# 13 — Docs grounding: Node/CI stack (verified syntax)

Read-only grounding pass, 2026-10-17. No installs, no paid calls, no requests to
maxxbuilders.com. One `npm pack schema-dts@2.1.0` was unpacked in a scratch folder to read
the `.d.ts`. Nothing below was executed against a live site.

**Method.** I looked up each item in Context7 (`resolve-library-id` → `query-docs`), then
cross-checked it against the vendor's source or docs **at the pinned tag**, using
`gh api repos/<o>/<r>/contents/<path>?ref=<tag>`, `npm view`, unpkg `?meta`, or the vendor
web page. All lookups are dated 2026-10-17.

**Legend.** V = verified in the vendor source or docs at the tag. C7 = Context7 only.
U = UNVERIFIED, with the smallest test that would settle it.

**Registry state on 2026-10-17 (V `npm view`):** playwright 1.64.1, crawlee and
@crawlee/playwright 3.18.2, lighthouse 13.5.0 (`engines.node >=22.19`, `type: module`),
@lhci/cli 0.15.1, web-vitals 6.2.3, promptfoo 0.124.1 (`engines.node >=22.22.0`),
schema-dts 2.1.0, **typescript 7.0.2** (`latest`), **seo 0.7.0** (0.5.0 shipped 2026-10-16;
0.6.0 and 0.7.0 both shipped 2026-10-17), chrome-launcher 1.2.2. The repo's workflows use
`node-version: 22`, which resolves to the newest 22.x, so it meets both engine floors.
Local Node is v24.13.1.

---

## 1. Playwright 1.64.1

- **Context7:** `/microsoft/playwright`. Its newest tag is `v1.63.0`; there is **no v1.64
  tag**, so I queried v1.63.0.
- **Vendor source:** tag `v1.64.1` = `cfe490d9`: `docs/src/browsers.md`, `docs/src/ci.md`,
  `docs/src/api/class-{page,browsercontext,route,response,request}.md`,
  `packages/playwright-core/src/cli/program.ts`.

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();                       // headless by default
const context = await browser.newContext({
  userAgent: 'maxx-seo-agent-verify/1.0 (+https://github.com/BuildSmarterAI/maxx-seo-agent)',
  serviceWorkers: 'block',                                     // see the route note below
});
await context.addInitScript({ path: 'node_modules/web-vitals/dist/web-vitals.iife.js' });
const host = 'www.maxxbuilders.com';
await context.route('**/*', (route) =>
  new URL(route.request().url()).hostname === host
    ? route.continue()
    : route.abort('blockedbyclient'));
const page = await context.newPage();
const res = await page.goto(url, { waitUntil: 'load' });      // Response | null
if (!res) throw new Error('no main response');
const status = res.status();                 // number
const headers = res.headers();               // lower-cased keys; omits security headers
const all = await res.allHeaders();          // includes cookie-related headers
const rawBody = await res.text();            // the server's HTML, before JS runs
const dom = await page.content();            // the serialized DOM after JS, with doctype
await browser.close();
```

- **V facts:**
  - `goto` returns `<[null]|[Response]>`. After redirects it resolves with "the first
    non-redirect response".
  - `headers()` "does not return security-related headers, including cookie-related ones".
    Use `allHeaders()` when you need them.
  - A relative `addInitScript` `path` "is resolved relative to the current working
    directory".
  - `Route.abort(errorCode)` accepts, among others, `'aborted'` and `'blockedbyclient'`.
    `Route.continue`, `fallback` and `fulfill` all exist.
  - **"Enabling routing disables http cache."** Context routes do not see requests that a
    Service Worker intercepts, so the docs recommend `serviceWorkers: 'block'`.
- **CLI (V `program.ts`):** `install [browser...]` takes `--with-deps`, `--dry-run`,
  `--list`, `--force`, `--only-shell`, `--no-shell`, `--no-progress` and `--no-remove`.
  - CI, headless only: `npx playwright install --with-deps --only-shell` (the docs'
    example). With a browser named: `npx playwright install --with-deps chromium`.
  - `--only-shell` applies only "when installing chromium". It is right only when no
    `channel` option is set.
- **Browser location (V):** `%USERPROFILE%\AppData\Local\ms-playwright` on Windows and
  `~/.cache/ms-playwright` on Linux. Override it with `PLAYWRIGHT_BROWSERS_PATH`:
  - PowerShell: `$Env:PLAYWRIGHT_BROWSERS_PATH="$Env:USERPROFILE\pw-browsers"`.
  - `PLAYWRIGHT_BROWSERS_PATH=0` installs browsers inside `node_modules`.
- **CI caching (V `ci.md` "Caching browsers"):** "Caching browser binaries is **not
  recommended**". Restoring takes about as long as downloading, and the Linux OS
  dependencies can't be cached. If you cache anyway, key it on a hash of the Playwright
  version.
- **Context7 vs vendor:** consistent. Context7 also has a best-practices snippet with the
  order `install chromium --with-deps`; the CLI accepts both orders.
- **U:** none for the syntax.

## 2. Crawlee 3.18 (`@crawlee/playwright`)

- **Context7:** `/websites/crawlee_dev_js` (no version tags). `/apify/crawlee` has 19
  snippets and is thin.
- **Vendor source:** tag `v3.18.2` = `f92bb005`:
  `packages/basic-crawler/src/internals/basic-crawler.ts`,
  `browser-crawler/src/internals/browser-crawler.ts`,
  `core/src/enqueue_links/enqueue_links.ts`, `core/src/storages/sitemap_request_list.ts`,
  `utils/src/internals/sitemap.ts`, `core/src/configuration.ts`,
  `website/versioned_docs/version-3.18/guides/result_storage.mdx`.

```js
// npm i @crawlee/playwright@3.18.2 playwright@1.64.1   (playwright is an OPTIONAL peer dependency)
import { PlaywrightCrawler, SitemapRequestList, EnqueueStrategy, Configuration } from '@crawlee/playwright';

const requestList = await SitemapRequestList.open({ sitemapUrls: [sitemapUrl] });
const crawler = new PlaywrightCrawler({
  requestList,
  maxConcurrency: 2,
  maxRequestsPerMinute: 60,
  maxRequestRetries: 2,
  requestHandlerTimeoutSecs: 60,
  navigationTimeoutSecs: 30,
  maxRequestsPerCrawl: 300,
  async requestHandler({ request, page, response, enqueueLinks, pushData }) {
    await enqueueLinks({ strategy: EnqueueStrategy.SameHostname }); // or 'same-hostname'
  },
}, new Configuration({ purgeOnStart: true }));
await crawler.run();
```

- **V facts:**
  - The options above are all declared in `BasicCrawlerOptions` or
    `BrowserCrawlerOptions`, along with `respectRobotsTxtFile?: boolean | { userAgent? }`.
  - `strategy` accepts `EnqueueStrategy | 'all' | 'same-domain' | 'same-hostname' |
    'same-origin'`. The default is `SameHostname`.
  - `SitemapRequestList.open({ sitemapUrls, proxyUrl?, persistStateKey?, … })` loads in the
    background.
  - `Sitemap.load(urls: string|string[], proxyUrl?, parseSitemapOptions?)` returns
    `{ urls }`. `Sitemap.tryCommonNames(url)` tries `/sitemap.xml` and `/sitemap.txt`.
- **Import trap (V `src/index.ts` chain):**
  - `@crawlee/playwright` re-exports `@crawlee/browser` → `@crawlee/basic` →
    `@crawlee/core`. Core exports `SitemapRequestList`, `EnqueueStrategy` and
    `Configuration`.
  - It does **not** re-export `Sitemap`. That class lives in `@crawlee/utils`, and only the
    `crawlee` meta-package re-exports it.
  - Context7's example `import { PlaywrightCrawler, Sitemap } from 'crawlee'` therefore
    fails if you rename the import to `@crawlee/playwright`. Use
    `import { Sitemap } from '@crawlee/utils'`: it is a transitive dependency, but declare
    it explicitly.
- **ESM (V `npm view … exports`):** `"import": "./index.mjs"`, `"require": "./index.js"`.
- **Storage (V docs 3.18):**
  - `CRAWLEE_STORAGE_DIR` defaults to `./storage` in the cwd.
  - `purgeOnStart` / `CRAWLEE_PURGE_ON_START` defaults to `true`.
  - `persistStorage` / `CRAWLEE_PERSIST_STORAGE` defaults to `true`.
  - `purgeDefaultStorages()` purges explicitly.
  - `CRAWLEE_STORAGE_DIR` is read by memory-storage, not listed in `Configuration`. Set it
    as an env var, not as a constructor option.
- **Context7 vs vendor:** the `Sitemap` import path is the only material gap.
- **U:** that `SitemapRequestList` plus `requestList` works with `PlaywrightCrawler` in 3.18
  without also passing a `requestQueue`. Smallest test: a local run against a fixture
  sitemap served by `http-server` on localhost. Expect `requestsFinished` to equal the
  number of URLs.

## 3. lychee 0.24.2 + lychee-action v2.9.0

- **Context7:** `/lycheeverse/lychee` (no tags; it serves `master`).
- **Vendor source:** tag `lychee-v0.24.2` (2026-05-01) `README.md` help block. Action tag
  `v2.9.0` = `e7477775…` `action.yml` + `entrypoint.sh`.
- **Flags (V help text):**

| Flag | Fact |
|---|---|
| `--max-concurrency <N>` | default 128 |
| `--max-retries <N>` | default 3 |
| `-r, --retry-wait-time <s>` | default 1 |
| `-t, --timeout <s>` | default 20 |
| `--cache[=<false\|true>]` | cache stored at `.lycheecache` in cwd |
| `--max-cache-age <dur>` | default `1d` |
| `--cache-exclude-status <ranges>` | e.g. `429` |
| `-f, --format` | `compact` (default), `detailed`, `json`, `junit`, `markdown` |
| `-o, --output <file>` | |
| `-u, --user-agent` | default `lychee/x.y.z` |
| `--exclude <regex>` (repeatable), `--exclude-all-private` | |
| `-a, --accept` | range syntax `200..=204, 429`; default `100..=103,200..=299` |
| `-b, --base-url`, `--root-dir <ABS>` | **local files only** |
| `-c, --config` | default `lychee.toml` (auto-loaded) |

- **`--files-from` accepts URLs (V):** "Each line should contain one input (file path, URL,
  or glob pattern)". `-` reads stdin. This settles the open question in doc 11.
- **Inputs are link sources, not link targets (V):** `[inputs]...` means "where to get
  links to check from". `lychee https://…/page/` fetches that page and checks every link
  on it. There is no recursion. A sitemap URL list therefore means "check all links on
  these ~240 pages".
- **Exit codes (V):** 0 = ok, 1 = missing inputs or runtime error, 2 = link failures,
  3 = config error.

```yaml
- uses: actions/cache@v4               # caller-side; the action has no built-in cache
  with: { path: .lycheecache, key: lychee-${{ github.run_id }}, restore-keys: lychee- }
- id: lychee
  uses: lycheeverse/lychee-action@e7477775783ea5526144ba13e8db5eec57747ce8 # v2.9.0
  with:
    lycheeVersion: v0.24.2
    args: >-
      --no-progress --max-concurrency 4 --max-retries 2 --cache --max-cache-age 1d
      --user-agent "maxx-seo-agent-linkcheck (+https://github.com/BuildSmarterAI/maxx-seo-agent)"
      --files-from urls.txt
    format: markdown        # keep markdown: see failIfEmpty below
    output: lychee/out.md
    fail: false
    failIfEmpty: true
    jobSummary: true
- if: steps.lychee.outputs.exit_code != 0
  run: echo "lychee exit ${{ steps.lychee.outputs.exit_code }}"
```

- **Action inputs (V `action.yml`):**

| Input | Default |
|---|---|
| `args` | `--verbose --no-progress './**/*.md' './**/*.html' './**/*.rst'` |
| `debug` | `false` |
| `fail` | `true` |
| `failIfEmpty` | `true` |
| `format` | `markdown` |
| `jobSummary` | `true` |
| `lycheeVersion` | `v0.24.2` |
| `output` | `lychee/out.md` |
| `checkbox` | `true` (adds `--mode task`) |
| `token` | `github.token` |
| `workingDirectory` | `.` |

  The only output is `exit_code`.
- **Action traps (V `entrypoint.sh`):**
  - **`failIfEmpty` greps the output for `Total\s+\|\s+0`.** That only matches the markdown
    table. With `format: json` it never fires, so an empty run passes silently (a vacuous
    green).
  - **`jobSummary` only writes when `INPUT_FORMAT == markdown`.**
  - Setting `--output` in `args` while `output` is also set exits 1. Setting `--mode` in
    `args` while `checkbox` is set also exits 1.
  - A `--format ` in `args` overrides the `format` input.
  - The exit code goes only to `$GITHUB_OUTPUT` (`steps.<id>.outputs.exit_code`), **not to
    `env`**.
  - If you need JSON, run a second, plain `lychee --format json -o out.json` step from the
    binary the action put on `PATH`. Otherwise assert `total > 0` yourself.
- **Linux asset (V release):** `lychee-x86_64-unknown-linux-gnu.tar.gz` plus `.sha256`.
  Windows: `lychee-x86_64-pc-windows-msvc.zip` plus `.sha256`.
- **Context7 vs vendor:**
  - Context7 (master) shows `--cache-location <PATH>`. It is **absent from 0.24.2**, so
    don't use it with the pinned version.
  - Context7's workflow checks `env.lychee_exit_code`, which v2.9.0 doesn't set. Use
    `steps.<id>.outputs.exit_code`.
- **U:** that `restore-keys` keeps `.lycheecache` warm across runs (lychee loads the file
  only when `--cache` is set). Smallest test: two consecutive manual dispatches; the second
  should log cache hits.

## 4. Lighthouse 13.5.0 CLI + Node API

- **Context7:** `/googlechrome/lighthouse/v13.5.0` (a tag exists).
- **Vendor source:** tag `v13.5.0` = `ed5840cc`: `cli/cli-flags.js`, `readme.md`,
  `docs/readme.md`, `core/config/desktop-config.js`.

```sh
npx lighthouse@13.5.0 "$URL" --output=json --output-path=./lh/home.json \
  --only-categories=performance,seo --preset=desktop \
  --chrome-flags="--headless=new --no-sandbox" --no-enable-error-reporting --quiet
# Multiple outputs: --output json --output html --output-path ./lh/home.json
```

- **V facts:**
  - `--output` is an array: `json`, `html`, `csv`. The default is `html`.
  - `--output-path` "If using JSON output, default is stdout". `stdout` is accepted.
  - `--preset` choices: **`perf`, `experimental`, `desktop`** (there is no `mobile`).
  - `--form-factor` choices: `mobile`, `desktop`. The help says "For desktop, use
    `--preset=desktop` instead".
  - `--throttling-method` choices: `devtools`, `provided`, `simulate`.
  - `--enable-error-reporting` is a boolean; `--no-enable-error-reporting` turns it off.
  - The readme example lists the categories as `accessibility`, `best-practices`,
    `performance`, `seo`.

```js
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import desktopConfig from 'lighthouse/core/config/desktop-config.js'; // `export default config`
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
try {
  const r = await lighthouse(url, { port: chrome.port, output: 'json', onlyCategories: ['performance'], logLevel: 'error' }, desktopConfig);
  const lhr = r.lhr; // r.report is the serialized string
} finally { chrome.kill(); }
```

- **Deep import:** lighthouse 13.5.0 has **no `exports` map**, so a deep import of
  `core/config/desktop-config.js` resolves.
- **Context7 vs vendor:** Context7 also returns `docs/headless-chrome.md` with a
  **CommonJS `require('lighthouse')`** example. Lighthouse 13 is `type: module`, so ignore
  that snippet and use the `docs/readme.md` ESM form.
- **U:** that `chromeLauncher.launch` finds Chrome on `ubuntu-latest` without
  `CHROME_PATH`. Smallest test: a CI step `npx lighthouse@13.5.0 about:blank
  --output=json --output-path=stdout | head -c 200`.

## 5. @lhci/cli 0.15.1

- **Context7:** `/googlechrome/lighthouse-ci` (no tag).
- **Vendor source:** tag `v0.15.1`, `docs/configuration.md`.
- **Lighthouse version:** `@lhci/cli@0.15.1` depends on **`lighthouse 12.6.1`**
  (V `npm view`). LHCI does **not** give you Lighthouse 13.

```json
{
  "ci": {
    "collect": {
      "url": ["https://example.com/", "https://example.com/pricing/"],
      "numberOfRuns": 3,
      "settings": { "preset": "desktop", "chromeFlags": "--no-sandbox" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": "./lhci" }
  }
}
```

- **V facts:**
  - Config files are discovered in the **cwd only**, in this order: `.lighthouserc.js`,
    `lighthouserc.js`, `.lighthouserc.cjs`, `lighthouserc.cjs`, `.lighthouserc.json`,
    `lighthouserc.json`, then the `.yml`/`.yaml` forms. There is no upward traversal; use
    `--config=` for another path. Use **`lighthouserc.json`**, because the repo bans `.cjs`
    and `.js` would sit under `type: module`.
  - `numberOfRuns` defaults to 3.
  - Assertions use the eslint style `level | [level, opts]`, where opts are `minScore`,
    `maxLength` and `maxNumericValue`, and categories are keyed `categories:<id>`. With no
    opts the defaults are `{"aggregationMethod":"optimistic","minScore":1}`.
  - `target` values: `lhci` (default), `temporary-public-storage`, `filesystem`.
    `outputDir` (filesystem only) writes a `manifest.json` (url, `isRepresentativeRun`,
    `htmlPath`, `jsonPath`, `summary`) plus the reports.
  - Every option can also be set as an env var: `LHCI_` + the yargs path.
- **PSI mode:** `collect.method` is `"node"` or `"psi"`. `psiApiKey` is required for psi;
  `psiStrategy` is `mobile` (default) or `desktop`. With psi, "**no other collection options
  will be respected**", so `settings` and `preset` are ignored. Example:
  `{"collect":{"method":"psi","psiApiKey":"…","psiStrategy":"desktop","url":[…]}}`.
- **Context7 vs vendor:** Context7's `lhci collect --help` snippet shows `--method
  [choices: "node"]`. The docs at v0.15.1 document `psi` too. Trust the docs.
- **U:** the `--method` choices in the actual 0.15.1 binary. Smallest test:
  `npx -y @lhci/cli@0.15.1 collect --help`.

## 6. web-vitals 6.2.3

- **Context7:** none queried. The vendor sources were enough.
- **Vendor source:** tag `v6.2.3` `README.md`, `npm view web-vitals@6.2.3 exports`, and
  `https://unpkg.com/web-vitals@6.2.3/dist/?meta`.
- **Top-level `dist/` files (V unpkg meta):** `web-vitals.js` (8,967 B), `web-vitals.iife.js`
  (8,991), `web-vitals.umd.cjs` (9,180), `web-vitals.attribution.js` (15,677),
  `web-vitals.attribution.iife.js` (15,697), `web-vitals.attribution.umd.cjs` (15,886), plus
  `.map` files and `dist/modules/**`. The IIFE and UMD builds expose `self.webVitals.*`.

```js
import { onLCP, onINP, onCLS, onTTFB } from 'web-vitals';               // standard
import { onLCP as onLCPa } from 'web-vitals/attribution';               // attribution build
onLCP((m) => report(m), { reportAllChanges: true });
// Playwright injection: export the global first, then subscribe in a second init script
await context.addInitScript({ path: 'node_modules/web-vitals/dist/web-vitals.attribution.iife.js' });
await context.addInitScript(() => {
  window.__cwv = [];
  for (const f of ['onLCP', 'onCLS', 'onINP', 'onTTFB'])
    self.webVitals[f]((m) => window.__cwv.push(m), { reportAllChanges: true });
});
```

- **V facts:**
  - `ReportOpts` is `{ reportAllChanges?: boolean; reportSoftNavs?: boolean }`.
    `reportAllChanges` reports when the **metric value changes**, not on every input.
  - The `exports` subpaths are `.`, `./onCLS.js` … `./onTTFB.js`, `./attribution`,
    `./attribution.js`, and `./attribution/on*.js`. **`./dist/*` is not exported**, so
    `import.meta.resolve('web-vitals/dist/web-vitals.iife.js')` throws
    `ERR_PACKAGE_PATH_NOT_EXPORTED`. Pass a file path instead, as above, or build it with
    `fileURLToPath(new URL('../node_modules/…', import.meta.url))`.
- **Discrepancy inside the vendor README:** the v6.2.3 README's CDN examples still load
  `https://unpkg.com/web-vitals@5/dist/web-vitals.iife.js`. Pin `@6.2.3` yourself.
- **U:** whether LCP and CLS reach `__cwv` in a headless lab session without a
  visibility change. LCP finalizes on input or hidden; with `reportAllChanges` the
  candidates should still arrive. Smallest test: a local fixture page, then
  `page.evaluate(() => window.__cwv.map(m => m.name))` after `load`. INP needs an
  interaction (`page.click`).

## 7. promptfoo 0.124.1

- **Context7:** `/promptfoo/promptfoo` (no tags; it serves `main`).
- **Vendor source:** git tag **`0.124.1`** (no `v` prefix) = `421e7959`:
  `site/docs/usage/command-line.md`, `configuration/reference.md`, `test-cases.md`,
  `providers/anthropic.md`, `expected-outputs/{index,javascript}.md`,
  `expected-outputs/model-graded/index.md`, `configuration/telemetry.md`.

```yaml
# evals/skills.promptfooconfig.yaml
prompts: [file://prompts/metadata.txt]
providers:
  - id: anthropic:messages:claude-sonnet-4-6
defaultTest:
  options:
    provider: anthropic:messages:claude-haiku-4-5-20251001   # pin the grader
tests:
  - vars:
      page: file://fixtures/page-1.json        # resolves from the config file's directory
    assert:
      - type: is-json
      - type: javascript
        value: file://asserts/title-length.mjs   # ESM must use .mjs
      - type: llm-rubric
        value: Title leads with the primary entity and is under 60 characters
```

```powershell
$env:PROMPTFOO_DISABLE_TELEMETRY = '1'; $env:PROMPTFOO_DISABLE_UPDATE = '1'
npx --yes promptfoo@0.124.1 eval -c evals/skills.promptfooconfig.yaml --no-cache --no-share --no-table -j 2 -o evals/out/results.json
if ($LASTEXITCODE -eq 100) { 'test failures' } elseif ($LASTEXITCODE -ne 0) { 'error' }
```

- **V CLI flags:** `-c, --config <paths...>`, `-j, --max-concurrency <number>`,
  `--no-cache`, `--no-table`, `--no-share`, and `-o, --output <paths...>` (csv, txt, json,
  jsonl, yaml, yml, html, xml, junit.xml).
- **V exit codes:** `100` when at least one test fails or the pass rate is below
  `PROMPTFOO_PASS_RATE_THRESHOLD` (a percentage, default 100). `1` for other errors.
  `PROMPTFOO_FAILED_TEST_EXIT_CODE` overrides the 100.
- **V env vars:**
  - `PROMPTFOO_DISABLE_TELEMETRY=1` (`telemetry.md`).
  - `PROMPTFOO_DISABLE_UPDATE` (default `false`).
  - `PROMPTFOO_CONFIG_DIR` (eval history).
  - `PROMPTFOO_CACHE_ENABLED` (default `true`), `PROMPTFOO_CACHE_PATH`
    (`~/.promptfoo/cache`), `PROMPTFOO_CACHE_TTL` (default `1209600` s = 14 days).
  - `PROMPTFOO_DISABLE_SHARING` (from the sharing docs via Context7).
- **V assertions:**
  - `javascript` with `value: file://path.js[:fn]`. ESM "must have a `.mjs` file
    extension".
  - The `is-json` and `llm-rubric` types exist.
  - **Grader:** by default "promptfoo chooses that provider from the credentials available
    in the environment". Override it with `--grader`, `defaultTest.options.provider`, or
    `assertion.provider`.
- **Model IDs (V `anthropic.md`):** `anthropic:messages:claude-sonnet-4-6` and
  `anthropic:messages:claude-haiku-4-5-20251001` are listed.
- **Context7 vs vendor:** consistent. Context7 serves `main`, but these lines are unchanged
  at 0.124.1.
- **U:** that a `.mjs` assertion with `export default (output, context) => …` loads. The
  docs only show `module.exports`. Smallest test: an echo-provider config with one `.mjs`
  assert and `--no-cache`. Expect exit 0, and exit 100 when the assert returns `false`.

## 8. Firecrawl API v2 (REST)

- **Context7:** `/firecrawl/firecrawl-docs` (no tag).
- **Vendor docs:** https://docs.firecrawl.dev/api-reference/endpoint/scrape,
  `/api-reference/endpoint/map`, `/rate-limits`, `/billing` (fetched 2026-10-17).

```sh
curl -X POST https://api.firecrawl.dev/v2/scrape \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/","formats":["markdown","rawHtml"],"onlyMainContent":true,
       "waitFor":0,"maxAge":0,"location":{"country":"US","languages":["en"]}}'
curl -X POST https://api.firecrawl.dev/v2/map -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com","sitemap":"include","limit":5000}'
```

- **`/v2/scrape` body (V):** `url` (required), `formats` (default `["markdown"]`),
  `onlyMainContent` (default `true`), `waitFor` (ms, default 0, max 60000), `maxAge` (ms,
  default `172800000` = 2 days; `0` = always fresh), `timeout` (ms, default 60000, range
  1000–300000), `location.country` (default `US`), `location.languages`, `proxy`
  (`basic` | `enhanced` | `auto`, default `auto`), `storeInCache` (default `true`). Auth is
  HTTP Bearer. Errors: `402` insufficient credits, `429` rate limit, `500`.
- **`/v2/map` (V):** `url`, `search`, `sitemap` (`include` default, `skip`, `only`),
  `includeSubdomains` (default `true`), `ignoreQueryParameters` (default `true`),
  `ignoreCache`, `limit` (default 5000, max 100000), `timeout`, `location`. It returns
  `links[]` of `{url, title?, description?}`.
- **Credits (V billing):**
  - Scrape costs 1 credit per page; JSON (LLM extraction) adds 4 per page; the enhanced
    proxy adds 0. Map costs 1 credit per call.
  - The free plan gives 1,000 credits a month.
  - **Cached results still cost 1 credit** (C7 `features/fast-scraping.mdx`), so `maxAge`
    buys speed, not savings.
- **Rate limits (V):**

| Plan | /scrape and /map, req/min | Concurrent browsers |
|---|---|---|
| Free | 10 | 2 |
| Hobby | 100 | 5 |
| Standard | 500 | 25 |

  Over either limit the API returns **429**. **No `Retry-After` header is documented**;
  use exponential backoff.
- **Context7 vs vendor:**
  - Context7's cURL snippets omit auth ("No API key needed to get started"). The rate-limit
    page confirms keyless use exists but is capped per IP per day (numbers not published).
    Always send the key.
  - The Context7 `Formats` schema is the object form (`{type:"markdown"}`). The reference
    examples use strings. Both appear in the vendor docs.
- **U:**
  - Whether `rawHtml` costs extra. The billing page lists no surcharge, so it should cost 0
    extra. Smallest test: one scrape of a controlled page, then compare `creditsUsed` in
    the response or dashboard.
  - Whether 429 responses carry `Retry-After`. Smallest test: inspect headers on a forced
    burst against the free tier.

## 9. DataForSEO v3 (REST)

- **Context7:** `/websites/dataforseo_v3` (no tag).
- **Vendor docs:** https://docs.dataforseo.com/v3/serp/google/organic/task_post/,
  `…/live/advanced/`, `…/task_get/advanced`, `/v3/keywords_data/google_ads/search_volume/task_post/`,
  `/v3/appendix/sandbox/`, `/v3/auth/` (fetched 2026-10-17).

```js
const auth = 'Basic ' + Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
const base = process.env.DATAFORSEO_SANDBOX ? 'https://sandbox.dataforseo.com' : 'https://api.dataforseo.com';
// Standard queue: POST an array of up to 100 tasks
await fetch(`${base}/v3/serp/google/organic/task_post`, { method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/json' },
  body: JSON.stringify([{ keyword: 'commercial construction cost houston',
    location_code: 2840, language_code: 'en', device: 'desktop', depth: 10, tag: 'q1' }]) });
// GET /v3/serp/google/organic/tasks_ready → tasks[].result[].{id, endpoint_advanced}
// GET /v3/serp/google/organic/task_get/advanced/{id}
// Live (one task per call, more expensive): POST /v3/serp/google/organic/live/advanced
// Search volume: POST /v3/keywords_data/google_ads/search_volume/task_post
//   [{ keywords: [...<=1000], location_code: 2840, language_code: 'en' }]
```

- **Auth (V):** `Authorization: Basic base64(login:password)`. The API password is
  generated on the "API Access" tab and **differs from the account password**.
- **SERP `task_post` (V):**
  - Up to **100 tasks per POST** (error `40006` above that) and 2,000 calls per minute.
  - Required: `keyword` (≤700 chars), one of `location_code`/`location_name`/
    `location_coordinate`, and one of `language_code`/`language_name`.
  - `device` is `desktop` (default) or `mobile`; `os` is optional.
  - `depth` defaults to 10 (max 700), billed "per each SERP containing up to 10 results".
  - `priority` is 1 (normal, default) or 2 (high, extra cost).
  - Responses carry a **top-level `cost`** and a **per-task `tasks[].cost`**.
- **Live (V):** `POST …/live/advanced`. "Each Live SERP API call can contain only one
  task"; it costs more than Standard.
- **Search volume (V):** up to 1,000 keywords per task (≤80 chars, ≤10 words each,
  lowercased). Also `search_partners`, `date_from`/`date_to`, and `sort_by`. Up to 100
  tasks per POST. It is charged per task regardless of keyword count. A live variant
  exists at `/v3/keywords_data/google_ads/search_volume/live`.
- **Sandbox (V):** `sandbox.dataforseo.com` exists and is "completely **free** for any
  registered user". Swap the host. It returns **dummy data** with the same structure, and
  covers SERP, Keywords Data, Labs, Backlinks, OnPage and the other API families. Use it in
  tests for $0.
- **Context7 vs vendor:** the Context7 Python comment says `GET /v3/serp/google/organic/advanced/$id`.
  The real path is **`/task_get/advanced/{id}`**. Prefer `endpoint_advanced` from
  `tasks_ready`.
- **U:**
  - Whether sandbox auth uses the same API login and password (the docs imply it but don't
    say so). Smallest test: one sandbox `task_get/advanced/00000000-0000-0000-0000-000000000000`
    with the API credentials.
  - How long `task_get` results are retained (not stated on the page).

## 10. schema-dts 2.1.0 + JSDoc in `.mjs`; TypeScript current

- **Context7:** `/google/schema-dts` (no tag; it includes `context7.com/google/schema-dts/llms.txt`).
- **Vendor source:** tag `v2.1.0`, unpacked `dist/schema.d.ts` (12,526 lines). Its
  dependency is `schema-dts-lib ^1.1.0`.
- **V types:**
  - `export type WithContext<T extends JsonLdObject | string> = T & { "@context": "https://schema.org" }`.
  - `export interface Graph { "@context": "https://schema.org"; "@graph": readonly Thing[] }`.
  - `export type GeneralContractor = GeneralContractorLeaf | string`, which is a member of
    `HomeAndConstructionBusiness`.

```js
// @ts-check
/** @type {import('schema-dts').WithContext<import('schema-dts').GeneralContractor>} */
export const org = { '@context': 'https://schema.org', '@type': 'GeneralContractor', name: 'Maxx Builders' };
/** @type {import('schema-dts').Graph} */
export const graph = { '@context': 'https://schema.org', '@graph': [ /* … */ ] };
```

```sh
npx tsc --noEmit --allowJs --checkJs --module nodenext --types node --ignoreConfig schema/build/*.mjs
```

- **TypeScript current = 7.0.2** (`latest`; `next` is 7.1.0-dev). This is the native Go
  compiler: the package depends on per-platform `@typescript/typescript-*` binaries, and
  `bin` is still `tsc`.
- **TS 6.0 defaults, carried into 7 (V devblogs "Announcing TypeScript 6.0"):**
  - `strict` is true, `module` is `esnext`, `target` floats (es2025), and **`types` is
    `[]`**. Node globals need `--types node` plus `@types/node`.
  - `--moduleResolution node` (node10) is deprecated in favour of `nodenext`/`bundler`, and
    `baseUrl` is deprecated.
  - **Running `tsc` with files while a `tsconfig.json` exists is error TS5112**; use
    `--ignoreConfig` or a tsconfig.
- **TS 7 JS changes (V `microsoft/typescript-go/CHANGES.md`):**
  - Closure-only JSDoc is gone (`@enum`, `function(string)` types, identifier-named
    typedefs, `@type {o}` auto-typeof).
  - Values are no longer resolved as types in JSDoc.
  - `import('pkg').Name` in `@type` is the supported form, so the snippet above is safe.
- **Context7 vs vendor:** consistent for schema-dts. Context7 knows nothing about the
  TS 6/7 defaults; these are what break a "plain `tsc --checkJs`" command copied from
  older docs.
- **U:** that `tsc@7.0.2 --checkJs` accepts `WithContext<GeneralContractor>`, since the
  union includes `string`. Smallest test: a two-line `.mjs` with a deliberate typo
  property. Expect exactly one TS2353 or similar error, and none once the typo is fixed.

## 11. iannuttall/seo (npm `seo`) at v0.5.0

- **Context7:** not indexed. I did not resolve it, given the release churn.
- **Vendor source:** tag `v0.5.0`: `README.md`,
  `packages/cli/src/commands/{core-commands,crawl,mcp}.ts`,
  `commands/opportunities/internal-links.ts`, `packages/core/src/commands/report.ts`,
  `gsc/auth/service-account.ts`, `core/src/telemetry.ts`. I also read the `CHANGELOG.md`
  at `v0.7.0`.

```sh
export SEO_TELEMETRY_DISABLED=1            # or DO_NOT_TRACK=1
export GOOGLE_APPLICATION_CREDENTIALS=./gcp.json   # reuse the repo's existing SA
npx -y seo@0.5.0 sites --json
npx -y seo@0.5.0 report --site sc-domain:maxxbuilders.com --section quick-wins --json
npx -y seo@0.5.0 report --site sc-domain:maxxbuilders.com --detail rows --offset 20 --json
npx -y seo@0.5.0 crawl https://example.com/ --mode sitemap --health --max-pages 200 --concurrency 2 --format json
npx -y seo@0.5.0 internal-links --site sc-domain:maxxbuilders.com --url https://example.com/target/ --json
npx -y seo@0.5.0 mcp serve                 # LOCAL stdio MCP server
```

- **V commands:** the README names eight: `report`, `page --url`, `compare --date`,
  `index`, `research <action>`, `data`, `crawl <url>`, and `internal-links --url`. Also
  `sites`, `start`, `skill install`, `mcp install|serve`, `providers …`, `privacy`,
  `doctor`, `auth logout --all`, `reset`, and `telemetry disable`.
- **V flags:**
  - `--json` on every command ("JSON mode never prompts").
  - `--site` accepts a domain, a URL, or a GSC property.
  - `--detail summary|rows|full`, `--offset`.
- **`--section` values (V `SECTION_IDS`):** `overview`, `quick-wins`, `low-ctr`,
  `striking-distance`, `second-page`, `content-decay`, `cannibalization`, `traffic-drop`,
  `bing`.
- **`crawl` arguments (V):**
  - `--mode` is `site`, `page`, `list` or `sitemap`.
  - `--max-pages` (default 500, max 10,000), `--max-depth` (16, max 64), `--concurrency`
    (8, max 16; up to 4 with `--health`).
  - `--sitemap-url`, `--urls`, `--urls-file`, `--include`, `--exclude`, `--no-sitemap`,
    `--no-robots`, `--no-external`, `--js`, `--rendering`, `--fetch-interval-ms`,
    `--fetch-interval-cap`, `--refresh`.
  - `--format pretty|json|csv|html|markdown|junit` (junit requires `--health`),
    `--output`, `--csv`, `--severity`, and `--fail-on <severity>` (non-zero exit).
- **`internal-links` at 0.5.0 (V):** `--site`, `--url`, the shared report args,
  `--brand-terms`, `--json`.
- **Local MCP: yes (V).** `seo mcp serve` "as a local stdio server". `seo mcp install
  --codex|--claude-code|--cursor|--claude-desktop` writes the client config. The local
  server adds `seo_crawl`, `seo_internal_links` and the `seo_*_provider` tools to the
  hosted tool set.
- **Service-account auth (V `service-account.ts`):**
  - It takes exactly one of `SEO_GOOGLE_SERVICE_ACCOUNT_JSON` (inline JSON),
    `SEO_GOOGLE_SERVICE_ACCOUNT_FILE`, or `GOOGLE_APPLICATION_CREDENTIALS` (a file path).
    Setting more than one is an error.
  - It requires `type: service_account`, `client_email` and `private_key`. That means
    **service-account keys only; gcloud user ADC (`authorized_user`) JSON is rejected**.
  - Scopes are read-only.
- **Telemetry (V):** `DO_NOT_TRACK`, `SEO_TELEMETRY_DISABLED`, `SEOSKILL_TELEMETRY_DISABLED`.
  `CI` is also detected.
- **Churn (V CHANGELOG 0.7.0):** `internal-links` "takes only `--url` and optional dates…
  The old flags stop with a notice". The `seo analytics clicky report` command became
  `seo data --source clicky`. **Pin `seo@0.5.0` exactly, or re-ground before moving to
  0.7.0.**
- **U:**
  - Whether `crawl` respects robots and is polite at `--concurrency 2` on a WAF-protected
    site.
  - Whether `report --json` exits non-zero on GSC permission errors. Smallest test:
    `seo sites --json` with the service account. Expect `sc-domain:maxxbuilders.com` in
    the list, and a non-zero exit when `GOOGLE_APPLICATION_CREDENTIALS` points at an
    invalid file.

## 12. SiteOne crawler v2.5.1

- **Context7:** not used. The vendor sources were enough.
- **Vendor source:** `gh api repos/janreges/siteone-crawler/releases/tags/v2.5.1`
  (published 2026-06-27) and `README.md?ref=v2.5.1`. v2.5.1 is also the newest *release*.
- **Linux asset (V):** `siteone-crawler-v2.5.1-linux-x64.tar.gz` (10,876,162 B,
  `sha256:09278d958d4a087fa46093805cd33b085b96618001dd31d45c448ad724c9024e`). Other assets:
  `linux-musl-x64`, the arm64 builds, `.deb`/`.rpm`/`.apk` packages, `win-x64.zip` and the
  macOS builds.
- **Checksums:** **no checksum files are published.** The release API does expose a
  GitHub-computed `digest` (sha256) per asset; verify against that.

```sh
gh release download v2.5.1 -R janreges/siteone-crawler -p 'siteone-crawler-v2.5.1-linux-x64.tar.gz'
echo "09278d958d4a087fa46093805cd33b085b96618001dd31d45c448ad724c9024e  siteone-crawler-v2.5.1-linux-x64.tar.gz" | sha256sum -c -
./siteone-crawler --url=https://example.com/sitemap.xml --workers=2 --max-reqs-per-sec=2 \
  --max-visited-urls=300 --timeout=10 --device=desktop \
  --user-agent="maxx-seo-agent-crawl (+https://github.com/BuildSmarterAI/maxx-seo-agent)" \
  --output=json --output-json-file=tmp/siteone.json \
  --ci --ci-min-score=7.0 --ci-max-5xx=0 --ci-max-404=0
```

- **V options:**
  - `--url=<url>` is required unless `--url-list` is given, and can be a sitemap or
    sitemap index.
  - `--workers` (default 3), `--max-reqs-per-sec` (default 10), `--max-visited-urls`
    (default 10000), `--timeout` (s, default 5).
  - `--single-page` loads one page and its assets. `--device` is `desktop`, `mobile` or
    `tablet`.
  - `--user-agent` overrides `--device`. A trailing `!` drops the crawler signature.
  - `--output` is `text` or `json`. `--output-json-file` defaults to
    `tmp/%domain%.output.%datetime%.json`.
  - `--http-cache-dir` defaults to `~/.cache/siteone-crawler/http-cache`; `'off'` or
    `--no-cache` disables it.
  - `--result-storage` is `memory` or `file`.
- **`--ci` mode (V):**
  - It **exits 10** when thresholds fail and suppresses the default file outputs unless an
    `--output-*` option is given.
  - Score thresholds: `--ci-min-score` (default 5.0) and `--ci-min-{performance,seo,security,
    best-practices}` (5.0 each; accessibility 3.0).
  - Count thresholds: `--ci-max-404` and `--ci-max-5xx` (0 each), `--ci-max-criticals` (0),
    `--ci-min-pages` (**default 10**) and `--ci-min-assets` (**default 10**).
  - Regression checks: `--ci-baseline=<json>`, `--ci-max-score-drop`,
    `--ci-fail-on-code=<aplCode>`.
- **`--browser` (V):** Chromium via CDP; the browser itself is detected or downloaded at
  runtime. `--browser-auto-download` gives pre-consent for CI. Related options:
  `--browser-path`, `--browser-no-sandbox`, `--browser-workers` (3), `--browser-wait`
  (`networkidle`), `--browser-timeout` (30 s).
- **Discrepancies:** doc 10's example omits `--ci`. The `--ci-min-pages`/`--ci-min-assets`
  defaults of 10 will **fail a `--single-page` CI run**. Set them explicitly.
- **U:** the binary name and layout inside the tarball (the README runs
  `./siteone-crawler`). Smallest test: `tar tzf siteone-crawler-v2.5.1-linux-x64.tar.gz`.

---

## Corrections to docs 10, 11 and 12

| Doc | Claim | Correction |
|---|---|---|
| 11 §15 Playwright | "Cache `~/.cache/ms-playwright` keyed on the Playwright version" | Vendor: caching is **not recommended**, and OS deps can't be cached. If you cache, key on the version hash. Consider `--only-shell` only if full-Chromium parity is dropped. |
| 11 §15 | smoke test reads `r.headers()['x-cache']` on `goto` | Correct (lower-cased keys), but `goto` can return `null`; guard it. `headers()` hides cookie headers; use `allHeaders()` for `Set-Cookie`. Routing disables the HTTP cache. |
| 11 §18 lychee | `--files-from` with URLs is UNVERIFIED | **Verified:** each line may be a file path, URL or glob. |
| 11 §18 | action example uses `format: json` + `jobSummary: true`, relies on default `failIfEmpty` | `failIfEmpty` and `jobSummary` only work with **markdown**; with json an empty run is a vacuous green. Use markdown in the action plus a separate json run, or assert `total > 0`. |
| 11 §18 | URL args = "feed it every sitemap URL" | Correct, but each URL is a **page whose links are extracted**, so the job checks every outbound link on ~240 pages. Size `--max-concurrency` and the cache to match. Read the exit code from `steps.<id>.outputs.exit_code`, not `env`. |
| 11 §19 web-vitals | "load the IIFE build" | File is `dist/web-vitals.iife.js` (or `.attribution.iife.js`), global `self.webVitals`. Not resolvable through `exports`: pass a file path. The README's CDN example says `@5`; pin `@6.2.3`. |
| 10 §7 / 11 | LHCI notes | Confirmed: 0.15.1 pins Lighthouse **12.6.1**, `method=psi` ignores all other collect options, use `lighthouserc.json` (not `.js`/`.cjs` in this ESM repo). |
| 10 §4 SiteOne | example lacks `--ci`; checksums not discussed | No checksum files exist; verify against the GitHub asset `digest`. With `--ci`, set `--ci-min-pages`/`--ci-min-assets` (default 10). |
| 10 §1 seo | v0.5.0 classified as "run as CLI" | It also has a **local stdio MCP** (`seo mcp serve`). It accepts `GOOGLE_APPLICATION_CREDENTIALS` (service-account keys only, not user ADC). 0.6.0 and 0.7.0 shipped 2026-10-17 and changed `internal-links` flags: pin exactly. |
| 12 §21 schema-dts | `tsc --checkJs` would check it | Current TypeScript is **7.0.2** (native). TS 6+ defaults `types: []`, makes files plus tsconfig error TS5112, and deprecates node10 resolution. Pass `--module nodenext --types node --ignoreConfig`. The JSDoc `import()` form still works. |
| 12 §27 promptfoo | flags, exit 100, env vars, 14-day cache | All confirmed at tag `0.124.1`. Add: ESM asserts must be `.mjs`; vars `file://` resolve from the config file's directory; `-j` is `--max-concurrency`. |
| 11 §13 Firecrawl | (credits not detailed) | Scrape is 1 credit per page, plus 4 for JSON extraction. **Cached `maxAge` hits still cost 1.** Map is 1 per call. 429 has no documented `Retry-After`. |
| 10 §3 DataForSEO | — | The **sandbox exists and is free** (dummy data). Use `task_get/advanced/{id}`, not Context7's `/advanced/{id}`. Live calls are 1 task per call; `task_post` allows 100 per POST. Read the per-task `cost` field. |
