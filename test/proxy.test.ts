import {expect} from 'chai'
import {EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher} from 'undici'

import {installProxyDispatcher} from '../src/proxy.js'

describe('installProxyDispatcher', () => {
  const originalEnv = {...process.env}

  // proxy-from-env consults each of these (preferring the lowercase form), so any
  // left set by the surrounding environment would leak into the assertions below.
  const proxyEnvKeys = [
    'ALL_PROXY',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'NO_PROXY',
    'npm_config_no_proxy',
    'npm_config_proxy',
    'npm_config_http_proxy',
    'npm_config_https_proxy',
  ]

  let originalDispatcher: ReturnType<typeof getGlobalDispatcher>

  beforeEach(() => {
    for (const key of proxyEnvKeys) {
      delete process.env[key]
      delete process.env[key.toLowerCase()]
    }

    originalDispatcher = getGlobalDispatcher()
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }

    Object.assign(process.env, originalEnv)

    // Leaving an EnvHttpProxyAgent installed would reroute every later fetch in
    // the test process, so hand the original dispatcher back.
    setGlobalDispatcher(originalDispatcher)
  })

  it('leaves the dispatcher alone when no proxy env var is set', () => {
    installProxyDispatcher('https://test.atlassian.net')

    expect(getGlobalDispatcher()).to.equal(originalDispatcher)
  })

  it('installs an EnvHttpProxyAgent when HTTPS_PROXY applies to the host', () => {
    process.env.HTTPS_PROXY = 'http://user:pass@proxy.example.com:8080'

    installProxyDispatcher('https://test.atlassian.net')

    expect(getGlobalDispatcher()).to.be.an.instanceOf(EnvHttpProxyAgent)
  })

  it('does not install when the host is excluded via NO_PROXY', () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080'
    process.env.NO_PROXY = 'test.atlassian.net'

    installProxyDispatcher('https://test.atlassian.net')

    expect(getGlobalDispatcher()).to.equal(originalDispatcher)
  })

  it('skips installation for an http:// host', () => {
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080'

    installProxyDispatcher('http://confluence.internal.example.com')

    expect(getGlobalDispatcher()).to.equal(originalDispatcher)
  })

  it('skips installation for a host without a parseable URL', () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080'

    installProxyDispatcher('test.atlassian.net')

    expect(getGlobalDispatcher()).to.equal(originalDispatcher)
  })

  it('installs only once even when called for several proxied hosts', () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080'

    installProxyDispatcher('https://test.atlassian.net')
    const installed = getGlobalDispatcher()
    installProxyDispatcher('https://other.atlassian.net')

    expect(getGlobalDispatcher()).to.equal(installed)
  })
})
