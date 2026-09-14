import {expect} from 'chai'
import {execFile} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'

const execFileAsync = promisify(execFile)

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CLI = path.join(REPO_ROOT, 'bin', 'run.js')

/**
 * The space every fixture is created in.
 *
 * Its four template pages are not in Confluence's CQL index, so a CQL search
 * scoped to this space only ever sees content this suite created.
 */
export const E2E_SPACE = 'Sidekick'

/**
 * A label no page carries, giving empty-result assertions a stable target.
 *
 * Confluence has no equivalent of an empty Jira project to point at, and a
 * whole space reserved for emptiness would be one more thing to provision.
 */
export const E2E_EMPTY_LABEL = 'e2e-label-that-matches-nothing'

export type CliResult = {
  code: number
  stderr: string
  stdout: string
}

/**
 * Reads the sandbox credentials from the environment.
 *
 * Nothing in this repo loads .env, so these must already be exported.
 *
 * @returns The host, email and API token.
 * @throws {Error} If any of the three variables is missing.
 */
export function requireEnv(): {apiToken: string; email: string; host: string} {
  const apiToken = process.env.ATLASSIAN_API_TOKEN
  const email = process.env.ATLASSIAN_EMAIL
  const host = process.env.ATLASSIAN_URL

  if (!apiToken || !email || !host) {
    throw new Error(
      'Missing ATLASSIAN_URL, ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN. ' +
        'Nothing in this repo loads .env — run: set -a; . ./.env; set +a',
    )
  }

  return {apiToken, email, host: host.endsWith('/') ? host.slice(0, -1) : host}
}

/**
 * Writes a throwaway oclif config dir holding a `default` profile pointing at
 * the sandbox and a `broken` profile whose API token is invalid.
 *
 * Credentials are written as literals rather than `env:` references so the
 * suite never depends on a secret backend being reachable.
 *
 * @returns Absolute path to the config dir, to be passed as CONNI_CONFIG_DIR.
 */
export async function createConfigDir(): Promise<string> {
  const {apiToken, email, host} = requireEnv()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'conni-e2e-'))
  const profile = {apiToken, email, host}

  await fs.writeFile(
    path.join(dir, 'conni-config.json'),
    JSON.stringify(
      {
        defaultProfile: 'default',
        profiles: {
          broken: {...profile, apiToken: 'definitely-not-the-token'},
          default: profile,
        },
      },
      null,
      2,
    ),
    {mode: 0o600},
  )

  return dir
}

/**
 * Removes a config dir written by createConfigDir().
 *
 * @param dir The directory to remove.
 */
export async function removeConfigDir(dir: string): Promise<void> {
  await fs.rm(dir, {force: true, recursive: true})
}

/**
 * Whether `value` is a non-empty run of ASCII digits, as Confluence page and
 * comment ids are.
 *
 * Written with string methods rather than a regex on purpose: eslint's
 * `require-unicode-regexp` is configured to demand the `v` flag, and the `v`
 * flag needs TS target es2024 while this repo targets es2022 — so eslint and
 * tsc contradict each other on any regex literal under test/**.
 *
 * @param value The string to check.
 * @returns True if `value` is all digits and not empty.
 */
export function isNumericId(value: string): boolean {
  return value.length > 0 && [...value].every((char) => char >= '0' && char <= '9')
}

/**
 * Runs the built CLI (`bin/run.js`) as a real subprocess against the sandbox.
 *
 * Non-zero exits are returned rather than thrown so tests can assert on
 * failure paths. Note that `bin/run.js` takes the `conni` topic once
 * (`['conni', 'space', 'list']`); only the published binary doubles it.
 *
 * @param args Command line arguments, e.g. ['conni', 'space', 'list'].
 * @param configDir Value for CONNI_CONFIG_DIR, from createConfigDir().
 * @returns The exit code and captured stdout/stderr.
 */
export async function runCli(args: string[], configDir: string): Promise<CliResult> {
  try {
    const {stderr, stdout} = await execFileAsync(process.execPath, [CLI, ...args], {
      env: {...process.env, CONNI_CONFIG_DIR: configDir, FORCE_COLOR: '0', NO_COLOR: '1'},
      maxBuffer: 32 * 1024 * 1024,
    })
    return {code: 0, stderr, stdout}
  } catch (error: unknown) {
    const failure = error as {code?: number; stderr?: string; stdout?: string}
    return {code: failure.code ?? 1, stderr: failure.stderr ?? '', stdout: failure.stdout ?? ''}
  }
}

/**
 * Replaces every occurrence of `secret` in `text` with `<redacted>`.
 *
 * A missing/empty secret is a no-op rather than matching everything — an empty
 * needle would otherwise turn `replaceAll` into a full-string redaction.
 *
 * Exported (rather than a private helper) so it can be exercised directly by a
 * unit-style test without invoking a command whose output carries a real token,
 * such as `conni auth list`.
 *
 * @param text Captured stdout/stderr that may contain the secret.
 * @param secret The value to scrub; falsy values leave `text` untouched.
 * @returns `text` with every occurrence of `secret` replaced.
 */
export function redactSecret(text: string, secret: string | undefined): string {
  return secret ? text.replaceAll(secret, '<redacted>') : text
}

/**
 * Reads the API token for redaction purposes only.
 *
 * Swallows the "missing credentials" error from requireEnv() so a call site
 * with no env configured still gets a (no-op) redaction rather than a throw.
 *
 * @returns The API token, or undefined if the environment isn't configured.
 */
function redactionToken(): string | undefined {
  try {
    return requireEnv().apiToken
  } catch {
    return undefined
  }
}

/**
 * Runs the CLI and fails the test if it exited non-zero.
 *
 * The failure message redacts the API token from stdout/stderr before it is
 * interpolated, so a failing `conni auth …` call never prints the real token
 * into mocha's failure output or CI logs. The returned `CliResult` itself is
 * left unredacted — tests need the real values to assert on.
 *
 * @param args Command line arguments.
 * @param configDir Value for CONNI_CONFIG_DIR.
 * @returns The successful result.
 */
export async function runCliOk(args: string[], configDir: string): Promise<CliResult> {
  const result = await runCli(args, configDir)
  const secret = redactionToken()
  const stdout = redactSecret(result.stdout, secret)
  const stderr = redactSecret(result.stderr, secret)
  expect(result.code, `\`conni ${args.join(' ')}\` failed:\n${stdout}\n${stderr}`).to.equal(0)
  return result
}

/**
 * Retries `attempt` until `predicate` accepts its result, or the deadline passes.
 *
 * Confluence's CQL index is eventually consistent *and* not monotonic — a page
 * was observed appearing, disappearing, then settling — so asserting once that
 * a search finds a freshly created page is a race no amount of up-front waiting
 * reliably wins. Polling the assertion itself is the honest shape: a CLI that
 * genuinely could not search would never satisfy the predicate and the deadline
 * would fire with a message naming what was expected.
 *
 * @param description What is being waited for, used in the timeout message.
 * @param attempt The operation to retry.
 * @param predicate Returns true once the result is the expected one.
 * @param timeoutMs How long to keep trying.
 * @returns The first accepted result.
 * @throws {Error} If the deadline passes before the predicate is satisfied.
 */
export async function eventually<T>(
  description: string,
  attempt: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last: T | undefined

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    last = await attempt()
    if (predicate(last)) return last

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })
  }

  throw new Error(
    `eventually: timed out after ${timeoutMs}ms waiting for ${description}; last saw ${JSON.stringify(last)}`,
  )
}

/**
 * Runs the CLI and parses stdout as JSON.
 *
 * JSON is the default output mode (BaseCommand.jsonEnabled()), and `--json` is
 * not a declared flag — do not add one.
 *
 * @param args Command line arguments.
 * @param configDir Value for CONNI_CONFIG_DIR.
 * @returns The parsed JSON payload.
 */
export async function runCliJson<T = unknown>(args: string[], configDir: string): Promise<T> {
  const {stdout} = await runCliOk(args, configDir)
  return JSON.parse(stdout) as T
}
