import {getProxyForUrl} from 'proxy-from-env'
import {EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher} from 'undici'

/**
 * confluence.js's HTTP transport is the global fetch, which — unlike axios —
 * ignores HTTP(S)_PROXY env vars entirely. MITM-style proxies that require
 * CONNECT for https:// upstreams (e.g. Agent Vault) therefore receive no traffic
 * at all unless a proxy-aware dispatcher is installed. EnvHttpProxyAgent honors
 * HTTP_PROXY/HTTPS_PROXY/NO_PROXY per request and CONNECT-tunnels https
 * targets, which is exactly the behavior the old axios httpsAgent workaround
 * existed to provide.
 *
 * The dispatcher is process-global: sdkck runs sibling plugins in the same
 * process, so every fetch is routed through it once installed. EnvHttpProxyAgent
 * only proxies requests whose env vars say so, and NO_PROXY keeps hosts
 * opt-out safe, which makes the global side effect benign.
 *
 * The workaround only engages for https:// targets, mirroring the old guard:
 * Confluence hosts are https, and skipping installation when no proxy applies
 * leaves unrelated fetch traffic untouched.
 */
export function installProxyDispatcher(host: string): void {
  if (!isHttpsTarget(host)) return
  // getProxyForUrl returns '' (and undefined in odd cases) when no proxy applies.
  if (!getProxyForUrl(host)) return
  if (getGlobalDispatcher() instanceof EnvHttpProxyAgent) return

  setGlobalDispatcher(new EnvHttpProxyAgent())
}

function isHttpsTarget(host: string): boolean {
  try {
    return new URL(host).protocol === 'https:'
  } catch {
    return false
  }
}
