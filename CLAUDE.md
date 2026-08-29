# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**conni** is an Oclif-based CLI for the Confluence REST API, published as `@hesed/conni` and installed as an `sdkck` plugin. It covers pages, spaces, comments, labels, and attachments.

Because the package declares `"bin": {"conni": ...}` _and_ an oclif topic named `conni`, real invocations are doubled: `conni conni content 12345`. In development, `./bin/dev.js` is the binary, so the topic appears once: `./bin/dev.js conni content 12345`.

## Development Commands

```bash
npm run build            # shx rm -rf dist && tsc -b
npm test                 # mocha --forbid-only "test/**/*.test.ts"  (posttest runs lint)
npm run test:coverage    # c8, thresholds at 50% lines/functions/branches/statements
npm run lint
npm run format           # eslint --fix, then prettier --write
npm run find-deadcode    # ts-prune, ignoring (run|default)
```

Run a single test file — note `.mocharc.json` supplies the ts-node ESM loader, so plain `npx mocha` works:

```bash
npx mocha test/commands/conni/content/get.test.ts
```

Exercise a command against a real instance during development:

```bash
./bin/dev.js conni content search 'space=DEV AND title ~ "Error saving file"'
```

`npm ci` pulls the private `@hesed/*` scope and fails with `E401` without a valid registry token.

## Architecture

```
src/
├── base-command.ts   # BaseCommand: output mode + oclif workarounds
├── commands/conni/   # auth/ content/ space/ — thin oclif wrappers
├── conni/
│   ├── conni-api.ts     # ConniApi — all confluence.js calls
│   └── conni-client.ts  # singleton-backed functional wrappers
├── markdown.ts       # Markdown → ADF
└── proxy.ts          # HTTPS CONNECT-tunnel workaround for axios
```

### @hesed/plugin-lib owns the cross-cutting layer

This is the single most important thing to know: config loading, output formatting, the client singleton, and the entire auth command family live in `@hesed/plugin-lib`, not in this repo. There is no `src/config.ts` and no `src/format.ts`.
<!-- prettier-ignore -->
| Need | Import from `@hesed/plugin-lib` |
| --- | --- |
| `ApiResult`, `AuthConfig` types | `type ApiResult`, `type AuthConfig` |
| Load auth for the selected profile | `createProfileManager(this.config, flags.profile, 'conni-config.json')` → `loadAuthConfig()` |
| TOON output | `formatAsToon` |
| Client singleton + `clearClients` | `createApiClient(serviceName, factory)` |
| Auth commands | `createAuthAddCommand`, `createAuthUpdateCommand`, `createAuthTestCommand`, `createAuthListCommand`, `createAuthDeleteCommand`, `createAuthProfileCommand` |

Every file under `src/commands/conni/auth/` is a one-line factory call passing `configFile: 'conni-config.json'` (and, where a live check is needed, this repo's `testConnection`/`clearClients`). Do not hand-write auth commands — extend the factories upstream instead.

### Output contract (return, don't log)

`BaseCommand.jsonEnabled()` returns `true` unless `--toon` appears before a `--` separator. Consequently:

- `run()` **returns** the `ApiResult`; oclif serializes it as JSON automatically.
- The `--toon` branch explicitly calls `this.log(formatAsToon(result))` and JSON output is suppressed.

Never call `this.logJson(result)` — it double-prints under the default JSON mode.

`BaseCommand` carries two further workarounds, both documented inline in [src/base-command.ts](src/base-command.ts): `parse()` force-sets `this.parsed = true` in a `finally` so a thrown parse error doesn't also emit an `UnparsedCommand` warning, and `toErrorJson()` reduces errors to `{error: message}` because oclif's default leaks the whole config via `CLIParseError.context`.

### ApiResult never throws

`ConniApi` wraps every method in try/catch and funnels failures through `toErrorResult()`, returning `{error, success: false}`. Callers branch on `success`, they don't catch. `getClient()` lazily builds the `ConfluenceClient`, choosing `basic` auth when `config.email` is set and `oauth2` otherwise.

### Markdown to ADF

Convert through `markdownToAdfDocument()` from [src/markdown.ts](src/markdown.ts) rather than calling `markdownToAdf()` directly. The helper enables marked's `breaks` option so a single newline becomes a `hardBreak` node instead of collapsing into the surrounding paragraph, and it unescapes literal `\n` sequences (how shell users pass multi-line bodies in one argument). `setOptions` mutates a marked global, so the helper applies it once behind a flag.

`unescapeNewlines()` is exported separately for the `representation=storage` path, which sends the raw body straight through and skips ADF entirely.

### Inline media on page creation

`createPageWithMedia()` is a two-phase operation: upload each `--attach` file, then rewrite the ADF. `collectExternalMedia()` indexes `mediaSingle` nodes whose `attrs.type === 'external'` by URL basename; `patchMediaNodes()` swaps those to `type: 'file'` with the uploaded `id`/`collection`, and appends `mediaSingle` nodes for attachments not referenced inline. So `![diagram](./diagram.png)` in the body embeds in place, while an unreferenced `--attach` lands at the end.

### Proxy handling

[src/proxy.ts](src/proxy.ts) exists because axios forwards an absolute-URI request instead of opening a CONNECT tunnel for `https://` targets, which MITM-style proxies reject with a 400. `buildProxyRequestConfig()` returns an explicit `httpsAgent` plus `proxy: false` — but only for `https://` hosts, since for `http://` that combination would silently bypass the proxy.

## Adding a New Command

1. Create `src/commands/conni/<category>/<name>.ts`.
2. Extend `BaseCommand` (not oclif's `Command`).
3. Define static `args`, `description`, `examples`, `flags` — include `profile` (`char: 'p'`) and `toon` on any command that talks to Confluence.
4. In `run(): Promise<ApiResult>`: parse, `loadAuthConfig()` via `createProfileManager`, `this.error(...)` when auth is missing, call the client function, `clearClients()`, log TOON if requested, then return the result.
5. Add the client wrapper to `conni-client.ts` and the method to `ConniApi`.

```typescript
import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getContent} from '../../../conni/conni-client.js'

export default class ContentGet extends BaseCommand {
  static override args = {
    pageId: Args.string({description: 'Page ID', required: true}),
  }

  static override description = 'Get details of a Confluence content'
  static override examples = ['<%= config.bin %> <%= command.id %> 1544060948']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(ContentGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'conni-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getContent(auth, args.pageId)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
```

**Argument ordering convention:** the id (`pageId`, comment `id`) is always the first positional argument. `eslint-config-oclif` enforces `perfectionist/sort-objects`, so wrap the `args` block when that conflicts with alphabetical order — the disable comment needs a description, since `eslint-comments/require-description` is on for `src/`:

```typescript
/* eslint-disable perfectionist/sort-objects -- pageId must be the first arg per CLAUDE.md convention */
static override args = {
  pageId: Args.string({description: 'Page ID', required: true}),
  body: Args.string({description: 'Comment in Markdown format', required: true}),
}
/* eslint-enable perfectionist/sort-objects */
```

**Topic index commands:** `conni content <PAGEID>` and `conni space <SPACEKEY>` are the topic defaults, implemented as `content/index.ts` and `space/index.ts` but tested as `get.test.ts`.

## Testing

- Mocha + Chai, `esmock` for module mocking, 60s timeout, tests mirror the source tree.
- Mock **both** `../../src/conni/conni-client.js` and `@hesed/plugin-lib` (at minimum `createProfileManager` returning `{loadAuthConfig}`); otherwise the command reads the developer's real config.
- Assert on the value `run()` returns. For `--toon`, stub `command.log` and assert on the captured output.
- Instantiate with an argv array whose order matches the `static args` definition — oclif assigns positionals by position, and flags go in the same array:
  ```typescript
  const command = new ContentUpdateComment.default(['10001', 'Updated text'], createMockConfig())
  const toonCommand = new ContentGet.default(['123456', '--toon'], createMockConfig())
  ```
- Use `createMockConfig()` from `test/helpers/config-mock.ts` for oclif's `Config`.
- `/* eslint-disable max-params */` at the top of a test file when mocks exceed four parameters.
- `tsconfig.json` excludes `test/`, so type-aware lint rules are switched off there via `tseslint.configs.disableTypeChecked`; `test/tsconfig.json` is `noEmit` for editor support only.
- Verify the `examples` on any command you touch actually run.

## Configuration

Auth lives in `conni-config.json` under oclif's platform-dependent config dir (`~/.config/conni/` on Linux). The file is profile-keyed and read/written entirely by `@hesed/plugin-lib` — `auth add` requires `-p <profile>`, `auth profile` selects the default, and every Confluence command accepts `-p` to override. A profile holds `host`, `email`, and `apiToken`; omitting `email` switches `getClient()` to OAuth2 bearer auth.

## Important Notes

- ES modules throughout — imports of local files must carry the `.js` extension.
- Node.js >=22 required. CI builds on the `.nvmrc` version and runs tests on Node 22, 23, and 24 across Linux, Windows, and macOS.
- `npm run pre-commit` (format + dead-code check) exists as a script, but **no git hook is installed** — run it manually before committing.
- Releases are automated by release-please; `prepack` regenerates `oclif.manifest.json` and the README command reference, so don't hand-edit the `<!-- commands -->` block in README.md.

## Commit Message Convention

**Always use Conventional Commits format** for commit messages and PR titles — a CI workflow enforces it on PRs, and release-please derives versions from it.

- `feat:` - New features or capabilities
- `fix:` - Bug fixes
- `docs:` - Documentation changes only
- `refactor:` - Code refactoring without changing functionality
- `test:` - Adding or modifying tests
- `chore:` - Maintenance tasks, dependency updates, build configuration

**Examples:**

```
feat: add search command for content
fix: handle connection timeout errors gracefully
docs: update configuration examples in README
refactor: extract API formatting into separate module
test: add integration tests for Confluence operations
chore: update confluence.js to latest version
```
