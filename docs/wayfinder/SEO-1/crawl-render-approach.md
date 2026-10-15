# Crawl and render-audit approach for maxxbuilders.com (WP Rocket + Elementor)

**Question.** Which crawl and render-audit approach covers this WP Rocket + Elementor site
at acceptable cost? Today nothing crawls on a schedule. The 2026-06 audit used Chrome
DevTools by hand, the `seo-audit` skill expects a crawl CSV, and `scripts/link-graph.mjs`
is not wired into any workflow.

**Date of research:** 2026-10-15. Every external fact below was read on 2026-10-15 from
the URL next to it. Repo facts were read at `origin/main` 7e50e22.
**Status:** research findings, pending coordinator verification. Nothing was installed,
no sign-ups or paid runs were made, and maxxbuilders.com was not crawled for this
research.

Legend: **[V]** verified on a primary source (vendor page, docs, EULA, GitHub API) today ·
**[R]** read from this repo or a prior in-repo audit · **[E]** estimate from stated
assumptions · **ND** = not documented on the primary source.

---

## 0. TL;DR

1. **Recommendation: build, in two pieces. Confidence: medium.**
   - **Piece 1, the crawler.** A small in-repo crawler on Crawlee + Playwright
     (both Apache-2.0) runs weekly in GitHub Actions. It writes a Screaming-Frog-shaped CSV
     into `crawl/` for the `seo-audit` skill. The same crawler replaces the raw-`fetch`
     regex link extraction in `link-graph.mjs`.
   - **Piece 2, lab checks.** Unlighthouse (MIT) runs Lighthouse with axe-core over the
     priority URLs for lab CWV and accessibility.
   - **Cost.** About **$0/mo**, because the repo is public and standard GitHub-hosted
     runners are free for public repos.
   - **Medium, not high.** Two things are unproven: whether Playwright sees what Chrome
     and Googlebot see on WP Rocket's delayed-JS pages (that is the SEO-12 spike), and how
     much effort the build takes.
2. **Why not just buy Screaming Frog ($279/yr ≈ $23/mo)?** It is the best off-the-shelf fit
   on checks and output format. Its CSV is exactly what `seo-audit` names. However, the
   **EULA has not been cleared for GitHub-hosted runners**:
   - the software may run only on "computers that are owned or controlled by the licensee";
   - "only the User will operate" it;
   - only "1 instance … at any one time" is allowed;
   - it must not be used to "create any automated tool or service capable of being accessed
     by anyone other than the User".

   Screaming Frog's own cloud guide permits "as many instances … as required in the Cloud",
   which contradicts clause 3.2(c). **If Screaming Frog confirms in writing that one
   single-user licence may run headless on GitHub-hosted runners**, it becomes a credible
   *buy* alternative and should be re-scored. Until then, it fits only as the operator's
   desktop tool for occasional deep audits. The free tier can't do the job: it has **no
   JavaScript rendering, scheduling or structured-data validation**.
3. **Firecrawl stays the ad-hoc tool, not the recurring crawler.**
   - **For:** it renders JavaScript, supports `actions` (scroll, click, wait), and the
     weekly workload (~1,040 pages/mo [E]) roughly fits the 1,000-credit free tier, or Hobby
     at $19/mo.
   - **Against:** it does not document canonical or redirect-chain capture, or the status of
     links it never fetched. Output is JSON, so it needs an adapter, and every week costs
     credits.
   - **Evidence:** the 2026-10-14 Firecrawl audit used ~170 credits [R].
4. **Sitebulb doesn't fit a GitHub Actions loop.** No CLI is documented. Scheduling lives
   in the desktop app (Pro $42/mo) or in Sitebulb Cloud (from £95/mo, with webhooks and S3
   export).
5. **Rendering is the crux, and it is a site-specific risk.**
   - **The mechanism.** WP Rocket's *Delay JavaScript execution* runs delayed scripts only
     on user-interaction events, and its docs mention no timeout fallback. Google states
     that Search "does not interact with your page".
   - **What that means.** A renderer that waits but never interacts, Googlebot included,
     may miss content that delayed scripts inject.
   - **What we have seen.** The 2026-10-14 audit already saw an empty `/projects/*` project
     grid in a Firecrawl render. It has not been confirmed in a real browser [R].
   - **What SEO-12 must measure.** Raw HTML, a passive render, an interacting render and
     real Chrome, field by field (§4).
6. **Server logs: unknown.** The host is not identified. The response headers show nginx
   with a page cache [R]. Whether access logs can be exported was not established, so this is
   an open question for the operator (§6).

---

## 1. Context and constraints (from the repo and the map)

- **`seo-audit` input contract** [R] (`.claude/skills/seo-audit/SKILL.md`, "Inputs" and
  "Steps"):
  - Input is `./crawl/*.csv`, described as "Screaming Frog / Sitebulb / Firecrawl".
  - Per-URL fields it needs: status, title length, meta description presence and length,
    canonical and self-reference, H1 count, indexability (robots or meta), and JSON-LD type.
  - Hygiene checks need redirect chains, soft-404s, and the sitemap ∩ indexability join.
  - The internal-link step needs a **link export** (crawl ∩ sitemap ∩ links).
  - Performance comes from PSI through `scripts/check-vitals.sh` over `config/urls.txt`,
    which holds 31 lines.
  - There is no `crawl/` directory at 7e50e22.
- **`scripts/link-graph.mjs`** [R]:
  - It reads `SITEMAP_URL` and takes the first `LINK_GRAPH_MAX_PAGES` URLs (default
    **150**). The live sitemap lists 238 URLs, so about 88 pages are silently left out [R:
    2026-10-14 audit].
  - Each page is fetched with plain `fetch` (no rendering), and `href` values are pulled
    out with a regex (`run()`).
  - Results go to `link_graph` through `db.from("link_graph").upsert` (`:89`, error
    unchecked per the baseline). Orphans go through `enqueue()`.
  - No workflow calls it (grep of `.github/workflows/` shows no reference).
- **Existing scheduled runner** [R]:
  - `.github/workflows/seo-sensors.yml` runs nightly at `cron: "0 7 * * *"`.
  - Every sensor sits in one shared `run:` block: `sensor-gsc`, `sensor-sitemap`,
    `sensor-indexation`, `sensor-cwv`.
  - `vitals-pr.yml` runs PSI on `deployment_status`.
  - Lab CWV already exists through PSI (`check-vitals.sh`). Field CWV comes from CrUX
    (`scripts/sensor-cwv.mjs`, which does nothing without a key).
- **Site facts** [R, baseline §4]:
  - Stack: WordPress 7.1.3, Elementor 4.0.7 + Pro, and WP Rocket 3.23.2.2 with delay-JS,
    lazy-load and CDN rewrite.
  - Also installed: Wordfence, Slider Revolution, and nginx with a page cache.
  - There is no staging environment, and the site has about 238 sitemap URLs.
- **Repository is public** [V: GitHub API `repos/BuildSmarterAI/maxx-seo-agent` →
  `"visibility":"public"`, 2026-10-15]. Two consequences:
  - Actions minutes are free.
  - Anything committed (such as crawl CSVs) is public. Decide whether `crawl/` output
    should be committed or kept as short-lived workflow artifacts / Supabase rows.
- **Map rules** (SEO-1):
  - The balanced stack must stay at or under ~$300/mo.
  - A licensing or compatibility failure disqualifies an option.
  - No invented pricing.
  - Spikes are capped at $25, with sign-off.

**Workload assumption [E]:** 240 URLs × 4.33 weekly runs ≈ **1,040 page renders/month**.
That is the full sitemap plus a few non-sitemap link targets. Lab CWV covers the 31 priority
URLs.

---

## 2. Comparison table

Weekly cost assumes ~240 URLs; monthly ≈ 1,040 renders [E]. "GHA" = GitHub Actions on
GitHub-hosted `ubuntu-latest`.

| Option | Rendering | Checks out of the box (canonical / robots / sitemap / redirects / duplicates / structured data / broken links) | Schedulable in GHA | Output vs `seo-audit` input | Cost for ~240 URLs weekly | Licence | Maintenance / exit |
|---|---|---|---|---|---|---|---|
| **Screaming Frog SEO Spider (paid)** | Chromium JS rendering, **paid only** [V1]. Headless Linux needs a virtual display (Xvfb) for JS rendering [V3]. | All seven. Structured-data validation and near-duplicates are **paid only** [V1]. Bulk exports cover inlinks/outlinks and broken-link sources [V3]. | **Technically yes**: `.deb` for Ubuntu, `--headless --crawl … --export-tabs … --bulk-export … --export-format csv` [V3]. **Licence not cleared** for hosted runners (§3) [V2]. | **Native.** CSV tabs are what the skill names. Needs only an `Internal:All` + `All Inlinks` column map. | **$279/yr ≈ $23/mo** (£199 / €245) per user [V1]. GHA minutes $0 (public repo) [V6]. | Proprietary EULA, last updated 7 May 2024 [V2]. | Vendor-maintained (v24.3 shown) [V1]. Low lock-in: CSV output; config lives in the `spider.config`/`.seospiderconfig` file. |
| **Screaming Frog (free)** | **None.** JS rendering is crossed out [V1]. | Broken links, redirects, titles/meta, directives, exact duplicates and sitemaps are ticked. **No** structured data, near-duplicates or scheduling [V1]. | Scheduling is crossed out [V1]. Whether the CLI is allowed on free is **ND**. | Native CSV | $0, 500-URL cap [V1] | Same EULA | Fails the rendering requirement → **not a candidate**. |
| **Sitebulb Pro (desktop)** | JS crawling "at no extra cost" [V4] | Broad SEO audit with CSV/XLSX exports [V5]. Per-check detail **not verified** here. | **No.** No CLI documented. Scheduled audits are a desktop/Cloud feature [V4][V5]. Whether the machine must stay on is **ND**. | CSV exports ("Internal", "Indexability") [V5]. Column map needed. | **$42/mo** (1 user, monthly; Lite $18/mo, 10k-URL cap) [V4] | Proprietary subscription | Vendor-maintained. Desktop-bound, so it can't feed Supabase unattended. |
| **Sitebulb Cloud** | Yes [V4] | As Pro | Not in GHA. Runs on Sitebulb Cloud. Webhook "Audit Finished" POST + S3 export [V5]. | CSV to S3 [V5] | **From £95/mo** [V4] | Proprietary | Highest cost and lock-in. Needs a webhook receiver, which this repo lacks. |
| **Firecrawl (hosted API)** | Yes: headless browser, `waitFor`, `actions` (click/scroll/wait/screenshot) [V7] | Documented metadata: title, description, `robots`, og*, `statusCode`, `sourceURL` [V7]. **Canonical, JSON-LD and redirect chains are not in metadata (ND).** They must be parsed from `rawHtml`. No status for links it didn't fetch → broken-link check needs extra GETs. | Yes: REST + CLI from any runner. Rate limits per plan [V9]. | JSON/markdown → **adapter required** to produce CSV | Free 1,000 credits/mo (1 credit/page; `map` 1 credit/call) [V8][V10]. ~1,040/mo [E] is just over. **Hobby $19/mo** monthly or $16/mo annual, 5,000 credits [V8]. | Hosted ToS. Self-host is **AGPL-3.0** [V11]. | Vendor-maintained (release v2.11.0, 2026-06-19) [V11]. Exit: AGPL self-host or swap the adapter. |
| **Crawlee + Playwright (build)** | Real Chromium/Firefox/WebKit through Playwright. Can run **passive and interacting** renders and raw HTML in one job. | **None out of the box.** It's a framework. All seven checks must be written (parse `<link rel=canonical>`, meta robots, X-Robots-Tag, JSON-LD, the redirect chain from response history, link status by HEAD/GET). `Sitemap.load()` works with `PlaywrightCrawler` [V12]. | Yes. Free on public-repo standard runners [V6]. 6 h job limit [V13]. | **We choose the shape**: emit SF-compatible CSVs plus a link export, and write `link_graph` directly. | **$0** cash [V6]. Build effort [E]: ~3–5 dev-days for the crawler + checks + CSV + tests. Upkeep: ~0.5 day/quarter for dependency bumps. | Apache-2.0 (both) [V11] | Active (Crawlee v3.18.2, 2026-09-29; Playwright v1.64.1, 2026-10-14) [V11]. Exit: plain Node code we own, no vendor. |
| **Lighthouse CI (`@lhci/cli`)** | Lighthouse in Chrome | Lab perf, a11y (axe-core), best-practices, basic SEO audits. Not a crawler: you give it the URL list [V14]. | Yes; official GHA example [V14] | JSON/HTML reports. `temporary-public-storage` uploads are **public** [V14], so use `filesystem`. | $0 | Apache-2.0 [V11] | **Release cadence slowed**: latest v0.15.1 on 2025-06-26, last push 2026-03-27 [V11]. |
| **Unlighthouse (`unlighthouse-ci`)** | Lighthouse in Chrome, across many URLs | Same Lighthouse categories. Discovers URLs from robots.txt and sitemap. Budgets per category [V15]. | Yes; documented GHA example [V15] | Reporters `json`, `jsonExpanded`, `csv`, `csvExpanded`, `lighthouseServer` [V15] | $0 | MIT [V11] | Active (v0.19.1, 2026-10-03) [V11]. Node ≥ 22.18 required [V11 README]. |
| **PSI API (already wired)** | Lighthouse on Google infra | Lab perf (+a11y/SEO categories) | Already in `vitals-pr.yml` / `check-vitals.sh` [R] | JSON | $0. Key "recommended for frequent, automated queries" [V16]. Quota **ND** on that page. | Google API ToS | No new code. |
| **Server access logs** | n/a (they record what bots actually requested) | Real Googlebot crawl frequency, status codes served to bots, crawl waste | Depends on the host | Depends on the host | **Unknown** | n/a | **Host not identified; log access unknown** (§6). |

Accessibility: Lighthouse 13.5.0 pins `axe-core` 4.13.0 in its `package.json` [V11]. Any
Lighthouse-based runner (LHCI, Unlighthouse, PSI) therefore gets axe-core results.
Standalone axe-core is MPL-2.0, v4.14.0 [V11].

---

## 3. Scoring against the SEO-1 rubric (impact 30 · gap fit 20 · data quality 15 · effort 15 · cost 10 · reliability 10)

| Option | Disqualifier? | Impact | Gap fit | Data quality | Effort | Cost | Reliability/control | Weighted /100 [E] |
|---|---|---|---|---|---|---|---|---|
| Crawlee + Playwright + Unlighthouse (build) | none | 8 | 9 | 8* | 5 | 10 | 8 | **80** |
| Screaming Frog paid in GHA | **licence not cleared** for hosted runners: provisional disqualification until written confirmation | 8 | 9 | 9* | 8 | 9 | 7 | (84 if cleared) |
| Screaming Frog paid, operator desktop | none | 6 | 5 | 9* | 8 | 9 | 5 | 68 |
| Firecrawl Hobby as recurring crawler | none | 7 | 6 | 6* | 6 | 8 | 6 | 65 |
| Sitebulb Cloud | none | 7 | 5 | 8* | 6 | 4 | 6 | 61 |
| Sitebulb Pro desktop | none (but not automatable) | 5 | 4 | 8* | 7 | 8 | 4 | 58 |
| Screaming Frog free | **fails rendering requirement** | — | — | — | — | — | — | disqualified |

\* Data quality is starred because it depends on the rendering-fidelity result (§4). Scores
are judgement on a 0–10 scale × weight; they are estimates, not measurements.

Weighted totals check: build = 8·3 + 9·2 + 8·1.5 + 5·1.5 + 10·1 + 8·1 = 24+18+12+7.5+10+8 =
79.5 ≈ 80. SF-in-GHA (if cleared) = 24+18+13.5+12+9+7 = 83.5 ≈ 84 (treat it as
"close to build").

**How Screaming Frog's licence reads for a GitHub-hosted runner** [V2], EULA last updated
7 May 2024:
- **3.2(b)** allows installing "on computers that are owned or controlled by the licensee
  on the condition that only the User will operate the Software at any time". It does not
  permit installing on "a network, shared computer or drive for use by anyone other than
  the authorised User". Two questions follow:
  - Is an ephemeral GitHub VM "controlled by the licensee"? ND.
  - Does a cron-triggered workflow in a repo with several collaborators count as "only the
    User" operating it? ND.
- **3.2(c)** allows "1 instance of the Software anywhere in the world at any one time". This
  contradicts the cloud guide's "as many instances of the SEO Spider as required in the
  Cloud" [V2b].
- **3.4(f)**: "must not … use the Software to create any automated tool or service
  capable of being accessed by anyone other than the User". A scheduled job whose output
  feeds a shared agent queue is arguably that.
- The licence key would sit in Actions secrets of a public repo. Secrets are not exposed,
  but every maintainer with workflow-edit rights could run it.

**Conclusion:** no clause forbids CI by name. Taken together, though, the clauses are too
ambiguous to treat as compatible. A one-line written answer from Screaming Frog support
resolves it.

---

## 4. What the SEO-12 spike ("crawler vs Chrome") must measure

The build-vs-buy answer partly hinges on rendering fidelity. WP Rocket's *Delay JavaScript
execution* loads delayed scripts only after events such as `keydown`, `mousemove`,
`touchstart`, `wheel` and `click`, and its docs mention no timeout fallback [V17]. Google
says Search "does not interact with your page" by scrolling, clicking or typing [V18].
Googlebot renders with evergreen headless Chromium [V19]. A crawler that renders but never
interacts may therefore match **Googlebot** more closely than it matches a **human in
Chrome**, and the spike must keep those two references apart.

**Sample: 20 URLs.**
- `/`
- The 11 cluster primaries in root `CLAUDE.md`, plus the second restaurant page
- `/projects/car-wash/` and 2 more `/projects/*` (the suspected empty grid)
- 1 location page
- 2 blog posts with FAQ blocks
- 1 `/portfolio/*` page

**Five captures per URL**, all from the same IP and at low concurrency:
1. **Raw HTML.** A GET with no JS.
2. **Passive render.** Playwright Chromium, mobile viewport, `networkidle` + 5 s, no
   input events.
3. **Interacting render.** As (2), plus a synthetic `mousemove` + `wheel` scroll to the
   bottom, then 3 s of settling.
4. **Ground truth for users.** Real Chrome, operator-driven, DevTools "Copy outerHTML"
   after normal browsing.
5. **Ground truth for Google** (operator, in the UI). GSC URL Inspection, *Test live URL*
   → *View tested page* → HTML. This is HITL. The URL Inspection API exposes index status,
   not rendered HTML (ND for the HTML; check before relying on it).

**Fields to compare across captures:**

| Field | Metric | Pass threshold to adopt the build |
|---|---|---|
| `<title>`, meta description, canonical, meta robots, X-Robots-Tag | exact match | 100% agreement between (2)/(3) and (5) |
| H1 count and text | exact match | ≥ 95% of URLs |
| JSON-LD blocks: `@type` set and count | set equality | 100% (Yoast emits these server-side, so expect equality even in (1)) |
| Internal link set (normalised href) | Jaccard vs (4) and vs (5) | ≥ 0.95 vs (5); report the delta vs (4) separately |
| Main-content word count | relative delta | within ±5% of (5) |
| Images with a real `src` (not a lazy placeholder) | count delta | report only; this sizes the lazy-load effect |
| `/projects/*` grid tile count | count | non-zero in (4) ⇒ the empty grid is a crawler artefact; zero in (5) ⇒ a real Google-visible defect |

**Operational measurements:**
- Wall-clock time per URL and per 240-URL run on `ubuntu-latest`. Must stay well under
  the 6 h job limit [V13].
- Any **Wordfence** block, 403/429/503 or challenge page at 1, 2 and 4 concurrent
  requests. Pick the crawl rate from this.
- Whether WP Rocket serves a different cached variant to the Playwright UA than to Chrome.
  Diff the page-cache footer comment and response headers across UAs.
- Whether (2) and (3) disagree at all. If they never disagree on SEO fields, the crawler
  can run passive-only and the interaction step is dropped.

**Decision rule from the result:**
- **(2) or (3) matches (5) on all head fields and the link-set threshold:** build as
  recommended.
- **Gaps are real Google-visible defects (2 ≈ 5 ≠ 4):** they become *site* fixes, not
  tool problems. For example, exclude the grid script from delay-JS.
- **(2)/(3) can't match (5) for structural reasons:** fall back to SF paid (if the licence
  is cleared) or Firecrawl with `actions`, and re-score.

**Spike cost:** $0. Playwright locally or in Actions on a public repo, plus operator GSC
UI time. Firecrawl free credits are optional, for a sixth capture.

---

## 5. Recommended shape (for the spec; nothing built here)

- **`scripts/crawl-site.mjs`** (new). Crawlee `PlaywrightCrawler` seeded from
  `collectPageUrls()`, which the existing sitemap sensor already exports
  (`scripts/sensor-sitemap.mjs:collectPageUrls`, including its SSRF guard). It writes:
  - `crawl/internal_all.csv`, using SF `Internal:All` column names for what `seo-audit` needs
  - `crawl/all_inlinks.csv`
  - `crawl/response_codes.csv` (redirect chains, 4xx/5xx)
- **`link-graph.mjs`** consumes the crawler's link export instead of its own regex
  `fetch`. This removes the 150-page cap problem and the unrendered-link blind spot.
  Wiring it in should come with the unchecked-upsert fix the baseline lists.
- **Lab CWV/a11y.** Unlighthouse CI over `config/urls.txt` (31 URLs) with `csv`/`json`
  reporters, or keep PSI. Field CWV stays on CrUX (`sensor-cwv.mjs`).
- **Scheduling.** A **separate weekly workflow**, not a step inside `seo-sensors.yml`'s
  shared `run:` block, which the baseline already flags as fail-together. It needs
  read-only, unauthenticated GETs only and no WordPress credentials.
- **Data exposure.** Because the repo is public, keep crawl output as short-lived workflow
  artifacts and/or Supabase rows, not committed files, unless the operator accepts that the
  site's audit data is public.

---

## 6. Open questions

1. **Server logs (unknown).** Who hosts maxxbuilders.com, and does the plan expose nginx
   access logs (download, SFTP, or a log-drain API)? Nothing public identifies the host.
   Only `nginx` + page cache is observed [R]. Without logs, Googlebot's real crawl pattern
   is visible only through GSC Crawl Stats (UI-only). Operator to answer.
2. **Screaming Frog licence.** Will Screaming Frog confirm in writing that one licence may
   run `--headless` on ephemeral GitHub-hosted runners, triggered by cron in a repo with
   several collaborators? See clauses 3.2(b), 3.2(c) and 3.4(f).
3. **Wordfence rate limits.** What thresholds are configured? A crawler at the wrong rate
   could be throttled or blocked, or trip alerts on a production-only site.
4. **Is the empty `/projects/*` grid real?** This is SEO-12 capture (4) vs (5).
5. **Firecrawl free-tier ToS for commercial use.** Not stated on the pricing page [V8]. It
   matters only if Firecrawl stays in the loop.
6. **Sitebulb desktop scheduling.** Must the machine and app be running? ND [V5]. Relevant
   only if Sitebulb is reconsidered.

---

## 7. Documented vs claimed vs estimated

| Claim | Status |
|---|---|
| SF free tier lacks JS rendering, scheduling, structured-data validation | **[V]** (raw HTML of the comparison list: `class="cross"` under Free) [V1] |
| SF price £199 / $279 / €245 per year per user | **[V]** [V1]. The user guide still says £199 [V3] |
| SF CLI flags and the need for Xvfb on Linux for JS rendering | **[V]** [V3] |
| SF licence compatible with GitHub-hosted runners | **Not documented / ambiguous** [V2][V2b] |
| Sitebulb Lite $18/mo, Pro $42/mo (1 user, monthly, USD) | **[V]** via the pricing page's own price endpoint (`/Subscriptions/Api/Paddle/GetPrice/`, US) [V4] |
| Sitebulb Cloud from £95/mo | **[V]** [V4] |
| Sitebulb has no CLI | **ND** (none documented; Cloud support collection lists none) [V5] |
| Firecrawl renders JS and supports `actions` | **[V]** [V7] |
| Firecrawl returns canonical / JSON-LD in metadata | **ND** → parse `rawHtml` |
| Firecrawl free 1,000 credits/mo; Hobby $19 monthly / $16 annual | **[V]** [V8] |
| WP Rocket delay-JS has no timeout fallback | **ND** in vendor doc (absence documented) [V17] |
| Googlebot does not interact; renders with evergreen Chromium | **[V]** [V18][V19] |
| Build effort 3–5 dev-days | **[E]** |
| Weighted rubric scores | **[E]** |
| ~1,040 renders/month | **[E]** (240 × 4.33) |

---

## 8. Sources (all retrieved 2026-10-15)

- [V1] Screaming Frog SEO Spider, free vs paid comparison and pricing:
  https://www.screamingfrog.co.uk/seo-spider/ and https://www.screamingfrog.co.uk/seo-spider/pricing/
- [V2] Screaming Frog SEO Spider EULA (clauses 3.2(b), 3.2(c), 3.4(f); "Last updated 7th
  May 2024"): https://www.screamingfrog.co.uk/seo-spider/terms-conditions/
- [V2b] Screaming Frog, running the SEO Spider in the cloud (last modified 2025-07-02):
  https://www.screamingfrog.co.uk/seo-spider-cloud/
- [V3] Screaming Frog CLI guide (last modified 2026-08-03):
  https://www.screamingfrog.co.uk/guides/command-line ; user guide (Linux, licence):
  https://www.screamingfrog.co.uk/seo-spider/user-guide/general/
- [V4] Sitebulb pricing: https://sitebulb.com/pricing/ (prices via the page's
  `POST /Subscriptions/Api/Paddle/GetPrice/`, products 570212 = Lite, 509759 = Pro 1 user);
  Sitebulb Cloud: https://sitebulb.com/cloud/
- [V5] Sitebulb support: Cloud collection
  https://support.sitebulb.com/en/collections/9616843-sitebulb-cloud ; webhooks
  https://support.sitebulb.com/en/articles/9857593-sitebulb-cloud-webhooks ; data exports
  https://support.sitebulb.com/en/articles/9854016-data-exports-settings ; scheduling
  https://support.sitebulb.com/en/collections/10446814-scheduling
- [V6] GitHub Actions billing ("standard GitHub-hosted runners is free … In public
  repositories"): https://docs.github.com/en/billing/concepts/product-billing/github-actions
- [V7] Firecrawl scrape: https://docs.firecrawl.dev/features/scrape ; crawl:
  https://docs.firecrawl.dev/features/crawl
- [V8] Firecrawl pricing: https://www.firecrawl.dev/pricing
- [V9] Firecrawl rate limits: https://docs.firecrawl.dev/rate-limits
- [V10] Firecrawl map ("1 credit per call"): https://docs.firecrawl.dev/features/map
- [V11] GitHub API (licence SPDX, latest release): https://github.com/firecrawl/firecrawl ,
  https://github.com/apify/crawlee , https://github.com/microsoft/playwright ,
  https://github.com/GoogleChrome/lighthouse-ci , https://github.com/harlan-zw/unlighthouse ,
  https://github.com/dequelabs/axe-core , https://github.com/GoogleChrome/lighthouse
  (`package.json` → `axe-core` 4.13.0)
- [V12] Crawlee sitemap crawling: https://crawlee.dev/js/docs/examples/crawl-sitemap
- [V13] GitHub Actions limits ("up to 6 hours of execution time"):
  https://docs.github.com/en/actions/reference/limits
- [V14] Lighthouse CI getting started:
  https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md
- [V15] Unlighthouse CI: https://unlighthouse.dev/integrations/ci
- [V16] PageSpeed Insights API (updated 2025-08-28):
  https://developers.google.com/speed/docs/insights/v5/get-started
- [V17] WP Rocket, Delay JavaScript execution (updated 2026-03-11):
  https://docs.wp-rocket.me/article/1349-delay-javascript-execution
- [V18] Google Search Central, lazy-loading (updated 2025-12-10):
  https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading
- [V19] Google Search Central, JavaScript SEO basics (updated 2026-03-04):
  https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- [R] Repo at 7e50e22: `.claude/skills/seo-audit/SKILL.md`, `scripts/link-graph.mjs`,
  `scripts/sensor-sitemap.mjs`, `scripts/check-vitals.sh`, `.github/workflows/seo-sensors.yml`,
  `.github/workflows/vitals-pr.yml`, `config/urls.txt`. Prior audit
  `audit/firecrawl-seo-audit-2026-10-14.md` on branch `audit/firecrawl-seo-2026-10-14`
  (commit 12aae03). Linear document "Baseline: capability & gap matrix (2026-10-14)".
