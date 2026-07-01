# ADR-007 — AI Overview citation intelligence (capture → diff → analyst)

**Date:** 2026-07-01
**Status:** Proposed
**Deciders:** Harris / BuildSmarter

---

## Context

The closed loop is the thing that makes this system "agentic" rather than a pile of SEO
scripts, and it is only half-wired. But the sharper finding that drove this ADR: **Google
AI Overview — the citation surface the operator cares most about — is not captured at
all.** `lib/engines.mjs` exports `ALL_ENGINES = [askClaude, askPerplexity, askOpenAI]`;
the `google_aio` value the `ai_citations` schema allows is never written. The system
optimizes against Claude/Perplexity/ChatGPT proxies while blind to Google's actual AIO.

Two constraints shape the design:

1. **No statistical power.** The target site is ~30 URLs (`config/urls.txt`), attribution
   runs at a 28-day lag with `MIN_N=3`, and GSC noise on a low-traffic construction site
   is easily ±30% week-to-week. A multi-armed bandit or holdout-control design cannot
   reach significance in any realistic timeframe. The intelligence must come from
   **reasoning about confounders**, not from averaging samples that don't exist.
2. **AIO is volatile.** Google shows/hides the AI Overview for an identical query
   run-to-run, and the cited sources flicker non-deterministically. Naive week-over-week
   diffing will record phantom losses.

## Decision

Build a three-stage capability, wired into the existing weekly `ai-search-sensors.yml`
job (no new cron, no agent SDK):

**1. Capture — `askGoogleAIO` adapter (SerpApi).**
SerpApi is chosen over DataForSEO because `scripts/sensor-paa.mjs` already calls
`serpapi.com/search.json?engine=google`, the `ai_overview` field rides on that same
response payload, and `SERPAPI_KEY` is already provisioned in CI. The adapter handles the
`page_token` async second-fetch case. To defeat rendering flicker it takes a **3-sample
majority per run** (8 queries × 3 = 24 calls/week, negligible), writing `engine='google_aio'`
rows to `ai_citations` with `sources` and `competitors`.

**2. Diff with memory — `citation_events` table.**
A diff step compares the latest vs previous `google_aio` snapshot per query and writes a
row **on transition only**: `event ∈ {gained, lost, displaced}`, `competitor_won`,
`prev_captured_at`, `captured_at`. A lost AIO citation is the highest-severity SEO event
on a small site; it becomes a first-class, queryable object instead of an implicit diff.

**3. Analyst — `scripts/analyze-citation-events.mjs` (Sonnet), gates the enqueue.**
Raw events do NOT auto-enqueue fixes. Each event routes through an analyst that attributes
cause and writes the verdict **onto the event row**: `attributed_cause ∈ {self_inflicted,
competitor_displacement, algo_update, seasonal, unexplained}`, `confidence`, `rationale`,
`analyzed_at`. Enqueue is conditional on the verdict:

- `self_inflicted` (a `decision_log` row hit that `target_url` inside the window) →
  re-examine that specific change.
- `competitor_displacement` → targeted `restructure-for-citation` / `ai-info-page` against
  the content that won.
- `algo_update` / `seasonal` / `unexplained` / low-confidence → **log only, no enqueue.**

The analyst is Sonnet (overridable via `CITATION_ANALYST_MODEL`), calling the Anthropic
Messages API directly — the pattern already used in `lib/engines.mjs` and
`scripts/eval-judge.mjs`.

**`self_inflicted` candidate window.** The diff detects a `lost` event at `captured_at`
with the last-cited snapshot at `prev_captured_at`. Because an AIO citation loss lags the
change that caused it (recrawl → reindex → Overview regeneration), a deterministic step
surfaces **all** `decision_log` rows on that `target_url` with
`created_at ∈ [prev_captured_at − 14d, captured_at]` as *self-inflicted candidates* (with
exact dates). The analyst adjudicates causation within that window — weighing propagation
lag (a change <2–3 days before the loss is implausibly recent), the algo calendar, and
`competitor_won`. The window *surfaces candidates*; it never *labels* the cause. A fixed
window labeling things self-inflicted would be the dumb-attribution failure this design
replaces.

**Confidence gates are asymmetric — bias toward acting, bias against learning.** The
analyst emits `confidence ∈ {low, med, high}`. Enqueuing is cheap and human-gated
downstream (queue → seo-fixer → PR → eval-gate → human merge); feeding
`learned_patterns_geo` is persistent and compounding with nothing downstream to catch it.
Therefore:

- **Enqueue floor = `med`.** `low` → not discarded: logged and re-queued for re-analysis
  next cycle (the weekly re-capture lengthens the trajectory and often resolves it).
- **Aggregation floor = `high` AND `≥ MIN_N`.** Only high-confidence `self_inflicted`
  verdicts, still subject to the existing `MIN_N` gate, teach `learned_patterns_geo`. A
  `med` self_inflicted verdict acts but does not move the learned aggregate.

**Learning + prioritization.**
Only **high-confidence `self_inflicted`** verdicts aggregate into `learned_patterns_geo`
(the only cause with a real `change_type`). This ADR also closes the standing GEO-blend
gap: `prioritize.mjs` is wired to read `learned_patterns_geo` as a simple weighted additive
term — `priority = base + round(gsc_effect × W) + round(geo_effect × GEO_WEIGHT)`, clamped
0–10 — rather than a statistical scale reconciliation.

**Algo-update calendar.**
The analyst's one external input not already in the DB. Source is an in-repo,
manually-maintained `config/algo-updates.json`; the analyst is *handed* the in-window
entries as structured context and never recalls dates from memory. Optional `web_search`
augmentation for entries newer than the file is advisory only.

## Rationale

- **Reasoning over statistics** is the only design that works at 30 URLs. The analyst
  never fabricates an effect size — the diff produces the measured transition; the analyst
  only adjudicates *cause and confidence*. That split neuters the hallucination risk.
- **Analyst-gated enqueue** makes the system react to causes, not symptoms. Auto-enqueuing
  raw events would make the analyst decorative and thrash the site on AIO flicker.
- **SerpApi** adds zero new vendor/secret — it's a second field read on an existing call.
- **Verdict-on-event + self-inflicted-only aggregation** keeps `learned_patterns_geo`
  causal: only the agent's own changes can teach it what works.

## Alternatives rejected

- **Multi-armed bandit over change strategies / holdout controls** — the correct tool for
  a high-volume site, statistical theater at 30 URLs. Deferred to a high-volume future.
- **DataForSEO for AIO capture** — new vendor, new secret, new client for no benefit at 8
  queries/week.
- **2-consecutive-weeks debounce** — reliable but adds up to a week of latency to the
  highest-severity event. Rejected in favor of 3-sample-majority-per-run.
- **LLM recalls algo-update dates itself** — training-cutoff staleness and hallucinated
  dates are the exact failure the analyst exists to prevent.
- **Compute-on-read instead of a `citation_events` table** — avoids a migration but leaves
  regressions as implicit diffs, not alertable objects.

## Consequences

- One idempotent migration: `citation_events` table + verdict columns. Apply via the
  Supabase Management API (standing operator rule), not the SQL editor.
- The weekly job gains four steps in order: capture (3-sample) → diff → analyze →
  conditional enqueue, ahead of the existing `attribute-citations` → `prioritize`.
- `config/algo-updates.json` requires occasional manual upkeep (a few entries/year). A
  stale file fails safe (leans unexplained/self-inflicted → confidence-gated); a
  hallucinated date would fail loud — hence the file over recall.
- `learned_patterns_geo` finally influences prioritization; a bad `GEO_WEIGHT` could skew
  the queue, so it ships behind an env knob defaulting conservative.

## Open (implementation-level, not yet decided)

- SerpApi AIO field-parsing specifics + `page_token` handling.
- `citation_events` column types and the migration itself.
- Test plan — mirror `test/learning.test.mjs`: inject the API call, unit-test the verdict
  and diff cores with fakes.

## Files affected (planned)

- `lib/engines.mjs` — add `askGoogleAIO`; extend `ALL_ENGINES` or a dedicated AIO path
- `scripts/sensor-ai-citations.mjs` — 3-sample-majority capture of `google_aio`
- `scripts/diff-citation-events.mjs` (new) — transition detection → `citation_events`
- `scripts/analyze-citation-events.mjs` (new) — Sonnet analyst, verdict-on-event
- `scripts/prioritize.mjs` + `orchestrator/lib/learning.mjs` — GEO blend term
- `config/algo-updates.json` (new)
- `sql/ai-search-schema.sql` — `citation_events` table + verdict columns
- `.github/workflows/ai-search-sensors.yml` — new pipeline steps
