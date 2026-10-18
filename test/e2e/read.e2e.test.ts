import {expect} from 'chai'

import {cleanupRun, fixtureTitle, RUN_ID, seedPage, SHARED_LABEL} from './fixtures.js'
import {
  CQL_INDEX_BUDGET_MS,
  CQL_TEST_TIMEOUT_MS,
  createConfigDir,
  E2E_EMPTY_LABEL,
  E2E_SPACE,
  eventually,
  removeConfigDir,
  runCli,
  runCliJson,
} from './helpers.js'

type Page = {id: string; title: string}
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
    // No `type` assertion: the pages response carries no type field — id and
    // title are the identity proof.
  })

  it('finds the fixture through CQL', async () => {
    const payload = await eventually(
      `the CQL search to return page ${pageId}`,
      async () =>
        runCliJson<{data: SearchResults; success: boolean}>(['conni', 'content', 'search', runCql], configDir),
      (result) => result.data.results.some((page) => page.id === pageId),
      CQL_INDEX_BUDGET_MS,
    )

    expect(payload.success).to.be.true
    expect(payload.data.results.map((page) => page.id)).to.include(pageId)
  }).timeout(CQL_TEST_TIMEOUT_MS)

  it('honours --limit', async () => {
    // One poll over the unlimited/limited pair rather than two polls in a row,
    // so the test spends a single CQL budget. The unlimited search must see
    // both fixtures, making a --limit of 1 genuinely a truncation rather than
    // coincidentally the whole result set; and since the index is not
    // monotonic — a search straight after one that saw both fixtures has come
    // back empty — the limited search is retried with it until it sees
    // anything. A --limit that is ignored still fails the length assertion.
    const {limited, unlimited} = await eventually(
      'the unlimited CQL search to return both fixtures and the limited one a result',
      async () => {
        const unlimited = await runCliJson<{data: SearchResults; success: boolean}>(
          ['conni', 'content', 'search', runCql],
          configDir,
        )
        if (unlimited.data.results.length < 2) return {limited: undefined, unlimited}

        const limited = await runCliJson<{data: SearchResults; success: boolean}>(
          ['conni', 'content', 'search', runCql, '--limit', '1'],
          configDir,
        )
        return {limited, unlimited}
      },
      (result) => result.limited !== undefined && result.limited.data.results.length > 0,
      CQL_INDEX_BUDGET_MS,
    )
    expect(unlimited.data.results.length).to.be.at.least(2)
    expect(limited?.data.limit).to.equal(1)
    expect(limited?.data.results.length).to.equal(1)
  }).timeout(CQL_TEST_TIMEOUT_MS)

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

  it('lists the footer comments of the fixture page', async () => {
    // The freshly seeded fixture carries no comments, so an empty array is the
    // success shape; creating one would need write fixtures this suite lacks.
    const payload = await runCliJson<{data: {results: unknown[]}; success: boolean}>(
      ['conni', 'content', 'comment-list', pageId],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.results).to.be.an('array')
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
