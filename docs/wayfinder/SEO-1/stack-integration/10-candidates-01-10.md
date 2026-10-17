# SEO stack integration: candidates 01–10

Read-only public research, 2026-10-16. Nothing was installed or executed. Repos were
shallow-cloned into the session scratchpad and only read. This extends the earlier
SEO-1 notes and does not repeat them:
`crawl-render-approach.md` (LHCI vs Unlighthouse, PSI), `first-party-search-apis.md`,
`seo-data-providers.md` (DataForSEO pricing and terms), `wp-apply-surfaces.md` and
`lead-attribution-path.md`.

**Repo baseline** (worktree `research/seo-stack-integration` @ `7a3d333`): Node ≥22 ESM;
deps `@anthropic-ai/claude-agent-sdk 0.1.77`, `googleapis ^144`, `google-auth-library ^10.7`,
`@supabase/supabase-js`, `marked`, `zod 4.4.3`. Sensors present: `sensor-gsc`,
`sensor-sitemap`, `sensor-cwv` (CrUX), `sensor-indexation` (GSC URL Inspection),
`sensor-ai-citations` (SerpApi AIO), `sensor-ai-referrals` (GA4 Data API via service
account), `sensor-paa`. `scripts/check-vitals.sh` runs Lighthouse **through the PSI API**
(no local Chrome). All workflows use `actions/setup-node` with `node-version: 22`. The
orchestrator `query()` calls use `allowedTools: ["Read","Write","Edit","Glob","Grep","Bash","Agent"]`
(`orchestrator/run.mjs:45,110`), so **no `mcp__*` tool is reachable headless today**.
`.mcp.json` already declares `analytics-mcp` (see §8).

Evidence tags: **[S]** read in source at the commit given · **[V]** official vendor
page or API, fetched 2026-10-16 · **[G]** `gh api` / `npm view` / PyPI JSON output ·
**[U]** unverified.

---

## Summary table

| # | Repo | Canonical | Version / date examined | License | Classification | Gap addressed | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | iannuttall/seo | github.com/iannuttall/seo (npm `seo`) | v0.5.0 (npm 2026-10-16), commit `c8beab5` 2026-10-16 | Apache-2.0 (+ hosted-service Terms/Privacy) | **Run as CLI** (pinned `npx`, service account, telemetry off). Spike only. **Reject** the hosted MCP | Ready-made GSC opportunity reports (cannibalization, decay, striking distance, Google-update compare) checked against `gsc-opportunity-mining` | Medium |
| 2 | AgriciDaniel/claude-seo | github.com/AgriciDaniel/claude-seo | v2.4.2 (2026-10-04), `4b99de2` | MIT | **Adapt selected skills/instructions** (seo-drift comparison rules; schema deprecation notes). **Reject** its installer | Post-apply on-page regression ("drift") rules; current schema-deprecation facts | Medium-high |
| 3 | dataforseo/mcp-server-typescript | github.com/dataforseo/mcp-server-typescript (npm `dataforseo-mcp-server`) | v3.1.3 (tag/npm), `1fc6d19` 2026-10-02 | Apache-2.0 (+ DataForSEO ToS) | **Connect as MCP server, interactive only** (docs lookup + ad-hoc pulls). Headless: **direct REST from Node** | Interactive keyword/SERP exploration; the endpoint docs index | High |
| 4 | janreges/siteone-crawler | github.com/janreges/siteone-crawler | Release v2.5.1 (2026-06-27); tags to v2.6.1; `f3d967b` 2026-09-27 | MIT | **Run as CLI** (spike candidate against the SEO-12 crawl plan) | One-binary crawl + QA gate (404s, redirects, headers, a11y/security/SEO checks), optional CDP rendering, JSON output, `--ci` exit 10 | Medium |
| 5 | StJudeWasHere/seonaut | github.com/StJudeWasHere/seonaut | No release/tags; `a67387f` 2026-10-08 | MIT | **Reject** | None that 4 or the existing Firecrawl path doesn't cover; web UI only, Docker + MySQL | High |
| 6 | GoogleChrome/lighthouse | github.com/GoogleChrome/lighthouse (npm `lighthouse`) | v13.5.0 (2026-09-18), `d8617fe` | Apache-2.0 | **Already covered** via PSI (`check-vitals.sh`). **Defer** local Lighthouse until PSI proves insufficient | Lab perf/a11y/SEO audits | High |
| 7 | GoogleChrome/lighthouse-ci | github.com/GoogleChrome/lighthouse-ci (npm `@lhci/cli`) | v0.15.1 (2025-06-26); main `08b9802` 2026-10-17 | Apache-2.0 | **Defer** (prior doc prefers Unlighthouse). If used: `filesystem` target only, never `temporary-public-storage` | Assertion/budget gate over a URL list | High |
| 8 | googleanalytics/google-analytics-mcp | github.com/googleanalytics/google-analytics-mcp (PyPI `analytics-mcp`) | 0.7.0 (2026-07-29), `75c0e1b` 2026-10-02 | Apache-2.0 | **Connect as MCP server (interactive only)**, already in `.mcp.json`. Pin the version and fix the launcher. Headless stays on the Node GA4 Data API | Ad-hoc GA4 exploration for the attribution work | High |
| 9 | coreyhaines31/marketingskills | github.com/coreyhaines31/marketingskills | v2.11.37 (2026-10-15), `365b412` | MIT | **Architecture reference** (selected passages only). **Reject** a wholesale install | SaaS-skewed, carries partner placements. A few `ai-seo` / `programmatic-seo` passages are useful as cross-checks | Medium |
| 10 | pradeepoct/google-search-console-mcp | github.com/pradeepoct/google-search-console-mcp (`package.json` points at JuJu78/gsc-mcp-connector) | No release; `48145eb` 2026-09-13 | MIT (copyright Julien Gourdon) | **Reject** | Redundant with the `googleapis` GSC sensor. Also over-broad `adwords` scope, 1 star, a detached copy | High |

---

## 1. iannuttall/seo

- **Canonical:** https://github.com/iannuttall/seo. Not archived, not a fork, created
  2026-07-10. Default branch `main`, 1 open issue, 578 stars. No GitHub Releases; tags
  `v0.5.0`, `v0.4.2`, `v0.4.1`. npm `seo` 0.5.0, latest, modified 2026-10-16, published with
  provenance [G].
- **Examined:** commit `c8beab5` (2026-10-16).
- **What it does [S]:** a TypeScript monorepo (`packages/core|cli|mcp`, `apps/web`, `apps/mcp`)
  that ships one npm package with bin `seo`, a library export (`seo`, `seo/mcp`,
  `seo/provider-sdk`) and one skill (`skills/seo/SKILL.md`, 106 lines). There are eight
  commands: `report`, `page`, `compare`, `index`, `research`, `data`, `crawl` and
  `internal-links`. Report sections are `overview`, `quick-wins`, `low-ctr`,
  `striking-distance`, `second-page`, `content-decay`, `cannibalization`, `traffic-drop`
  and `bing` (README; `packages/core/src/analyze/*`). `compare` overlays Google
  update dates (`traffic-anomaly*.ts`). `research` proxies the user's own DataForSEO or
  Ahrefs key. `crawl` has a rendering mode (`renderingModeArg`) that uses
  `playwright-core 1.61.1` against a detected or system Chrome
  (`fetch/page-fetcher/browser-path.ts`). It also depends on `lighthouse 13.4.1`.
- **Runtime:** Node `>=22.19.0` (engines) [G]. ESM (`"type":"module"`), so it is compatible
  with this repo. Native deps: `libsql`, `@napi-rs/keyring` (prebuilt binaries [U]). npm
  shows no `preinstall`/`postinstall`/`install` script [G]. It pulls in Lighthouse and
  playwright-core, a heavy transitive tree, so it should not be added to this repo's
  `dependencies`.
- **Credentials [S]:** OAuth through a **shared OAuth client** (`scripts/inject-shared-oauth-client.mjs`)
  or a service account. Scopes are fixed at `webmasters.readonly` + `analytics.readonly`
  (`gsc/auth/types.ts:12-13`). The service-account source is exactly one of
  `SEO_GOOGLE_SERVICE_ACCOUNT_JSON`, `SEO_GOOGLE_SERVICE_ACCOUNT_FILE` or
  **`GOOGLE_APPLICATION_CREDENTIALS`** (`gsc/auth/service-account.ts:39-55`), so the repo's
  existing `gcp.json` would be picked up unchanged. Optional: `SEO_TOKEN` (seoskill.dev
  account token), `SEO_BING_API_KEY`, DataForSEO/Ahrefs keys, `SEO_CONFIG_DIR` and
  `SEO_CACHE_DIR`.
- **Telemetry [S]:** anonymous usage telemetry is **on by default** after a first-run
  notice, posting to `https://seoskill.dev/api/t` (`telemetry-shared.ts:4`). It is
  auto-disabled under `GITHUB_ACTIONS` and other CI vars (`telemetry.ts:175`). Disable it
  with `DO_NOT_TRACK=1`, `SEOSKILL_TELEMETRY_DISABLED=1`, `SEO_TELEMETRY_DISABLED=1` or
  `seo telemetry disable` (PRIVACY.md §telemetry).
- **Hosted MCP (`https://seoskill.dev/mcp`) [S, PRIVACY.md]:** stores the linked Google
  accounts' refresh/access tokens, any saved DataForSEO/Ahrefs keys and Clicky passwords
  (encrypted) in Cloudflare D1. It is run by an individual maintainer. For Maxx this means
  handing a third party standing read access to GSC/GA4 and a paid DataForSEO credential.
  **Reject the hosted mode.**
- **License:** Apache-2.0 code. Separate TERMS.md, PRIVACY.md and TRADEMARKS.md cover the
  hosted service and the brand. Commercial use of the code is fine under Apache-2.0.
- **Maintenance:** very active (daily commits, 0.3→0.5 in about three months). The
  CHANGELOG shows **frequent breaking renames** ("old research reports became
  `seo research`"), so any use must pin the exact version.
- **Headless:** yes. `--json` "never prompts". The README CI example uses a service account.
- **Overlap:** GSC pulls (`sensor-gsc.mjs`), URL Inspection (`sensor-indexation.mjs`) and
  the `gsc-opportunity-mining` skill already exist. What is new is ready-made
  cannibalization/decay/striking-distance logic plus the Google-update overlay. The repo has
  an `ALGO_UPDATES_FILE` for its own analyst.
- **Classification: Run as CLI, spike only.** Use it as a second opinion against
  `gsc-opportunity-mining` output, especially the restaurant-cluster cannibalization risk
  named in root `CLAUDE.md`. Do not add it as a dependency, do not use the hosted MCP, and
  do not give it DataForSEO keys.
- **Command** (flags from README "Use it in CI and scripts"; PowerShell):
  ```powershell
  $env:SEO_TELEMETRY_DISABLED = '1'
  $env:GOOGLE_APPLICATION_CREDENTIALS = '<path to gcp.json>'
  npx -y seo@0.5.0 report --site sc-domain:maxxbuilders.com --section cannibalization --json > seo-cannibalization.json
  ```
  **Smallest smoke test:** `npx -y seo@0.5.0 sites --json`, which should list
  `sc-domain:maxxbuilders.com`. (`sites` is in the README; that it accepts `--json` is [U],
  though the README says "Add `--json` to any command".)
- **Unverified:** whether `GOOGLE_APPLICATION_CREDENTIALS` alone suffices for GA4
  sections, since the service account must be a GA4 property user (already true for
  `sensor-ai-referrals` per its header); and whether the native prebuilds install cleanly
  on Windows. Test: the smoke test above on Windows plus `ubuntu-latest`.

## 2. AgriciDaniel/claude-seo

- **Canonical:** https://github.com/AgriciDaniel/claude-seo. Not archived, `main`, 36 open
  issues, about 19.1k stars. Latest release **v2.4.2** (2026-10-04), last commit `4b99de2`
  (2026-10-04) [G].
- **What it does [S]:** 26 skills (`skills/seo*`, 6,715 SKILL.md lines in total) and 19
  agents (`agents/seo-*.md`). Python helper scripts (`scripts/`, `requirements.txt`:
  playwright, trafilatura, google-api-python-client, google-analytics-data, google-ads,
  weasyprint, matplotlib…). Nine extensions (ahrefs, dataforseo, firecrawl, unlighthouse,
  bing-webmaster…). A PostToolUse hook `hooks/hooks.json` runs
  `validate-schema.py` on every `Edit|Write`.
- **Runtime:** Python ≥3.10 plus a private venv created by `scripts/runtime.py setup`, and
  Git. Playwright browsers for rendering. No Node conflict, but it brings a second
  language runtime.
- **Installer [S, `install.ps1`]:** clones the tag, then copies **into global
  `%USERPROFILE%\.claude\skills\*` and `%USERPROFILE%\.claude\agents\*.md` with
  `Copy-Item -Force`**. That includes generic names such as `seo-audit`, `seo-schema`,
  `seo-sitemap` and `seo-programmatic`. These would shadow or confuse this repo's
  project skills (`seo-audit`, `schema-generate`, `programmatic-plan`) in every
  repository on the machine. It also rewrites the installed `.md` files in place and builds
  a Python venv. **Do not run it.** None of these skills is currently in
  `~/.claude/skills` (checked).
- **Agent tool grants [S]:** most agents get `Bash` + `Write`, and several get `WebFetch`.
  Fetched page content flows into agents that can write and execute, which is the
  prompt-injection-susceptible pattern. That is acceptable for an operator at the
  keyboard, not for the orchestrator.
- **Telemetry:** PRIVACY.md states "No telemetry, analytics, or usage tracking" [S].
- **Content quality spot-checks [S]:**
  - `seo-schema/SKILL.md:55`: "Google retired FAQ rich results for ALL sites on May 7, 2026".
    **Confirmed [V]**: Google's FAQPage doc now says the FAQ rich result "is deprecated and
    no longer shown in Google Search results". This bears on this repo's `faq-schema`
    skill (out of scope here, reported only).
  - `seo-geo/SKILL.md:350` labels the 130–170-word passage length "a heuristic, not a
    Google rule". That is honest, but it still leans toward the passage chunking that root
    `CLAUDE.md` says not to invest in.
  - `seo-drift` (219 lines): baseline/compare of title, meta description, canonical, robots,
    H1–H3, JSON-LD, OG, CWV, status and content hashes, with "17 rules across 3 severity
    levels" in `references/comparison-rules.md`. This matches a gap: the WP apply pack has
    rollback but no rule-based post-apply on-page diff [U, not exhaustively checked].
- **Material issues [G]:** #348 Windows venv rename failure (WinError 5), #344 Claude
  Desktop skips it since v2.4.2, #342 argument-index bug. These are packaging bugs.
- **License:** MIT, so adaptation with attribution is allowed.
- **Classification: Adapt selected skills/instructions.** Port the `seo-drift` comparison
  rules into a Node validator that runs after `wp:apply` and is wired to the existing
  rollback, and lift dated schema-deprecation facts into `schema-generate` after checking
  each one against Google docs. Keep MIT attribution in the ported file header.
- **Smoke test (no install):** read
  `skills/seo-drift/references/comparison-rules.md` at tag v2.4.2 and map each rule onto
  fields `scripts/cms-read.mjs` can already read.

## 3. dataforseo/mcp-server-typescript

- **Canonical:** https://github.com/dataforseo/mcp-server-typescript (vendor org). Default
  branch **`master`**, 4 open issues. No GitHub Releases; tags to **v3.1.3**. npm
  `dataforseo-mcp-server` 3.1.3, engines `node >=22`, Apache-2.0, last commit 2026-10-02
  [G].
- **What it does in v3 [S]:** it is no longer one tool per endpoint. It exposes **generic
  tools**: `docs-index`, `docs-list-sections`, `docs-search` and **`api_request`**, which
  takes `method ∈ {GET,POST,PUT,DELETE}`, any `path`/`url` and an arbitrary `data` body
  (`src/core/tools/api-request-tool.ts`). Annotated `readOnlyHint:false`. The only
  middleware truncates Live-endpoint bodies to one task
  (`live-endpoint-api-request-middleware.ts`). There is **no path allowlist and no spend
  cap**, so an agent can call any paid endpoint repeatedly. It also runs as a CLI
  (`dataforseo-mcp-server request -X POST -p /v3/...`) and in HTTP mode, and a hosted remote
  is at `https://mcp.dataforseo.com/v3/mcp` (OAuth).
- **Credentials:** `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` (HTTP Basic; stdio needs env)
  [S README + `env.ts`]. Optional `FIELD_CONFIG_PATH` / `FIELD_CONFIG_JSON` and `DEBUG`. The
  DataForSEO API has no scope granularity: the login is the whole account balance.
- **Install footprint [G]:** runtime dependency `wrangler ^4.125.0`, which pulls in
  `workerd` (npm `postinstall: node install.js`, a native binary download), miniflare and
  esbuild. That is heavy and has an install-time network hook. Do not add it to
  `package.json`.
- **Pricing [V, fetched 2026-10-16]:** "$50 minimum top-up" and "Balance never expires"
  (https://dataforseo.com/pricing). A **"$1 trial credit"** for new accounts (pricing page;
  new since the prior doc listed it as unknown). Google Organic SERP: Standard **$0.0006**,
  Priority **$0.0012**, Live **$0.002** per SERP, async AI Overview "+1 base price"
  (https://dataforseo.com/pricing/serp/google-organic-serp-api). Google Ads search volume:
  Standard **$0.06**, Live **$0.09** per task, up to 1,000 keywords per task
  (https://dataforseo.com/pricing/keywords-data/google-ads). Labs "$0.012 / task + $0.00012 /
  item". MCP usage is billed as ordinary API calls (no separate MCP price shown). ToS [V]:
  30-day refund on first-time credit purchases only; SERP data "shall not be used to
  compete with or adversely affect the business interests of the search engine
  providers"; accounts may be removed "without restitution". These match
  `seo-data-providers.md`.
- **MCP vs direct REST:** the repo's headless path (`scripts/keyword-research.mjs`,
  planned rank sensor) should call REST directly with `fetch` + Basic auth. That gives
  zero dependencies, an explicit endpoint allowlist, task batching on the Standard queue
  (Live is 3.3× the price) and spend logged against `control.spend_usd`. The MCP adds value
  only interactively: `docs-search` fetches the vendor's own endpoint docs and examples,
  which is useful when writing that REST code.
- **Classification: Connect as MCP server, interactive and opt-in only.** Use a
  sub-account or low balance, and never add it to the orchestrator's `allowedTools`.
  Headless: **direct REST**.
- **Command** (README stdio block; PowerShell, user-scoped so the credential never sits in
  the repo's `.mcp.json`):
  ```powershell
  claude mcp add dataforseo --scope user -e DATAFORSEO_LOGIN=<login> -e DATAFORSEO_PASSWORD=<password> -- npx -y dataforseo-mcp-server@3.1.3
  ```
  The `claude mcp add … -e … --` form matches the shape in the google-analytics-mcp README.
  Pinning the version follows the repo's practice for the Supabase MCP.
  **Smallest smoke test ($0):** `npx -y dataforseo-mcp-server@3.1.3 docs index --list-sections`.
  It uses no credentials and spends nothing (README CLI table).
- **Unverified:** whether `docs` commands need credentials (README implies not); whether a
  DataForSEO sub-user with a balance cap exists [U]. Test: the docs command with env unset,
  plus a check of the DataForSEO dashboard.

## 4. janreges/siteone-crawler

- **Canonical:** https://github.com/janreges/siteone-crawler. Not archived, `main`, 16 open
  issues, 957 stars. **Latest GitHub Release v2.5.1 (2026-06-27)**, but `Cargo.toml` on
  `main` and the tags are at **v2.6.1** with no release assets [G/S]. Last commit
  `f3d967b` (2026-09-27).
- **What it does [S README]:** a Rust single binary. Crawls a site (or a sitemap URL) and
  reports 404s, redirects, headers, caching, DNS/SSL, security, accessibility,
  best-practice and SEO/OpenGraph findings, with a 0–10 quality score. Outputs HTML report,
  `--output=json` / `--output-json-file`, text, sitemap generation, offline clone and
  markdown export. `--ci` quality gate with `--ci-min-score`, `--ci-max-404` and others, exit
  code **10** on failure. `--workers` (default 3) and `--max-reqs-per-sec` (default 10).
  Optional **`--browser`** renders with real Chromium over CDP and auto-detects
  Chrome/Edge, offering to download `chrome-headless-shell` otherwise. Optional opt-in LLM
  "AI assistant" (OpenAI/Anthropic/Gemini keys).
- **Data exposure:** `--upload` sends the HTML report to `https://crawler.siteone.io/up`
  (default retention 30d), but it is **opt-in** (README "Upload options"; `upload_exporter.rs`).
  Never pass `--upload`.
- **Runtime:** release assets for `win-x64.zip`, `linux-x64.tar.gz` (glibc 2.39+, which
  means ubuntu-24.04 runners) and `linux-musl-x64` [G]. No Node, Python or container needed.
- **Credentials:** none. If the AI assistant were ever used, it would need an LLM key. Per
  global policy, **never** pass `ANTHROPIC_API_KEY`; leave the feature off.
- **Overlap:** Firecrawl crawl audits exist, and `crawl-render-approach.md` picked
  Crawlee + Playwright + Unlighthouse for SEO-12. SiteOne could replace the "build a
  crawler" part with a binary that already emits JSON and a CI exit code. WP Rocket's
  delay-JS means `--browser` mode matters, and in that mode headers and cookies aren't
  forwarded to the browser (README limitations).
- **Classification: Run as CLI**, as a spike competitor in SEO-12, not adopted yet.
- **Command** (flags verified in README option tables; PowerShell, after downloading and
  extracting `siteone-crawler-v2.5.1-win-x64.zip` from the v2.5.1 release):
  ```powershell
  .\siteone-crawler.exe --url=https://www.maxxbuilders.com/sitemap_index.xml --workers=2 --max-reqs-per-sec=2 --max-visited-urls=200 --output=json --output-json-file=tmp\siteone.json --output-html-report=tmp\siteone.html
  ```
  **Smallest smoke test:** the same command with `--single-page` against
  `https://www.maxxbuilders.com/`.
- **Unverified:** the executable name inside the Windows zip [U]; the sitemap index path
  (Yoast default `sitemap_index.xml` [U]); whether Wordfence rate-limits 2 req/s; and
  whether v2.6.x will get release binaries. Test: unzip and list, then the single-page run.

## 5. StJudeWasHere/seonaut

- **Canonical:** https://github.com/StJudeWasHere/seonaut. Not archived, `main`, 10 open
  issues, 808 stars. **No releases or tags**. Last commit `a67387f` (2026-10-08) [G].
- **What it does [S]:** a Go 1.25 web app with MySQL 8.4 (`docker-compose.yml`). It crawls
  a project and shows issues in a dashboard. Exports (`/export/csv`, `/export/sitemap`,
  `/export/resources`, `/export/wazc`) are **cookie-session-authenticated HTML routes**
  (`internal/routes/app.go:49-53`). There is no CLI, API token or JS rendering
  (no chromedp/headless in `go.mod` or `internal/`).
- **Runtime:** Docker + MySQL. The sample compose file uses `root`/`seonaut` passwords.
- **Headless:** no practical path. A cron job would have to script a login session.
- **Classification: Reject.** It would mean running a stateful service with no
  machine interface, for less than #4 or Firecrawl already gives.

## 6. GoogleChrome/lighthouse

- **Canonical:** https://github.com/GoogleChrome/lighthouse, `main`, 473 open issues.
  **v13.5.0 (2026-09-18)**, npm latest 13.5.0, last commit 2026-10-17 UTC [G].
- **Node 22:** `engines.node ">=22.19"`, `"type":"module"`. README: "Lighthouse requires
  Node 22 (LTS) or later." [G/S]. `setup-node` `22` resolves to the newest 22.x, and the
  ubuntu-24.04 image ships Node 22.23.3, so it is compatible.
- **Chrome on GitHub Actions [G, `actions/runner-images` Ubuntu2404-Readme.md]:** the
  ubuntu-24.04 image includes **Google Chrome 155.0.8059.39** and Chromium 155, so no
  browser install step is needed. Pass `--chrome-flags="--headless"` (README example);
  LHCI's docs use `--no-sandbox` for containers.
- **Telemetry:** the CLI asks on first run to send anonymous runtime-exception reports;
  `--no-enable-error-reporting` disables it (README). No npm lifecycle scripts.
- **CLI (README):** `lighthouse <url> --output=json --output-path=./report.json --only-categories=performance,seo,accessibility --quiet --chrome-flags="--headless"`.
- **Overlap:** `check-vitals.sh` and `vitals-pr.yml` already run Lighthouse on Google's
  infrastructure via PSI, at $0 and without Chrome. Lighthouse lab scores are diagnostics,
  not ranking inputs (`first-party-search-apis.md` §2.3).
- **Classification: Already covered (PSI). Defer local Lighthouse.** Revisit only if PSI
  quota or variance blocks the vitals gate, or if a pre-production/authenticated URL must
  be tested, which PSI cannot reach. Note that `iannuttall/seo` 0.5.0 pins Lighthouse 13.4.1.

## 7. GoogleChrome/lighthouse-ci

- **Canonical:** https://github.com/GoogleChrome/lighthouse-ci, `main`, 199 open issues.
  **Latest release v0.15.1 (2025-06-26)**. `main` shows a burst of commits on 2026-10-17
  (puppeteer ^24.43.1, inquirer 8, a getChromiumPath fix), but **nothing released for 16
  months** [G].
- **Node 22:** `@lhci/cli` 0.15.1 declares no `engines`. It pins **`lighthouse 12.6.1`**
  (engines `>=18.20`) [G], so it runs on Node 22, but it audits with the previous
  Lighthouse major (12, versus 13.5 current). Its scores won't match PSI's current engine.
- **Storage / data exposure [S docs]:** `upload.target` choices are `lhci` (default, needs
  your own LHCI server), `temporary-public-storage` and `filesystem`.
  `services-disclaimer.md`: temporary public storage is run by **Eris Ventures LLC**,
  uploads are "public information that can be accessed by anyone in the world", kept "3
  days to 5 weeks", and stored on GCP. The getting-started guide and the GitLab example
  default to it, so copying the examples would leak reports. **Use `filesystem` with
  `--outputDir`** if LHCI is ever used. An LHCI server is a separate Node service plus a
  database. Not worth it at 31 URLs.
- **PSI mode:** `collect.method: "psi"` + `psiApiKey` runs via PSI without Chrome, but "no
  other collection options will be respected" (configuration.md).
- **Classification: Defer.** `crawl-render-approach.md` already recommends Unlighthouse
  (MIT, active, Node ≥22.18) for multi-URL lab runs, and PSI covers the per-change canary.
  If LHCI is chosen anyway: `npx -y @lhci/cli@0.15.1 autorun --upload.target=filesystem --upload.outputDir=./lhci`
  (flag names from configuration.md `--outputDir [filesystem only]`; the dotted form is
  [U]).

## 8. googleanalytics/google-analytics-mcp

- **Canonical:** https://github.com/googleanalytics/google-analytics-mcp (official
  googleanalytics org), `main`, 29 open issues, 3.5k stars. Release **0.7.0
  (2026-07-29)**. PyPI `analytics-mcp` 0.7.0 uploaded 2026-07-29, `requires_python >=3.10`.
  Last commit 2026-10-02 (dependency bump) [G].
- **What it does [S]:** Python MCP server, **stdio transport only**
  (`server.py`, `mcp.server.stdio`). Tools: `get_account_summaries`,
  `get_property_details`, `list_google_ads_links`, `list_property_annotations`,
  `run_report`, `run_realtime_report`, `run_funnel_report`, `run_conversions_report` and
  `get_custom_dimensions_and_metrics` (`coordinator.py`). All are read-only; there are no
  Admin writes.
- **Scopes [S]:** credentials come from `google.auth.default(scopes=[analytics.readonly])`
  (`tools/client.py:50-84`). ADC uses `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth
  application-default login`. The README's gcloud example also adds the `cloud-platform`
  scope; with a service-account JSON only `analytics.readonly` is requested. It includes a
  Windows stdio-deadlock workaround for gcloud subprocesses.
- **Dependencies:** pins `google-analytics-data==0.23.2` and
  `google-analytics-admin==0.30.1`, and also requires **`google-adk>=1.29.0`** (Google's
  Agent Development Kit, used only for tool-schema conversion). That is a large transitive
  tree.
- **Already configured in this repo:** `.mcp.json` declares
  `"analytics-mcp": {"command":"uvx","args":["analytics-mcp"], env GOOGLE_APPLICATION_CREDENTIALS}`
  (added 01f854e, 2026-07-08, #89). Two problems:
  1. It is **unpinned** (`uvx analytics-mcp` resolves to the latest PyPI release each
     time, unlike Supabase pinned at `@0.8.2`).
  2. In this session the server failed with **CONNECTION_CLOSED**, and `uvx`/`pipx` are
     **not on the Git Bash PATH** here. Likely cause [U]; uv may live elsewhere on the
     launcher's PATH.
- **Headless:** technically yes (stdio, ADC), but the orchestrator's `allowedTools`
  excludes `mcp__*`, and `sensor-ai-referrals.mjs` already calls the GA4 Data API from Node
  with the same service account. Adding a Python MCP to CI would add a runtime for no new
  capability.
- **Classification: Connect as MCP server (interactive only), already done.** Pin it and
  get it connecting. Headless GA4 stays on Node.
- **Fix (README's documented runner is `pipx run analytics-mcp`; the repo uses `uvx`):**
  change `.mcp.json` args to `["analytics-mcp==0.7.0"]` for uvx. That is standard uv
  requirement syntax [U for this entry]. Then confirm uv is installed
  (`winget install --id=astral-sh.uv -e` [U, not checked against uv docs this session]).
  **Smoke test:** in an interactive session, `/mcp` should show `analytics-mcp`
  connected, and `get_account_summaries` should list the Maxx property behind
  `GA4_PROPERTY_ID`. That also answers open question 1 in `lead-attribution-path.md`.

## 9. coreyhaines31/marketingskills

- **Canonical:** https://github.com/coreyhaines31/marketingskills, `main`, 27 open issues,
  about 55k stars. Release **v2.11.37 (2026-10-15)** [G]. MIT.
- **What it does [S]:** 47 skills (`skills/*`). SEO-relevant ones: `seo-audit` (496 lines),
  `ai-seo` (499), `programmatic-seo` (242), `schema` (191), `site-architecture` (359),
  `competitors`. Each has `references/` and `evals/evals.json`. `tools/clis/*.js` holds
  vendor CLI wrappers (including `dataforseo.js` and `ahrefs.js`).
- **Commercial placements [S]:** `partners.json` is a "Canonical partner registry" of paid
  "skill-partner" tier vendors (e.g. Converly, Ploy). Skills mention them inline with a ◆
  "Verified Partner" disclosure (`ai-seo/references/agent-readiness.md:46`,
  `programmatic-seo/references/implementation-platforms.md:34`). The maintainer discloses
  authoring a partner's playbook. These instructions would make an agent recommend vendors.
- **Fit:** SaaS-oriented (G2/Capterra profiles, paywalls, signup). It has no construction
  or local-GC angle. Some content agrees with repo policy: `ai-seo/SKILL.md:100,446` quotes
  Google's "Don't break your content into tiny pieces for AI", which matches root
  `CLAUDE.md`'s no-chunking rule. `npx is-agentic` is suggested as a scoring tool (third-party
  code, not vetted here).
- **Classification: Architecture reference.** Read `ai-seo` and `programmatic-seo`
  references as a cross-check when revising `restructure-for-citation` / `programmatic-plan`.
  Copy no skill wholesale, remove partner references from anything adapted, and keep MIT
  attribution.

## 10. pradeepoct/google-search-console-mcp

- **Canonical:** https://github.com/pradeepoct/google-search-console-mcp. 1 star, created
  2026-08-18, 15 commits, not a GitHub fork. But `package.json` names
  `gsc-mcp-connector`, `repository: JuJu78/gsc-mcp-connector`, author Julien Gourdon, and the
  first four commits are by JuJu78 (2026-05-04). It is a **detached copy** of
  https://github.com/JuJu78/gsc-mcp-connector (MIT, 1 star, last push 2026-05-12) [G/S].
  Latest commit `48145eb` (2026-09-13) added DataForSEO, Clarity, SERP and Google Ads tools.
- **What it does [S]:** a Cloudflare Worker (wrangler 3, Durable Objects, KV) MCP server
  with 34 tools: GSC, GA4, Google Ads Keyword Planner, SerpApi/Serper AIO, Clarity and
  DataForSEO. OAuth user flow plus a `MCP_BEARER_TOKEN` gate. The operator's
  DataForSEO/SerpApi/Ads credentials are Worker secrets used for every caller.
- **Scopes [S, `src/google_auth.ts:13-15`]:** `webmasters.readonly`, `analytics.readonly`
  and **`https://www.googleapis.com/auth/adwords`**. The `adwords` scope is full Google Ads
  API access, not read-only. That is broader than any SEO read needs.
- **Hygiene:** `wrangler.jsonc` commits a Cloudflare `account_id` and KV namespace id.
  `.npmrc` sets `legacy-peer-deps=true`. One-person maintenance.
- **Overlap:** fully redundant with `sensor-gsc.mjs` / `orchestrator/lib/gsc.mjs`
  (googleapis + service account), `sensor-ai-referrals` (GA4) and `sensor-ai-citations`
  (SerpApi). A remote Worker MCP can't be used headless by the orchestrator anyway.
- **Classification: Reject.**

---

## Cross-cutting findings

1. **GSC MCPs are redundant headless.** The `googleapis` service-account path already covers
   Search Analytics and URL Inspection, and the orchestrator can't call `mcp__*` tools. The
   only GSC-side tool worth time is #1's CLI, as an analysis second opinion.
2. **DataForSEO: REST in code, MCP at the keyboard.** v3's generic `api_request` tool has
   no endpoint allowlist or budget guard. Keep it out of any unattended loop.
3. **Lighthouse family: PSI stays primary.** Chrome 155 is preinstalled on ubuntu-24.04
   runners and Lighthouse 13.5 supports Node 22, so a local run is cheap to add later. But
   LHCI's last release is stale (Lighthouse 12) and its docs default to public storage.
4. **Skill imports: copy content, never run installers.** claude-seo's installer
   force-copies about 26 skills and 19 agents into global `~/.claude`, which collides by
   name with project skills. marketingskills carries paid partner placements.
5. **Out-of-scope item to route to a ticket:** Google's FAQPage doc now says the FAQ rich
   result is deprecated and no longer shown [V]. This repo's `faq-schema` skill should be
   reviewed.

## Open questions / smallest tests

| Question | Test |
|---|---|
| Does `seo@0.5.0` read GSC with only `GOOGLE_APPLICATION_CREDENTIALS`? | `npx -y seo@0.5.0 sites --json` with telemetry disabled |
| Why does `analytics-mcp` fail to connect? | Run `uvx analytics-mcp==0.7.0` in a terminal; check `where.exe uvx` |
| Do DataForSEO MCP `docs` commands work without credentials? | `npx -y dataforseo-mcp-server@3.1.3 docs index --list-sections` with env unset |
| Does SiteOne `--browser` see WP Rocket delayed-JS content and Elementor links? | Single-page run with and without `--browser`; diff link counts |
| Will SiteOne v2.6.x ship binaries? | Watch the releases page; until then pin v2.5.1 |
| Can a DataForSEO balance be capped per credential? | DataForSEO dashboard / support |

## Sources (fetched or read 2026-10-16)

- GitHub API (`gh api repos/<r>`, `/releases/latest`, `/tags`, `/commits`) for all 10 repos;
  `actions/runner-images` `images/ubuntu/Ubuntu2404-Readme.md`.
- npm: `npm view seo`, `dataforseo-mcp-server`, `lighthouse`, `lighthouse@12.6.1`,
  `@lhci/cli`, `wrangler@4.125.0`, `workerd`. PyPI JSON: https://pypi.org/pypi/analytics-mcp/json
- Source read at the commits listed per section (shallow clones, not executed).
- https://dataforseo.com/pricing · https://dataforseo.com/pricing/serp/google-organic-serp-api ·
  https://dataforseo.com/pricing/keywords-data/google-ads · https://dataforseo.com/terms-of-service
- https://developers.google.com/search/docs/appearance/structured-data/faqpage
- LHCI docs in repo: `docs/getting-started.md`, `docs/configuration.md`,
  `docs/services-disclaimer.md`. Lighthouse `readme.md` and `package.json` via the contents API.
