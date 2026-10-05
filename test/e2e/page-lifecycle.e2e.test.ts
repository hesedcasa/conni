import {expect} from 'chai'

import {cleanupRun, deletePage, fixtureTitle, pageHttpStatus, RUN_ID, trackPage} from './fixtures.js'
import {createConfigDir, E2E_SPACE, eventually, isNumericId, removeConfigDir, runCli, runCliJson} from './helpers.js'

type PageData = {id: string; title: string; version?: {number: number}}
type PagePayload = {data: PageData; success: boolean}

describe('e2e: page lifecycle', () => {
  let configDir: string
  let pageId: string
  const title = fixtureTitle('lifecycle')

  before(async () => {
    configDir = await createConfigDir()
  })

  // The page is created by the CLI rather than seeded. trackPage stamps the
  // fixture labels onto it, so cleanupRun's lookup sees it even when a test
  // fails mid-suite; deletePage purges it by id — necessary even after the
  // delete test passed, because the CLI's own delete only moves the page to
  // the trash.
  after(async () => {
    try {
      if (pageId) await deletePage(pageId)
      await cleanupRun()
    } finally {
      await removeConfigDir(configDir)
    }
  })

  it('creates a page', async () => {
    const payload = await runCliJson<PagePayload>(
      [
        'conni',
        'content',
        'create',
        '--fields',
        `spaceKey=${E2E_SPACE}`,
        '--fields',
        `title=${title}`,
        '--fields',
        'body=original body',
      ],
      configDir,
    )

    expect(payload.success).to.be.true
    pageId = payload.data.id
    // Recorded and labelled before anything below can fail, so a failure here
    // still leaves the after() hooks able to reclaim the page.
    await trackPage(pageId)
    expect(payload.data.title).to.equal(title)
    expect(isNumericId(pageId), `create should return a numeric page id, got ${pageId}`).to.be.true
  })

  it('reads back what it created', async () => {
    const payload = await runCliJson<{data: {body: {storage: {value: string}}; title: string}; success: boolean}>(
      ['conni', 'content', pageId],
      configDir,
    )
    expect(payload.success).to.be.true
    expect(payload.data.title).to.equal(title)
    expect(payload.data.body.storage.value).to.contain('original body')
  })

  it('updates the title and body', async () => {
    const updated = `${title} (updated)`
    const payload = await runCliJson<PagePayload>(
      ['conni', 'content', 'update', pageId, '--fields', `title=${updated}`, '--fields', 'body=replaced body'],
      configDir,
    )
    expect(payload.success).to.be.true

    // The page GET is not read-after-write consistent: a read straight after a
    // successful update has come back with the previous title and body. Poll
    // rather than trusting one lookup; an update that never applied still
    // fails, as a timeout naming the last page seen.
    const read = await eventually(
      'the page read to reflect the update',
      () =>
        runCliJson<{data: {body: {storage: {value: string}}; title: string}}>(['conni', 'content', pageId], configDir),
      (result) =>
        result.data?.title === updated && (result.data?.body?.storage?.value?.includes('replaced body') ?? false),
    )
    expect(read.data.title).to.equal(updated)
    expect(read.data.body.storage.value).to.contain('replaced body')
    // The update replaces the body rather than appending to it.
    expect(read.data.body.storage.value).to.not.contain('original body')
  })

  it('bumps the version number on update', async () => {
    const before = await runCliJson<PagePayload>(['conni', 'content', pageId], configDir)
    const versionBefore = before.data.version?.number ?? 0

    const updated = await runCliJson<PagePayload>(
      ['conni', 'content', 'update', pageId, '--fields', `body=body at ${RUN_ID}`],
      configDir,
    )
    expect(updated.success, `update failed: ${JSON.stringify(updated)}`).to.be.true

    // Same read-after-write lag as above, seen here as the old version number.
    const after = await eventually(
      'the page read to reflect the bumped version',
      () => runCliJson<PagePayload>(['conni', 'content', pageId], configDir),
      (result) => (result.data?.version?.number ?? 0) > versionBefore,
    )
    expect(after.data.version?.number).to.be.greaterThan(versionBefore)
  })

  it('deletes the page', async () => {
    const payload = await runCliJson<{success: boolean}>(['conni', 'content', 'delete', pageId], configDir)
    expect(payload.success).to.be.true

    // Asserted through the REST API, not a CQL search: the search index lags
    // by seconds, so a search could still report the page as present. Even the
    // REST GET has answered 200 straight after a successful delete, so poll it.
    const status = await eventually(
      `page ${pageId} to read as gone`,
      () => pageHttpStatus(pageId),
      (code) => code === 404,
    )
    expect(status, `page ${pageId} should be gone, got HTTP ${status}`).to.equal(404)
  })

  it('reports a failure when deleting a page that is already gone', async () => {
    const {code, stdout} = await runCli(['conni', 'content', 'delete', pageId], configDir)
    expect(code).to.equal(0)

    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
  })
})
