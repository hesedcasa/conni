import {expect} from 'chai'

import {
  cleanupRun,
  deletePage,
  findByLabel,
  pageHttpStatus,
  purgeTrashedFixtures,
  RUN_LABEL,
  seedPage,
  trashPage,
  waitForIndexed,
} from './fixtures.js'
import {eventually, isNumericId} from './helpers.js'

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

  it('purges only trashed pages that carry the fixture label', async () => {
    // A review finding, regression-tested: the trash sweep must never select a
    // page by title alone, because a human's page can plausibly be titled
    // "[e2e notes]". The imposter shares the fixture title shape exactly but
    // carries no labels — the empty metadata override replaces them wholesale —
    // so a title-matching sweep would purge it and a label-matching one cannot.
    const imposter = await seedPage({metadata: {}})
    const owned = await seedPage()
    await trashPage(imposter)
    await trashPage(owned)

    // The trash listing lags the DELETE by a beat (~2s observed), unlike the
    // rest of the REST API, which is immediate. Sweeping inside eventually()
    // rather than after a fixed sleep: the sweep is idempotent and purges
    // nothing until the listing catches up, so retrying it is the natural way
    // to wait, and a listing that lags longer than usual cannot flake the test.
    const result = await eventually(
      'the labelled fixture to be purged from the trash',
      async () => {
        // Sweep first, check second: the confirming attempt must be the one
        // that did the purging, or its count reads zero.
        const purged = await purgeTrashedFixtures()
        return {gone: (await pageHttpStatus(`${owned}?status=trashed`)) === 404, purged}
      },
      (value) => value.gone,
    )
    expect(result.purged, 'the labelled page at least must have been purged').to.be.at.least(1)

    expect(await pageHttpStatus(`${imposter}?status=trashed`), 'unlabelled look-alike must stay in the trash').to.equal(
      200,
    )

    // The imposter is ours to clean up too — we made it — now that the sweep
    // has proved it leaves it alone.
    await deletePage(imposter)
  })
})
