import {expect} from 'chai'

import {cleanupRun, deletePage, fixtureTitle, pageHttpStatus, RUN_ID} from './fixtures.js'
import {createConfigDir, E2E_SPACE, isNumericId, removeConfigDir, runCli, runCliJson} from './helpers.js'

type PageData = {id: string; title: string; version?: {number: number}}
type PagePayload = {data: PageData; success: boolean}

describe('e2e: page lifecycle', () => {
  let configDir: string
  let pageId: string
  const title = fixtureTitle('lifecycle')

  before(async () => {
    configDir = await createConfigDir()
  })

  // The page is created by the CLI rather than seeded, so it carries no fixture
  // label and cleanupRun's lookup cannot see it. deletePage purges it by id —
  // necessary even after the delete test passed, because the CLI's own delete
  // only moves the page to the trash.
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
    expect(payload.data.title).to.equal(title)
    pageId = payload.data.id
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

    const read = await runCliJson<{data: {body: {storage: {value: string}}; title: string}}>(
      ['conni', 'content', pageId],
      configDir,
    )
    expect(read.data.title).to.equal(updated)
    expect(read.data.body.storage.value).to.contain('replaced body')
    // The update replaces the body rather than appending to it.
    expect(read.data.body.storage.value).to.not.contain('original body')
  })

  it('bumps the version number on update', async () => {
    const before = await runCliJson<PagePayload>(['conni', 'content', pageId], configDir)
    const versionBefore = before.data.version?.number ?? 0

    await runCliJson<PagePayload>(
      ['conni', 'content', 'update', pageId, '--fields', `body=body at ${RUN_ID}`],
      configDir,
    )

    const after = await runCliJson<PagePayload>(['conni', 'content', pageId], configDir)
    expect(after.data.version?.number).to.be.greaterThan(versionBefore)
  })

  it('deletes the page', async () => {
    const payload = await runCliJson<{success: boolean}>(['conni', 'content', 'delete', pageId], configDir)
    expect(payload.success).to.be.true

    // Asserted through the REST API, not a CQL search: the search index lags
    // by seconds, so a search could still report the page as present.
    const status = await pageHttpStatus(pageId)
    expect(status, `page ${pageId} should be gone, got HTTP ${status}`).to.equal(404)
  })

  it('reports a failure when deleting a page that is already gone', async () => {
    const {code, stdout} = await runCli(['conni', 'content', 'delete', pageId], configDir)
    expect(code).to.equal(0)

    const payload = JSON.parse(stdout) as {error: string; success: boolean}
    expect(payload.success).to.be.false
  })
})
