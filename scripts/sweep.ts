import {purgeTrashedFixtures, RUN_LABEL, sweepRun, sweepStale} from '../test/e2e/fixtures.js'

// The three passes are independent, so a failure in one must not stop the
// others: each is attempted, its error recorded, and the script fails at the
// end if any of them did — the failure stays visible without leaving the rest
// of the sandbox uncleaned.
const failures: unknown[] = []

async function attempt(pass: () => Promise<void>): Promise<void> {
  try {
    await pass()
  } catch (error) {
    console.error(error)
    failures.push(error)
  }
}

// With E2E_RUN_ID set, this process shares a fixture label with the mocha run
// that just finished, so it can reclaim that run's fixtures directly. That is
// what covers a mocha killed before its `after` hooks ran — the job timeout in
// the CI workflow, or a local Ctrl-C — whose fixtures are far too young for
// sweepStale's one-hour cutoff to touch.
//
// sweepRun, not cleanupRun: this process created nothing, so the label is
// its only lead, and it keeps polling until the lagging CQL index stops
// turning up pages rather than trusting one lookup.
if (process.env.E2E_RUN_ID) {
  await attempt(async () => {
    const reclaimed = await sweepRun()
    console.log(`Cleaned up ${reclaimed} fixture(s) labelled "${RUN_LABEL}".`)
  })
}

await attempt(async () => {
  const deleted = await sweepStale()
  console.log(`Swept ${deleted} stale e2e fixture(s).`)
})

// Last, and unconditionally: pages the CLI created carry no fixture label and
// `conni content delete` only trashes them, so the label-driven passes above
// cannot see them at all.
await attempt(async () => {
  const purged = await purgeTrashedFixtures()
  console.log(`Purged ${purged} trashed e2e fixture(s).`)
})

if (failures.length > 0) {
  console.error(`Sweep failed: ${failures.length} of its cleanup passes threw.`)
  process.exitCode = 1
}
