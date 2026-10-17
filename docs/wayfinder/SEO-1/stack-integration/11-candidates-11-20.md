# Stack-integration candidates 11–20: crawlers, renderers, extractors, link checkers, RUM

**Date examined:** 2026-10-16. **Status:** read-only public research. Nothing was installed or
executed and maxxbuilders.com was not crawled. Shallow clones (for reading only) of
crawl4ai, python-seo-analyzer, lychee-action, web-vitals, firecrawl, trafilatura and advertools
sit in the session scratchpad, not in the repo.

**Builds on** `docs/wayfinder/SEO-1/crawl-render-approach.md` (2026-10-15, worktree
`wt-maxx-seo-agent-research-crawl-render-approach`) and `wp-apply-surfaces.md` (same date).
Those docs already cover Firecrawl pricing, Crawlee + Playwright as the build option,
Unlighthouse/LHCI/PSI, the WP Rocket delay-JS rendering risk, and the front `X-Cache` layer.
This doc doesn't repeat them. It adds per-candidate facts and answers the five key questions.

Legend: **[V]** verified today on a primary source (GitHub API, npm/PyPI registry, cloned
source, vendor doc) · **[R]** read in this repo at `research/seo-stack-integration` 7a3d333 or
a prior in-repo research doc · **[E]** estimate or inference · **UNVERIFIED** = not established.

---

## 0. Answers to the key questions

1. **Is Playwright the right single renderer for cache-aware read-back of WordPress/Elementor
   pages?** Yes, as the *only browser*. Most read-back checks don't need a browser, though.
   - **Head fields don't need rendering.** Title, meta description, canonical, robots and Yoast
     JSON-LD are emitted server-side [R: `wp-apply-surfaces.md`; Yoast debug marker in raw
     HTML]. A plain Node `fetch` of the raw HTML is the authoritative and cheapest check.
     `packs/wordpress/apply.mjs:39 verifyYoastHead` reads `yoast_head` over REST
     `context=edit`, which WP Rocket never page-caches [R]. It proves the *origin* value, not
     what visitors or Googlebot are served. **Gap: there is no public-HTML read-back today.**
   - **The cache needs a two-read design** [E, built on V facts]:
     - Read A is the canonical URL as served. Record `X-Cache`, `Age`, `Last-Modified` and
       the WP Rocket `cached@` footer comment.
     - Read B is the same URL plus a unique, un-allowlisted query string
       (`?mx_verify=<nonce>`). WP Rocket "does not cache pages with query strings by
       default" except an ignore-list (utm_*, gclid, fbclid…) [V: docs.wp-rocket.me/article/971,
       updated 2026-09-04], so B skips WP Rocket's page cache.
     - **UNVERIFIED:** whether the front nginx `X-Cache` layer keys on the query string.
       Check that B returns `X-Cache: MISS`/absent in the SEO-12 spike.
     - Outcomes: B matches but A doesn't means "applied, stale cache". Neither matches
       means "apply failed".
   - **Playwright is needed only for JS-dependent fields:** Elementor widgets, `/projects/*`
     grids under delay-JS, and lazy images. One Playwright `page.goto()` gives both:
     `response.text()` (raw document) and `page.content()` (rendered DOM), plus
     `response.headers()`. That makes it a single tool for the rendered side.
   - **No second renderer is warranted.** crawl4ai is Playwright underneath, and Firecrawl is
     a hosted browser.
2. **Do we need a second crawler beyond Firecrawl?** **No framework crawler.**
   - **Scope is small.** The sitemap has ~238 URLs [R] and is already parsed with an SSRF
     guard by `scripts/sensor-sitemap.mjs:collectPageUrls` [R].
   - **A small in-repo crawler is enough** [E]. It would use:
     - Node `fetch` for raw HTML and headers on every sitemap URL;
     - Playwright for a rendered pass, only on URLs flagged Elementor or JS-dependent (or a
       weekly full pass);
     - a tiny concurrency limiter at 1–4 concurrent requests, for Wordfence.
   - **This refines the prior doc's Crawlee recommendation.** Crawlee's queue/autoscale and
     anti-blocking stack (`fingerprint-injector`, `got-scraping`, `proxy-chain` [V npm deps
     of `@crawlee/browser-pool`/`@crawlee/core` 3.18.2]) is built for crawling third-party
     sites at scale, not for 240 known URLs on our own origin. Adopt Crawlee only if link
     *discovery* beyond the sitemap becomes a requirement.
   - **Firecrawl stays the ad-hoc/agent tool** (CLI skill), as already decided.
3. **Is lychee a cheaper broken-link check than current code?** **There is no current
   broken-link code.**
   - **Evidence of the gap.** The repo has no link-status checker. `scripts/link-graph.mjs`
     counts hrefs with a regex and never checks status [R]. The `seo-audit` skill expects
     broken links from a crawl CSV that doesn't exist [R].
   - **What lychee gives** [V]: cached, retried, rate-limit-aware link checking with
     JSON/Markdown output. It runs as a pinned GitHub Action, so it is $0 on the public repo
     and needs no new code beyond feeding it the sitemap URL list.
   - **Limit:** it checks links in **raw HTML only**, with no JS. That is acceptable, because
     WP/Yoast/Elementor emit `<a href>` server-side, except links injected by delay-JS
     widgets.
   - **Classification: Run as CLI (GitHub Action).**
4. **Is web-vitals RUM worth it given CrUX?** **Not now (Defer).**
   - **Cost of adopting:** it needs a script on the live WordPress site, which is a gated,
     production-only change with no staging (root CLAUDE.md), plus a collector (GA4 event or a
     Supabase endpoint).
   - **What exists already:** CrUX p75 for URLs with enough traffic (`sensor-cwv.mjs`, which
     treats a 404 as no signal [R]) and PSI lab data.
   - **Where the gain would be:** low-traffic URLs and INP attribution. Revisit if CWV work
     stalls on "no field data".
   - **Free alternative:** inject `web-vitals` into *our own* Playwright sessions
     (`addInitScript`) for lab LCP/CLS. That touches nothing on the site [E].
5. **Does a Python env pay off for advertools/trafilatura?** **No, not today.**
   - Neither closes a gap the Node plan leaves open.
   - **advertools** is the strongest Python case, through `logs_to_df` access-log analysis
     [V source]. Server logs are still an open question (host unknown [R]), so defer it until
     logs exist.
   - **trafilatura** (main-content extraction) is only needed for the programmatic uniqueness
     gate and main-content word counts. A Node path (`@mozilla/readability` 0.6.0,
     Apache-2.0 [V npm]) is available if that becomes urgent.

---

## 1. Repo baseline relevant to this batch [R]

- `package.json` (Node ≥22, `"type":"module"`). Deps: `@anthropic-ai/claude-agent-sdk`
  0.1.77, `@supabase/supabase-js`, `google-auth-library`, `googleapis`, `marked`, `zod`
  **4.4.3**.
- `package-lock.json` has **no playwright, crawlee, firecrawl, cheerio, lighthouse, or
  web-vitals** entries (scripted scan of `packages` keys).
- Firecrawl is used only via the Firecrawl CLI/skills (`.claude/skills/seo-audit`, `audit/*.md`).
  No SDK is imported in any `.mjs`.
- Workflows pin actions by **tag** (`actions/checkout@v4`), not SHA.
- No `crawl/` directory exists, and no broken-link check exists anywhere.

---

## 2. Per-candidate findings

### 11. apify/crawlee

- **Canonical:** https://github.com/apify/crawlee. Not archived, default branch `master`
  [V].
- **Examined:** v3.18.2 (release 2026-09-29). Last commit 2026-10-15. 152 open issues
  [V GitHub API]. npm `crawlee` 3.18.2, `engines.node >=16`, Apache-2.0 [V npm].
- **Capabilities:** a crawler framework with HTTP/Cheerio/JSDOM/Playwright/Puppeteer crawlers,
  request queue, autoscaled pool, sessions, sitemap loading, and dataset storage.
  - Ships an ESM wrapper (`gen-esm-wrapper ./index.js ./index.mjs` in its build script) [V].
  - `playwright` is an **optional peer dependency** of `@crawlee/playwright` [V], so you install
    it yourself.
  - The meta-package `crawlee` pulls in every crawler flavour, including `@crawlee/puppeteer`.
    Use `@crawlee/playwright` alone.
- **Runtime:** Node; browsers come through Playwright. Writes a local `./storage` directory by
  default [E: Crawlee docs convention, not re-verified today].
- **Credentials:** none (Apify platform optional).
- **Licence:** Apache-2.0.
- **Install scripts:** none in the published package (`scripts` holds build only) [V].
- **Overlap:** the `sensor-sitemap.mjs` sitemap parser already exists. Crawlee mostly adds
  queue and anti-blocking, which our own small origin doesn't need.
- **Classification: Defer.**
  - **Gap it would close:** link discovery beyond the sitemap (orphan detection of
    non-sitemap URLs).
  - **Trigger to adopt:** the site grows past ~1–2k URLs, or discovery crawling is required.
- **Confidence:** medium. The SEO-12 spike may show a discovery need.

### 12. scrapy/scrapy

- **Canonical:** https://github.com/scrapy/scrapy [V].
- **Examined:** 2.19.0 (2026-09-10). Last commit 2026-10-16. 225 open issues. BSD-3-Clause
  [V]. PyPI `requires_python >=3.10`, Twisted-based [V PyPI].
- **Capabilities:** a mature Python crawl framework (robots.txt via `protego`, middleware,
  feeds). **No JS rendering** without a plugin such as scrapy-playwright.
- **Compatibility:** Python only. It adds a second toolchain to a Node-only repo.
- **Overlap:** the Node fetch + Playwright plan covers it.
- **Classification: Reject** for direct use. It is indirectly relevant only as advertools'
  engine.
- **Confidence:** high.

### 13. firecrawl/firecrawl

- **Canonical:** https://github.com/firecrawl/firecrawl [V].
- **Examined:** v2.11.0 (2026-06-19). Last commit 2026-10-16. 619 open issues [V].
- **Licences, split by component:**
  - The server/repo root `LICENSE` is **AGPL-3.0** [V clone].
  - The SDKs carry their own `LICENSE` files (`apps/js-sdk`, `apps/python-sdk`, …).
  - npm `@mendable/firecrawl-js` / `firecrawl` 4.46.0 is **MIT**, `engines.node >=22`,
    `type: module` [V npm].
  - The hosted cloud is governed by its ToS (not re-read today; the prior doc flagged that
    free-tier commercial-use terms are unstated).
- **Cloud pricing** [V firecrawl.dev/pricing, 2026-10-16]. Credits do not roll over except on
  Scale (one month).

  | Plan | Price | Credits/mo | Concurrency | Pay-as-you-go |
  |---|---|---|---|---|
  | Free | $0 | 1,000 | 2 | — |
  | Hobby | $19 monthly, $16 annual | 5,000 | 5 | 1,000 credits per $5 |
  | Standard | $83 annual | 100,000 | 25 | 2,000 credits per $5 |
  | Growth | $333 annual | 500,000 | — | — |
  | Scale | $599 annual | 1,000,000 | — | — |

  These match the 2026-10-15 doc.
- **SDK conflict:** the JS SDK depends on `zod ^3.23.8` and pins `axios 1.20.0` [V]. The repo
  pins `zod 4.4.3`, so npm would nest a second zod. That works, but it duplicates zod and adds
  axios.
- **Self-host:** possible, but `SELF_HOST.md` says the anti-blocking "Fire-engine" is separate
  [V clone]. Self-hosting means running a multi-service AGPL stack, which is not worth it at
  240 URLs.
- **Credentials:** `FIRECRAWL_API_KEY` for cloud.
- **Classification: Already covered** (ad-hoc CLI/skill use). **Don't add the SDK as a
  dependency.**
- **Confidence:** high.

### 14. unclecode/crawl4ai

- **Canonical:** https://github.com/unclecode/crawl4ai [V].
- **Examined:** v0.9.5 (2026-10-14). Last commit 2026-10-15. 261 open issues.
  `requires_python >=3.10` [V].
- **Licence: Apache-2.0 plus an appended "Attribution Requirement"** in `LICENSE` [V clone]:
  > "All distributions, publications, or public uses of this software, or derivative works …
  > must include the following attribution: 'This product includes software developed by
  > UncleCode … as part of the Crawl4AI project …'"

  It requires a prominent placement (README/NOTICE, an About page, CLI help).
  - The README says attribution is "recommended" in one sentence and "must" in the next
    [V]. That contradiction is a licence-clarity risk.
  - **maxx-seo-agent is a public repo** [R prior doc], so "public uses" plausibly applies.
- **Install scripts / global changes** [V `crawl4ai/install.py`]:
  - `crawl4ai-setup` (`post_install`) creates `~/.crawl4ai` (or `$CRAWL4_AI_BASE_DIRECTORY`).
  - It runs `python -m playwright install --with-deps --force chromium`. On Linux,
    `--with-deps` installs OS packages as root.
  - It runs a migration and prints a cloud notice. `CRAWL4AI_MODE=api` skips the browser
    install.
- **Dependencies** [V PyPI] include `playwright`, **`patchright`**, **`playwright-stealth`**,
  **`fake-useragent`** (anti-detection), `nltk`, `numpy`, `shapely`, and **`unclecode-litellm==1.81.13`**.
  The last is a vendor fork adopted after the 2026-03 PyPI `litellm` supply-chain compromise
  [V `SECURITY.md`, "Fixed in v0.8.6 (2026-03-24)"].
  - A forked LLM router that a single maintainer controls is a supply-chain concentration
    risk.
  - Stealth tooling has no place on our own site, and it makes Wordfence behaviour harder to
    reason about.
- **Cloud** [V crawl4ai.com, 2026-10-16]: credits cost $0.001 each.

  | Plan | Price | Credits/mo | Rate | Concurrency |
  |---|---|---|---|---|
  | Free | $0 | 1,000 | 10/min | 2 |
  | Starter | $10/mo | 10k | — | — |
  | Builder | $99/mo | 125k | — | — |
  | Scale | $499/mo | 750k | — | — |

  Credit costs: page 0.5, browser render 1, difficult site 2.
- **Overlap:** total with Playwright + Firecrawl.
- **Classification: Reject.**
- **Confidence:** high.

### 15. microsoft/playwright

- **Canonical:** https://github.com/microsoft/playwright [V].
- **Examined:** v1.64.1 (release 2026-10-14). Last commit 2026-10-16. 189 open issues.
  Apache-2.0 [V]. npm `playwright` 1.64.1, `engines.node >=20`, depends only on
  `playwright-core` 1.64.1 [V].
- **Install scripts:** the npm packages have **no lifecycle scripts**. `npm view playwright
  scripts` is empty and `playwright-core` exposes only `bin: cli.js` [V]. So `npm i` does not
  download browsers.
- **Browser install is an explicit, separate step that changes per-user global state** [V
  playwright.dev/docs/browsers]:
  - Browsers go to `%USERPROFILE%\AppData\Local\ms-playwright` (Windows) or
    `~/.cache/ms-playwright` (Linux). That cache is shared by every project on the machine.
  - `PLAYWRIGHT_BROWSERS_PATH` overrides the location.
  - `install-deps` / `--with-deps` installs OS packages and needs root on Linux.
  - The CLI at v1.64.1 has `install [browser...]` with `--only-shell`/`--no-shell`,
    `uninstall` (`--all` removes browsers for every install on the system), and
    `install-deps` [V `packages/playwright-core/src/cli/program.ts@v1.64.1`].
- **Compatibility:** ESM `import { chromium } from "playwright"` works on Node 22. No conflict
  with the repo's dependencies, since `playwright` has a single dependency.
- **Credentials:** none.
- **Unattended use:** yes, headless on `ubuntu-latest` (free on the public repo [R]).
- **Fidelity notes:**
  - For Googlebot parity, use full Chromium in new headless mode rather than headless-shell
    [E: Googlebot uses evergreen Chromium [R prior doc]; whether shell and full differ on
    this site is part of the SEO-12 spike].
  - Set an identifying `userAgent`. Whether Wordfence treats the default `HeadlessChrome` UA
    differently is UNVERIFIED.
- **Classification: Install as dependency** (devDependency or regular; it is a runtime
  verifier).
  - **Gap:** rendered-DOM read-back and the SEO-12 spike captures (2)/(3).
- **Windows PowerShell commands** (verified against the docs and CLI source; not executed):
  ```powershell
  npm i -D playwright@1.64.1
  npx playwright install chromium          # writes %LOCALAPPDATA%\ms-playwright (per-user, shared)
  # optional, keep browsers inside the worktree instead of the shared cache:
  $Env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.pw-browsers"; npx playwright install chromium
  ```
- **GitHub Actions:**
  `npm ci && npx playwright install --with-deps chromium`. Apt install on the ephemeral runner
  is fine. Cache `~/.cache/ms-playwright` keyed on the Playwright version.
- **Env vars:** `PLAYWRIGHT_BROWSERS_PATH` (optional) and `SITEMAP_URL` (already used).
- **Smoke test:**
  `node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch();const p=await b.newPage();const r=await p.goto('https://www.maxxbuilders.com/');console.log(r.status(),r.headers()['x-cache'],(await p.title()));await b.close()})"`.
  Expect 200 and the homepage title. This is a single GET on production, so run it once and
  at low concurrency.
- **Rollback:** `npm uninstall playwright`, then `npx playwright uninstall` (or delete the
  `ms-playwright` folder; avoid `--all` if other projects use Playwright).
- **Confidence:** high.

### 16. adbar/trafilatura

- **Canonical:** https://github.com/adbar/trafilatura [V].
- **Examined:** v2.3.1 (2026-10-06, which is also the last commit). 85 open issues.
  Apache-2.0. `requires_python >=3.10`. Light dependencies (`lxml>=6.1.3`, `courlan`,
  `htmldate`, `justext`, `urllib3`) [V PyPI].
- **Capabilities:** main-content and metadata extraction (boilerplate removal), with date
  extraction through `htmldate`. No rendering.
- **Gaps it could serve:**
  - the `programmatic-plan` uniqueness ratio ≥ 0.5 (no implementation in the repo; a grep for
    `uniqueness|jaccard|shingle` in `scripts/ lib/ orchestrator/` found none [R]);
  - the SEO-12 "main-content word count" field.
- **Node alternative:** `@mozilla/readability` 0.6.0 (Apache-2.0, last publish 2025-03-03) +
  `linkedom` 0.18.13 (ISC) [V npm]. Its extraction quality is lower than trafilatura's, which
  is a common benchmark claim [E, not re-verified today].
- **Classification: Defer.**
  - **Gap:** programmatic uniqueness gate.
  - **Trigger:** programmatic/location page batches start, or SEO-12 shows word-count deltas
    that matter. If adopted then, run it as a pinned CLI in a GitHub Actions Python step (`pip
    install trafilatura==2.3.1`), not as a repo-wide Python environment.
- **Confidence:** medium.

### 17. eliasdabbas/advertools

- **Canonical:** https://github.com/eliasdabbas/advertools [V].
- **Examined:** PyPI 0.18.0 (2026-06-17). No GitHub releases (404). Last commit 2026-06-30
  ("Drop Python 3.8 from CI"). 5 open issues. MIT [V].
- **Packaging inconsistency:** `setup.py` still says 0.17.2 while `pyproject.toml` says 0.18.0
  [V clone]. It is a sign of a single-maintainer project.
- **Dependencies:** `pandas`, `pyarrow`, `scrapy>=2.5`, `twython` (an unmaintained Twitter
  client) [V PyPI].
- **Capabilities** [V source]:
  - `crawl()` is a Scrapy spider. Its output columns include `canonical`, `h1`, `status`,
    `redirect_urls`/`redirect_reasons`, `links_url`, `img_src` and `jsonld_*`.
  - Other functions: `crawlytics.redirects/links/images/compare`, `sitemap_to_df`,
    `robotstxt_to_df/robotstxt_test`, `crawl_headers`, **`logs_to_df`** (server access logs
    → parquet), and reverse-DNS bot verification (`reverse_dns_lookup.py`).
  - No JS rendering.
- **Overlap:** crawl, sitemap and robots are covered by the Node plan. **Logs analysis is
  unique**, but there are no logs yet (host unknown [R]).
- **Classification: Defer** (as a Run-as-CLI candidate).
  - **Gap:** Googlebot log analysis.
  - **Trigger:** the operator confirms nginx access-log export.
  - Until then, use it as an architecture reference for the crawl column schema.
- **Confidence:** medium.

### 18. lycheeverse/lychee

- **Canonical:** https://github.com/lycheeverse/lychee [V]. Action:
  https://github.com/lycheeverse/lychee-action [V].
- **Examined:** CLI `lychee-v0.24.2` (2026-05-01). Last commit 2026-10-13. 78 open issues.
  Apache-2.0.
  - The action is at `v2.9.0` (2026-07-09) → commit
    **`e7477775783ea5526144ba13e8db5eec57747ce8`**. Its `lycheeVersion` defaults to `v0.24.2`
    [V `action.yml`]. Apache-2.0.
  - Release assets include `lychee-x86_64-pc-windows-msvc.zip` + `.sha256` [V].
- **Capabilities** [V README]:
  - It checks links in files *or a website URL* (`lychee https://…`).
  - Formats: `compact|detailed|json|junit|markdown`.
  - Features: `--cache` with `--max-cache-age` (default 1d), `--max-retries` (default 3),
    "respect rate limits", `--include`/`--exclude` regex, `-E --exclude-all-private`,
    `--user-agent`, `--header`, `--accept`.
  - **`--max-concurrency` defaults to 128.** It must be lowered for Wordfence on a
    production-only site.
  - **Recursion: no** (its own comparison table). Feed it every sitemap URL.
  - It checks raw HTML only.
- **Action security:** it downloads the binary with `curl -sfLO` and **does not verify the
  `.sha256`** [V `action.yml`]. Pin the action by SHA. Pinning `lycheeVersion` is
  belt-and-braces.
- **Credentials:** `token` defaults to `github.token`. It is used only to avoid GitHub
  rate limits on github.com links, and no new secret is needed.
- **Classification: Run as CLI (GitHub Action).**
  - **Gap:** no broken-link or redirect-target check exists at all [R]. It feeds `seo-audit`
    step 2/3 and the `internal-linking` "broken internal links" item.
- **GitHub Actions** (new weekly workflow, separate from `seo-sensors.yml`):
  ```yaml
  - id: urls   # e.g. node -e that prints collectPageUrls() space-separated to $GITHUB_OUTPUT
    run: node scripts/print-sitemap-urls.mjs >> "$GITHUB_OUTPUT"   # hypothetical helper
  - uses: lycheeverse/lychee-action@e7477775783ea5526144ba13e8db5eec57747ce8 # v2.9.0
    with:
      lycheeVersion: v0.24.2
      args: >-
        --no-progress --max-concurrency 4 --max-retries 2 --cache --max-cache-age 1d
        --user-agent "maxx-seo-agent-linkcheck (+https://github.com/BuildSmarterAI/maxx-seo-agent)"
        --exclude-all-private
        ${{ steps.urls.outputs.list }}
      format: json
      output: lychee/out.json
      fail: false
      jobSummary: true
  ```
  - Passing ~240 URLs as arguments is fine on Linux.
  - Whether `--files-from` accepts **URLs** rather than file paths is **UNVERIFIED**. The help
    text says "input filenames", so test it before relying on it.
- **Windows PowerShell** (local, optional):
  - `winget install --id lycheeverse.lychee` is a **machine/user-global install** [V README].
  - Preferred: download `lychee-x86_64-pc-windows-msvc.zip` v0.24.2 into a scratch folder,
    verify it with `Get-FileHash -Algorithm SHA256` against the `.sha256`, and run it from
    there.
- **Smoke test:**
  `lychee --no-progress --max-concurrency 2 --format json https://www.maxxbuilders.com/`.
  Expect a JSON summary with `total`/`successful`/`errors` and non-zero `total`. **Zero links
  checked is a vacuous pass.**
- **Rollback:** delete the workflow, or `winget uninstall --id lycheeverse.lychee` / delete the
  folder.
- **Caveats:**
  - External social links (LinkedIn) commonly return non-2xx to bots [E]. Add them to
    `--exclude` or `--accept` after the first run, rather than guessing now.
  - Run it on a schedule only after the Wordfence rate-limit question (prior doc §6.3) is
    answered.
- **Confidence:** high on capability, medium on Wordfence interaction.

### 19. GoogleChrome/web-vitals

- **Canonical:** https://github.com/GoogleChrome/web-vitals [V].
- **Examined:** tag v6.2.3, npm 6.2.3 (2026-10-05). No GitHub Releases. Last commit
  2026-10-16 ("drain queued LCP entries before disconnecting"). 13 open issues. Apache-2.0.
  `type: module` [V].
- **Lifecycle scripts:** `prepare: husky` runs only in a git checkout, not for registry
  consumers [E: npm semantics].
- **Capabilities:** `onLCP/onINP/onCLS/onFCP/onTTFB`, plus an "attribution" build (~1.5K
  brotli larger) carrying root-cause diagnostics [V README]. The README advises
  **self-hosting** over unpkg/jsDelivr/cdnjs [V README].
- **What RUM requires here:**
  - script injection on live WordPress (a gated change; no staging);
  - a collector, with GA4 as the zero-new-infrastructure option (GA4 is already in the repo:
    `GA4_PROPERTY_ID`) or a Supabase endpoint;
  - consent/privacy review.
- **Overlap:** CrUX (`sensor-cwv.mjs`) and PSI lab (`check-vitals.sh`, `vitals-pr.yml`) [R].
- **Classification: Defer (RUM).**
  - **Gap:** field CWV for URLs CrUX can't see, and INP attribution.
  - **Trigger:** CWV fixes blocked by "no CrUX data" on money pages.
  - **Optional adapt now ($0, no site change):** load the IIFE build into our Playwright pages
    via `page.addInitScript` for lab LCP/CLS during read-back [E].
- **Confidence:** medium-high.

### 20. sethblack/python-seo-analyzer

- **Canonical:** https://github.com/sethblack/python-seo-analyzer [V].
- **Examined:** PyPI `pyseoanalyzer` 2025.4.3 (2025-04-03). **No release in 18 months**,
  though `main` has commits (last 2026-10-08). 21 open issues.
- **Licence:** GitHub reports `NOASSERTION`. The `LICENSE` text is BSD-3-Clause [V clone].
- **Capabilities** [V `page.py`]:
  - urllib3 GET with **no JS**.
  - Warnings for title <10 or >70 chars (the repo rule is ≤60), missing description, missing
    og:*, missing alt, missing h1, missing `lang`, and "Anchor missing title tag".
  - The anchor-title warning is not an SEO requirement [E].
  - No canonical, robots, JSON-LD, or redirect-chain checks.
- **Optional LLM pass** [V `llm_analyst.py`]: LangChain + `ANTHROPIC_API_KEY`, or
  **`ORCAROUTER_API_KEY` routing to a third-party proxy** (`https://api.orcarouter.ai`). That
  conflicts with the global credential policy.
- **Dependencies:** pinned exact versions (`langchain==0.3.30`, `trafilatura==2.0.0`, …).
- **Classification: Reject.** The repo's metadata validator, schema lint and planned crawler
  already exceed it.
- **Confidence:** high.

---

## 3. Recommended composition from this batch [E]

```
sitemap (collectPageUrls, existing)
  ├─ fetch raw HTML + headers (A: as served, B: ?mx_verify=nonce)  → head-field read-back, cache staleness
  ├─ Playwright (1.64.1) rendered pass on Elementor/JS URLs        → rendered-DOM fields, SEO-12 captures
  └─ lychee-action (SHA-pinned, weekly, concurrency ≤4)            → broken links / redirect targets
Firecrawl CLI stays ad-hoc. Crawlee, trafilatura, advertools, web-vitals RUM: deferred with triggers.
```

---

## 4. Summary table

| # | Repo | Canonical | Version / date | Licence | Classification | Gap | Confidence |
|---|---|---|---|---|---|---|---|
| 11 | apify/crawlee | github.com/apify/crawlee | v3.18.2 / 2026-09-29 | Apache-2.0 | Defer | Discovery crawl beyond sitemap (not needed at ~240 URLs) | Medium |
| 12 | scrapy/scrapy | github.com/scrapy/scrapy | 2.19.0 / 2026-09-10 | BSD-3-Clause | Reject | None not covered by Node plan; Python, no JS | High |
| 13 | firecrawl/firecrawl | github.com/firecrawl/firecrawl | v2.11.0 / 2026-06-19 (SDK 4.46.0) | AGPL-3.0 server; MIT SDK; cloud ToS | Already covered | Ad-hoc rendered scrape (CLI); don't add SDK (zod 3 vs repo zod 4) | High |
| 14 | unclecode/crawl4ai | github.com/unclecode/crawl4ai | v0.9.5 / 2026-10-14 | Apache-2.0 + appended attribution requirement | Reject | None; attribution clause on public repo, stealth deps, forked litellm, root apt via setup | High |
| 15 | microsoft/playwright | github.com/microsoft/playwright | v1.64.1 / 2026-10-14 | Apache-2.0 | Install as dependency | Rendered-DOM read-back, SEO-12 spike captures | High |
| 16 | adbar/trafilatura | github.com/adbar/trafilatura | v2.3.1 / 2026-10-06 | Apache-2.0 | Defer | Programmatic uniqueness / main-content word count | Medium |
| 17 | eliasdabbas/advertools | github.com/eliasdabbas/advertools | 0.18.0 (PyPI) / 2026-06-17 | MIT | Defer (CLI when logs exist); architecture reference | Server-log Googlebot analysis | Medium |
| 18 | lycheeverse/lychee | github.com/lycheeverse/lychee (+ lychee-action) | CLI v0.24.2 / 2026-05-01; action v2.9.0 @ e747777 / 2026-07-09 | Apache-2.0 | Run as CLI (GitHub Action) | No broken-link check exists | High (capability) / Medium (Wordfence) |
| 19 | GoogleChrome/web-vitals | github.com/GoogleChrome/web-vitals | 6.2.3 / 2026-10-05 | Apache-2.0 | Defer (RUM); optional adapt in Playwright | Field CWV where CrUX has no data | Medium-high |
| 20 | sethblack/python-seo-analyzer | github.com/sethblack/python-seo-analyzer | 2025.4.3 / 2025-04-03 | BSD-3-Clause (GitHub: NOASSERTION) | Reject | None; weaker than existing validators; third-party LLM proxy | High |

---

## 5. Open items carried forward

1. Does the front nginx `X-Cache` layer bypass on an unknown query string? This is SEO-12, one
   GET pair.
2. Does Wordfence throttle Playwright or lychee at 1/2/4 concurrent requests, and does it treat
   the `HeadlessChrome` UA differently? This is SEO-12.
3. Does `lychee --files-from` accept URLs? Test it once locally.
4. crawl4ai attribution clause: moot while it is rejected; the vendor would need to clarify it
   before any reconsideration.

## 6. Sources (retrieved 2026-10-16 unless noted)

- GitHub REST API: `repos/<owner>/<repo>`, `/releases/latest`, `/commits?per_page=1`,
  `/tags` for all ten repos, plus `lycheeverse/lychee-action` and
  `git/ref/tags/v2.9.0`.
- npm registry: `npm view` for crawlee, @crawlee/playwright, @crawlee/browser-pool,
  @crawlee/core, playwright, playwright-core, @playwright/test, @mendable/firecrawl-js,
  firecrawl, web-vitals, @mozilla/readability, linkedom, cheerio.
- PyPI JSON: scrapy, crawl4ai, trafilatura, advertools, pyseoanalyzer.
- Shallow clones (read only): crawl4ai `LICENSE`, `README.md`, `pyproject.toml`,
  `crawl4ai/install.py`, `SECURITY.md`; python-seo-analyzer `LICENSE`, `pyproject.toml`,
  `pyseoanalyzer/{page,http,llm_analyst}.py`; lychee-action `action.yml`; web-vitals
  `README.md`, `package.json`; firecrawl `LICENSE`, `SELF_HOST.md`; advertools
  `advertools/*.py`, `setup.py`, `pyproject.toml`.
- Playwright CLI source:
  https://raw.githubusercontent.com/microsoft/playwright/v1.64.1/packages/playwright-core/src/cli/program.ts
- Playwright browsers: https://playwright.dev/docs/browsers
- lychee README (via GitHub API `repos/lycheeverse/lychee/readme`).
- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Crawl4AI Cloud: https://crawl4ai.com/
- WP Rocket query-string caching (updated 2026-09-04):
  https://docs.wp-rocket.me/article/971-caching-query-strings
- Repo [R]: `package.json`, `package-lock.json`, `packs/wordpress/apply.mjs:39`,
  `scripts/link-graph.mjs`, `scripts/sensor-cwv.mjs`, `scripts/check-vitals.sh`,
  `.github/workflows/*.yml`, `.claude/skills/{seo-audit,internal-linking}/SKILL.md`; prior docs
  `crawl-render-approach.md`, `wp-apply-surfaces.md` (2026-10-15).
