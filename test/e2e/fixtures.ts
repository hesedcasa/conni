import {Buffer} from 'node:buffer'
import {randomBytes} from 'node:crypto'

import {E2E_SPACE, requireEnv} from './helpers.js'

/**
 * One token per mocha process, so concurrent runs never delete each other's
 * fixtures.
 *
 * E2E_RUN_ID overrides it so a *separate* process can address this run's
 * fixtures by label — `scripts/e2e.sh` and the CI workflow both set it, which
 * is what lets their post-run sweep reclaim fixtures a killed mocha never got
 * to clean up.
 */
export const RUN_ID = process.env.E2E_RUN_ID || randomBytes(4).toString('hex')
export const RUN_LABEL = `e2e-run-${RUN_ID}`
/** Carried by every fixture ever created, so a crashed run can be reclaimed later. */
export const SHARED_LABEL = 'e2e-cli'

/** Both labels, in the shape Confluence's create-content endpoint expects. */
const LABEL_METADATA = [SHARED_LABEL, RUN_LABEL].map((name) => ({name, prefix: 'global'}))

type ConfluenceResponse = {body: unknown; status: number}

/**
 * Page ids created by this process, as a fallback for `cleanupRun`.
 *
 * Confluence's CQL index is asynchronous — a fixture took as long as 14 seconds
 * to become searchable — so a CQL lookup alone can miss a page created moments
 * earlier and silently leave it behind.
 */
const created = new Set<string>()

/**
 * Confluence requires page titles to be unique within a space, so every
 * generated title gets its own suffix. A bare counter would collide across the
 * two processes that share a RUN_ID (mocha and the sweep), so it is seeded
 * randomly per process.
 */
let titleCounter = 0

async function call(method: string, endpoint: string, body?: unknown): Promise<ConfluenceResponse> {
  const {apiToken, email, host} = requireEnv()
  const authorization = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`

  const response = await fetch(host + endpoint, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {accept: 'application/json', authorization, 'content-type': 'application/json'},
    method,
  })

  const text = await response.text()
  return {body: text ? JSON.parse(text) : null, status: response.status}
}

/**
 * Builds a title that is unique within the space.
 *
 * @param prefix A short human-readable hint about what the fixture is for.
 * @returns A title carrying the run id and a per-process counter.
 */
export function fixtureTitle(prefix: string): string {
  titleCounter += 1
  return `[e2e ${RUN_ID}] ${prefix} ${titleCounter}-${randomBytes(2).toString('hex')}`
}

/**
 * The per-run parent page every fixture is nested under, created on first use.
 *
 * Memoised as a promise rather than an id so concurrent seeds share one
 * in-flight request instead of racing to create two parents — Confluence would
 * reject the second on the unique-title constraint.
 */
let parentPage: Promise<string> | undefined
/** The resolved id of the above, so `deletePage` can recognise the parent. */
let parentPageId: string | undefined

/**
 * Forgets the memoised parent page, so the next seed creates a fresh one.
 *
 * The parent carries the run label, which means cleanup deletes it along with
 * everything else. Without this, a suite that cleans up and then seeds again
 * would point new pages at a purged ancestor and get a 404.
 */
function forgetParentPage(): void {
  parentPage = undefined
  parentPageId = undefined
}

/**
 * Creates a page in the fixture space via the REST API directly.
 *
 * Fixtures are never created through the CLI: they are the oracle the CLI is
 * checked against, so they must not share its code path.
 *
 * @param overrides Extra or replacement content fields, e.g. a `title` or `body`.
 * @param extraLabels Labels to add on top of the two every fixture carries.
 *   Pass a suite-specific label when the suite makes CQL assertions: the shared
 *   run label is churned by every other suite's cleanup, and a search racing
 *   those deletions is the flakiest thing in this suite.
 * @returns The created page id.
 * @throws {Error} If Confluence rejects the request.
 */
export async function seedPage(overrides: Record<string, unknown> = {}, extraLabels: string[] = []): Promise<string> {
  const ancestorId = await ensureParentPage()

  const {body, status} = await call('POST', '/wiki/rest/api/content', {
    ancestors: [{id: ancestorId}],
    body: {storage: {representation: 'storage', value: '<p>e2e fixture</p>'}},
    metadata: {labels: [...LABEL_METADATA, ...extraLabels.map((name) => ({name, prefix: 'global'}))]},
    space: {key: E2E_SPACE},
    title: fixtureTitle('fixture'),
    type: 'page',
    ...overrides,
  })

  // The create endpoint answers 200, not the 201 the REST conventions suggest.
  if (status !== 200 && status !== 201) {
    throw new Error(`seedPage failed: ${status} ${JSON.stringify(body)}`)
  }

  const {id} = body as {id: string}
  created.add(id)
  return id
}

/**
 * Creates (once per process) the parent page fixtures are nested under.
 *
 * It carries the same labels as its children, so `cleanupRun` and `sweepStale`
 * reclaim it without needing to know it is special.
 *
 * @returns The parent page id.
 * @throws {Error} If Confluence rejects the request.
 */
async function ensureParentPage(): Promise<string> {
  parentPage ??= (async () => {
    const {body, status} = await call('POST', '/wiki/rest/api/content', {
      body: {storage: {representation: 'storage', value: '<p>Fixtures for one e2e run. Safe to delete.</p>'}},
      metadata: {labels: LABEL_METADATA},
      space: {key: E2E_SPACE},
      title: `[e2e ${RUN_ID}] fixtures`,
      type: 'page',
    })

    if (status !== 200 && status !== 201) {
      throw new Error(`ensureParentPage failed: ${status} ${JSON.stringify(body)}`)
    }

    const {id} = body as {id: string}
    created.add(id)
    parentPageId = id
    return id
  })()

  return parentPage
}

/**
 * Searches for pages carrying a label.
 *
 * Always scoped to E2E_SPACE. Both `cleanupRun` and `sweepStale` are
 * destructive queries driven by ambient environment variables (a label and an
 * age cutoff) with no other guard, so scoping every lookup to the fixture space
 * here — structurally, once — bounds their blast radius to that one space
 * instead of every space the credentials can see.
 *
 * Every value is quoted: Confluence answers an unquoted `space=Sidekick` with a
 * parse error and no `size` field at all, which an unguarded caller would read
 * as "nothing matched".
 *
 * @param label The exact label to match.
 * @param extraCql Optional additional CQL, ANDed onto the label clause.
 * @returns The matching page ids.
 * @throws {Error} If Confluence rejects the search.
 */
export async function findByLabel(label: string, extraCql = ''): Promise<string[]> {
  const cql = `space="${E2E_SPACE}" AND label="${label}"${extraCql ? ` AND (${extraCql})` : ''}`
  const limit = 100
  const ids: string[] = []

  // Every page, not just the first: a caller that stopped at 100 would delete
  // one page of fixtures and report success, leaving the rest in the sandbox.
  for (let start = 0; ; start += limit) {
    const query = new URLSearchParams({cql, limit: String(limit), start: String(start)})
    // eslint-disable-next-line no-await-in-loop
    const {body, status} = await call('GET', `/wiki/rest/api/content/search?${query.toString()}`)

    if (status !== 200) {
      throw new Error(`findByLabel failed: ${status} ${JSON.stringify(body)}`)
    }

    const page = body as {results?: Array<{id: string}>}
    const results = page.results ?? []
    ids.push(...results.map((result) => result.id))

    // A short page is the last page.
    if (results.length < limit) return ids
  }
}

/**
 * How many consecutive polls must agree before the index is believed.
 *
 * Confluence's CQL index is not monotonic: a freshly created page was observed
 * appearing at t+2s, *absent again* at t+4s, and only stable from t+5s. A
 * single sighting therefore proves nothing, and a caller that acted on one
 * would race the very flicker this guards against.
 */
const STABLE_POLLS = 3

/**
 * Polls until specific pages are stably visible to CQL.
 *
 * Takes ids rather than a count because a count cannot say *which* pages it
 * saw: every fixture shares the run label with the parent page they hang off,
 * so `expected = 1` was satisfied by the parent alone while the page the caller
 * actually cared about was still unindexed.
 *
 * @param label The label to search for.
 * @param ids The page ids that must all be visible.
 * @returns The ids seen on the final, confirming poll.
 * @throws {Error} If the deadline passes first — a silent return would let a
 *   `before` hook "succeed" with nothing indexed and defer the real failure
 *   into a confusing assertion error later.
 */
export async function waitForIndexed(label: string, ids: string[]): Promise<string[]> {
  const deadline = Date.now() + 60_000
  let seen: string[] = []
  let streak = 0

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const found = await findByLabel(label)
    seen = found
    streak = ids.every((id) => found.includes(id)) ? streak + 1 : 0
    if (streak >= STABLE_POLLS) return found

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })
  }

  const missing = ids.filter((id) => !seen.includes(id))
  throw new Error(
    `waitForIndexed: page(s) ${missing.join(', ')} never became stably visible under label "${label}"; ` +
      `last saw [${seen.join(', ')}]`,
  )
}

/**
 * Reads a page's HTTP status straight from the REST API.
 *
 * An existence check that does not go through CQL, so it is not subject to the
 * search index's lag — 404 means gone, right now.
 *
 * @param id The page id.
 * @returns The status code: 200 if the page is there, 404 once it is gone.
 */
export async function pageHttpStatus(id: string): Promise<number> {
  const {status} = await call('GET', `/wiki/rest/api/content/${id}`)
  return status
}

/**
 * Deletes a page, tolerating one that is already gone.
 *
 * Confluence's delete is two-phase: the first call moves the page to the
 * space's trash, and only `?status=trashed` purges it. Stopping at the first
 * would leave every nightly run's fixtures piling up in the trash, still
 * counting against the space and still visible to anyone browsing it.
 *
 * Purging a parent cascades to its children, so a child deleted afterwards
 * answers 404 — tolerated here rather than treated as a failure.
 *
 * @param id The page id.
 * @throws {Error} If either phase fails for a reason other than "already gone".
 */
export async function deletePage(id: string): Promise<void> {
  const trashed = await call('DELETE', `/wiki/rest/api/content/${id}`)
  if (trashed.status !== 204 && trashed.status !== 404) {
    throw new Error(`deletePage ${id} failed to trash: ${trashed.status} ${JSON.stringify(trashed.body)}`)
  }

  const purged = await call('DELETE', `/wiki/rest/api/content/${id}?status=trashed`)
  if (purged.status !== 204 && purged.status !== 404) {
    throw new Error(`deletePage ${id} failed to purge: ${purged.status} ${JSON.stringify(purged.body)}`)
  }

  created.delete(id)
  if (id === parentPageId) {
    forgetParentPage()
  }
}

/**
 * Deletes every page in `ids`, tolerating individual failures until all
 * deletions have been attempted, then throwing if any actually failed.
 *
 * Promise.all would abandon the remaining deletions on the first rejection;
 * allSettled ensures a single stuck page never masks failures to delete the
 * rest.
 *
 * @param ids The page ids to delete.
 * @throws {Error} If any deletion failed.
 */
async function deleteAll(ids: string[]): Promise<void> {
  const results = await Promise.allSettled(ids.map((id) => deletePage(id)))
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failures.length > 0) {
    throw new Error(
      `deleteAll: ${failures.length}/${ids.length} deletion(s) failed: ${failures.map((f) => String(f.reason)).join('; ')}`,
    )
  }
}

/**
 * Deletes every fixture created by this process.
 *
 * Unions the CQL lookup with the ids `seedPage` recorded, because indexing lags
 * creation by seconds: a suite that seeds a page and then cleans up immediately
 * would otherwise find nothing and orphan it. The CQL half still matters — with
 * E2E_RUN_ID set, a sweep running in a different process than mocha has an
 * empty `created` set and the label is all it has to go on.
 */
export async function cleanupRun(): Promise<void> {
  const indexed = await findByLabel(RUN_LABEL)
  try {
    await deleteAll([...new Set([...indexed, ...created])])
  } finally {
    // In a `finally` because a partial failure still leaves the parent's fate
    // unknown: re-seeding against a possibly-purged ancestor would fail with a
    // confusing 404 instead of the deletion error worth reporting.
    forgetParentPage()
  }
}

/**
 * Title prefix shared by every page this suite creates, seeded or CLI-made.
 *
 * `fixtureTitle` is the only way test pages get named, so this is a reliable
 * second guard alongside the space scope when labels are unavailable.
 */
const FIXTURE_TITLE_PREFIX = '[e2e '

/**
 * Purges e2e pages sitting in the fixture space's trash.
 *
 * The label-driven cleanup cannot reach these. Pages created through
 * `conni content create` carry no fixture label, and `conni content delete` is
 * single-phase — it trashes but never purges — so without this they pile up in
 * the trash indefinitely, invisible to CQL but still there.
 *
 * Doubly guarded: the listing is scoped to the fixture space, and only titles
 * carrying the fixture prefix are purged, so nothing a human trashed is at risk.
 *
 * @returns How many pages were purged.
 * @throws {Error} If the trash listing fails.
 */
export async function purgeTrashedFixtures(): Promise<number> {
  const limit = 100
  const ids: string[] = []

  for (let start = 0; ; start += limit) {
    const query = new URLSearchParams({
      limit: String(limit),
      spaceKey: E2E_SPACE,
      start: String(start),
      status: 'trashed',
    })
    // eslint-disable-next-line no-await-in-loop
    const {body, status} = await call('GET', `/wiki/rest/api/content?${query.toString()}`)

    if (status !== 200) {
      throw new Error(`purgeTrashedFixtures failed: ${status} ${JSON.stringify(body)}`)
    }

    const page = body as {results?: Array<{id: string; title: string}>}
    const results = page.results ?? []
    ids.push(...results.filter((result) => result.title.startsWith(FIXTURE_TITLE_PREFIX)).map((result) => result.id))

    if (results.length < limit) break
  }

  // Already trashed, so only the purge phase is left; deletePage tolerates the
  // 404 its first phase gets back.
  await deleteAll(ids)
  return ids.length
}

/**
 * Deletes fixtures older than an hour, left behind by a crashed run.
 *
 * The age filter is what makes this safe to run while another suite is in
 * flight: it can only ever reclaim fixtures no live run still owns.
 *
 * @returns How many pages were deleted.
 */
export async function sweepStale(): Promise<number> {
  const ids = await findByLabel(SHARED_LABEL, 'created <= now("-1h")')
  await deleteAll(ids)
  return ids.length
}
