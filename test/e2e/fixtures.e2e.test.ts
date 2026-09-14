import {expect} from 'chai'

import {cleanupRun, deletePage, findByLabel, pageHttpStatus, RUN_LABEL, seedPage, waitForIndexed} from './fixtures.js'
import {isNumericId} from './helpers.js'

describe('e2e: fixtures', () => {
  after(async () => {
    await cleanupRun()
  })

  it('seeds a page that is findable by its run label, then cleans up', async () => {
    const id = await seedPage()
    expect(isNumericId(id), `seedPage should return a numeric page id, got ${id}`).to.be.true

    const found = await waitForIndexed(RUN_LABEL, [id])
    expect(found).to.include(id)

    await cleanupRun()

    const afterCleanup = await findByLabel(RUN_LABEL)
    expect(afterCleanup).to.not.include(id)
  })

  it('cleans up a fixture created too recently to be indexed', async () => {
    // No waitForIndexed here: that is the point. cleanupRun runs while the page
    // is still invisible to CQL, so only the created-id tracking can reclaim
    // it. Asserting through the API rather than a search, since a search would
    // be subject to the same indexing lag.
    const id = await seedPage()
    await cleanupRun()

    const status = await pageHttpStatus(id)
    expect(status, `${id} should be gone, got HTTP ${status}`).to.equal(404)
  })

  it('purges rather than only trashing, so the page never lingers in the trash', async () => {
    const id = await seedPage()
    await deletePage(id)

    // A trashed-but-not-purged page also answers 404 on a plain GET, so that
    // alone would not distinguish the two. Asking for it *as* trashed content
    // is what separates them: 404 here means it really was purged.
    const status = await pageHttpStatus(`${id}?status=trashed`)
    expect(status, `${id} should be purged, not just trashed`).to.equal(404)
  })

  it('tolerates deleting a page twice', async () => {
    const id = await seedPage()
    await deletePage(id)
    await deletePage(id)
  })
})
