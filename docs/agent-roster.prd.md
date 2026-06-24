# Agent Roster — Completing the Autonomous SEO/Marketing Department

> PRD · 2026-06-24 · companion to `AGENTIC-ROADMAP.md`, `CONTEXT.md`, and `docs/adr/0001–0003`
> Status: DRAFT — needs validation. Generated via a grilling + domain-modeling session.

## Problem Statement

The orchestrator today is a complete **on-site organic SEO/GEO** loop (sense → plan → act → verify → learn) but it covers only part of a marketing department. Traffic earned by the loop is never optimized into revenue, the system has no off-site authority motion, no reputation management, no competitor-driven reprioritization, and no automated supervision digest — so the human-on-the-loop still assembles the Monday review by hand. The cost of not closing these gaps is that the loop ranks pages it never converts, and a single operator's attention stays the bottleneck the autonomy ladder was meant to remove.

## Evidence

- `AGENTIC-ROADMAP.md` names the real signal as revenue, not ranking: AI-referred visitors convert **14.2% vs 2.8%** — yet no agent acts on conversion.
- `OPERATIONS.md §1` is a **manual** 10-minute Monday routine across GitHub + Supabase — exactly the supervision an observer agent should pre-digest.
- The entire skill set (`seo-audit`, `metadata-generate`, `schema-generate`, `internal-linking`, `blog-write`, `restructure-for-citation`, …) writes to the customer's **own** CMS. There is zero off-site authority motion, and off-site signals are ~half of ranking.
- `CONTEXT.md` already pre-modeled two of these gaps (`link_prospects`, `gbp_platform`) in the prior domain-modeling session — the need was identified but the agents weren't specced.

## Proposed Solution

Add five roster members that **reuse the existing rails** — `work_queue → orchestrator → seo-fixer subagent → eval_gate → approval → publish` — with no second queue, no second orchestrator, and no standalone actor. Each new member is at most three artifacts: a **sensor** (what enqueues), a **kit skill** (what drafts), and sometimes a **pack** (how it publishes). Two members ride only part of the loop by design: the **CMO Reporter** is a read-only *observer* (no `work_queue`, nothing to gate), and the **Link Prospector** rides the front half while its back half (outreach) collapses to a human. Two further candidates (LinkedIn syndication, newsletter) are **deferred** because they fork the sensor + outcome/attribution layers — the one thing "no parallel systems" forbids.

## Key Hypothesis

We believe a **conversion optimizer + off-site authority + competitor-driven reprioritization + an automated supervision digest**, all riding the existing loop, will convert the department from "ranks pages" to "earns and compounds revenue" for a single owner-operator GC — and we'll know we're right when **conversion rate on optimized pages rises** and the **operator's weekly supervision time drops** without an increase in escalations that slip past review.

## What We're NOT Building

- **F — LinkedIn syndication (`repurpose-social`)** — deferred ([BUI-62](https://linear.app/buildsmarterholdings/issue/BUI-62)). It forks the learning layer: outcomes are keyed on **`url`**, a post's outcome is keyed on **post ID**. Unblocks only after the outcome key is generalized `url → asset` (ADR-worthy) — until then it can only ship as a non-learning fire-and-forget distributor.
- **G — Newsletter (`newsletter-draft`)** — deferred, same class of problem (separate channel + separate outcome universe).
- **Paid SERP-rank competitor tracking** — deferred until budget justifies; v1 competitor watch uses the AI-citation data already collected.
- **Paid backlink APIs (Ahrefs/Majestic)** for the Link Prospector — v1 reuses `ai_citations` + the free GSC Links report.

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| Conversion rate on `cro-audit`-optimized pages | +X% vs baseline (set after first GA4 read) | GA4 `conversions` outcome, trailing 28-day window |
| Operator weekly supervision time | < 10 min (from current manual routine) | Self-reported; digest replaces `OPERATIONS.md §1` |
| Link prospects actioned → links won | ≥ N won / quarter | `link_prospects.status = won` |
| Competitor-triggered tasks that pass eval | ≥ 70% pass rate | `work_queue.source = competitor` rows that auto-merge |
| Roster cost | Haiku + Sonnet only, **no Opus** | `control.spend_usd` per run vs `MONTHLY_BUDGET_USD` |

## Open Questions

- [ ] `cro-audit` task name: the `-audit` suffix conventionally means **read-only** (per `CLAUDE.md`). The detection step (GA4 finds low-converting pages) is the audit; the drafting step is a generator. Confirm name — `cro-audit` (detection) + `cro-optimize` (generation), or one `cro-audit` task that both detects and drafts?
- [ ] Conversion source of truth for a GC: GA4 page-conversions (chosen) vs submitted-RFP/contact-form events. GA4 is the v1 feed; revisit if form-events prove more accurate.
- [ ] GBP API access approval timeline (multi-week allowlist) — start the request now so D isn't blocked on it.
- [ ] Does the Link Prospector's outcome (referring-domain growth) deserve a dedicated `outcomes` metric, or is citation-share a sufficient proxy in v1?

---

## Users & Context

**Primary User**
- **Who**: Harris (owner-operator), running the loop for Maxx Builders today; Buzz Digital's multi-vertical clients next (per ADR-0001/0003).
- **Current behavior**: Manually assembles the Monday supervision review; has no off-site, conversion, or reputation motion at all.
- **Trigger**: A weekly cadence (supervision), a deploy or GSC/citation delta (action), a new review (reputation).
- **Success state**: The department earns *and converts* traffic, surfaces its own exceptions in a digest, and stays inside the budget cap — with the human approving exceptions, not driving steps.

**Job to Be Done**
When my SEO loop has earned traffic and is running unattended, I want it to convert that traffic, build off-site authority, and hand me a one-glance supervision digest, so I can supervise a marketing department instead of operating one.

**Non-Users**
Not for multi-operator marketing teams, not for paid-media/SEM, not for sites in regulated YMYL verticals (treated as fully gated). Not the bsm-ai multi-tenant product yet — this is Phase A (repo-per-client), designed to migrate per ADR-0001.

---

## Solution Detail

### The roster (your requested spec)

| Agent | Gap it fills | New `work_queue` task(s) | New Supabase tables / schema | Model tier + justification | Blast radius | Priority |
|---|---|---|---|---|---|---|
| **A — CMO Reporter** (`weekly-digest`) | No automated supervision; the Monday runbook is manual | **none** — read-only *observer*, does not enqueue | **none** (reads `decision_log`/`outcomes`/`learned_patterns`/`work_queue`/`control`) | **Haiku** — pure summarization over structured rows; no synthesis | **~zero** — read-only; only external action is an outbound email | **P0** |
| **B — Conversion Optimizer** (`cro-audit`) | Loop ranks pages but never converts them | `cro-audit` | **none** — reuses `work_queue`/`change_set`/`outcomes`; adds a **GA4 sensor** (new `GA4_PROPERTY_ID`; reuses repo's `googleapis`/`google-auth-library`) that also auto-populates the `conversions` outcome | **Sonnet** — persuasion copy + layout reasoning is past Haiku's reliable range; not high-stakes enough for Opus | **Medium** — edits live conversion paths; capped by **always-gated** (never safe-class, brushes positioning per ADR-0002) | **P1** |
| **C — Link Prospector** (`link-prospect`) | System is on-site only; no off-site authority / link earning | `link-prospect` | **`link_prospects`** (already in `CONTEXT.md`: `drafted→approved→sent→replied→won\|lost\|skipped`). Inherits ADR-0001 frozen-schema/per-repo replication | **Sonnet** — research synthesis + persuasive pitch; **`vertical_config`-driven** per ADR-0003 | **~zero on-site** — never touches the property; back half (outreach) is 100% human-executed | **P1** |
| **D — GBP Agent** (`review-reply`, first slice) | No reputation / local-trust signal management | `review-reply` (writes `change_set` rows) | **No new table** — `change_set.platform` += `'gbp'` enum + new **`packs/gbp/apply.mjs`** pack (per `gbp_platform` term). Loop B, **permanently gated** (ADR-0002) | **Haiku** for positive/neutral replies; **Sonnet** only for negative/sensitive | **~zero on-site** — Loop B, never publishes without the human `pending→approved` flip; negatives always escalate | **P2** |
| **E — Competitor Watch** (sensor) | No competitor-driven reprioritization (L4 behavior) | **none new** — enqueues **existing** tasks (`restructure-for-citation` / `ai-info-page` when out-cited; `blog-audit` refresh when out-ranked), `source = competitor` | **none** (reads `ai_citations`, writes `work_queue`) | **Deterministic** routing + optional **Haiku** URL-mapping via the intent map | **Low** — only enqueues *safe* tasks (which still run the full gated loop); risk is queue spam, capped by `unique(url,task,status)` + trailing-window threshold + budget cap | **P1** |
| ~~F — LinkedIn syndication~~ | Distribution | ~~`repurpose-social`~~ | forks sensor + outcome layers | — | — | **Deferred** ([BUI-62](https://linear.app/buildsmarterholdings/issue/BUI-62)) |
| ~~G — Newsletter~~ | Lifecycle email | ~~`newsletter-draft`~~ | separate channel + outcome | — | — | **Deferred** |

**Finding worth flagging:** the entire active roster runs on **Haiku + Sonnet — no Opus**. Synthesis here is bounded (summarize rows, draft a reply, draft a pitch, optimize a CTA); none clears the Opus bar. That keeps the loop inside the non-rolling credit pool the roadmap warns about.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|---|---|---|
| Must | A — CMO Reporter | Cheapest build; unblocks the human-on-the-loop supervision L4 requires |
| Must | B — Conversion Optimizer | Closes traffic→revenue — the roadmap's own "real signal" |
| Must | C — Link Prospector | The single biggest *pure-SEO* gap (system is on-site only) |
| Must | E — Competitor Watch | Cheap; monetizes the `ai_citations` investment; the L4 closed-loop behavior |
| Should | D — GBP Agent (review-reply) | Real local-SEO signal, but low GC review volume + GBP API access friction → after A/B/C/E |
| Won't (now) | F — LinkedIn, G — Newsletter | Fork the learning layer; need the `url → asset` outcome generalization first |

### MVP Scope

Ship **A** first (it's nearly free and makes everything else observable), then **B** and **C** in parallel (independent: GA4 vs `ai_citations`/GSC-Links sensors), then **E** (rides the GEO sensor already in place), then **D** last (gated on GBP API access, started in parallel).

### User Flow (critical path, per agent)

- **A:** weekly cron → read memory layer → render digest → GitHub Issue + job-summary mirror + email push. No gate.
- **B:** GA4 sensor finds high-traffic/low-conversion URL → `cro-audit` task → `seo-fixer` drafts `change_set` edits → **always human-approved** → pack applies → GA4 `conversions` outcome closes the loop.
- **C:** `ai_citations`/GSC-Links sensor finds an authority gap → `link-prospect` task → drafts a `link_prospects` row (`drafted`) → human approves + sends manually → status walks to `won|lost`.
- **D:** new-review feed → `review-reply` task → drafts `change_set` (`platform=gbp,field=review_reply`, `pending`) → human flips `approved` → `packs/gbp/apply.mjs` posts. Negatives drafted cautiously + escalated.
- **E:** competitor out-cites us (sustained, trailing window) → enqueue an existing GEO/refresh task → normal gated loop.

---

## Technical Approach

**Feasibility**: **HIGH** — every member reuses an existing rail; the only genuinely new infrastructure is two read-only sensors (GA4, competitor-extension of `ai_citations`), one outreach table already in the domain model, one new pack, and one outbound-email integration.

**Architecture Notes**
- **Observer agents are a sanctioned exception** to "every agent traverses the loop." A read-only member that emits a report (not `work_queue`/`change_set` rows) is not a parallel *acting* system — it has nothing to gate. (New `CONTEXT.md` term: `observer_agent`.)
- **Loop A vs Loop B asymmetry matters for B and D.** Repo-based edits hit the automated `eval_gate`; live-CMS and GBP edits (Loop B) do **not** — the human approval flip is the only gate (ADR-0002). D and CMS-side B therefore lean entirely on the human gate + brand-safety review.
- **`vertical_config` (ADR-0003)** binds `cro-audit` and `link-prospect`: their value-prop language and pitch angles are vertical-specific, so they read `VERTICAL`/`SERVICE_TAXONOMY`/`STAT_SOURCES` from `CLAUDE.md`, not hardcoded construction copy.
- **ADR-0001 frozen-schema constraint** applies to the new `link_prospects` table: it must be identical across client repos and gets `client_id` at the multi-tenant migration.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Competitor sensor spams `work_queue` | M | Trailing-window threshold + `unique(url,task,status)` + budget cap |
| GBP API access approval delays D | H | Start access request now (parallel); v1 fallback = paste-in review feed |
| CRO edit silently brushes positioning | M | Always-gated; brand-safety eval on Loop A; human flip on Loop B |
| GA4 attribution noise misreads conversion lift | M | Trailing 28-day window; guardbands, not single-week reactions (roadmap warning) |
| New `link_prospects` table drifts across client repos | L | Treat as frozen shared schema (ADR-0001 §2); extract to shared package before client #5 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | A — CMO Reporter | Weekly digest observer: read memory layer → GitHub Issue + job summary + email | pending | - | - | - |
| 2 | B — Conversion Optimizer | GA4 sensor + `cro-audit` skill + `conversions` feed; always-gated edits | pending | with 3 | 1 | - |
| 3 | C — Link Prospector | `link-prospect` skill + `link_prospects` table + `ai_citations`/GSC-Links sensor | pending | with 2 | 1 | - |
| 4 | E — Competitor Watch | Extend `sensor-ai-citations` to enqueue existing GEO/refresh tasks on sustained gap | pending | - | 3 | - |
| 5 | D — GBP Agent | `change_set.platform='gbp'` + `packs/gbp/apply.mjs` + `review-reply` skill | pending | - | 1 | - |

### Parallelism Notes

A is the keystone (cheap, makes the rest observable) — everything depends on it only for visibility, not function. B and C are fully independent (different sensors, different output paths) and run concurrently. E depends on C's sensor patterns landing first. D is gated on external GBP API access and runs last.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Roster scope | A–D agents + E sensor; F/G deferred | Force F/G into v1 | F/G fork the outcome/attribution layer = a parallel system |
| F deferral reason | Learning layer keyed on `url`, not `asset` | Ship F non-learning | Honest about the seam; filed [BUI-62](https://linear.app/buildsmarterholdings/issue/BUI-62) |
| B conversion source | GA4 Data API | Form events / manual CSV | Lowest marginal cost (reuses Google stack); makes B truly closed-loop |
| C identity | `link-prospect` + `link_prospects` table | New `offsite-authority` skill | Conform to existing domain model (`CONTEXT.md`), don't invent a parallel name |
| D identity | `change_set` `platform='gbp'`, Loop B | New artifact path | Conform to `gbp_platform` term; permanently gated per ADR-0002 |
| E form | Sensor, not a drafting agent | New "competitor" skill | It perceives + routes to existing skills; drafting it would duplicate them |
| Model tiers | Haiku + Sonnet only | Opus for any | No member clears the Opus bar; protects the credit pool |
| Linear home | BSM-AI team | New SEO team / Operations | Roster graduates to the bsm-ai product (ADR-0001 migration) |

---

## Research Summary

**Market / domain context**
Mirrors the four-layer autonomous pattern in `AGENTIC-ROADMAP.md` (sensing → orchestration → memory → guardrails) and its autonomy matrix; this PRD fills the *non-on-site* quadrants the roadmap names but doesn't staff.

**Technical context (codebase, with file references)**
- Rails: `orchestrator/run.mjs` (dispatch + PR), `scripts/eval-judge.mjs` (Loop A gate), `scripts/collect-outcomes.mjs` (GSC + optional `conversions`/`citations` CSV), `scripts/prioritize.mjs` (reprioritization).
- Memory + vocabulary: `sql/schema.sql`, `CONTEXT.md` (already defines `link_prospects`, `gbp_platform`, `vertical_config`, `client_id`).
- Decisions: `docs/adr/0001` (repo-per-client → multi-tenant), `0002` (human-gate policy), `0003` (single configurable skill).
- Publish model: `CONTEXT.md` "approval-to-publish loop" Loop A (repo/PR) vs Loop B (live CMS/GBP).

---

*Generated: 2026-06-24 · Status: DRAFT — needs validation*
*Next: `/prp-plan docs/agent-roster.prd.md` to plan Phase 1 (CMO Reporter).*
