# Spike - External SEO / search / extraction APIs for maxx-seo-agent

**Date checked:** 2026-10-08 (all vendor facts below fetched on this date unless noted)
**Question:** Which external APIs should feed sensing, prioritization, content research, competitor intel, and future multi-site operation?
**Method:** Primary sources only (vendor docs, pricing pages, ToS, Google policies). Unverified items are marked **[UNVERIFIED]**. Cost math is **estimate**, derived from the quoted unit prices.

---

## 1. Executive summary

- **Primary SEO data provider: DataForSEO.** Standard-queue Google SERP is [$0.0006 per 10-result SERP](https://dataforseo.com/pricing/google-serp/google-organic-serp-api) (Live is $0.002), supports location_code/coordinate targeting, local pack / PAA / featured snippet / AI Overview items, and is the only provider in the list with Backlinks, OnPage crawl, Labs competitor data and LLM-mentions. Pay-as-you-go, [$50 minimum top-up](https://dataforseo.com/pricing).
- **Primary extraction provider: Firecrawl** (Hobby, 5,000 credits). 1 credit/page for scrape/crawl, 1 credit/map call, robots.txt respected by default. Use it for competitor pages and rendered-HTML verification only. Maxx's own WordPress content should keep coming from WP REST (`scripts/cms-read.mjs`), not from a paid crawler.
- **Research-only: Exa (source discovery) + Anthropic web search/fetch (in-loop agent research, already wired in `lib/engines.mjs`).** Neither measures Google rankings or search demand. Their output may inform briefs, never trigger queue rows. Skip Tavily for now (training-use clause in its ToS, country-only geo).
- **SerpApi stays as fallback / AIO cross-check** (already integrated per ADR-007; ~10-100x more expensive per rank check than DataForSEO at volume). Its legal indemnity (US Legal Shield, Production plan and up) is the one thing DataForSEO does not offer.
- **Trust boundary:** Google's own policy names ["scraping results for rank-checking purposes"](https://developers.google.com/search/docs/essentials/spam-policies) as a ToS violation, so every SERP vendor is a vendor-risk item. GSC stays ground truth for Maxx's own positions; SERP APIs add competitor, location and SERP-feature context. A single noisy SERP reading must never create a queue row alone. During this research a Firecrawl page returned text addressed to AI agents (prompt injection in the wild), so all extracted content is untrusted data.

---

## 2. Provider comparison

| Provider | Best use | Verified pricing unit | Strength | Limitation | Recommended role |
|---|---|---|---|---|---|
| **DataForSEO** | Rank tracking by city, SERP features, keyword volume, competitor keywords, backlinks, OnPage audit, AI-search volume / LLM mentions | SERP: $0.0006 Standard / $0.0012 Priority / $0.002 Live per 10-result SERP. Ads search volume: $0.06 per task (<=1,000 kw) Standard. Labs: $0.012/task + $0.00012/item. Backlinks: $0.024/request + $0.000036/row. OnPage: $0.00015/page basic, $0.0015 with JS. LLM Mentions: see s8 (page inconsistent) | Cheapest per unit, queue + batch (100 tasks/POST), 2,000 calls/min, one vendor for ~8 use cases | Scrapes Google (ToS grey zone, user indemnifies); Standard turnaround is "target 45 min"; Ads volume is Keyword Planner-style approximate; no first-party ZDR statement found | **Primary SEO data** |
| **Firecrawl** | Competitor page extraction, site map/crawl, change monitoring, JSON-schema extraction | 1 credit per scrape/crawl page, 1 per map call, +4 for JSON format, 2 per 10 search results. Hobby $16/mo (billed yearly; $19 monthly) = 5,000 credits; Standard $83/mo (yearly) = 100,000 | JS rendering, markdown, robots respected, Monitor feature (cron, diff, judge), webhooks | Not an SEO metrics source; crawl results API-retained 24h; ZDR Enterprise only; scraped content is a prompt-injection vector | **Primary extraction** |
| **Exa** | Semantic source discovery for briefs, "find sources/competitors" | $7 per 1k fast/auto searches, $4 instant, $12 deep; contents $1 per 1k pages; $10 free credit monthly; no subscription | Good domain/date filters (up to 1,200 domains), `userLocation`, `costDollars` in response, 10 QPS | No rankings/volume; ZDR Enterprise only; ToS PDF unreadable to me **[UNVERIFIED]** | **Research-only (discovery)** |
| **Anthropic web search + fetch** | Agent-side fact lookup with citations, reading a known URL | Search $10 per 1,000 searches + tokens; Fetch no surcharge (tokens only) | Already authenticated (`ANTHROPIC_API_KEY`), `max_uses`, domain allow/block lists, ZDR-eligible (without dynamic filtering) | No JS rendering in fetch; fetch only URLs already in context; search is a black box (no SERP rank) | **Research-only (in-loop)** |
| **SerpApi** | AI Overview capture, PAA, ad hoc SERP | Plans: $25 = 1,000 searches ... $75 = 5,000, $150 = 15,000, $275 = 30,000; cached/failed searches not counted; AIO follow-up billed as separate search per SerpApi tutorials (page itself silent) | Already integrated (`sensor-paa.mjs`, `lib/engines.mjs`); free Locations API; US Legal Shield from $150 plan | Per-search price 10-100x DataForSEO Standard; no backlinks/OnPage/volume | **Fallback / comparison** |
| **Tavily** | LLM-oriented web search | 1 credit basic search ($0.008 PAYG), 2 advanced; extract 1 credit per 5 URLs; plans $30 = 4,000 credits | Simple, domain filters, `country` boost | ToS 6.5 lets Tavily and third-party AI providers train on inputs/outputs; only country-level geo; ZDR claimed only in marketing/FAQ | **Not now** |

---

## 3. Architecture recommendation

Principle: provider data is a **sensor input**, never an authority. Everything enters Supabase through `orchestrator/lib/supabase.mjs`, and only deterministic or corroborated signals reach `work_queue`.

```
SENSE      scripts/sensor-serp.mjs (new)        DataForSEO SERP Standard, weekly, per keyword x location
           scripts/sensor-keywords.mjs (new)    DataForSEO Ads volume + Labs ranked_keywords/competitors, monthly
           scripts/sensor-backlinks.mjs (new)   DataForSEO Backlinks summary + new/lost, monthly
           scripts/sensor-onpage.mjs (new)      DataForSEO OnPage task_post/summary, monthly (+ post-deploy)
           scripts/sensor-competitors.mjs (new) Firecrawl map/scrape JSON on competitor_domains, monthly
           (existing) sensor-gsc / sensor-cwv / sensor-sitemap / sensor-ai-citations (SerpApi) / sensor-paa
STORE      sql/schema.sql (idempotent additions, s5 SEO-API-1): provider_spend, serp_snapshots, keyword_metrics,
           backlink_snapshots, page_snapshots(competitor) ; reuse competitor_domains, ai_queries, ai_citations
           (sql/ai-search-schema.sql). All reads/writes via new exports in orchestrator/lib/supabase.mjs
PRIORITIZE scripts/prioritize.mjs + orchestrator/lib/learning.mjs: add BASE sources (serp, onpage, keyword, backlink);
           volume/position-gap used as an opportunity weight, never as a trigger by itself
QUEUE      work_queue rows via enqueue(): reuse existing KIT_TASKS (orchestrator/lib/tasks.mjs) -
           metadata-generate, schema-generate, internal-linking, cwv-audit, gsc-opportunity-mining,
           blog-ideas, blog-audit, faq-schema, local-page-plan, restructure-for-citation
SKILL      existing skills consume `serp_snapshots`/`keyword_metrics` via mem.mjs (e.g. gsc-opportunity-mining,
           blog-ideas, local-page-plan); competitor-gap skill deferred to Phase 3 (needs KIT_TASKS entry)
VALIDATE   scripts/validators/* + validate:metadata + validate-json + check-citation-density (unchanged);
           NEW: claims check for any provider-sourced number placed in content (orchestrator/lib/claims.mjs is
           untracked in this checkout - confirm scope before depending on it) ; provider budget gate before any call
APPLY      unchanged: change_set -> packs/wordpress (production-only, backup + small batch), PR flow via seo/auto-* branch
LEARN      collect-outcomes / attribute.mjs: add `serp_position` outcome metric (provider-sourced, flagged
           lower confidence than GSC `position`)
```

### Risk-class mapping (per `.claude/rules/workflow.md`)

| Signal | Queue task | Class | Why |
|---|---|---|---|
| OnPage: missing/duplicate title/description, non-indexable, broken internal link, missing schema | metadata-generate / internal-linking / schema-generate | **safe** | Deterministic, verified against fetched HTML before enqueue |
| Own-page rank drop confirmed by GSC position delta AND 2 consecutive SERP checks | gsc-opportunity-mining / blog-audit | **safe** (refresh under size + uniqueness thresholds) | Corroborated |
| Keyword gap (competitor ranks, Maxx does not) | blog-ideas / local-page-plan | **gated** until Phase 3 | New page batches, cannibalization risk (known restaurant cluster), doorway guardrail 30/50 |
| Competitor pricing/positioning or any cost figure from extracted pages | any content task | **gated** | Brand/pricing; YMYL-adjacent cost claims; fabricated-stat risk |
| Backlink lost/new | none (digest only) | **gated / human** | Outreach is a human action; 301s are forbidden by repo constraints |
| LLM/AIO mention change | restructure-for-citation | per ADR-007 analyst gate | AIO flicker |
| Exa / Anthropic / Tavily research output | none | n/a | Evidence for human or `blog-ideas`, never a trigger |

### Cost controls
- **Do not reuse `control.spend_usd`** for provider spend: `orchestrator/lib/preflight.check()` stops the Claude loop when it exceeds `MONTHLY_BUDGET_USD` (default 50), so a rank-tracking spike would halt content work. Add a separate `provider_spend` ledger and per-provider caps (`DATAFORSEO_MONTHLY_CAP_USD`, `FIRECRAWL_MONTHLY_CREDIT_CAP`, etc.). Tradeoff: two budgets to watch; benefit: sensors cannot starve the fixer.
- Every provider client must check `isPaused()` (kill switch) and the provider cap before each batch, and filter keywords/URLs through `doNotTouch` / `isProtected` (`orchestrator/lib/url.mjs`) for page-targeting calls.
- DataForSEO returns `cost` per task, so record actual cost, not estimates. Exa returns `costDollars`. Also set dashboard limits (DataForSEO pricing page: ["free account cost-management tools ... setting budgets, and setting limits"](https://dataforseo.com/pricing)).
- Dedupe identical tasks: DataForSEO ToS 8.2 treats identical API tasks as a user error and non-refundable.

### Credentials (`.claude/rules/security.md`)
Add to the credential inventory: `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` (Basic auth, API password distinct from account password; blast radius = prepaid balance + account abuse), `FIRECRAWL_API_KEY`, `EXA_API_KEY`. `SERPAPI_KEY` is already in CI but absent from the inventory table, and `scripts/sensor-paa.mjs` puts it in the URL query string (`api_key=`), which can land in logs; move to a client that never logs the URL. Never echo or log; CI secrets only; no browser-facing import.

---

## 4. MVP plan (3 phases)

**Phase 1 - read-only sensing (no queue writes, no apply).** Provider ledger + budget gate; DataForSEO location lookup for Houston/Dallas/Austin; weekly SERP snapshots for the ~30 clusters in root `CLAUDE.md` (3 locations, depth 20); monthly Ads volume + Labs competitors; monthly OnPage + Backlinks baselines. Output: a Supabase snapshot table and a markdown digest (`output/`). Success: 4 consecutive weeks of data, cost within estimate, 0 ledger gaps.

**Phase 2 - queue generation and prioritization.** Convert deterministic OnPage findings and corroborated rank drops into `safe` rows; add `source` values and BASE weights in `prioritize.mjs`; keyword-gap and competitor-diff rows go in as `gated` (escalated to Linear via `push-escalations.mjs`). Firecrawl competitor snapshots feed `competitor_domains` classification and `blog-ideas`. Success: precision of auto-enqueued rows reviewed manually >= 80% over 4 weeks.

**Phase 3 - automated workflows with review gates.** `competitor-gap` skill (add to KIT_TASKS) producing briefs with claim provenance; Firecrawl Monitor on competitor money pages (weekly); SERP-position outcome attribution in the learning loop; optional DataForSEO LLM Mentions for AI visibility; multi-site `site_id` rollout (ADR-0001 migration path). Gates: manifest review before apply, WP production-only rules, doorway 30/50.

---

## 5. Implementation tickets

| ID | Title | Files touched | Acceptance criteria | Size |
|---|---|---|---|---|
| SEO-API-1 | Provider spend ledger + budget gate | `sql/schema.sql` (new table `provider_spend` + atomic increment fn with `REVOKE ... FROM anon, public` / `GRANT ... authenticated, service_role`), `orchestrator/lib/supabase.mjs`, new `orchestrator/lib/provider-budget.mjs`, tests | Gate returns not-ok when paused or cap hit; month rollover; concurrent increments don't lose updates (mirrors `increment_spend`); real-DB test, no mock | M |
| SEO-API-2 | DataForSEO client | new `orchestrator/lib/dataforseo.mjs`, `.claude/rules/security.md`, `.env.example` | Basic auth from env, throws on missing creds, never logs creds; records `cost` into ledger; retries 5xx only; 100-task POST batching; honors 2,000 calls/min | M |
| SEO-API-3 | Location resolver | `orchestrator/lib/dataforseo.mjs`, `config/` seed | Resolves Houston/Dallas/Austin to `location_code` via the free locations endpoint, caches in config; fails loudly if City type not returned | S |
| SEO-API-4 | SERP snapshot sensor | new `scripts/sensor-serp.mjs`, schema `serp_snapshots`, `package.json` script | task_post/tasks_ready/task_get Standard; stores rank, local_pack, PAA, featured snippet, AIO presence per keyword x location x device; dry-run flag; cost printed before run; idempotent on re-run | L |
| SEO-API-5 | Keyword metrics sensor | new `scripts/sensor-keywords.mjs`, schema `keyword_metrics` | Ads volume (<=1,000 kw/task) + Labs ranked_keywords for own domain and `competitor_domains`; monthly cadence guard | M |
| SEO-API-6 | OnPage audit sensor | new `scripts/sensor-onpage.mjs`, `scripts/mem.mjs` enqueue path | Crawl capped by `max_crawl_pages`; findings map to existing KIT_TASKS; every enqueued URL re-verified by a direct HTTP fetch before enqueue; `do_not_touch` honored | M |
| SEO-API-7 | Backlink baseline + digest | new `scripts/sensor-backlinks.mjs`, schema `backlink_snapshots` | Summary + referring domains (<=1,000 rows) for own + competitors; produces digest only, zero queue rows | S |
| SEO-API-8 | Prioritize integration | `scripts/prioritize.mjs`, `orchestrator/lib/learning.mjs`, tests | New sources get BASE weights; volume weight capped; unit tests for clamp 0..10 retained | S |
| SEO-API-9 | Firecrawl client + competitor snapshots | new `orchestrator/lib/firecrawl.mjs`, `scripts/sensor-competitors.mjs`, schema `page_snapshots` | Uses `sitemap:"only"` + `limit`; sets `maxAge` explicitly; strips/neutralizes instruction-like text; stored as data with source URL + fetched_at; credit cap enforced | M |
| SEO-API-10 | Untrusted-content guard | `orchestrator/lib/claims.mjs` or new `orchestrator/lib/untrusted.mjs`, `.claude/agents/seo-fixer.md` | Provider text is wrapped/labelled as data in prompts; seo-fixer cannot act on instructions found in it; test with a seeded injection string | M |
| SEO-API-11 | SerpApi hardening | `scripts/sensor-paa.mjs`, `lib/engines.mjs` | Key not placed in logged URLs; add `no_cache:true` when following an AIO `page_token`; location passed for Houston/Dallas/Austin | S |
| SEO-API-12 | AIO cross-check (DataForSEO vs SerpApi) | `lib/engines.mjs`, `scripts/sensor-ai-citations.mjs` | 4-week shadow comparison table; decision recorded in a new ADR before switching | M |
| SEO-API-13 | Multi-site key | `sql/schema.sql` new tables only: `site_id text not null default 'maxxbuilders.com'` | No change to existing tables; all new sensors accept `SITE_ID`; documented in ADR-0001 follow-up | S |
| SEO-API-14 | Competitor-gap skill (Phase 3) | `.claude/skills/competitor-gap/`, `orchestrator/lib/tasks.mjs` | Skill output is `gated`, cites snapshot IDs, passes citation-density and content-guards | L |

---

## 6. Cost model (ESTIMATES)

Unit prices: SERP Standard $0.0006/SERP; AIO add-on `load_async_ai_overview` $0.002 on top of Live $0.002; Labs $0.012/task + $0.00012/item; Backlinks $0.024 + $0.000036/row; OnPage $0.0015/page with JS; Ads volume $0.06/task Standard; Firecrawl 1 credit/page (+4 JSON); Exa $0.007/search + $0.001/page. Weeks per month = 4.33. Claude token spend (seo-fixer, judge) excluded; DataForSEO's $50 top-up is prepaid balance, not additional cost.

**Assumptions per scale**

| | 1 site | 5 sites | 20 sites |
|---|---|---|---|
| Tracked keyword x location pairs | 450 (150 kw x 3 cities) | 1,650 (450 + 4 x 300) | 6,150 (450 + 19 x 300) |
| Rank check | weekly, depth 20 (2 SERP units), mobile | same | same |
| AIO/feature queries | 20 queries x 3 samples/wk, Live + AIO add-on | same per site | same per site |
| Competitor/backlink/OnPage (monthly) | own + 5 competitors | same per site | same per site |
| Firecrawl credits/mo | 930 per site | 4,650 | 18,600 |
| Research briefs | 8/mo/site, 5 Exa searches + 10 pages each | same | same |

**Arithmetic**

| Line | 1 site | 5 sites | 20 sites |
|---|---|---|---|
| Rank tracking: pairs x 2 x $0.0006 x 4.33 | 450x2x0.0006 = $0.54/wk -> **$2.34** | 3,300x0.0006 = $1.98/wk -> **$8.57** | 12,300x0.0006 = $7.38/wk -> **$31.95** |
| AIO samples: 60 x ($0.002+$0.002) x 4.33 per site | $0.24/wk -> **$1.04** | **$5.20** | **$20.80** |
| Labs ranked kw (6 domains x ($0.012 + 1,000 x $0.00012 = $0.132)) | $0.79 | $3.96 | $15.84 |
| Backlinks (6 domains x 2 calls x $0.06) | $0.72 | $3.60 | $14.40 |
| OnPage (300 pages x $0.0015) + Ads volume ($0.06) | $0.51 | $2.55 | $10.20 |
| Firecrawl plan (Hobby $19 monthly-billed / Standard $83 yearly-billed) | 930 cr -> Hobby **$19** | 4,650 cr -> Hobby **$19** (93% of 5,000) | 18,600 cr -> Standard **$83** |
| Exa research (8 briefs x (5x$0.007 + 10x$0.001) = $0.36) | $0.36 | $1.80 | $7.20 |
| **Total / month** | **~$25.8** | **~$45.7** | **~$184** |

Optional: LLM Mentions at $0.10/request + $0.001/row (1,000 rows = ~$1.10; vendor page shows an inconsistent $0.05 example, so verify before budgeting): about $5.50/site/mo for 5 pulls.

**Sensitivity**
- Daily instead of weekly rank checks multiplies the rank line by ~7 (1 site ~ $16; 20 sites ~ $224).
- Same rank load on SerpApi (depth 10 only): 450 x 4.33 = 1,949 searches/mo -> Developer $75 (1 site); 6,150 x 4.33 = 26,630 -> Big Data $275 (20 sites). DataForSEO is ~30x (1 site) to ~9x (20 sites) cheaper on this line even at double the depth.
- Firecrawl Monitor, if enabled on 30 URLs daily = ~900 credits/mo/site on top.
- Standard Queue is cheapest but "target turnaround 45 minutes"; Priority is 2x price for ~1 min. Weekly cadence tolerates Standard.

---

## 7. Risks and guardrails

| Risk | Guardrail |
|---|---|
| Google ToS: automated SERP queries named as a violation ([spam policies](https://developers.google.com/search/docs/essentials/spam-policies), [Google ToS](https://policies.google.com/terms)). DataForSEO ToS 7.2 puts [indemnity on the user](https://dataforseo.com/terms-of-service). | Treat SERP vendors as replaceable; keep GSC as source of truth; keep adapters behind one interface so SerpApi (with Legal Shield, US-law claims only) can substitute; consider counsel review before scaling to 20 sites |
| SERP noise (personalization, AIO flicker) | 2 consecutive reads + GSC corroboration before any `safe` enqueue; majority sampling for AIO per ADR-007 |
| Prompt injection via extracted pages (observed: Firecrawl pages carried AI-addressed instructions) | SEO-API-10; extracted text is data only; seo-fixer has write tools, so never pass raw competitor text as instructions |
| Fabricated stats / competitor claims in content | Provider numbers only through claims/citation-density validators; cost figures stay `gated` |
| Runaway spend | Provider ledger + per-provider caps + kill switch + dedupe identical tasks |
| Credential leakage | Env/CI secrets only; Basic-auth header not URL; fix SerpApi query-string key |
| Third-party data handling: Tavily ToS 6.5 allows training on inputs/outputs; Firecrawl ZDR Enterprise only; Exa ZDR Enterprise only; DataForSEO retention unstated | Send only public queries/URLs; no unpublished drafts or client data to Tavily/Exa/Firecrawl |
| Doorway/scaled-content risk from keyword-gap automation | Keep programmatic guardrail 30 warn / 50 hard stop; Google [scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies) examples include generating many pages without added value |
| WordPress production-only | Provider data never writes to WP directly; only `change_set` path with backup + small batch |
| Pricing drift | DataForSEO raised ~20% across most APIs on [2026-07-01](https://dataforseo.com/update/pricing-update-in-dataforseo-apis); read `cost` from responses and alert on unit-cost drift |

---

## 8. Per-provider verified detail

### DataForSEO
- **Capabilities:** Google Organic SERP with item types `local_pack`, `featured_snippet`, `people_also_ask`, `ai_overview`, etc.; params `location_code`/`location_name`/`location_coordinate`, `language_code`, `device`, `depth` (default 10, max 200), `load_async_ai_overview`, `people_also_ask_click_depth` ([Live Advanced docs](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/)). Maps SERP accepts `location_coordinate` (lat,lng,zoom) and returns rating, `place_id`, `cid` ([docs](https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/)). Keywords Data Google Ads search volume: <=1,000 keywords/request, 4 years of `monthly_searches`, current month not available, Live limited to 12 req/min ([docs](https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/)). Labs Google: ranked keywords, competitors domain, domain intersection, keyword ideas/suggestions, bulk difficulty, search intent, historical rank - Live only ([overview](https://docs.dataforseo.com/v3/dataforseo_labs/overview/)). Backlinks: summary, backlinks, referring domains, anchors, competitors, intersections, timeseries, new/lost, bulk up to 1,000 targets; live index ([overview](https://docs.dataforseo.com/v3/backlinks/overview/)). OnPage: task_post crawl with optional JS, resources, browser rendering, keyword density; duplicate tags/content, redirect chains, non-indexable, raw HTML ([overview](https://docs.dataforseo.com/v3/on_page/overview/)). AI Optimization: LLM Responses (ChatGPT, Claude, Gemini, Perplexity), LLM Scraper (ChatGPT, Gemini), AI Keyword Data (Live), LLM Mentions (Live; platform `google` = AI Overview, `chat_gpt` US/English only) ([overview](https://docs.dataforseo.com/v3/ai_optimization/overview/), [mentions search](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search/live/)).
- **Pricing (checked 2026-10-08):** minimum payment [$50](https://dataforseo.com/pricing). SERP per 10-result SERP: Standard $0.0006 (~5 min avg, "target 45 min"), Priority $0.0012 (~1 min), Live $0.002 (~6 s); `site:`/`intitle:` operators 5x; AIO add-on $0.002; PAA click $0.00015 each ([Google Organic pricing](https://dataforseo.com/pricing/google-serp/google-organic-serp-api)). Maps SERP same tiers per up-to-100-result page ([pricing](https://dataforseo.com/pricing/google-serp/google-maps-serp-api)). Ads volume Standard $0.06/task (1-3 h), Live $0.09/task ([pricing](https://dataforseo.com/pricing/keywords-data/google-ads)). Labs: $0.012/task + $0.00012/item (grouped "all other endpoints", endpoint-level mapping not confirmed by the page); historical rank $0.12 + $0.0012/item; `include_clickstream_data` doubles cost ([pricing](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api)). Backlinks $0.024/request + $0.000036/row, 1,000 rows max ([pricing](https://dataforseo.com/pricing/backlinks/backlinks)); the $100/month commitment was removed 2026-07-01 ([update](https://dataforseo.com/update/pricing-update-in-dataforseo-apis)). OnPage per page: basic $0.00015, resources $0.00045, JS $0.0015, browser rendering $0.0051, screenshot $0.0048; Lighthouse price not shown on page ([pricing](https://dataforseo.com/pricing/on-page/onpage-api)). LLM Mentions $0.1/request + $0.001/row but the page's own example total ($0.05) does not reconcile ([pricing](https://dataforseo.com/pricing/ai-optimization/llm-mentions)). AI Keyword Search Volume $0.01/request + $0.0001/keyword ([pricing](https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume)). LLM Responses Live $0.0006 + LLM charge ([pricing](https://dataforseo.com/pricing/ai-optimization/llm-responses)). LLM Scraper $0.0012 / $0.0024 / $0.004 per results page, ChatGPT and Gemini only ([pricing](https://dataforseo.com/pricing/ai-optimization/llm-scraper)).
- **Limits / async:** 2,000 API calls/min, <=100 tasks per POST, Standard = task_post + tasks_ready/task_get or `pingback_url`/`postback_url`; Live SERP = 1 task per call ([SERP overview](https://docs.dataforseo.com/v3/serp/overview/)); Backlinks/Labs/LLM Mentions: also max 30 simultaneous requests. Higher limits on request. The standalone rate-limits appendix page returned 404.
- **Auth:** HTTP Basic with API login + API password (generated, different from account password) from the dashboard API Access tab ([auth](https://docs.dataforseo.com/v3/auth/)). IP allow-listing not documented on that page.
- **Freshness / history:** Ads volume: no current month, 4 years history. Backlinks: "live index"; history depth not stated. LLM Mentions: `first_response_at`/`last_response_at` per item, monthly AI volume array; cadence not stated.
- **Locations:** Free locations endpoint returns `location_code`, `location_name`, `location_type` ([docs](https://docs.dataforseo.com/v3/serp/google/locations/)). **[UNVERIFIED]** that City-level codes exist for Houston/Dallas/Austin; the docs page only showed Country/State examples.
- **ToS:** No credit-expiry statement; 30-day refund on first-time API credit purchase; identical tasks are user error; SERP data "shall not be used to compete with ... search engine providers" (7.1) with user indemnity (7.2); no stated policy on AI training or result retention ([terms](https://dataforseo.com/terms-of-service)).
- **Reliability for queue rows:** OnPage findings and counts: reliable (verify by direct fetch). SERP rank: corroborate with GSC. Ads volume: directional only. Backlinks/LLM mentions: human review.

### Firecrawl
- **Capabilities:** `/v2/scrape` (markdown, html, links, json, screenshot...), `/v2/crawl` (async job, `includePaths`, `sitemap` include/skip/only, `maxDiscoveryDepth`, webhooks with HMAC signature), `/map` (URLs from sitemap + SERP + prior crawls, `search` param, speed over completeness), `/search`, interact, agent, parse; Monitor (scrape/crawl/search targets, cron >= 5 min, markdown or JSON-field diff, optional LLM judging) ([intro](https://docs.firecrawl.dev/introduction), [crawl](https://docs.firecrawl.dev/features/crawl), [map](https://docs.firecrawl.dev/features/map), [monitor](https://docs.firecrawl.dev/features/monitor), [scrape](https://docs.firecrawl.dev/features/scrape)).
- **Pricing:** Free 1,000 credits; Hobby $16 yearly / $19 monthly, 5,000; Standard $83 yearly, 100,000; Growth $333, 500,000; Scale $599, 1,000,000; PAYG credits in $5 steps on paid plans ([pricing](https://www.firecrawl.dev/pricing)). Credits: scrape/crawl 1/page, map 1/call, search 2 per 10 results, JSON format +4, PDF +1/page, ZDR +1/page ([billing](https://docs.firecrawl.dev/billing)). Monitor: 1 credit/page/check, +1 per judged change, no separate fee. Cached scrapes still cost 1 credit; default `maxAge` 2 days.
- **Limits:** Hobby 100 req/min scrape/map/search, 20 crawl; 5 concurrent browsers; 50,000 queued jobs ([rate limits](https://docs.firecrawl.dev/rate-limits)). Crawl `limit` default 10,000 and returns 402 if credits cannot cover it, so always set `limit`.
- **Auth:** `Authorization: Bearer $FIRECRAWL_API_KEY`; keyless MCP exists for search/scrape/parse.
- **Freshness / retention:** Crawl results available via API 24h; scraping can serve cache up to `maxAge`; ZDR Enterprise only.
- **ToS / robots:** robots.txt respected by default; `ignoreRobotsTxt` Enterprise only ([crawl docs](https://docs.firecrawl.dev/features/crawl)). Terms put legality, third-party content risk and indemnity on the user; content submitted is licensed to Firecrawl irrevocably; no stated retention period ([terms](https://www.firecrawl.dev/terms-of-service)).
- **Measures Google rankings/demand?** No. Reliable for queue rows only for own-site structural checks; competitor data is evidence.

### Exa
- **Capabilities:** `POST /search` types instant/fast/auto/deep-lite/deep/deep-reasoning; `includeDomains` (up to 1,200), date filters, `category`, `userLocation` (country or lat/long), `contents` (text/highlights/summary), `costDollars` in response ([search ref](https://exa.ai/docs/reference/search)).
- **Pricing:** instant $4, fast/auto $7, deep $12 per 1k requests; contents $1 per 1k pages; Answer $5/1k; Monitors $15/1k; $10 free monthly credit; no subscription ([pricing](https://exa.ai/docs/reference/pricing)).
- **Limits:** 10 QPS search/answer; 5 QPS deep; 100 QPS contents ([rate limits](https://exa.ai/docs/reference/rate-limits)).
- **Auth:** `x-api-key` or Bearer.
- **ZDR:** Enterprise feature per pricing page. **Terms:** PDF not machine-readable in my fetch -> **[UNVERIFIED]**; zero-data-retention docs URL returned 404.
- **Measures rankings/demand?** No.

### Anthropic web search / web fetch
- **Search:** versions `web_search_20250305`, `_20260209` (dynamic filtering), `_20260318`; `max_uses`, `allowed_domains`/`blocked_domains`, approximate `user_location`; $10 per 1,000 searches + tokens; errors are not billed; org-level admin can disable ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)).
- **Fetch:** `web_fetch_20250910` ... `_20260318`; no extra charge beyond tokens; only fetches URLs already present in conversation context; no JavaScript-rendered pages; refuses robots-blocked and private addresses; exfiltration warning for untrusted input + sensitive data ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)).
- **Retention:** Both ZDR-eligible; dynamic filtering is not ZDR/HIPAA eligible ([data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)).
- **Repo status:** `lib/engines.mjs` `askClaude` already uses `web_search_20250305` with `max_uses: 4`.
- **Auth:** existing `ANTHROPIC_API_KEY` (metered pool per `security.md`).

### SerpApi
- **Capabilities:** Google search JSON with `local_results`, `related_questions`; AI Overview via `ai_overview` (inline, or `page_token` for a second `engine=google_ai_overview` call; token expiry documented as 1 minute on [one page](https://serpapi.com/google-ai-overview-api) and 4 minutes per search result snippet of another page - plan for 1 minute); `location` (canonical name via free [Locations API](https://serpapi.com/locations-api)), `uule`, `gl`, `hl`, `device`, `async`, `no_cache`, `json_restrictor` ([search API](https://serpapi.com/search-api)).
- **Pricing:** Free 250/mo; $25 1,000; $75 5,000; $150 15,000; $275 30,000; $725 100,000; only successful uncached searches counted; no published overage rate ([pricing](https://serpapi.com/pricing)). AIO follow-up counted as a separate search per SerpApi's blog tutorials (found via search; the AIO API page is silent) - treat as 2 credits worst case.
- **Throughput:** guaranteed searches/hour per plan (e.g., Starter 200/hr, Developer 1,000/hr).
- **Legal:** US Legal Shield up to $2M for U.S.-law claims, Production plan and above, conditional on lawful use ([legal](https://serpapi.com/legal)). Terms of service URL returned 404 -> not reviewed. ZeroTrace is Enterprise-only.
- **Measures rankings/volume?** Rankings yes; volume no; no backlinks.

### Tavily
- **Capabilities:** `POST /search` (depth basic/advanced/fast/ultra-fast, `include_domains` max 300, `country` boost general topic only, `time_range`, optional answer/raw content), extract, map, crawl, research ([search ref](https://docs.tavily.com/documentation/api-reference/endpoint/search)).
- **Pricing:** basic/fast 1 credit, advanced 2; extract 1 credit per 5 URLs; PAYG $0.008/credit; Project $30 = 4,000 credits; free 1,000 ([credits](https://docs.tavily.com/documentation/api-credits), [pricing](https://www.tavily.com/pricing)).
- **Limits:** dev key 100 RPM, production 1,000 RPM; production key needs a paid plan or PAYG ([rate limits](https://docs.tavily.com/documentation/rate-limits)).
- **ToS:** 6.5 permits Tavily and third-party AI providers to use customer input/outputs for model training; 3.2(viii) bars data mining/robots through the service except reasonable API use; no retention period; ZDR claimed in marketing/FAQ, no formal doc found ([terms](https://www.tavily.com/terms), [retention help](https://help.tavily.com/articles/6781493822-data-retention)).
- **Measures rankings?** No.

---

## 9. Sources checked (date checked 2026-10-08)

Loaded: [DataForSEO pricing](https://dataforseo.com/pricing) | [Google Organic SERP pricing](https://dataforseo.com/pricing/google-serp/google-organic-serp-api) | [Maps SERP pricing](https://dataforseo.com/pricing/google-serp/google-maps-serp-api) | [Keywords Data (Google Ads) pricing](https://dataforseo.com/pricing/keywords-data/google-ads) | [Labs pricing](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api) | [Backlinks pricing](https://dataforseo.com/pricing/backlinks/backlinks) | [OnPage pricing](https://dataforseo.com/pricing/on-page/onpage-api) | [LLM Mentions pricing](https://dataforseo.com/pricing/ai-optimization/llm-mentions) | [LLM Responses pricing](https://dataforseo.com/pricing/ai-optimization/llm-responses) | [LLM Scraper pricing](https://dataforseo.com/pricing/ai-optimization/llm-scraper) | [AI Keyword Volume pricing](https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume) | [2026-07-01 pricing update](https://dataforseo.com/update/pricing-update-in-dataforseo-apis) | [SERP overview](https://docs.dataforseo.com/v3/serp/overview/) | [Organic Live Advanced](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/) (first 100k of 395k chars read) | [Maps Live Advanced](https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/) | [Locations](https://docs.dataforseo.com/v3/serp/google/locations/) | [Google Ads search volume](https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/) | [Labs overview](https://docs.dataforseo.com/v3/dataforseo_labs/overview/) | [Backlinks overview](https://docs.dataforseo.com/v3/backlinks/overview/) | [OnPage overview](https://docs.dataforseo.com/v3/on_page/overview/) | [AI Optimization overview](https://docs.dataforseo.com/v3/ai_optimization/overview/) | [LLM Mentions overview](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/overview/) | [LLM Mentions search](https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search/live/) (first 100k of 142k read) | [DataForSEO auth](https://docs.dataforseo.com/v3/auth/) | [DataForSEO ToS](https://dataforseo.com/terms-of-service) | [Firecrawl pricing](https://www.firecrawl.dev/pricing) | [billing](https://docs.firecrawl.dev/billing) | [rate limits](https://docs.firecrawl.dev/rate-limits) | [introduction](https://docs.firecrawl.dev/introduction) | [crawl](https://docs.firecrawl.dev/features/crawl) | [map](https://docs.firecrawl.dev/features/map) | [monitor](https://docs.firecrawl.dev/features/monitor) | [scrape](https://docs.firecrawl.dev/features/scrape) | [Firecrawl ToS](https://www.firecrawl.dev/terms-of-service) | [Tavily credits](https://docs.tavily.com/documentation/api-credits) | [pricing](https://www.tavily.com/pricing) | [rate limits](https://docs.tavily.com/documentation/rate-limits) | [search ref](https://docs.tavily.com/documentation/api-reference/endpoint/search) | [about](https://docs.tavily.com/documentation/about) | [terms](https://www.tavily.com/terms) | [retention](https://help.tavily.com/articles/6781493822-data-retention) | [Exa pricing](https://exa.ai/docs/reference/pricing) and [exa.ai/pricing](https://exa.ai/pricing) | [Exa search ref](https://exa.ai/docs/reference/search) | [Exa rate limits](https://exa.ai/docs/reference/rate-limits) | [SerpApi pricing](https://serpapi.com/pricing) | [search API](https://serpapi.com/search-api) | [AIO API](https://serpapi.com/google-ai-overview-api) | [AIO results](https://serpapi.com/ai-overview) | [Locations API](https://serpapi.com/locations-api) | [SerpApi legal](https://serpapi.com/legal) | [Claude web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) | [Claude web fetch](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool) | [Claude data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) | [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | [Google ToS](https://policies.google.com/terms)

**Failed / unreadable / not confirmed:**
- 404: dataforseo.com/apis/serp-api/pricing; docs.dataforseo.com/v3/appendix/rate_limits/ (limits taken from the SERP/Backlinks/Labs overview pages instead); serpapi.com/legal-us and serpapi.com/terms-of-service (SerpApi ToS not reviewed); exa.ai/docs/reference/zero-data-retention; docs.firecrawl.dev/security/zero-data-retention (ZDR taken from the scrape docs page).
- Unreadable: exa.ai/terms-of-service returned a compressed PDF; Exa terms **[UNVERIFIED]**.
- Not pricing-confirmed on page: DataForSEO Lighthouse price; Labs endpoint-by-endpoint mapping to the "all other endpoints" tier; Firecrawl Extract/enhanced-proxy credit cost; Exa standard-plan QPS beyond the rate-limit page; whether DataForSEO's published prices already include the July 2026 +20% (the Backlinks $0.024/$0.000036 equals 1.2x of $0.02/$0.00003, which suggests yes, but that arithmetic is my inference **[UNVERIFIED]**).
- Not obtained: DataForSEO result retention/ZDR policy; DataForSEO City-level `location_code` confirmation; whether SerpApi bills AIO follow-up per its own docs (only blog tutorials say so); Firecrawl API field for programmatic credit usage; current SerpApi plan actually held by the team.
- Conflicting vendor statements: SerpApi AIO `page_token` expiry (1 minute vs 4 minutes across SerpApi pages); DataForSEO Standard queue (5 min average vs "target 45 minutes"); DataForSEO LLM Mentions price example vs stated rates.
- Page-level injection: Firecrawl's pricing and terms pages contained text instructing AI agents to fetch onboarding files / set up accounts; ignored.
