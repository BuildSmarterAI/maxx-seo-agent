# Agentic AI / LLM SEO — Highest-Leverage Improvements (2026 Research)

**Scope.** How to improve *AI/LLM SEO performance* — visibility, citation frequency, answer inclusion, brand accuracy, and qualified traffic from answer engines (Google AI Overviews & AI Mode, ChatGPT search, Perplexity, Bing/Copilot, Claude, Gemini) — via **agentic workflows**, not generic SEO. Every tactic below is mapped to a concrete hook in *this* repo (`maxx-seo-agent`): **`exists`** (already built, file cited), **`partial`** (built but incomplete), or **`gap`** (recommended build).

**Date:** 2026-07-09. **Audience:** operators of the maxx-seo-agent GEO loop.

---

## How to read the evidence (fact-tier legend)

Every claim in this report is tagged. Do not treat them as equal.

| Tag | Meaning | Trust |
| --- | --- | --- |
| 🟢 **Confirmed** | Stated by the platform itself (Google) or a peer-reviewed study. | High |
| 🔵 **Source-backed** | Reproducible industry study with a stated method/sample, independently reported. | Medium-high |
| 🟡 **Vendor** | Figure from a tool vendor or agency selling the service; directionally useful, not independently verified. | Low-medium |
| ⚪ **Assumption** | A reasonable inference this report makes; not directly measured. | Low |
| 🔴 **Unproven / debunked** | Popular tactic with no evidence, or explicitly debunked by the platform. | Avoid |

**The single most important framing (🟢 Confirmed):** Google's AI-features guide (updated 2026-06-15) states *"optimizing for generative AI search is optimizing for the search experience, and thus still SEO."* AI-Overview citation comes from the **same fundamentals** as ranking: crawlable HTML, useful content, clear structure, topical authority, E-E-A-T. There is no separate "AI schema" or magic file. ([Search Engine Journal](https://www.searchenginejournal.com/what-googles-new-ai-guide-actually-debunks-and-what-it-doesnt/575497/))

---

## 0. Reconciliation with Google's June 2026 guidance — what to STOP doing first

Before adding tactics, cut the ones Google's own mythbusting section names as ineffective for citation. This anchors the whole program against hype (and the repo's root `CLAUDE.md` already anticipates most of it).

| Debunked tactic 🔴 | Google's position | Repo status |
| --- | --- | --- |
| **llms.txt for ranking/citation** | "No effect — positive or negative — on Google Search or AI Overviews." | Root `CLAUDE.md` already treats `/llms.txt` as a zero-cost agent-routing hedge with *no expected SEO value*. ✅ aligned. |
| **Content chunking for AI** | Breaking content into AI-specific pieces is unnecessary. | Root `CLAUDE.md`: "Do NOT invest in content chunking." ✅ aligned. |
| **AI-specific content rewriting / keyword-variation** | Treated as low-effort content. | Root `CLAUDE.md`: "Do NOT invest in keyword-variation rewriting." ✅ aligned. |
| **Schema as a citation lever** | "No special structured data is required for AI features." Schema still enables rich results & entity recognition — it is **not** a citation cause. | Repo generates schema (`schema-generate`) but should frame it as entity/rich-result enablement, not a citation hack. ⚠️ language fix. |
| **Inauthentic mentions / manufactured buzz** | Spam policy violation. | Covered by `check-content-guards.mjs` + brand/YMYL gating. ✅ aligned. |

**Caveat (🟢 Confirmed):** *"Wrong for Google Search is not the same as wrong for AI agents."* The guide covers **citation** only. Machine-readable docs and clean structure can still help **agents that act on your site** (booking, lookups) — a different use case than getting cited. Keep `/llms.txt` for that reason alone, noindexed.

---

## The 10 areas, ranked-within by leverage

Each area uses the same sub-fields: **What / Why for AI search / Evidence / Agent detect / Agent generate / Agent validate / Risk / Automation verdict.**

### 1. Content structure for answer engines — `exists` + `gap`

- **What.** Answer-first structure: the direct answer (number, range, yes/no, definition) sits in the first ~30% of the body, followed by supporting depth, TL;DR, and comparison tables.
- **Why for AI search.** RAG pipelines do **passage-level** extraction, not whole-page scoring. The extractable answer must be near the top and self-contained.
- **Evidence.** 🔵 ~44.2% of AI citations come from the **first 30%** of content (Superlines, via [Discovered Labs](https://discoveredlabs.com/blog/ai-citation-patterns-how-chatgpt-claude-and-perplexity-choose-sources)). 🟢 Google: "clear, well-organized content gets cited." 🟢 The Princeton **fluency/authoritative-voice** tactics lifted citations +15–30% ([SeenRank summary](https://seenrank.com/blog/the-princeton-geo-study-explained-for-marketers/)).
- **Agent detect.** `sensor-ai-citations.mjs` runs each monitored question through the live engines; a **cited=false where the page ranks** is the "ranks but isn't extracted" signal → enqueues `restructure-for-citation`.
- **Agent generate.** `.claude/skills/restructure-for-citation/SKILL.md` — prepend a 2–4 sentence self-contained answer block under H1, additive, emits one `change_set` row. `blog-write` produces new answer-first drafts.
- **Agent validate.** Eval-gate: `eval-judge.mjs` (info-gain/quality), `check-content-guards.mjs`, and **new** `check-citation-density.mjs` (this PR) enforcing a lead statistic. Human approves the `change_set` before `wp:apply`.
- **Risk.** Low (additive, never a rewrite).
- **Automation.** ✅ Safe to automate to PR; human merge. Already the repo's strongest path.

### 2. Entity authority & brand disambiguation — `partial` + `gap`

- **What.** Make the brand a *recognized entity*, not a text string: consistent NAP, an Organization entity with `sameAs` links, credentialed named authors, and (the gap) a **Wikidata QID** + cross-source consistency.
- **Why for AI search.** LLMs weight entities by the **density and authority of their citation network**; disambiguation errors (confusing a similarly-named entity) suppress or misattribute citations. Brand accuracy depends on it.
- **Evidence.** 🔵 Domains with DR>50 appear in AI answers ~5× more than DR<30 ([Pixelmojo](https://www.pixelmojo.io/blogs/geo-playbook-get-cited-chatgpt-perplexity-claude)). 🔵 "Trust is established when the same entity appears consistently across multiple authoritative sources" — Wikidata QIDs act as machine-readable anchors ([SEO Solutions Texas](https://seosolutionstexas.com/wikidata-qids-for-entity-seo/), [Digital Applied](https://www.digitalapplied.com/blog/entity-seo-knowledge-graph-optimization-guide-2026)). ⚪ Wikidata→citation is correlation, not proven cause.
- **Agent detect.** `check-entity-density.mjs` flags thin pages (<4 named entities/1k words). **Gap:** no check that NAP/`sameAs`/author identity is *consistent across sources* or that a Wikidata QID exists.
- **Agent generate.** `.claude/skills/entity-authority/SKILL.md` upgrades per-page tags to an entity graph (Organization + `sameAs`, Person authors, Service/Place). Root `CLAUDE.md` holds the canonical `sameAs` set.
- **Agent validate.** `validate-json.mjs` (JSON-LD), `check-entity-density.mjs`. **Gap:** a NAP/`sameAs` byte-for-byte consistency validator against GBP.
- **Risk.** Medium — NAP/GBP edits are `gated` (root `CLAUDE.md`: "Schema NAP must match visible page text and GBP byte-for-byte").
- **Automation.** ⚠️ On-page schema/author = safe-to-PR. Wikidata/GBP edits = human. Build a read-only consistency **detector**; keep the write human.

### 3. Schema & structured data — `exists` (reframe)

- **What.** Valid, server-rendered JSON-LD: Organization (homepage), LocalBusiness subtype (location pages), Article, FAQPage, Person.
- **Why for AI search.** Enables **rich results and entity recognition** and helps the machine parse identity — **not** a direct citation lever.
- **Evidence.** 🟢 Google: "no special structured data is required for AI features"; overrelying on schema as the citation lever "doesn't work." 🟡 Vendor claims that schema'd pages hit citation chips "at a meaningfully higher rate" ([Citedify](https://www.citedify.com/blog/google-ai-overviews-seo-guide-2026)) — treat as correlation.
- **Agent detect.** Crawl/audit (`seo-audit`) finds missing/invalid schema; `sensor-sitemap` new URLs enqueue an audit.
- **Agent generate.** `.claude/skills/schema-generate/SKILL.md` → `schema/{slug}.jsonld`; packs inject it.
- **Agent validate.** `validate-json.mjs` + `lib/schema-lint.mjs` (syntax, `@context`/`@type`, leaked `OPERATOR_INSERT_*`). Runs on **every** PR in the eval-gate.
- **Risk.** Low (schema generation is `safe`).
- **Automation.** ✅ Automate generation + validation. **Do not** oversell it internally as the citation driver — content evidence markers (area 4) are.

### 4. Source / citation-worthiness — `gap` → **built in this PR**

- **What.** Put the *extractable evidence* on the page: original data / proprietary research, **statistics**, **named-source quotations**, and **outbound citations** to authoritative sources.
- **Why for AI search.** This is the **best-evidenced lever that exists** — the markers answer engines preferentially quote.
- **Evidence.** 🟢 **Princeton/GaTech/AI2/IIT "GEO" paper, KDD '24** (GEO-bench, 10k queries): of 9 tactics, 5 lifted citation rates **+30–41%** — *Statistics Addition (+41%), Cite Sources (+30%, up to +115% for lower-ranked pages), Quotation Addition (+28%), Fluency, Authoritative Voice*; keyword stuffing/padding/simplification did nothing or hurt ([DerivateX plain-English summary](https://derivatex.agency/blog/princeton-geo-paper-plain-english/), [Sunil Pratap Singh](https://sunilpratapsingh.com/guides/geo/what-research-says-about-generative-engine-optimization)). 🔵 Original data / proprietary research / pricing / case studies out-cite "what is" guides ([Discovered Labs](https://discoveredlabs.com/blog/ai-citation-patterns-how-chatgpt-claude-and-perplexity-choose-sources)).
- **Agent detect.** **NEW `scripts/check-citation-density.mjs`** (this PR) — deterministic gate: fails a draft below **≥3 statistics/1k words + ≥1 sourced quote + ≥1 outbound citation**. Pure core `scripts/validators/citation-density.mjs`.
- **Agent generate.** `blog-write` / `restructure-for-citation` now instructed to lead with a statistic and include a sourced quote (SKILL.md updated). Maxx's real project figures (sq ft, key counts, cost ranges in root `CLAUDE.md`) are the proprietary-data source.
- **Agent validate.** The new gate runs in the eval-gate (seo-auto content PRs) + is unit-tested (`test/citation-density.test.mjs`).
- **Risk.** Low (deterministic, additive, seo-auto-scoped).
- **Automation.** ✅ Fully automatable as a gate. **This is the #1 build.**

### 5. Internal linking & topical authority — `exists`

- **What.** Treat linking as a whole-site graph: fix orphans, wire cluster posts up to pillar pages with descriptive anchors, one page per intent cluster.
- **Why for AI search.** Answer engines evaluate at the **brand/cluster level** and fan a query into 5–10 sub-queries; a cluster of interlinked pages surfaces across sub-queries where one article won't.
- **Evidence.** 🔵 86% of AI citations come from sites with **≥5 interconnected pages** on the topic; bidirectional cluster↔pillar linking ≈ **2.7× citation probability** (Yext AI Citation Study, via [Passionfruit](https://www.getpassionfruit.com/blog/topical-authority-clusters-for-ai-search-citations), [Engage Coders](https://www.engagecoders.com/content-cluster-strategy-ai-visibility-2026/)). 🔵 Query fan-out = 5–10 sub-queries per prompt.
- **Agent detect.** `scripts/link-graph.mjs` builds the inbound/outbound graph, flags orphans (inbound=0) and pillars (inbound≥8), enqueues `internal-link-graph`.
- **Agent generate.** `.claude/skills/internal-link-graph/SKILL.md` (whole-graph) + `internal-linking` (page-level insertion); cluster map lives in root `CLAUDE.md`.
- **Agent validate.** `check-diff-size.mjs`, `eval-judge.mjs`; re-run `link-graph.mjs` to confirm orphan cleared.
- **Risk.** Low-medium (anchor over-optimization; watch cannibalization — root `CLAUDE.md` names the restaurant-cluster risk).
- **Automation.** ✅ Safe to PR; human merge. Cannibalization merges/redirects are `gated`.

### 6. Technical SEO & crawlability — `exists`

- **What.** Crawlable server-rendered HTML, clean indexation, ≤1 redirect hop, no soft-404s, fast delivery, sitemap hygiene, CWV at template level.
- **Why for AI search.** If bots can't fetch/parse it, it can't be cited. Perplexity does **real-time retrieval** — fresh, crawlable pages can appear in citations within hours.
- **Evidence.** 🟢 Google: crawlable HTML + clear structure is the baseline for AI-Overview visibility. 🔵 Perplexity real-time indexing → new content cited within hours ([Leapd](https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026)).
- **Agent detect.** `sensor-sitemap.mjs` (new URLs), `sensor-indexation.mjs` (GSC URL Inspection, not-indexed), `cwv-audit` / `check-vitals.sh` (CWV regressions on deploy via `vitals-pr.yml`).
- **Agent generate.** `seo-audit` (read-only report), `cwv-audit` (template-level LCP/INP/CLS fixes, order TTFB→LCP→INP→CLS per root `CLAUDE.md`).
- **Agent validate.** `check-vitals.sh` (PSI), crawl re-check.
- **Risk.** Low for template CWV fixes; **high** for redirects (301s are hard-denied by `guard-publish.sh`, always `gated`).
- **Automation.** ✅ Detection + template CWV = automatable to PR. Redirects/deletes = human only.

### 7. Freshness monitoring — `partial` → **top runner-up build**

- **What.** Track content recency and **citation decay** as first-class signals; refresh before the citation is lost, not after.
- **Why for AI search.** Answer engines strongly prefer fresh sources; a page can lose its AI citation weeks before it shows in analytics.
- **Evidence.** 🔵 AI-cited content ~25.7% fresher on average; content <30 days old earns ~**3.2× more** AI citations; after 90 days citation frequency drops ~**15–25%/month** until refreshed ([SalesPeak](https://salespeak.ai/aeo-news/content-freshness-ai-search), [Over The Top SEO](https://www.overthetopseo.com/content-freshness-for-ai-how-often-to-update-to-stay-cited/)). ⚪ Exact per-content-type decay coefficients are unverified.
- **Agent detect.** `sensor-gsc.mjs` senses **click decay** (≥25% drop). `diff-citation-events.mjs` catches AIO cited↔uncited **transitions**. **Gap:** no separate **citation-decay curve** — the repo deliberately makes AIO *position drift while still cited* invisible, and a slide toward loss isn't an early warning yet.
- **Agent generate.** `blog-write` refresh path; `restructure-for-citation`.
- **Agent validate.** `attribute-citations.mjs` measures whether the refresh moved the citation rate; eval-gate on the draft.
- **Risk.** Low-medium (refresh under size + uniqueness thresholds is `safe`; large rewrites `gated`).
- **Automation.** ⚠️ Detection automatable; **build a citation-freshness sensor** that flags pages past a decay half-life *before* loss (see workflow #2).

### 8. Competitive AI citation tracking — `exists` + `gap`

- **What.** Track which competitors get cited for your monitored questions, and your **share of voice** across engines.
- **Why for AI search.** In answer engines you often get *only* the citation as an impression (most AI sessions end without a click); knowing who displaced you is the actionable unit.
- **Evidence.** 🔵 Up to **615×** brand-citation variance across platforms for the same brand; only ~11% domain overlap ChatGPT↔Perplexity ([AuthorityTech](https://authoritytech.io/curated/ai-citation-11-percent-platform-overlap-per-engine-audit-2026), [Ask Lantern](https://www.asklantern.com/blogs/10-most-cited-domains-across-chatgpt-perplexity-gemini-and-claudee-here-s-the-pattern)). 🟡 Enterprise trackers (Profound, Otterly) sell cross-platform share-of-voice ([Digital Applied tools roundup](https://www.digitalapplied.com/blog/ai-visibility-tools-2026-track-brand-chatgpt-perplexity-gemini)).
- **Agent detect.** `scoreResult()` records competitors cited per query; `classify-competitors.mjs` auto-labels new cited domains (`competitor_domains`); `diffAioSnapshots()` flags `displaced`/`competitor_won`; the analyst (`analyze-citation-events.mjs`) enqueues a fix on **competitor displacement** at med+ confidence. **Gap:** no rolled-up **share-of-voice metric** over time.
- **Agent generate.** Feeds `restructure-for-citation` / `ai-info-page` on the displaced query.
- **Agent validate.** Re-sample next cycle; `citation_events` idempotency.
- **Risk.** Low (read/measure).
- **Automation.** ✅ Detection is fully automated. **Gap build:** a per-engine share-of-voice rollup (workflow #4).

### 9. Programmatic content quality gates — `exists`

- **What.** Deterministic + LLM gates that stop scaled thin content: eligibility, uniqueness ≥0.5, unique intro/recommendation, min content, ≥3 internal links, entity density, **citation density (new)**, diff size, doorway guardrail.
- **Why for AI search.** Scaled low-value pages are a Google spam-policy risk (**Scaled Content Abuse**) that can sink the whole domain's authority — the opposite of citation-worthiness.
- **Evidence.** 🟢 Google spam policies (scaled content abuse, site reputation abuse). 🟢 Princeton: padding/stuffing hurt. Repo `AGENTIC-ROADMAP.md` names Scaled Content Abuse as a top risk.
- **Agent detect.** `programmatic-plan` eligibility gates; doorway guardrail (warn at 30 pages, hard-stop at 50 — root `CLAUDE.md`).
- **Agent generate.** `programmatic-plan` / `local-page-plan` as **portable artifacts**; human reviews the manifest before apply.
- **Agent validate.** Eval-gate stack: `check-diff-size.mjs`, `check-content-guards.mjs`, `check-entity-density.mjs`, `check-citation-density.mjs`, `eval-judge.mjs` (fails closed on fabrication/low info-gain).
- **Risk.** Medium (batch pages are `gated` above threshold).
- **Automation.** ✅ Gates automate; **generation never auto-publishes** — generate → human manifest review → apply (root `CLAUDE.md`).

### 10. Feedback loops from AI visibility data — `exists` + `gap`

- **What.** Close the loop: actions → outcomes (citations/GSC/conversions) → attribution → reprioritized backlog. Learn which change types actually move citations.
- **Why for AI search.** Without attribution you can't tell a self-inflicted regression from an algo update from a competitor — and you re-spend on tactics that don't work.
- **Evidence.** 🔵 Repo's own design (`AGENTIC-ROADMAP.md`): AI-referred conversion 14.2% vs 2.8% organic — citations are high-value, so measuring them pays. 🟢 Attribution-before-action is standard causal hygiene.
- **Agent detect.** The full GEO loop: `sensor-ai-citations` → `diff-citation-events` → `analyze-citation-events` (Sonnet analyst, grounded, confidence-gated) → `attribute-citations` → `prioritize`. `learned_patterns_geo` stores per-change-type citation deltas.
- **Agent generate.** Analyst enqueues fixes (competitor displacement) or escalates (self-inflicted); `prioritize.mjs` re-scores the queue blending GSC + GEO signal.
- **Agent validate.** `groundVerdict()` anti-hallucination gate; `ANALYST_BATCH_LIMIT`; algo-calendar confounder input.
- **Risk.** Medium (attribution is directional, not causal — confounded by core updates/seasonality).
- **Automation.** ✅ Loop runs weekly (`ai-search-sensors.yml`, `seo-learn.yml`). **Documented gaps:** `brand_mentioned`-but-uncited is captured but unused; `ai_referrals` conversion value isn't weighted into priority; cold-start dead zones; single SerpApi dependency for the whole AIO surface.

---

## Ranked leverage table

Ranked by **(evidence strength × impact × automatability ÷ risk)**. Status = repo state.

| # | Tactic | Evidence | Impact | Risk | Auto-safe? | Repo status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Statistics + quotations + outbound citations on the page | 🟢 Primary (KDD '24) | High | Low | ✅ Yes | **built this PR** |
| 2 | Answer-first structure (answer in first 30%) | 🔵/🟢 | High | Low | ✅ Yes | exists |
| 3 | Topical clusters wired to pillars | 🔵 | High | Low-med | ✅ Yes | exists |
| 4 | Citation-decay freshness monitoring | 🔵 | High | Low-med | ⚠️ Detect only | **partial → build** |
| 5 | Entity consistency + Wikidata QID | 🔵/⚪ | Med-high | Med | ⚠️ Detect auto, write human | partial → build detector |
| 6 | Competitive share-of-voice tracking | 🔵/🟡 | Med-high | Low | ✅ Detect | exists → add metric |
| 7 | Crawlability + fast indexing (real-time engines) | 🟢/🔵 | Med-high | Low (high for 301s) | ✅ Detect + CWV | exists |
| 8 | Feedback-loop attribution → reprioritize | 🔵 | Med-high | Med | ✅ Yes | exists → close gaps |
| 9 | Programmatic quality gates (anti-scaled-abuse) | 🟢 | Med (protective) | Med | ✅ Gates | exists |
| 10 | Weight fixes by AI-referred conversion value | 🔵/⚪ | Med | Med | ⚠️ | gap |
| 11 | Valid schema (Organization/FAQ/Article) | 🟢 (enabler, not lever) | Low-med | Low | ✅ Yes | exists (reframe) |
| — | llms.txt / chunking / AI-rewrite as citation hacks | 🔴 Debunked | ~0 | — | — | correctly avoided |

---

## Top 10 agentic workflows to build (or complete)

Ordered by leverage. #1 ships in this PR; the rest are the roadmap.

1. **Citation-worthiness gate** ✅ *(this PR)* — deterministic `check-citation-density.mjs` enforcing statistics/quotes/outbound-citations on generated content, wired into the eval-gate. Operationalizes the strongest primary-source lever.
2. **Citation-decay freshness sensor** — a new sensor that computes a per-page/per-query citation-freshness score from `ai_citations` history and enqueues a `blog-write` refresh **before** the citation is lost (extends `diff-citation-events` beyond binary cited↔uncited to a decay curve). Fills the deliberately-blind position-drift gap.
3. **Answer-first citation-recovery loop** *(exists, keep tuning)* — miss on a live engine → `restructure-for-citation`; the highest-ROI existing path. Add a lead-statistic requirement (done in SKILL.md this PR).
4. **AI share-of-voice metric** — roll `competitor_domains` + `ai_citations.competitors` into a per-engine SoV trend so displacement is visible as a number, not just per-event.
5. **Entity-consistency detector** — read-only validator comparing on-page NAP/`sameAs`/author identity against GBP + checking for a Wikidata QID; opens a **gated** escalation (never auto-writes NAP).
6. **Value-weighted prioritization** — feed `ai_referrals` conversion value into `prioritize.mjs` so the loop optimizes citation *value*, not just citation *presence* (closes the documented gap where `ai_referrals` isn't weighted).
7. **Brand-mentioned-but-uncited handler** — act on the already-captured `brand_mentioned && !cited` state (a near-miss) with a lighter-weight fix than a full restructure.
8. **Multi-engine divergence router** — given ~11% ChatGPT↔Perplexity overlap and 615× variance, route fixes per engine (e.g., real-time-index-friendly freshness for Perplexity vs. entity/authority for ChatGPT).
9. **Topical-cluster completeness planner** — detect clusters with <5 interconnected pages (the 86%-citation threshold) and plan the missing supporting posts via `blog-ideas` + `internal-link-graph`.
10. **AIO-capture resilience** — remove the single-SerpApi dependency for the AIO surface (fallback capture path) so the decay→analyst→escalation chain can't go silently dark.

---

## Top 5 metrics to track

1. **Citation-inclusion rate per engine** — % of monitored questions where the target domain is in the cited sources, tracked separately for Claude / Perplexity / OpenAI / Google AIO (they diverge up to 615×). Source: `ai_citations.cited`.
2. **AI share of voice vs. competitors** — your citations ÷ (yours + competitors') per engine, over time. Source: `ai_citations.competitors` + `competitor_domains`.
3. **Answer-first coverage** — % of monitored commercial questions whose target page carries a self-contained answer in the first 30% + the KDD '24 evidence markers. Source: `check-citation-density.mjs` + `restructure-for-citation` completion.
4. **Citation freshness / decay half-life** — median age of currently-cited pages and the time from last-refresh to citation loss. Source: `ai_citations` history (new sensor).
5. **AI-referred conversion value** — sessions and conversions attributed to AI referrers, proving the *value* (not just presence) of a citation. Source: `ai_referrals` (GA4). 🔵 14.2% vs 2.8% organic conversion baseline.

---

## Top 5 things to avoid

1. **Investing in llms.txt / content chunking / AI-specific rewriting as citation levers** 🔴 — Google-debunked; zero citation value. (Keep llms.txt only as an agent-navigation hedge, noindexed.)
2. **Treating schema as the citation cause** 🔴 — it enables rich results/entity recognition; content evidence markers drive citations. Don't let schema work crowd out statistics/quotes.
3. **Scaled thin/programmatic content** 🔴 — Scaled Content Abuse can sink domain authority. Never let one run both generate and publish; enforce the gates + doorway guardrail (warn 30 / hard-stop 50).
4. **Over-trusting sampling-based AI trackers** 🟡 — answer engines are non-deterministic; treat any single-sample citation reading as an estimate. The repo's `AIO_SAMPLES` majority-vote (ADR-007) exists for exactly this — don't act on one raw miss (act on *transitions*).
5. **Auto-writing gated changes** — NAP/GBP, 301s, brand/pricing/YMYL, merges/deletes with backlinks, batch pages above threshold. These stay human-reviewed regardless of what a sensor says; the analyst *escalates*, it doesn't apply.

---

## 30 / 60 / 90-day roadmap

Mapped to the repo's autonomy ladder (L1 assisted → L4 partial-autonomy) and existing CI cadence (nightly `seo-sensors`, weekly `ai-search-sensors`, weekly `seo-learn`).

**Days 0–30 — evidence density + measurement (stay L1→L2).**
- ✅ Ship the citation-worthiness gate (this PR) and let it run on the next content PRs.
- Backfill existing money pages via `restructure-for-citation` to lead with a statistic + sourced quote (highest ROI, low risk).
- Stand up the **AI share-of-voice metric** (workflow #4) from data already in `ai_citations`.
- Confirm AIO capture is healthy (SerpApi key present) — the whole decay→analyst chain depends on it.

**Days 31–60 — freshness + entity (L2).**
- Build the **citation-decay freshness sensor** (workflow #2) and wire refresh enqueues into `ai-search-sensors.yml`.
- Build the read-only **entity-consistency detector** (workflow #5); route findings to gated escalation.
- Complete under-built **topical clusters** (<5 pages) via `blog-ideas` + `internal-link-graph`.
- Start weighting `ai_referrals` value into `prioritize.mjs` (workflow #6).

**Days 61–90 — value optimization + resilience (L2→L3 on safe classes).**
- Ship the **brand-mentioned-but-uncited** near-miss handler (#7) and the **multi-engine divergence router** (#8).
- Add **AIO-capture resilience** (#9) so the decay pipeline can't go dark.
- Review `learned_patterns_geo`: has any change type shown a real, confounder-adjusted citation lift? Feed that into auto-merge confidence for safe classes only.
- Re-run this research; refresh the evidence tiers (the space moves monthly).

---

## Sources (tiered)

**🟢 Confirmed — primary / platform / peer-reviewed**
- Google AI-features guide analysis (mythbusting; 2026-06-15 llms.txt clarification): https://www.searchenginejournal.com/what-googles-new-ai-guide-actually-debunks-and-what-it-doesnt/575497/
- "Wrong for Search ≠ wrong for agents": https://nohacks.co/blog/ignore-for-google-search-is-not-ignore-for-ai-agents
- Princeton/GaTech/AI2/IIT — *GEO: Generative Engine Optimization* (KDD '24), summaries: https://derivatex.agency/blog/princeton-geo-paper-plain-english/ · https://sunilpratapsingh.com/guides/geo/what-research-says-about-generative-engine-optimization · https://seenrank.com/blog/the-princeton-geo-study-explained-for-marketers/

**🔵 Source-backed — industry studies (attributed)**
- Citation placement (first 30% ≈ 44%) & cross-platform patterns: https://discoveredlabs.com/blog/ai-citation-patterns-how-chatgpt-claude-and-perplexity-choose-sources · https://www.tryprofound.com/blog/ai-platform-citation-patterns
- Platform divergence (11% overlap, 615× variance, cite rates): https://authoritytech.io/curated/ai-citation-11-percent-platform-overlap-per-engine-audit-2026 · https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026 · https://www.asklantern.com/blogs/10-most-cited-domains-across-chatgpt-perplexity-gemini-and-claudee-here-s-the-pattern
- Topical clusters (86% / 2.7×) & passage-level retrieval: https://www.getpassionfruit.com/blog/topical-authority-clusters-for-ai-search-citations · https://www.engagecoders.com/content-cluster-strategy-ai-visibility-2026/
- Freshness/decay (25.7% fresher, 3.2×, 15–25%/mo): https://salespeak.ai/aeo-news/content-freshness-ai-search · https://www.overthetopseo.com/content-freshness-for-ai-how-often-to-update-to-stay-cited/
- Entity/Wikidata & DR>50: https://seosolutionstexas.com/wikidata-qids-for-entity-seo/ · https://www.digitalapplied.com/blog/entity-seo-knowledge-graph-optimization-guide-2026 · https://www.pixelmojo.io/blogs/geo-playbook-get-cited-chatgpt-perplexity-claude

**🟡 Vendor — directional only**
- AI-visibility tool roundups & claims (Profound, Otterly, agency figures): https://www.digitalapplied.com/blog/ai-visibility-tools-2026-track-brand-chatgpt-perplexity-gemini · https://otterly.ai/ · https://www.citedify.com/blog/google-ai-overviews-seo-guide-2026 · AI-Overview ranking-factor lists: https://wellows.com/blog/google-ai-overviews-ranking-factors/

**Repo internal references:** root `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTIC-ROADMAP.md`, `AUTORESEARCH-ROADMAP.md`, `sql/ai-search-schema.sql`, `scripts/sensor-ai-citations.mjs`, `scripts/diff-citation-events.mjs`, `scripts/analyze-citation-events.mjs`, `scripts/attribute-citations.mjs`, `scripts/check-entity-density.mjs`, `scripts/check-citation-density.mjs` (new), `.claude/skills/{restructure-for-citation,ai-info-page,entity-authority,internal-link-graph,blog-write}/SKILL.md`.

---

*A shareable, theme-aware web version of this report is published as a Claude Artifact: https://claude.ai/code/artifact/6eacb568-68a9-4c02-8823-cb16b2583c3e (private by default; share from the page's menu).*
