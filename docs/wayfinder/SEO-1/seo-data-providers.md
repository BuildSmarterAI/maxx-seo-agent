# Keyword, SERP, rank and backlink data providers for Maxx Builders

**Question.** Which keyword / SERP / rank / backlink data source covers Texas
commercial-construction queries (Houston, Dallas, Austin, San Antonio) within the
planning budget (balanced stack ≤ ~$300/mo of paid data)?

**Date of research:** 2026-10-15. Every external fact below was read on 2026-10-15 from
the URL given next to it. Repo facts were read at `origin/main` 7e50e22.
**Status:** research findings, pending coordinator verification. No sign-ups, keys,
trials or paid calls were made.

Legend: **[V]** verified on a primary source (vendor page, docs, ToS) today ·
**[S]** secondary source only (third-party blog / search snippet), not verified on a
primary page · **[E]** estimate derived from stated assumptions · **UNAVAILABLE** = not
public or the primary source could not be reached.

---

## 0. TL;DR

1. **DataForSEO pay-as-you-go is the clear balanced choice.** It is the only candidate
   that covers all six gaps (volume, SERP, rank, local/maps rank, backlinks, competitor
   keywords) from one REST API with Basic auth and no subscription. At the stated workload
   the expected cost is **~$10–15/mo** (high ~$55/mo on the standard queue, ~$135/mo if
   everything ran in Live mode). The $100/mo backlinks commitment was removed on
   2026-07-01. Rank tracking has to be built (a weekly SERP sensor plus storage); there is no
   hosted rank-tracker product.
2. **Keep SerpApi for AIO (ADR-007 stands).** The "duplicate" SerpApi spend is probably
   close to $0. SerpApi caches identical requests for 1 h, cached searches are free, and
   `askGoogleAIO` and `sensor-paa` send byte-identical URLs in the same job. That caching
   creates a correctness problem rather than a cost problem: the 3-sample AIO majority vote
   is probably comparing one live result with two cached copies of it. Moving PAA/AIO to
   DataForSEO would save little money. The case for doing it is redundancy
   (AGENTIC-AI-SEO-RESEARCH item 10), not cost.
3. **Ahrefs is now affordable for API use.** API v3 and MCP are included from Lite
   ($129/mo, 200k units, 750 weekly tracked keywords). It is the best *advanced* add-on,
   not the core. Semrush direct API still needs the Business/Advanced tier plus unit
   packages whose prices aren't published. Its MCP comes with 50k units on cheaper plans,
   but that is too thin for this workload. The Google Ads Keyword Planner API is $0, but
   Explorer access excludes `KeywordPlanIdeaService` and low-spend accounts get volume
   ranges, so it is a poor fit for low-volume B2B terms.
4. **The SEO-11 spike is still needed, and it is a data-quality test, not a price test.**
   The open risk is whether Google-Ads-sourced volumes exist at all, at state or city level,
   for these long-tail B2B phrases. Test DataForSEO against the $0 Yoast→Semrush proxy that
   is already reachable. Note that **DataForSEO's $50 minimum top-up exceeds the $25 spike
   cap**, so the spike needs explicit sign-off for the deposit; the unused balance doesn't
   expire.

---

## 1. Context and constraints (from repo + map)

- Clusters: 11 rows in root `CLAUDE.md` keyword/intent map (restaurant row = 2 pages) →
  "~12 clusters". Low-volume, high-intent B2B (e.g. Semrush via Yoast returned
  `warehouse construction cost` → vol 390, KDI 21 — `docs/spikes/semrush-proxy-auth-2026-06-25.md`).
- Existing SerpApi usage (repo, verified by reading code):
  - `lib/engines.mjs:156` — `askGoogleAIO` fetches
    `serpapi.com/search.json?engine=google&q=<query>&api_key=…` with **no `no_cache`, no
    `location`/`uule`** parameter; on a deferred AIO it redeems `page_token` at
    `engine=google_ai_overview` (`:164-165`).
  - `scripts/sensor-ai-citations.mjs:26,124-130` — `AIO_SAMPLES` default 3, sequential
    calls per query. Queries come from Supabase `ai_queries` (active), falling back to
    `config/monitored-queries.json` (**9 queries**) when the table is empty (`:30-41`).
  - `scripts/sensor-paa.mjs:16-28` — same `engine=google&q=` URL per `ai_queries` topic
    (limit 40); exits if `ai_queries` is empty.
  - `.github/workflows/ai-search-sensors.yml:4,30-60` — weekly (Mon 06:30 UTC); AIO step
    then PAA step in the same job, minutes apart.
  - Live `ai_queries` row count and the SerpApi plan currently held: **UNAVAILABLE**
    (Supabase not inspected; plan not recorded in repo).
- Prior decisions honoured: ADR-007 (SerpApi for AIO), ADR-008 (Yoast→Semrush proxy is
  fragile, flagged-only), buzz extension doc already names DataForSEO for SERP +
  backlinks (`docs/buzz-seo-extension-architecture.md:154-195,248`).

### 1.1 Finding: the "duplicate SerpApi call" is mostly cached, and that weakens the AIO vote

- [V] SerpApi Search API docs (https://serpapi.com/search-api, `no_cache` parameter):
  "Cache expires after 1h. Cached searches are free, and are not counted towards your
  searches per month." `no_cache` forces a fresh fetch.
- [V] SerpApi pricing FAQ (https://serpapi.com/pricing): "Only successful searches are
  counted … Cached, errored, and failed searches are not."
- [V] SerpApi blog, 2025-09-12 (https://serpapi.com/blog/understanding-ai-overview-data-from-serpapi/,
  "Follow-up request" section): a `page_token` follow-up "counts as a second SerpApi search".
- [E] Inference (not observed on the live account): samples 2–3 of the AIO vote and the
  PAA call reuse sample 1's cached response → billed ≈ 1 search + 0–1 page_token per query
  per week. The 3-sample flicker defence (ADR-007) is therefore likely inert, and a cached
  `page_token` (1-minute expiry, https://serpapi.com/google-ai-overview-api) may fail on
  samples 2–3. Captures also carry no Texas location. **Verify** in the SerpApi dashboard
  search history (cached vs billed) before acting; the fix (`no_cache=true` on AIO samples,
  a Texas `location`) is a code change outside this ticket.

---

## 2. Per-candidate fact table

Gap columns: **Vol** keyword volume · **SERP** on-demand SERP · **Rank** organic rank
tracking · **Local** local pack / Maps rank · **BL** backlinks · **Comp** competitor
content/keywords. ✔ = native, ◐ = buildable from raw data / partial, ✘ = none.

### 2.1 DataForSEO (pay-as-you-go APIs)

| Item | Fact | Source |
|---|---|---|
| Products | SERP API (Google Organic, Maps, Local Finder), Keywords Data (Google Ads), DataForSEO Labs, Backlinks, Business Data | https://dataforseo.com/pricing [V] |
| Gaps | Vol ✔ · SERP ✔ · Rank ◐ (build from SERP API) · Local ◐ (Maps/Local Finder SERP; geo-grid buildable via coordinates) · BL ✔ · Comp ✔ (Labs) | — |
| Billing model | "Pay as you go", "No subscriptions", "$50 minimum top-up", "Balance never expires" | https://dataforseo.com/pricing [V] |
| Google Organic SERP | Standard $0.0006 / Priority $0.0012 / Live $0.002 per SERP; "One SERP is a page of up to 10 organic results", depth rounds up per 10; async AI Overview `load_async_ai_overview` "+1 base price"; PAA expansion $0.00015 per click; search operators ×5 | https://dataforseo.com/pricing/serp/google-organic-serp-api [V] |
| Google Maps SERP | Standard $0.0006 / Priority $0.0012 / Live $0.002; "one request returns up to 100 listings"; +1 base price per extra 100 | https://dataforseo.com/pricing/serp/google-maps-serp-api [V] |
| Keywords Data – Google Ads search volume | Standard $0.06 / Live $0.09 per task; "up to 1,000 keywords in one request" | https://dataforseo.com/pricing/keywords-data/google-ads [V] |
| Search-volume limits | 2,000 API calls/min, ≤100 tasks per POST; Google returns "combined search volume values for groups of similar keywords"; `date_to` ≤ last month; 4-year history | https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/task_post.md [V] |
| Labs | "$0.012 / task + $0.00012 / item" (keyword ideas, ranked keywords, competitors) | https://dataforseo.com/pricing , https://dataforseo.com/pricing/dataforseo-labs/dataforseo-labs-api [V] |
| Backlinks | $0.024 per task + $0.000036 per row, ≤1,000 rows/request; "$100 monthly commitment … removed" and rates ~+20% effective 2026-07-01 | https://dataforseo.com/pricing/backlinks/backlinks , https://dataforseo.com/update/pricing-update-in-dataforseo-apis [V] |
| Other 2026-07-01 changes | Labs +20%, Keywords Data +20% (most endpoints), Business Data +20% | same update page [V] |
| Freshness | SERP: real-time (Standard ~5 min, Live ~6 s). Volumes: monthly (last or previous month per `actual_data`). Backlinks: "updated continuously" | pricing pages + docs above [V] |
| Auth | HTTP Basic (login/password) per docs; secret pair `DATAFORSEO_LOGIN/PASSWORD` already planned in buzz doc | docs.dataforseo.com [V]; repo |
| Terms | §7.1 SERP data "shall not be used to compete with or adversely affect the business interests of the search engine providers"; §5.1 30-day refund on first purchase only; §6.1/§8.1 may suspend/remove accounts "without restitution". No explicit resale/redistribution clause found | https://dataforseo.com/terms-of-service [V] |
| Free test | "free account to test … with a real-time playground" (amount of free credit UNAVAILABLE) | https://dataforseo.com/apis/backlinks-api [V] |
| MCP | Official `dataforseo/mcp-server-typescript` (npx), hosted `https://mcp.dataforseo.com/mcp` | https://github.com/dataforseo/mcp-server-typescript [S, repo name matches vendor org; not opened] |
| Overlap w/ SerpApi | Full overlap on Google SERP + AIO (async +1 base) + PAA | — |
| Exit / lock-in | Low: raw JSON stored in our Supabase; no subscription; balance non-expiring but non-refundable after 30 days | — |
| Disqualifiers | None found. Caveats: rank tracker is DIY; Google Ads grouping/rounding for long-tail | — |

### 2.2 SerpApi (incumbent)

| Item | Fact | Source |
|---|---|---|
| Gaps | Vol ✘ · SERP ✔ · Rank ◐ (build) · Local ◐ (Google Maps engine, `ll=@lat,lng,zoom`, 20/page) · BL ✘ · Comp ◐ (SERP only) | https://serpapi.com/google-maps-api [V] |
| Plans | Free $0/250 · Starter $25/1,000 · Developer $75/5,000 · Production $150/15,000 · Big Data $275/30,000 · Searcher $725/100,000 (searches/mo; hourly caps 50→20,000) | https://serpapi.com/pricing [V] |
| Billing unit | 1 successful search; cached (1 h), errored, failed are free; AIO `page_token` follow-up = second search | pricing FAQ; https://serpapi.com/search-api ; AIO blog 2025-09-12 [V] |
| Location | "recommended to specify `location` at the city level" | https://serpapi.com/search-api [V] |
| Terms | Legal Shield (≤$2M) only on Production+; §2 no resale ("not to reproduce, duplicate, copy, sell, resell"); 7-day refund if <20% used; search data retained 31 days | https://serpapi.com/legal [V] |
| Rollover / annual discount | UNAVAILABLE | — |
| MCP | Official `serpapi/serpapi-mcp`, hosted `mcp.serpapi.com`, MIT | https://github.com/serpapi/serpapi-mcp [V] |
| Exit | Monthly subscription; low lock-in | — |
| Disqualifiers | None for AIO/SERP; disqualified as the *sole* provider (no volume, no backlinks) | — |

### 2.3 Ahrefs API v3

| Item | Fact | Source |
|---|---|---|
| Gaps | Vol ✔ (country-level; city volumes UNAVAILABLE) · SERP ✔ (SERP Overview) · Rank ✔ (Rank Tracker, weekly) · Local UNAVAILABLE (city-level tracking not verified) · BL ✔ · Comp ✔ | https://docs.ahrefs.com/docs/api/reference/limits-consumption [V] |
| Plans | Lite $129 · Standard $249 · Advanced $449 · Enterprise $1,499 (annual) per month; annual billing "up to 17%" off | https://ahrefs.com/pricing [V] |
| API access | "Direct access to API v3, Ahrefs MCP" from Lite up; API units/mo: Lite 200k, Standard 800k, Advanced 2M, Enterprise 4M/custom; max rows/request 100/250/500/unlimited | https://help.ahrefs.com/en/articles/6559232-about-api-v3 [V] |
| Rank tracker | 750 / 2,000 / 5,000 tracked keywords (Lite/Std/Adv), update "Weekly" | https://ahrefs.com/pricing [V] |
| Unit cost | `max(50, per_row_cost × rows)`; field 1 unit, some 5–10; cached requests free; Rank Tracker, Management, Public endpoints free | limits-consumption page [V] |
| Extra units | PAYG units "last for three billing months"; price UNAVAILABLE | https://ahrefs.com/pricing FAQ [V] |
| Auth | API key (bearer) | docs [V] |
| Data-use / redistribution terms | UNAVAILABLE (API terms not reviewed) | — |
| MCP | Official Ahrefs MCP included with API plans | pricing + help article [V] |
| Overlap w/ SerpApi | SERP Overview overlaps on organic SERP; no AIO-citation parse verified | — |
| Exit | Subscription; rank history lives in Ahrefs (export needed) — medium lock-in | — |
| Disqualifiers | None. Cost: Lite fits 300 kw × 1 location only; 4-metro tracking needs Standard ($249) **if** each keyword-location counts as one tracked keyword (UNAVAILABLE) | — |

### 2.4 Semrush API

| Item | Fact | Source |
|---|---|---|
| Gaps | Vol ✔ · SERP ◐ · Rank ✔ (Position Tracking in product; API path/units UNAVAILABLE) · Local ✔ (Map Rank Tracker API "available for all Semrush users") · BL ✔ · Comp ✔ | https://developer.semrush.com/api/get-started/api-access [V] |
| Standard API | Requires SEO Toolkit **Business** tier; "after upgrading … the number of units will still be zero"; unit packages 2M/5M/10M/20M, **price UNAVAILABLE**; unused units expire | https://developer.semrush.com/api/get-started/api-access , https://www.semrush.com/kb/5-api [V] |
| MCP | `https://mcp.semrush.com/v2/mcp`, OAuth or API key; Semrush One Starter / Pro+ and SEO Classic Pro / Guru include **50,000 API units**/mo | https://developer.semrush.com/api/basics/semrush-mcp/ [V] |
| Unit cost examples | Domain reports 10 units/line (live), 50 units/line (historical) | https://developer.semrush.com/api/basics/api-units-balance/ [V] |
| Plan prices | Pricing page shows SEO $117.33, Starter $165.17, Pro+ $248.17 /mo billed annually; Advanced custom; monthly-billing prices UNAVAILABLE. Docs still say "Business" — naming in flux | https://www.semrush.com/prices/ [V] |
| Existing access | Yoast→Semrush proxy works headlessly but is fragile and flagged (ADR-008) | repo spike [V] |
| MCP vs CI | MCP default auth is OAuth (human); headless CI use relies on API key — whether the 50k-unit plans issue API keys for direct REST is UNAVAILABLE | — |
| Disqualifiers | Direct Standard API **disqualified for the balanced budget**: Business/Advanced tier + unpublished unit pricing. MCP-only tier is conditional (50k units ≈ 5,000 lines/mo) | — |

### 2.5 Moz API

| Item | Fact | Source |
|---|---|---|
| Primary source | https://moz.com/api/pricing returned **Cloudflare error 1000** on 2026-10-15 05:36 UTC (WebFetch and curl) → **UNAVAILABLE** | — |
| Secondary | Standard $99/10k rows … Large $299/70k rows; free tier ~25 queries | search snippets [S] |
| Gaps | Vol ◐ · SERP ✘ · Rank ✘ (via API) · Local ✘ · BL ✔ (authority metrics) · Comp ◐ | [S] |
| Verdict | **Not scored** (no primary evidence today); fit is lower than Ahrefs/DataForSEO anyway | — |

### 2.6 Google Ads API — Keyword Planner (`KeywordPlanIdeaService`)

| Item | Fact | Source |
|---|---|---|
| Gaps | Vol ✔ only | — |
| Access levels | Test (test accounts only), Explorer (2,880 ops/day prod), Basic (15,000/day), Standard (unlimited, ~10 business-day manual review). **`KeywordPlanIdeaService` is listed under Explorer "Restricted Services and Methods"** → Basic access application required. Page last updated 2026-10-14 | https://developers.google.com/google-ads/api/docs/api-policy/access-levels [V] |
| Data quality | "search volume statistics are rounded"; "less accurate if you're targeting a small geographic location" | https://support.google.com/google-ads/answer/3022575 [V] |
| Spend requirement | Low-spend accounts see **ranges** (e.g. 100–1K) instead of exact volumes | Search Engine Journal / Google statement reported [S]; not found on the primary page fetched |
| Cost | $0 API fee; needs Google Ads manager account + developer token + OAuth | access-levels page [V] |
| Disqualifiers | Not disqualified, but ranges for a no-spend account make it near-useless for 10–500/mo B2B terms; DataForSEO resells the same Google Ads source without token/spend | — |

### 2.7 Alternatives

| Candidate | Fact | Fit |
|---|---|---|
| **Local Falcon** (geo-grid Maps rank) | Starter $24.99/7,500 credits · Basic $49.99/15,150 · Pro $99.99/31,250 · Premium $199.99/63,150 per month; 1 credit per grid point, +25 for Falcon AI report; "API and integrations included free with Basic and above"; official MCP (remote + local). An on-demand API at $199/mo + $0.0032/request is reported [S] | Local ✔ only. Advanced add-on. https://www.localfalcon.com/llms.txt [V] |
| **BrightLocal** | Platform from ~$31–57/mo annual-equivalent [V https://www.brightlocal.com/pricing/]; rank API $0.01/request and plan gating (SEO Pro/Enterprise) [S]; API terms UNAVAILABLE | Local ✔; inferior evidence; not scored |
| **Serper.dev** | 2,500 free queries [V https://serper.dev/]; $50/50k credits, credits expire 6 months [S] | SERP only; cheap but no AIO/volume/BL; not scored |
| **Bright Data SERP API** | Billed "per-1,000 successful requests"; failed free unless custom headers/cookies [V https://docs.brightdata.com/scraping-automation/serp-api/pricing-and-billing]; ~$1.50/1k PAYG [S] | SERP only; no advantage over DataForSEO standard queue ($0.60/1k) |

---

## 3. Cost model

### 3.1 Workload assumptions

| Driver | Low | Expected | High | Notes |
|---|---|---|---|---|
| Keywords | 300 | 300 | 300 | 12 clusters × 25 |
| Rank: keyword–location pairs / week | 300 (1 location each) | 900 (200 statewide kw × 4 metros + 100 city-specific kw × 1) | 1,200 (300 × 4) | metros: Houston, Dallas, Austin, San Antonio |
| Rank depth | top 10 | top 20 (striking distance 11–20) | top 100 | DataForSEO bills per 10 results; SerpApi assumed 1 search per 10 results [E — Google dropped `num=100` in 2025; verify] |
| Rank SERP-pages / mo (×4.33 wk) | 1,299 | 7,794 | 51,960 | |
| Local/Maps checks / mo | 10 kw × 4 metros × 4.33 = 173 | 25 × 4 × 4.33 = 433 | 5×5 grid (25 pts) × 10 kw × 4 metros × 4.33 = 4,330 | |
| Volume refresh | 300 kw × 1 (Texas) monthly | 300 kw × 4 metros + Labs ideas (12 × 1,000 items) | + 4× bulk difficulty / re-pulls | |
| Competitor content | 10 domains × 250 items/quarter | 10 × 1,000 items/month (Labs ranked keywords) | 10 × 5,000 items/month | |
| Backlinks | 11 domains (us + 10) quarterly, summary + 1,000 ref-domains + 1,000 backlinks | same | 10,000 rows per list | |
| On-demand SERPs | 50/mo | 50/mo, Live, depth 20, with AIO | 50/mo | |
| AIO + PAA (existing) | 9 queries × 1 billed + 0–1 page_token / wk (cache-collapsed, current code) ≈ 39–78/mo | 9 × 3 samples with `no_cache` + PAA free from cache ≈ 117 (+ ≤117 page_token) / mo | 40 `ai_queries` × 3 × 2 + 40 PAA ≈ 1,213/mo | live `ai_queries` count UNAVAILABLE |

### 3.2 DataForSEO ($/mo, standard queue unless noted) [E from §2.1 prices]

| Line | Low | Expected | High (std) | High (Live) |
|---|---|---|---|---|
| Organic rank | 1,299 × $0.0006 = $0.78 | 3,897 pairs × 2 pages × $0.0006 = $4.68 | 5,196 × 10 × $0.0006 = $31.18 | ×$0.002 = $103.92 |
| Maps rank | $0.10 | $0.26 | 4,330 × $0.0006 = $2.60 | $8.66 |
| Volume (Google Ads) + Labs ideas | 1 task $0.06 + ~$0.40 | 4 tasks $0.24 + 12 × $0.132 = $1.82 total | ~$10 | ~$12 |
| Labs competitor keywords | 10 × $0.042 / 3 = $0.14 | 10 × $0.132 = $1.32 | 10 × $0.612 = $6.12 | $6.12 |
| Backlinks (quarterly ÷ 3) | 11 × ~$0.15 / 3 = $0.55 | $0.55 | 11 × 2 × 10 × $0.06 / 3 = $4.40 | $4.40 |
| On-demand SERPs (Live, depth 20, +AIO) | 50 × $0.006 = $0.30 | $0.30 | $0.30 | $0.30 |
| **Subtotal** | **≈ $2.3** | **≈ $8.9** | **≈ $54.6** | **≈ $135.4** |
| + 25% contingency (retries, depth creep) | $2.9 | **$11.2** | $68 | $169 |
| AIO+PAA if consolidated (optional) | 117 × $0.0012 = $0.14 | $0.14 + PAA free in same response | 1,213 × $0.0012 = $1.46 | × Live $4.85 |

Cash flow: the first $50 top-up covers ~4 months at expected load; balance never expires.

### 3.3 Alternatives ($/mo) [E]

| Option | Low | Expected | High | What it still lacks |
|---|---|---|---|---|
| SerpApi for rank + maps (on top of AIO) | 1,299 + 173 + 50 + 78 ≈ 1,600 → Developer **$75** | 7,794 + 433 + 50 + 234 ≈ 8,500 → Production **$150** | ≈ 57,700 → Searcher **$725** (over budget) | volume, backlinks, competitor keywords |
| Ahrefs | Lite **$129** (300 kw, 1 location, weekly) | Standard **$249** (≤2,000 tracked) | Advanced **$449** | AIO capture (keep SerpApi), Maps grid; city volume UNAVAILABLE |
| Semrush | One Starter **$165.17** (annual) MCP 50k units | Pro+ $248.17 (annual) | Business/Advanced + unit packs: UNAVAILABLE | headless API certainty; unit sufficiency |
| Google Ads KP API | $0 | $0 | $0 (+ ad spend to unlock exact volumes, amount UNAVAILABLE) | everything but volume |
| Local Falcon (add-on) | Starter $24.99 (4,330 credits fits) — no API | Basic **$49.99** (API) | Pro $99.99 | everything but local |
| Existing SerpApi (AIO+PAA only) | Free tier (250) covers ~78 billed/mo if cache collapse is real | Starter $25 (1,000) covers ~234 with `no_cache` | Developer $75 | — |

### 3.4 Does consolidating PAA/AIO onto the chosen provider remove duplicate SerpApi spend?

**No meaningful saving** [E, high confidence in the mechanism, low confidence in live
numbers]. PAA reuses the cached AIO response for free under SerpApi's 1-hour cache, so the
"duplicate" costs approximately $0 today. Moving AIO+PAA to DataForSEO would cost ~$0.14–1.50/mo
and could let SerpApi drop to Free/Starter. That saves at most the difference between the
current SerpApi plan (UNAVAILABLE) and $0–25. ADR-007's reasons (no new vendor for 8 queries)
change once DataForSEO is adopted for rank/volume anyway. Re-open ADR-007 only for
**resilience** (second AIO source), and only after SEO-11 confirms DataForSEO AIO parity.

---

## 4. Rubric scoring

Weights (map SEO-1): impact 30 · gap fit 20 · data quality 15 · effort 15 · cost 10 ·
reliability 10. Each criterion scored 1–5; weighted score = Σ weight × score / 5.

**Anchors**
- *Impact:* 5 = feeds prioritization with volume + rank + competitor signals for every
  cluster; 3 = one or two signals; 1 = marginal.
- *Gap fit:* 5 = covers all 6 gaps (✔ or ◐); 3 = 3 gaps; 1 = 1 gap.
- *Data quality:* 5 = Google-sourced volume + city-level SERP + large live backlink index,
  all verified; 3 = one material caveat; 1 = ranges/unknown.
- *Effort:* 5 = reuse existing key/client, < 1 day; 3 = new vendor + new sensor & table;
  1 = approvals/OAuth/manual token.
- *Cost (expected):* 5 ≤ $25/mo · 4 ≤ $75 · 3 ≤ $150 · 2 ≤ $300 · 1 > $300 or unknown.
- *Reliability/control:* 5 = PAYG, documented API, data in our DB, no human-held token;
  1 = undocumented/fragile or unclear licence.

| Option | Impact 30 | Gap 20 | Quality 15 | Effort 15 | Cost 10 | Reliab. 10 | **Score** | Confidence |
|---|---|---|---|---|---|---|---|---|
| **DataForSEO PAYG** | 5 | 5 | 4 (grouped long-tail volumes) | 3 (build rank sensor) | 5 | 4 (ToS §8.1; +20% hike precedent) | **89** | Medium-high (prices [V]; volume usefulness untested) |
| Ahrefs Lite/Standard | 4 | 4 | 4 (city volume/local UNAVAILABLE) | 4 (built-in rank tracker, free endpoints) | 2 | 3 (subscription, history lock-in, terms not read) | **74** | Medium |
| SerpApi expanded to rank/maps | 3 | 2 | 4 | 5 | 3 | 4 | **67** | High |
| $0 stack (GSC position + flagged Yoast→Semrush proxy) | 3 | 2 | 3 | 4 | 5 | 2 (ADR-008 fragility) | **61** | High |
| Semrush One Starter + MCP | 3 | 3 | 4 | 2 | 2 | 2 (plan naming in flux, units expire) | **56** | Low (unit sufficiency unknown) |
| Local Falcon (add-on only) | 2 | 1 | 4 | 4 | 4 | 4 | **55** | Medium |
| Google Ads KP API | 2 | 1 | 2 (ranges) | 2 (Basic access + dev token) | 5 | 3 | **44** | Medium |
| Semrush Standard API (Business) | — | — | — | — | — | — | **Disqualified** (tier + unpublished unit price ⇒ can't show ≤ $300) | — |
| Moz | — | — | — | — | — | — | **Not scored** (primary source unreachable 2026-10-15) | — |

The $0 stack ranks fourth. GSC already gives own-site average position, but it can't show
volume for zero-impression terms, competitor ranks, Maps rank, or backlinks, so it does not
capture most of the value.

---

## 5. Recommendation

| Stack | Contents | $/mo (expected / high) | Confidence |
|---|---|---|---|
| **Minimum** | GSC positions (existing) + DataForSEO for monthly Texas volumes, quarterly backlinks, monthly Labs competitor keywords; no weekly rank sensor. Keep SerpApi as is. | ~$3 / ~$20 (+ $50 one-time deposit) + current SerpApi | Medium-high |
| **Balanced** | Minimum + weekly DataForSEO organic rank (4 metros, depth 20) + Maps rank (25 kw × 4 metros) + 50 on-demand SERPs. SerpApi stays for AIO (ADR-007), plan right-sized after the cache finding is verified. | ~$12 / ~$70 + SerpApi ($0–75) | Medium-high |
| **Advanced** | Balanced + Ahrefs Lite ($129) for operator-facing backlink/competitor research + MCP, + Local Falcon Basic ($49.99) for geo-grid Maps rank. Optional: DataForSEO as second AIO source. | ~$190 / ~$260 + SerpApi | Medium |

All three fit ≤ ~$300/mo. No budget is approved by this document. Integrations here are
read-only and may proceed in parallel with the apply-path safety work.

---

## 6. SEO-11 (50-keyword coverage spike): what to test

The spike is **needed**. Prices are settled. What is still open is whether the data covers
these queries.

- **Providers:** (1) **DataForSEO**, the candidate. (2) **Semrush via the existing Yoast
  proxy**, a $0 comparator that is already authenticated (ADR-008 allows a one-off read; no
  production dependency). Ahrefs is not worth a paid month for the spike.
- **Sample:** 50 keywords, ~4 per cluster across the 11 cluster rows, mixing head
  ("design build houston") and long-tail ("medical office construction cost per square foot texas").
- **Measure:**
  1. Volume coverage: share of the 50 with non-null, non-zero Google Ads volume at US, Texas,
     and each of the 4 metros (DataForSEO `location_name`); grouping effects (identical volumes
     across variants); agreement with Semrush proxy volumes and with GSC impressions.
  2. SERP/rank parity: for 10 keywords × Houston + Dallas, DataForSEO standard-queue rank of
     maxxbuilders.com vs SerpApi `location=` result vs GSC average position.
  3. AIO parity: for the 9 monitored queries, whether DataForSEO `load_async_ai_overview`
     returns the same cited domains as SerpApi in the same hour (resilience question only).
  4. Maps: 5 keywords × 4 metros, whether Maxx Builders' listing appears in Maps SERP results.
  5. Backlinks: summary + referring domains for maxxbuilders.com + 2 competitors.
- **Cost:** consumption ~$1–2 [E]. However, **DataForSEO's $50 minimum top-up exceeds the
  $25 spike cap**, so it needs the user's explicit sign-off on the ticket. The remainder stays
  as non-expiring balance, and the first purchase is refundable within 30 days (ToS §5.1).
  If the free-account playground credit is enough, $0 (amount UNAVAILABLE).
- **Pass bar (proposal):** ≥ 60% of the 50 keywords have usable (non-zero) Texas-level volume,
  and rank agreement with GSC is within ±3 positions for ≥ 8 of 10 keywords. Otherwise,
  fall back to GSC + proxy volumes and reconsider Ahrefs.
- Separately (not part of the spike, no cost): read the SerpApi dashboard history to confirm
  whether AIO samples 2–3 and PAA are served from cache (§1.1).

---

## 7. Spot-check list (highest consequence if wrong)

1. DataForSEO backlinks commitment removal + rates —
   https://dataforseo.com/update/pricing-update-in-dataforseo-apis (2026-07-01 post) and
   https://dataforseo.com/pricing/backlinks/backlinks ($0.024/task + $0.000036/row).
2. Ahrefs API on Lite — https://help.ahrefs.com/en/articles/6559232-about-api-v3 (units table)
   and https://ahrefs.com/pricing (Lite $129, 750 tracked keywords, weekly).
3. SerpApi cache billing — https://serpapi.com/search-api (`no_cache` parameter: "Cache
   expires after 1h. Cached searches are free") and https://serpapi.com/pricing FAQ.

## 8. Unknowns carried forward

Current SerpApi plan and live `ai_queries` count · whether Ahrefs counts keyword×location as
separate tracked keywords · Ahrefs/Semrush API data-use terms · Semrush unit-package prices
and whether 50k-unit plans issue REST API keys · Moz pricing (site down) · Google Ads spend
threshold for exact volumes · DataForSEO free-account credit amount · BrightLocal API pricing.
