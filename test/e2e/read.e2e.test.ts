import {expect} from 'chai'

import {cleanupRun, fixtureTitle, RUN_ID, seedPage, SHARED_LABEL} from './fixtures.js'
import {
  createConfigDir,
  E2E_EMPTY_LABEL,
  E2E_SPACE,
  eventually,
  removeConfigDir,
  runCli,
  runCliJson,
} from './helpers.js'

type Page = {id: string; title: string; type: string}
type SearchResults = {limit: number; results: Page[]; size: number; start: number}
type Space = {key: string; name: string; type: string}

describe('e2e: read operations', () => {
  // A label private to this suite. The shared run label is deleted out from
  // under us by every other suite's cleanupRun, and a CQL search racing those
  // deletions through an eventually-consistent index is pure flake.
  const suiteLabel = `e2e-read-${RUN_ID}`
  const runCql = `space="${E2E_SPACE}" AND label="${suiteLabel}"`
  let configDir: string
  let pageId: string
  let pageTitle: string

  before(async () => {
    configDir = await createConfigDir()
    pageTitle = fixtureTitle('read')
    pageId = await seedPage({title: pageTitle}, [suiteLabel])
    // A second fixture so the --limit test below has something to truncate.
    await seedPage({}, [suiteLabel])
  })

  after(async () => {
    try {
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
    }
  })

  it('lists spaces', async () => {
    const payload = await runCliJson<{data: Space[]; success: boolean}>(['conni', 'space', 'list'], configDir)
    expect(payload.success).to.be.true
    expect(payload.data.map((space) => space.key)).to.include(E2E_SPACE)
  })

  it('gets a single space by key', async () => {
    const payload = await runCliJson<{data: Space; success: boolean}>(['conni', 'space', E2E_SPACE], configDir)
    expect(payload.success).to.be.true
    expect(payload.data.key).to.equal(E2E_SPACE)
    expect(payload.data.type).to.equal('collaboration')
  })

  it('gets a page by id', async () => {
    const payload = await runCliJson<{data: Page; success: boolean}>(['conni', 'content', pageId], configDir)
    expect(payload.success).to.be.true
    expect(payload.data.id).to.equal(pageId)
    expect(payload.data.title).to.equal(pageTitle)
    expect(payload.data.type).to.equal('page')
  })

  it('finds the fixture through CQL', async () => {
    const payload = await eventually(
      `the CQL search to return page ${pageId}`,
      async () =>
        runCliJson<{data: SearchResults; success: boolean}>(['conni', 'content', 'search', runCql], configDir),
      (result) => result.data.results.some((page) => page.id === pageId),
    )

    expect(payload.success).to.be.true
    expect(payload.data.results.map((page) => page.id)).to.include(pageId)
  })

  it('honours --limit', async () => {
    // Wait until the unlimited search sees both fixtures, so a --limit of 1 is
    // genuinely a truncation rather than coincidentally the whole result set.
    const unlimited = await eventually(
      'the CQL search to return both fixtures',
      async () =>
        runCliJson<{data: SearchResults; success: boolean}>(['conni', 'content', 'search', runCql], configDir),
      (result) => result.data.results.length >= 2,
    )
    expect(unlimited.data.results.length).to.be.at.least(2)

    const limited = await runCliJson<{data: SearchResults; success: boolean}>(
      ['conni', 'content', 'search', runCql, '--limit', '1'],
      configDir,
    )
    expect(limited.data.limit).to.equal(1)
    expect(limited.data.results.length).to.equal(1)
  })

  it('returns an empty result set rather than failing when nothing matches', async () => {
    const payload = await runCliJson<{data: SearchResults; success: boolean}>(
      ['conni', 'content', 'search', `space="${E2E_SPACE}" AND label="${E2E_EMPTY_LABEL}"`],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.results).to.deep.equal([])
    expect(payload.data.size).to.equal(0)
  })

  it('reports a CQL syntax error instead of an empty result set', async () => {
    // The distinction that matters: a malformed query must not look like
    // "nothing matched". Unquoted values are the easy way to trip this.
    const {code, stdout} = await runCli(
      ['conni', 'content', 'search', `space=${E2E_SPACE} AND label=${SHARED_LABEL}`],
      configDir,
    )
    expect(code).to.equal(0)

    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
    expect(payload.error.toLowerCase()).to.contain('cql')
  })

  it('reports a missing page rather than returning empty data', async () => {
    const {stdout} = await runCli(['conni', 'content', '999999999'], configDir)
    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
    expect(payload.error).to.contain('999999999')
  })

  it('formats output as TOON when asked', async () => {
    const {code, stdout} = await runCli(['conni', 'space', 'list', '--toon'], configDir)
    expect(code).to.equal(0)

    // TOON is a tabular rendering, so the JSON braces must be gone and the
    // header row present. jsonEnabled() returns false here, which is what
    // suppresses the default JSON serialisation.
    expect(stdout).to.contain('data[')
    expect(stdout).to.contain('success: true')
    expect(stdout.trimStart().startsWith('{'), 'TOON output must not also emit JSON').to.be.false
  })
})
