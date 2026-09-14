import {expect} from 'chai'

import {createConfigDir, redactSecret, removeConfigDir, requireEnv, runCli, runCliJson} from './helpers.js'

type Failure = {error: string; success: false}

describe('e2e: connection', () => {
  let configDir: string

  before(async () => {
    configDir = await createConfigDir()
  })

  after(async () => {
    await removeConfigDir(configDir)
  })

  it('authenticates with the default profile', async () => {
    const {code, stderr} = await runCli(['conni', 'auth', 'test'], configDir)
    expect(code).to.equal(0)
    // `auth test` is a plugin-lib command that reports progress rather than
    // returning an ApiResult, so there is no JSON payload to assert on.
    expect(stderr).to.contain('successful')
  })

  it('reaches Confluence with the default profile', async () => {
    const payload = await runCliJson<{data: unknown; success: boolean}>(['conni', 'space', 'list'], configDir)
    expect(payload.success).to.be.true
    expect(payload.data).to.be.an('array')
  })

  it('fails `auth test` with an invalid token', async () => {
    const {code} = await runCli(['conni', 'auth', 'test', '-p', 'broken'], configDir)
    // plugin-lib's auth commands exit 2, unlike the ApiResult-returning
    // commands below. Asserting the code rather than the message: the sandbox
    // account's Confluence language is not guaranteed to be English.
    expect(code).to.equal(2)
  })

  it('surfaces the real API error for an invalid token, on exit code 0', async () => {
    const {code, stdout} = await runCli(['conni', 'space', 'list', '-p', 'broken'], configDir)

    // Exit 0 is not an oversight here, it is the documented shape of this CLI:
    // ConniApi never throws, run() returns the ApiResult, and oclif serialises
    // it as a successful command. Callers branch on `success`, never on $?.
    expect(code, 'API-level failures ride on exit 0; branch on `success`').to.equal(0)

    const payload = JSON.parse(stdout) as Failure
    expect(payload.success).to.be.false
    // The status code, not the prose around it — Confluence translates messages.
    expect(payload.error).to.contain('403')
  })

  it('fails with exit 1 when the profile does not exist', async () => {
    const {code, stdout} = await runCli(['conni', 'space', 'list', '-p', 'nosuch'], configDir)
    // A missing profile is caught by this.error() before any request is made,
    // so unlike an API failure it does exit non-zero.
    expect(code).to.equal(1)

    const payload = JSON.parse(stdout) as {error: string}
    expect(payload.error).to.contain('Missing authentication config')
    // BaseCommand.toErrorJson() reduces errors to {error}; oclif's default
    // would leak the whole config via CLIParseError.context.
    expect(Object.keys(payload)).to.deep.equal(['error'])
  })

  it('redacts the API token from failure output', () => {
    const {apiToken} = requireEnv()
    const line = `apiToken: ${apiToken}`

    expect(redactSecret(line, apiToken)).to.equal('apiToken: <redacted>')
    expect(redactSecret(line, apiToken)).to.not.contain(apiToken)
  })

  it('leaves text untouched when there is no secret to redact', () => {
    // An empty needle would otherwise turn replaceAll into a full-string
    // redaction, silently scrubbing output that holds no secret at all.
    expect(redactSecret('nothing to hide', '')).to.equal('nothing to hide')
    expect(redactSecret('nothing to hide', undefined)).to.equal('nothing to hide')
  })
})
