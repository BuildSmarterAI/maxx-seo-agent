# Unused first-party Google and Bing search APIs: gaps, quotas and access rules

**Question.** The repo already uses GSC Search Analytics + URL Inspection, CrUX, PSI (key
unset) and the GA4 Data API. Which **first-party** surfaces would add value for free or
near-free, and what are their current limits?

**Date of research:** 2026-10-15. Every external fact below was read on 2026-10-15 from
the URL given next to it. The doc's own "last updated" date is quoted where the page shows
one. Repo facts were read at `origin/main` 7e50e22 (worktree base).
**Status:** research findings, pending coordinator verification. No sign-ups, keys, API
calls with credentials or installs were made.

Legend: **[V]** verified on a primary source (developers.google.com, support.google.com,
developer.chrome.com, learn.microsoft.com, blogs.bing.com, indexnow.org) today ·
**[C]** vendor-adjacent or community claim (forum answer, third-party write-up), not
confirmed on a primary page · **[E]** estimate from stated assumptions ·
**not documented** = the primary pages read give no number; no figure is inferred.

---

## 0. TL;DR

Ranked by the SEO-1 rubric (impact 30 · gap fit 20 · data quality 15 · effort 15 ·
cost 10 · reliability 10). Scores are **[E]** (1–5 per criterion, weighted to /100);
the reasoning is in §2.

| Rank | Surface | Score [E] | One-line case |
|---|---|---|---|
| 1 | **GSC API — unused parts of surfaces already authorised** (Search Analytics `searchAppearance`/`country`/`device`/`date`, `dataState`, `type`; URL Inspection fields the sensor discards; Sitemaps `list`/`get`) | 87 | Zero new credentials (`webmasters.readonly` already covers it), quotas far above need, closes canonical-drift and sitemap-health blind spots. |
| — | *GA4 Data API `conversions` → `keyEvents` (correction, not a new surface)* | *(89)* | Already decided in the lead-attribution research (path A); listed only so the stack is complete. |
| 2 | **PageSpeed Insights API with a key** | 74 | Lab data is the only first-party read of WP Rocket–rendered LCP; key is free; per-key quota **not documented** on the docs pages read. |
| 3 | **Bing Webmaster Tools API (read methods)** | 68 | Free, first-party **inbound-link** data (`GetUrlLinks`, `GetLinkCounts`) and Bing query/page stats — the only $0 partial fill for the "backlinks absent" gap. Bing's AI Performance (Copilot citations) report has **no API**. |
| 4 | **IndexNow** | 64 | Free freshness ping to Bing/Copilot, Yandex, Naver, Seznam, Yep, Amazon. **Google is not a participant**; no Google effect. Needs a live-site key file and must follow the apply path, so it sits behind the write-path safety prerequisites. |
| 5 | **CrUX History API** | 63 | Same key and quota as CrUX; 40 weekly periods gives a CWV before/after trend for attribution. Low value until the CrUX key is set and only if the site has enough field data. |
| 6 | **Google Business Profile APIs** (Performance + reviews) | 55 | Reads GBP impressions, calls, website clicks, direction requests, search keywords and reviews. Gated: application form, profile verified 60+ days, quota 0 until approved. |
| 7 | **Google Ads API Keyword Planner** | 52 | $0 but Explorer access excludes `KeywordPlanIdeaService`; Basic needs Cloud-project brand verification. The keyword-provider research already chose DataForSEO; keep as a fallback only. |
| ✗ | Google **Indexing API** | disqualified | Only for `JobPosting` / `BroadcastEvent`-in-`VideoObject` pages; misuse can revoke access. |

**Recommended $0 sequence [E]:** (1) widen the existing GSC calls; (2) set one Google
Cloud API key with CrUX + PSI enabled, so `sensor-cwv` stops no-opping and PSI lab checks
run; (3) add a read-only Bing Webmaster sensor (links + query stats); (4) wire IndexNow
only after the apply-path defects are fixed; (5) apply for GBP API access as a parallel,
no-code step if local data stays in scope. Keyword Planner stays parked.

---

## 1. Repo context (read 2026-10-15 at 7e50e22)

| Surface | Where it is called today | What it uses / ignores |
|---|---|---|
| GSC Search Analytics | `orchestrator/lib/gsc.mjs:queryAnalytics` (`:54-60`), callers `scripts/sensor-gsc.mjs:38,39,50`, `scripts/collect-outcomes.mjs:27` (`collectGsc`) | Sends only `startDate`, `endDate`, `dimensions` (`page` or `page,query`), `rowLimit` 5000, `startRow`. No `type`, `dataState`, `aggregationType` or `dimensionFilterGroups`. |
| GSC URL Inspection | `orchestrator/lib/gsc.mjs:inspectUrl` (`:75-77`); caller `scripts/sensor-indexation.mjs:indexationSensor.fetch` (`:25-33`) | Reads only `verdict` and `coverageState`. Default cap 50/run (`INDEXATION_LIMIT`). |
| GSC auth | `orchestrator/lib/gsc.mjs:searchConsole` (`:17-22`) | Service account, scope `webmasters.readonly`. |
| Sitemap | `scripts/sensor-sitemap.mjs:sitemapSensor`, `collectPageUrls` | Reads the site's own XML only; never asks GSC whether Google could process it. |
| CrUX | `scripts/sensor-cwv.mjs:cwvSensor.fetch` (`CRUX_ENDPOINT` `:20`, call `:80-84`) | `records:queryRecord`, `formFactor: "PHONE"`, per URL from `config/urls.txt`. Skips if neither `CRUX_API_KEY` nor `PAGESPEED_API_KEY` is set (`:104-105`). |
| PSI | `scripts/check-vitals.sh:35` (`runPagespeed`), `packs/webflow/publish.mjs` canary; env in `.github/workflows/vitals-pr.yml:23`, `seo-apply-cms.yml:56` | Key unset per baseline §1. |
| GA4 Data API | `scripts/collect-outcomes.mjs:collectGa4` (`:85-119`), `scripts/sensor-ai-referrals.mjs:run` (`:33-49`) | Metric `conversions` (deprecated) in both. Scope `analytics.readonly`. |
| IndexNow | `output/indexnow/README.md` | Docs only; key file not deployed (`audit/baselines/2026-07-06/analysis.json:9`). |
| Keyword data | `scripts/keyword-research.mjs:fetchKeywordData` | Yoast→Semrush proxy (ADR-008: not used). |
| Bing / GBP / Ads | — | No code. |

Sensor contract for any new read-only surface: an object `{ name, thresholds, fetch(env,
thresholds) }` run by `orchestrator/lib/sensor.mjs:runSensor`. Outcome metrics go through
`scripts/collect-outcomes.mjs:main`.

---

## 2. Per-surface findings

### 2.1 Google Search Console API (unused parts)

| Item | Finding |
|---|---|
| **Gaps addressed** | Canonical drift and crawl recency (URL Inspection fields already returned but discarded); sitemap processing errors as Google sees them (baseline: sitemap sensor checks only the XML); rich-result/appearance tracking (`searchAppearance`) to support schema work; fresher data for post-apply checks (`dataState: all`); country/device splits. **Not filled:** city-level (Texas metro) data. `country` is the finest geo dimension. |
| **Auth** | Existing service account + `webmasters.readonly`. Sitemaps `list` accepts `webmasters.readonly` or `webmasters` [V] https://developers.google.com/webmaster-tools/v1/sitemaps/list (updated 2024-07-23). `submit`/`delete` need write scope; not recommended. |
| **Quotas** | Search Analytics: per-site **1,200 QPM**, per-user 1,200 QPM, per-project 30,000,000 QPD / 40,000 QPM, plus short-term (10-min) and long-term (1-day) load quotas. URL Inspection: per-site **2,000 QPD / 600 QPM**; per-project 10,000,000 QPD / 15,000 QPM. All other resources (incl. Sitemaps): per-user 20 QPS / 200 QPM; per-project 100,000,000 QPD. [V] https://developers.google.com/webmaster-tools/limits (updated 2025-08-28) |
| **Data limits** | Dimensions `country, device, page, query, searchAppearance, date, hour`; `type` = `web` (default), `image`, `video`, `news`, `discover`, `googleNews`; `dataState` = `final` (default), `all`, `hourly_all`; `rowLimit` 1–25,000 (default 1,000); "does not guarantee to return all data rows but rather top ones". [V] https://developers.google.com/webmaster-tools/v1/searchanalytics/query (updated 2026-08-11). Max **50K rows per day per search type**, page with `startRow` until 0 rows. [V] https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data (updated 2025-08-28). Anonymized queries are omitted. [V] https://developers.google.com/search/blog/2022/10/performance-data-deep-dive. 16 months of history in the Performance report and API. [V] https://developers.google.com/search/blog/2018/01/introducing-new-search-console |
| **URL Inspection fields** | `indexStatusResult`: `verdict`, `coverageState`, `robotsTxtState`, `indexingState`, `lastCrawlTime`, `pageFetchState`, `googleCanonical`, `userCanonical`, `crawledAs`, `sitemap[]`, `referringUrls[]`; plus `richResultsResult`, `ampResult`; `mobileUsabilityResult` is **deprecated**. [V] https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult (updated 2025-01-21). The API reads the indexed version only: "you cannot test the indexability of a live URL"; no request-indexing method. [V] https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect (updated 2024-07-23) |
| **Sitemaps fields** | `errors`, `warnings`, `lastDownloaded`, `lastSubmitted`, `isPending`, `contents[].submitted`; `contents[].indexed` is **deprecated — do not use**. [V] https://developers.google.com/webmaster-tools/v1/sitemaps (updated 2024-07-23) |
| **Access restrictions** | Service account must be a user on `sc-domain:maxxbuilders.com` (already true, since sensors run). |
| **Ranking-effect stance** | Reporting only. Sitemap submission "is merely a hint: it doesn't guarantee that Google will download the sitemap or use the sitemap for crawling"; "Google ignores `<priority>` and `<changefreq>`"; `<lastmod>` used only if "consistently and verifiably … accurate". [V] https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (updated 2026-07-08) |
| **Integration points** | `orchestrator/lib/gsc.mjs:queryAnalytics` (add optional `type`, `dataState`, `dimensionFilterGroups` to `requestBody`); `orchestrator/lib/gsc.mjs:inspectUrl` (already returns the full result) → `scripts/sensor-indexation.mjs:indexationSensor.fetch` (compare `googleCanonical` vs `userCanonical`, check `lastCrawlTime` after an apply); new `listSitemaps` beside `inspectUrl` in `orchestrator/lib/gsc.mjs`, consumed by `scripts/sensor-sitemap.mjs:sitemapSensor`. |
| **Option, not ranked** | Bulk data export to BigQuery includes all performance data except anonymized queries. [V] https://support.google.com/webmasters/answer/12918484. BigQuery cost, backfill and cadence were **not documented** on the page read. Overkill for a site of this size [E]. |

### 2.2 GA4 Data API (correction to an existing surface)

| Item | Finding |
|---|---|
| **Gap** | Baseline: `conversions` metric is deprecated and counts every key event; attribution path A already chosen (`docs/wayfinder/SEO-1/lead-attribution-path.md`). |
| **Documented** | 2024-05-06: `conversions` → `keyEvents`, `sessionConversionRate` → `sessionKeyEventRate`, `isConversionEvent` → `isKeyEvent`. 2026-09-14: `dataTruncationReasons` added to `ResponseMetaData`; `properties.chat` (v1alpha) added. 2024-06-28: limit of 10,000 server errors per project per property per 15 minutes. [V] https://developers.google.com/analytics/devguides/reporting/data/v1/changelog |
| **Quotas (standard property)** | Core tokens 200,000/property/day, 40,000/property/hour, 14,000/project/property/hour; 10 concurrent requests; 10 server errors/project/property/hour; **120 potentially thresholded requests/hour**. Daily quotas reset at midnight Pacific. [V] https://developers.google.com/analytics/devguides/reporting/data/v1/quotas (updated 2026-10-13). Token cost per request is **not documented** as a fixed number. Two weekly reports are far inside these limits [E]. |
| **Key events** | "An event that measures an action that's particularly important to the success of your business"; marked in Admin. Per-property key-event limit **not documented** on the page read. [V] https://support.google.com/analytics/answer/13965727 |
| **Ranking stance** | None documented; measurement only. |
| **Integration** | `scripts/collect-outcomes.mjs:collectGa4` / `mapGa4Rows`; `scripts/sensor-ai-referrals.mjs:run`. Read `dataTruncationReasons` to surface truncation, matching the existing zero-row warning (`collect-outcomes.mjs:119`). |

### 2.3 PageSpeed Insights API

| Item | Finding |
|---|---|
| **Gap** | Baseline: `PAGESPEED_API_KEY` unset; WP Rocket delay-JS/lazy-load means lab CWV needs real-browser rendering. PSI runs Lighthouse server-side, so it is the $0 first-party lab check. |
| **Auth** | "Can be used with or without an API key, although a key is recommended for frequent, automated queries." [V] https://developers.google.com/speed/docs/insights/v5/get-started (updated 2025-08-28). Without a key, a shared key may trigger captchas. [V] https://developers.google.com/speed/docs/insights/faq (updated 2024-09-03) |
| **Quotas** | **Not documented** on the PSI docs pages read (get-started, FAQ). The per-project quota is visible only in the Cloud Console. No figure is given here. |
| **Data** | Returns Lighthouse lab data plus CrUX field data, but Google says it plans to stop including CrUX data in PSI and recommends the CrUX API. [V] https://developers.google.com/speed/docs/insights/v5/get-started |
| **Ranking stance** | Lab scores are diagnostics. Google's ranking statement is about CWV field data: good CWV "along with other page experience aspects, aligns with what our core ranking systems seek to reward". [V] https://developers.google.com/search/docs/appearance/core-web-vitals (updated 2025-12-10). No statement found that a Lighthouse score is used. |
| **Integration** | `scripts/check-vitals.sh` (already calls `runPagespeed`), `packs/webflow/publish.mjs` canary, `.github/workflows/vitals-pr.yml:23`. Setting the secret is an operator task. |

### 2.4 CrUX API vs CrUX History API

| Item | CrUX API (in use) | CrUX History API (unused) |
|---|---|---|
| Endpoint | `records:queryRecord` | `records:queryHistoryRecord` |
| Window | 28-day rolling; ~2-day lag; daily update ~04:00 UTC, no SLA | Up to **40 weekly periods** (~10 months), default 25 (`collectionPeriodCount` 1–40); updated Mondays ~04:00 UTC |
| Quota | **150 queries/min per Cloud project, shared between both APIs**, free, no paid tier | same |
| Auth | Cloud API key with the Chrome UX Report API enabled | same |
| Scope | origin or URL; `PHONE`/`TABLET`/`DESKTOP` or all | same |
| Source | [V] https://developer.chrome.com/docs/crux/api | [V] https://developer.chrome.com/docs/crux/history-api (updated 2025-04-11) |

- **Gap:** CWV attribution is before/after only (baseline §1 "no control"); History gives a
  weekly series per URL/origin to check whether a fix moved p75, and could replace the
  fixed 30-day cooldown in `sensor-cwv.mjs`.
- **Caveat [E]:** low-traffic B2B URLs often have no URL-level record (the sensor already
  treats 404 as "no field data", `sensor-cwv.mjs:83`). Origin-level history is the likely
  usable grain. Not tested: no key exists.
- **Ranking stance:** as §2.3. CWV is a documented input to page-experience signals; the API
  itself has no effect.
- **Integration:** `scripts/sensor-cwv.mjs:cwvSensor.fetch` (second endpoint beside
  `CRUX_ENDPOINT`), `breaches`; outcome rows via `scripts/collect-outcomes.mjs:main`.

### 2.5 Bing Webmaster Tools API

| Item | Finding |
|---|---|
| **Gaps addressed** | (a) **Backlinks absent** (baseline §1): `GetUrlLinks` "Get inbound links for specific site url", `GetLinkCounts` "Get list of site pages which has inbound links", `GetConnectedPages`. This is Bing's link graph only, not a full backlink index. (b) Second-engine performance: `GetQueryStats`, `GetPageStats`, `GetPageQueryStats`, `GetQueryPageDetailStats`, `GetRankAndTrafficStats`. (c) Keyword data on Bing: `GetKeywordStats` "keyword historical statistics", `GetKeyword`, `GetRelatedKeywords`. (d) Crawl/render: `GetCrawlIssues`, `GetCrawlStats`, `GetUrlInfo`, `GetFeeds`. [V] https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi?view=bing-webmaster-dotnet (updated 2023-11-14) |
| **AI visibility** | Bing's **AI Performance** report (public preview, 2026-02-10) shows citations in "Microsoft Copilot, AI-generated summaries in Bing, and select partner integrations": total citations, average cited pages, page-level citations, grounding queries. [V] https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview. Intents, Topics, Citation Share and Compare added 2026-06-16. [V] https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare. **No API method** for it appears in the interface list above, and neither post mentions an API. A Microsoft Q&A community moderator (not Microsoft staff) answered "not right now" on 2026-02-19 [C] https://learn.microsoft.com/en-us/answers/questions/5780844/bing-webmaster-tools-ai-performance-report-is-ther. It is a manual dashboard read only. |
| **Auth** | OAuth 2.0 (recommended) or an API key generated per **user** (not per site), one key per user, under Settings → API Access after accepting terms. [V] https://learn.microsoft.com/en-us/bingwebmaster/getting-access. JSON endpoint pattern `https://ssl.bing.com/webmaster/api.svc/json/METHOD?apikey=API_KEY`. [V] https://blogs.bing.com/webmaster/november-2019/Accessing-Bing-webmaster-tools-api-using-cURL |
| **Quotas** | Read-method rate limits: **not documented** on the pages read. URL submission: "up to 10,000 URLs per day, with no monthly quotas"; the per-site quota depends on verified age, impressions and other signals; check with `GetUrlSubmissionQuota`. [V] https://blogs.bing.com/webmaster/january-2019/bingbot-Series-Get-your-content-indexed-fast-by-now-submitting-up-to-10,000-URLs-per-day-to-Bing. The 2019 cURL post carries a November 2025 note recommending IndexNow as the preferred submission method. [V] (cURL post above). 500 URLs per `SubmitUrlBatch` [C] (third-party write-ups only). |
| **Access restrictions** | Site must be added and verified in Bing Webmaster Tools. Whether maxxbuilders.com is verified there is **unknown** (no account inspected). The API key is account-wide, so it grants write methods (`AddBlockedUrl`, `RemoveSite`, `SubmitSiteMove`, …) too. A read-only wrapper must allow-list methods. |
| **Ranking stance** | AI Performance metrics do "not indicate ranking, authority, or the role of any page within an individual answer" [V] (Feb 2026 post). No Google effect. |
| **Integration** | New `scripts/sensor-bing.mjs` exporting a sensor object for `orchestrator/lib/sensor.mjs:runSensor`; link counts and Bing clicks as outcome rows through `scripts/collect-outcomes.mjs:main`. Add `bing` to the citation-engine list only if an API appears later (`lib/engines.mjs`). |

### 2.6 IndexNow

| Item | Finding |
|---|---|
| **Gap** | Baseline: "IndexNow — docs only" (`output/indexnow/README.md`); repo-mode deploy gap means changes reach the site late, so freshness pings matter only after a real apply. |
| **Who honours it** | Amazon, Bing, Naver, Seznam.cz, Yandex, Yep (plus the global endpoint). A submission to any participating endpoint "will be shared across all IndexNow-enabled search engines". **Google is not listed.** [V] https://www.indexnow.org/faq |
| **Limits** | Up to 10,000 URLs per POST; "IndexNow does not publicly disclose exact rate limits". Submission "does not guarantee immediate indexing". Key file named `<key>.txt` at the root, containing only the key, publicly reachable. [V] https://www.indexnow.org/faq |
| **Google's stance** | Google's sitemap and Indexing API docs read today **do not mention IndexNow** [V] (build-sitemap page above; https://developers.google.com/search/apis/indexing-api/v3/quickstart). No Search Central page found stating adoption. Press reports that Google was "testing" IndexNow (2021) are **[C]** and were not verified on a primary source. Treat as: **no documented Google effect**. |
| **Bing's stance** | Bing recommends IndexNow to "keep information fresh across search and AI experiences" [V] (Feb 2026 AI Performance post). |
| **Auth / cost** | No account; ownership is proved by the hosted key file. $0. |
| **Access restrictions** | Hosting the key file is a **live-site change** (production-only WordPress); pinging belongs after a confirmed apply, so it inherits the SEO-1 rule that apply-path defects come first. |
| **Integration** | Post-success hook in `orchestrator/lib/cms.mjs:applyRow` (or `applyRows`) for indexable 200 URLs only; key hosting per `output/indexnow/README.md`. |

### 2.7 Google Business Profile APIs

| Item | Finding |
|---|---|
| **Gap** | SEO-1 "Local & industry data" (not yet specified): GBP performance and reviews as local signals and lead proxies (calls, website clicks, directions). |
| **What is readable** | Performance API: `fetchMultiDailyMetricsTimeSeries`, `getDailyMetricsTimeSeries`, `searchkeywords.impressions.monthly.list` ("search keywords used to find a business in search or maps"). [V] https://developers.google.com/my-business/reference/performance/rest (updated 2024-10-16). Daily metrics: impressions split desktop/mobile × Maps/Search, `BUSINESS_DIRECTION_REQUESTS`, `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_BOOKINGS`, `BUSINESS_FOOD_MENU_CLICKS`; `BUSINESS_CONVERSATIONS` and `BUSINESS_FOOD_ORDERS` deprecated. [V] https://developers.google.com/my-business/reference/performance/rest/v1/DailyMetric (updated 2026-10-05). Reviews (v4): `list`, `get`, `updateReply`, `deleteReply`; returns rating, comment, reviewer, reply, timestamps. [V] https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews (updated 2026-07-24) |
| **Access process** | Submit the GBP API contact form → "Application for Basic API Access". Requirements: manage a profile "verified and active for 60+ days", have a website listed on it, apply from an owner/manager email. Quota **0 QPM = not approved; 300 QPM = approved**, checked in Cloud Console. [V] https://developers.google.com/my-business/content/prereqs (updated 2026-08-28). Approval turnaround: **not documented**. |
| **Auth** | OAuth 2.0 (user data); several APIs to enable; no sandbox (use `validateOnly`). [V] https://developers.google.com/my-business/content/basic-setup (updated 2026-08-28) |
| **Ranking stance** | The APIs have none. Local ranking = relevance, distance, prominence; "More reviews and positive ratings can help your business's local ranking"; "There's no way to request or pay for a better local ranking". [V] https://support.google.com/business/answer/7091 |
| **Access restrictions** | OAuth as the profile owner/manager conflicts with the service-account pattern and the "no app credentials in Claude Code" policy; refresh-token storage must be a GitHub secret [E]. Reply/update methods are writes and must stay unused. Whether the Maxx profile meets the 60-day rule is **unknown** (the CLAUDE.md Maps link suggests a profile exists). |
| **Integration** | New collector in `scripts/collect-outcomes.mjs:main` (`gbp_calls`, `gbp_website_clicks`). There is no location-page key yet, so the join is to the homepage/contact URL [E]. |

### 2.8 Google Ads API Keyword Planner

| Item | Finding |
|---|---|
| **Gap** | Keyword volume (keyword research is manual, ADR-008). |
| **Access levels** | Test (test accounts only, 15,000 ops/day); **Explorer** (2,880 ops/day production) **cannot use `KeywordPlanIdeaService`** and the other KeywordPlan services; **Basic** 15,000 ops/day, needs Cloud-project brand verification; Standard unlimited, manual audit (~10 business days). [V] https://developers.google.com/google-ads/api/docs/api-policy/access-levels (updated 2026-10-14) |
| **New since the keyword-provider research** | **Developer tokens were sunset on 2026-09-09.** Access levels now attach to Google Cloud projects; sign-up happens in Cloud Console "without requiring a Google Ads manager account"; new apps start at Test; Basic applications are "automated and will be reviewed within minutes after brand verification". [V] https://developers.google.com/google-ads/api/docs/api-policy/developer-token (updated 2026-10-14) |
| **Data** | `GenerateKeywordIdeas`: average monthly searches, competition, top-of-page bid percentiles; up to 10 `geo_target_constants`; no `KeywordPlan` needed. [V] https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas (updated 2026-10-14). Ranged volumes for low-spend accounts are from the keyword-provider research and were **not re-verified** today. The Ads help page read does not state it (https://support.google.com/google-ads/answer/7337243). |
| **Ranking stance** | None (Ads planning data). |
| **Integration** | `scripts/keyword-research.mjs:fetchKeywordData` (replace the proxy). The keyword-provider research chose DataForSEO, so this is a fallback only. |

### 2.9 Google Indexing API — disqualified

Works "exclusively with pages containing `JobPosting` or `BroadcastEvent` embedded in a
`VideoObject`"; default quota 200; abuse "may result in access being revoked". [V]
https://developers.google.com/search/apis/indexing-api/v3/quickstart (updated 2026-07-16).
Maxx pages are neither, so using it would breach policy.

---

## 3. Scoring detail [E]

1–5 per criterion; weighted score = Σ(score/5 × weight).

| Surface | Impact 30 | Gap 20 | Data 15 | Effort 15 | Cost 10 | Reliability 10 | Total |
|---|---|---|---|---|---|---|---|
| GSC unused parts | 4 | 4 | 4 | 5 | 5 | 5 | 87 |
| GA4 keyEvents (correction) | 4 | 5 | 4 | 5 | 5 | 4 | 89 |
| PSI with key | 3 | 4 | 3 | 5 | 5 | 3 | 74 |
| Bing WMT API | 3 | 4 | 3 | 3 | 5 | 3 | 68 |
| IndexNow | 2 | 4 | 2 | 4 | 5 | 4 | 64 |
| CrUX History | 2 | 3 | 2 | 5 | 5 | 4 | 63 |
| GBP APIs | 2 | 3 | 3 | 2 | 5 | 3 | 55 |
| Ads Keyword Planner | 2 | 3 | 2 | 2 | 5 | 3 | 52 |

Rationale: GSC scores highest on reliability because the credential, client, retry and
quota handling exist already. Bing loses effort points for a new credential and a write-
capable key that needs a method allow-list. IndexNow has no Google effect, which caps its
impact. GBP and Keyword Planner lose effort points for approval steps with no documented
turnaround.

---

## 4. Documented vs claimed

| Claim | Status | Source |
|---|---|---|
| Google does not participate in IndexNow | **Documented (by omission)**: not in indexnow.org's participant list; not mentioned in Google's sitemap or Indexing API docs | https://www.indexnow.org/faq; https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap |
| "Google is testing IndexNow" (2021 press) | **Claim [C]**; no primary source found | — |
| Sitemap submission guarantees crawling | **False per Google**: "merely a hint" | build-sitemap page |
| `<priority>` / `<changefreq>` matter to Google | **False per Google**: ignored | build-sitemap page |
| Good CWV helps ranking | **Documented, hedged**: "aligns with what our core ranking systems seek to reward" | https://developers.google.com/search/docs/appearance/core-web-vitals |
| PSI/Lighthouse score is a ranking input | **Not documented** | — |
| URL Inspection API can request indexing | **False**: indexed version only; no live test | urlInspection.index/inspect |
| Indexing API speeds up any page | **False per Google**: JobPosting/BroadcastEvent only | Indexing API quickstart |
| Bing AI Performance shows ranking | **False per Bing**: "does not indicate ranking" | Bing Feb 2026 post |
| Bing AI Performance has an API | **No API documented**; "not right now" from a community moderator [C] | MS Q&A thread |
| Bing URL submission = 10,000/day | **Documented as an upper bound**; per-site quota varies | Bing Jan 2019 post |
| `SubmitUrlBatch` max 500 URLs | **Claim [C]** (third-party only) | — |
| GBP reviews improve local ranking | **Documented**: "can help" (prominence) | https://support.google.com/business/answer/7091 |
| Ranged Keyword Planner volumes for low spend | **Not re-verified** today | — |

---

## 5. Open questions

1. Is maxxbuilders.com verified in **Bing Webmaster Tools**, and under whose Microsoft
   account? (Needed before any Bing sensor; operator check, no sign-up by this research.)
2. Does the Maxx **GBP** meet the 60-day verified rule, and who is owner/manager? Is local
   data in scope for this map's balanced stack?
3. Which **Cloud project** would own the CrUX/PSI key, and what PSI quota does the Console
   show for it? (PSI quota is not documented on the docs pages.)
4. Does the site have **URL-level CrUX** records at all, or only origin-level? (Decides
   whether CrUX History is per-URL or origin-only.)
5. Should IndexNow pings wait for the **repo-mode deploy gap** fix, so pings only follow
   changes that actually reached WordPress?
6. Should the Sitemaps API's `errors`/`warnings` become a sensor signal, or a weekly report
   line only?

---

## 6. Sources (all retrieved 2026-10-15)

- https://developers.google.com/webmaster-tools/limits
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
- https://developers.google.com/webmaster-tools/v1/sitemaps
- https://developers.google.com/webmaster-tools/v1/sitemaps/list
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult
- https://developers.google.com/search/blog/2018/01/introducing-new-search-console
- https://developers.google.com/search/blog/2022/10/performance-data-deep-dive
- https://support.google.com/webmasters/answer/12918484
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/core-web-vitals
- https://developers.google.com/search/apis/indexing-api/v3/quickstart
- https://developer.chrome.com/docs/crux/api
- https://developer.chrome.com/docs/crux/history-api
- https://developers.google.com/speed/docs/insights/v5/get-started
- https://developers.google.com/speed/docs/insights/faq
- https://developers.google.com/analytics/devguides/reporting/data/v1/quotas
- https://developers.google.com/analytics/devguides/reporting/data/v1/changelog
- https://support.google.com/analytics/answer/13965727
- https://learn.microsoft.com/en-us/bingwebmaster/getting-access
- https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi?view=bing-webmaster-dotnet
- https://blogs.bing.com/webmaster/january-2019/bingbot-Series-Get-your-content-indexed-fast-by-now-submitting-up-to-10,000-URLs-per-day-to-Bing
- https://blogs.bing.com/webmaster/november-2019/Accessing-Bing-webmaster-tools-api-using-cURL
- https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare
- https://learn.microsoft.com/en-us/answers/questions/5780844/bing-webmaster-tools-ai-performance-report-is-ther [C]
- https://www.indexnow.org/faq
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/reference/performance/rest
- https://developers.google.com/my-business/reference/performance/rest/v1/DailyMetric
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
- https://support.google.com/business/answer/7091
- https://developers.google.com/google-ads/api/docs/api-policy/access-levels
- https://developers.google.com/google-ads/api/docs/api-policy/developer-token
- https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas
- https://support.google.com/google-ads/answer/7337243
