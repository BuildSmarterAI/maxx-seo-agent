# Agent Roster — Completing the Autonomous SEO/Marketing Department

> PRD · drafted 2026-06-24 · reconciled against `main` 2026-07-10
> Companion to `AGENTIC-ROADMAP.md`, `CONTEXT.md`, and the lowercase `docs/adr/0001–0003` series.
> Status: **PARTIALLY SUPERSEDED** — agents A, C, D are still greenfield and buildable as specced.
> Agent E is largely shipped. Agent B's sensing half is shipped; only its drafting skill remains.

> **ADR numbering.** This repo carries two ADR series. The **lowercase** `0001`–`0003` are the
> product/architecture decisions this PRD cites (repo-per-client, human-gate policy, single
> configurable skill). The **uppercase** `ADR-001`–`ADR-010` are the runtime/build decisions.
> Where this document says "ADR-0001" it means the lowercase series.

---

## Reconciliation note (2026-07-10)

This PRD was drafted on 2026-06-24 and sat unmerged on the `docs/agent-roster-prd` branch for
~110 commits. It is salvaged here because agents **A (CMO Reporter)**, **C (Link Prospector)**,
and **D (GBP Agent)** remain unbuilt and their designs still fit `main`'s architecture. Two
sections were factually wrong by the time of salvage and have been corrected in place rather
than left to mislead a future session:

| Was | Now |
|---|---|
| **E — Competitor Watch** specced as new work | **Largely shipped.** `scripts/classify-competitors.mjs` + the `competitor_domains` table (`sql/ai-search-schema.sql:81`) + analyst-gated enqueue in `scripts/analyze-citation-events.mjs`. Formalized under `ADR-007 — AI Overview citation intelligence`. **Do not rebuild.** |
| **B** specced as adding a GA4 sensor and a `conversions` outcome | **Sensing half shipped.** `scripts/sensor-ai-referrals.mjs` and `scripts/collect-outcomes.mjs` both read `GA4_PROPERTY_ID`; `scripts/attribute-conversions.mjs` writes `learned_patterns_conv`. Only the `cro-audit`/`cro-optimize` drafting skill is missing. |
| Outcome metric named `conversions` | Superseded by `organic_conversions` and `ai_conversions` (`sql/schema.sql:36`). Conversion attribution goes to a **separate** `learned_patterns_conv` table, deliberately not the shared `learned_patterns` — folding them in would rescale the GSC anchor. |
| `work_queue.source = 'competitor'` assumed | `source` is free text, but its documented enum is `gsc \| sitemap \| deploy \| citation \| manual`. Shipped citation-driven enqueues use `source: "citation"`. Pick one and document it before adding a sixth value. |

The PRD's **central architectural constraint still holds**: `main` has exactly one `work_queue`,
one orchestrator, and the `work_queue → orchestrator → seo-fixer → eval_gate → approval → publish`
rails are intact. Its evidence citations also still resolve — `AGENTIC-ROADMAP.md` and
`OPERATIONS.md` are both present.

---

## Problem Statement

The orchestrator today is a complete **on-site organic SEO/GEO** loop (sense → plan → act → verify → learn) but it covers only part of a marketing department. Traffic earned by the loop is never optimized into revenue, the system has no off-site authority motion, no reputation management, and no automated supervision digest — so the human-on-the-loop still assembles the Monday review by hand. The cost of not closing these gaps is that the loop ranks pages it never converts, and a single operator's attention stays the bottleneck the autonomy ladder was meant to remove.

## Evidence

- `AGENTIC-ROADMAP.md` names the real signal as revenue, not ranking: AI-referred visitors convert **14.2% vs 2.8%**. Conversion is now *measured* (`learned_patterns_conv`) but still not *acted on* — no skill drafts a conversion fix.
- `OPERATIONS.md §1` is a **manual** 10-minute Monday routine across GitHub + Supabase — exactly the supervision an observer agent should pre-digest.
- The entire skill set (`seo-audit`, `metadata-generate`, `schema-generate`, `internal-linking`, `blog-write`, `restructure-for-citation`, …) writes to the customer's **own** CMS. There is zero off-site authority motion, and off-site signals are ~half of ranking.
- `CONTEXT.md` already pre-modeled two of these gaps (`link_prospects`, `gbp_platform`) in the prior domain-modeling session — the need was identified but the agents weren't specced. **Neither table exists in `sql/schema.sql` as of 2026-07-10**; they remain vocabulary only.

## Proposed Solution

Add the remaining roster members that **reuse the existing rails** — `work_queue → orchestrator → seo-fixer subagent → eval_gate → approval → publish` — with no second queue, no second orchestrator, and no standalone actor. Each new member is at most three artifacts: a **sensor** (what enqueues), a **kit skill** (what drafts), and sometimes a **pack** (how it publishes). Two members ride only part of the loop by design: the **CMO Reporter** is a read-only *observer* (no `work_queue`, nothing to gate), and the **Link Prospector** rides the front half while its back half (outreach) collapses to a human. Two further candidates (LinkedIn syndication, newsletter) are **deferred** because they fork the sensor + outcome/attribution layers — the one thing "no parallel systems" forbids.

## Key Hypothesis

We believe a **conversion optimizer + off-site authority + an automated supervision digest**, all riding the existing loop, will convert the department from "ranks pages" to "earns and compounds revenue" for a single owner-operator GC — and we'll know we're right when **conversion rate on optimized pages rises** and the **operator's weekly supervision time drops** without an increase in escalations that slip past review.

## What We're NOT Building

- **F — LinkedIn syndication (`repurpose-social`)** — deferred ([BUI-62](https://linear.app/buildsmarterholdings/issue/BUI-62)). It forks the learning layer: outcomes are keyed on **`url`**, a post's outcome is keyed on **post ID**. Unblocks only after the outcome key is generalized `url → asset` (ADR-worthy) — until then it can only ship as a non-learning fire-and-forget distributor.
- **G — Newsletter (`newsletter-draft`)** — deferred, same class of problem (separate channel + separate outcome universe).
- **Paid SERP-rank competitor tracking** — deferred until budget justifies; the shipped competitor watch uses the AI-citation data already collected.
- **Paid backlink APIs (Ahrefs/Majestic)** for the Link Prospector — v1 reuses `ai_citations` + the free GSC Links report.

## Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| Conversion rate on `cro-audit`-optimized pages | +X% vs baseline (set after first GA4 read) | `outcomes.metric = organic_conversions`, trailing 28-day window |
| Operator weekly supervision time | < 10 min (from current manual routine) | Self-reported; digest replaces `OPERATIONS.md §1` |
| Link prospects actioned → links won | ≥ N won / quarter | `link_prospects.status = won` |
| Roster cost | Haiku + Sonnet only, **no Opus** | `control.spend_usd` per run vs `MONTHLY_BUDGET_USD` |

## Open Questions

- [ ] `cro-audit` task name: the `-audit` suffix conventionally means **read-only** (per `CLAUDE.md`). The detection step (GA4 finds low-converting pages) is the audit; the drafting step is a generator. Confirm name — `cro-audit` (detection) + `cro-optimize` (generation), or one `cro-audit` task that both detects and drafts?
- [ ] Conversion source of truth for a GC: GA4 page-conversions (chosen, and now shipped) vs submitted-RFP/contact-form events. Revisit if form-events prove more accurate.
- [ ] GBP API access approval timeline (multi-week allowlist) — start the request now so D isn't blocked on it.
- [ ] Does the Link Prospector's outcome (referring-domain growth) deserve a dedicated `outcomes.metric`, or is citation-share a sufficient proxy in v1?
- [ ] **New:** should `cro-optimize` read `learned_patterns_conv` for prioritization, the way `prioritize.mjs` already blends it? Deciding this pins whether B is a sensor consumer or a `learned_patterns` consumer.

---

## Users & Context

**Primary User**
- **Who**: Harris (owner-operator), running the loop for Maxx Builders today; Buzz Digital's multi-vertical clients next (per ADR-0001/0003).
- **Current behavior**: Manually assembles the Monday supervision review; has no off-site, conversion-drafting, or reputation motion.
- **Trigger**: A weekly cadence (supervision), a deploy or GSC/citation delta (action), a new review (reputation).
- **Success state**: The department earns *and converts* traffic, surfaces its own exceptions in a digest, and stays inside the budget cap — with the human approving exceptions, not driving steps.

**Job to Be Done**
When my SEO loop has earned traffic and is running unattended, I want it to convert that traffic, build off-site authority, and hand me a one-glance supervision digest, so I can supervise a marketing department instead of operating one.

**Non-Users**
Not for multi-operator marketing teams, not for paid-media/SEM, not for sites in regulated YMYL verticals (treated as fully gated). Not the bsm-ai multi-tenant product yet — this is Phase A (repo-per-client), designed to migrate per ADR-0001.

---

## Solution Detail

### The roster

| Agent | Gap it fills | New `work_queue` task(s) | New Supabase tables / schema | Model tier + justification | Blast radius | Priority |
|---|---|---|---|---|---|---|
| **A — CMO Reporter** (`weekly-digest`) | No automated supervision; the Monday runbook is manual | **none** — read-only *observer*, does not enqueue | **none** (reads `decision_log`/`outcomes`/`learned_patterns`/`work_queue`/`control`) | **Haiku** — pure summarization over structured rows; no synthesis | **~zero** — read-only; only external action is an outbound email | **P0** |
| **B — Conversion Optimizer** (`cro-audit`) · *sensing half shipped* | Loop ranks pages but never converts them | `cro-audit` | **none new.** Reuses the shipped GA4 feed (`sensor-ai-referrals.mjs`, `collect-outcomes.mjs`), the `organic_conversions`/`ai_conversions` outcome metrics, and `learned_patterns_conv`. **Remaining work: the drafting skill only.** | **Sonnet** — persuasion copy + layout reasoning is past Haiku's reliable range; not high-stakes enough for Opus | **Medium** — edits live conversion paths; capped by **always-gated** (never safe-class, brushes positioning per ADR-0002) | **P1** |
| **C — Link Prospector** (`link-prospect`) | System is on-site only; no off-site authority / link earning | `link-prospect` | **`link_prospects`** — still unbuilt. Vocabulary exists in `CONTEXT.md` (`drafted→approved→sent→replied→won\|lost\|skipped`); no table in `sql/schema.sql`. Inherits ADR-0001 frozen-schema/per-repo replication | **Sonnet** — research synthesis + persuasive pitch; **`vertical_config`-driven** per ADR-0003 | **~zero on-site** — never touches the property; back half (outreach) is 100% human-executed | **P1** |
| **D — GBP Agent** (`review-reply`, first slice) | No reputation / local-trust signal management | `review-reply` (writes `change_set` rows) | **No new table** — `change_set.platform` += `'gbp'` (today the documented enum is `wordpress \| webflow`) + new **`packs/gbp/apply.mjs`** pack (per `gbp_platform` term). Loop B, **permanently gated** (ADR-0002) | **Haiku** for positive/neutral replies; **Sonnet** only for negative/sensitive | **~zero on-site** — Loop B, never publishes without the human `pending→approved` flip; negatives always escalate | **P2** |
| ~~**E — Competitor Watch**~~ | ~~No competitor-driven reprioritization~~ | — | — | — | — | **SHIPPED** — see below |
| ~~F — LinkedIn syndication~~ | Distribution | ~~`repurpose-social`~~ | forks sensor + outcome layers | — | — | **Deferred** ([BUI-62](https://linear.app/buildsmarterholdings/issue/BUI-62)) |
| ~~G — Newsletter~~ | Lifecycle email | ~~`newsletter-draft`~~ | separate channel + outcome | — | — | **Deferred** |

#### Agent E — shipped, and built more carefully than specced

The PRD proposed extending `sensor-ai-citations` to enqueue existing GEO/refresh tasks on a
sustained competitor gap. What shipped instead, under `ADR-007 — AI Overview citation
intelligence`:

- `scripts/classify-competitors.mjs` discovers cited domains and classifies them into
  `competitor_domains` (`sql/ai-search-schema.sql:81`) via Haiku.
- `scripts/sensor-ai-citations.mjs` scores citation gaps against those rows and enqueues content
  fixes with `source: "citation"` — **not** `source: "competitor"`.
- `scripts/analyze-citation-events.mjs` adds an **analyst gate** the PRD did not anticipate: it
  acts on citation *transitions* (gained / lost / displaced), not raw single-sample misses, with
  `AIO_SAMPLES` majority-vote to kill rendering flicker.

That analyst gate is a strict improvement over the PRD's "trailing-window threshold" mitigation.
**Do not rebuild Agent E.** If anything remains, it is a thin follow-on, and it should be specced
against ADR-007, not against this document.

**Finding worth flagging:** the entire remaining roster runs on **Haiku + Sonnet — no Opus**. Synthesis here is bounded (summarize rows, draft a reply, draft a pitch, optimize a CTA); none clears the Opus bar. That keeps the loop inside the non-rolling credit pool the roadmap warns about.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|---|---|---|
| Must | A — CMO Reporter | Cheapest build; unblocks the human-on-the-loop supervision L4 requires |
| Must | B — Conversion Optimizer (drafting skill only) | Closes traffic→revenue — the roadmap's own "real signal". Sensing already landed |
| Must | C — Link Prospector | The single biggest *pure-SEO* gap (system is on-site only) |
| Should | D — GBP Agent (review-reply) | Real local-SEO signal, but low GC review volume + GBP API access friction → after A/B/C |
| Done | E — Competitor Watch | Shipped under ADR-007 |
| Won't (now) | F — LinkedIn, G — Newsletter | Fork the learning layer; need the `url → asset` outcome generalization first |

### MVP Scope

Ship **A** first (it's nearly free and makes everything else observable), then **B** and **C** in
parallel (independent: B consumes the shipped GA4 feed, C needs a new `ai_citations`/GSC-Links
sensor), then **D** last (gated on GBP API access, started in parallel). E is done.

### User Flow (critical path, per agent)

- **A:** weekly cron → read memory layer → render digest → GitHub Issue + job-summary mirror + email push. No gate.
- **B:** shipped GA4 feed surfaces a high-traffic/low-conversion URL → `cro-audit` task → `seo-fixer` drafts `change_set` edits → **always human-approved** → pack applies → `organic_conversions` outcome closes the loop.
- **C:** `ai_citations`/GSC-Links sensor finds an authority gap → `link-prospect` task → drafts a `link_prospects` row (`drafted`) → human approves + sends manually → status walks to `won|lost`.
- **D:** new-review feed → `review-reply` task → drafts `change_set` (`platform=gbp,field=review_reply`, `pending`) → human flips `approved` → `packs/gbp/apply.mjs` posts. Negatives drafted cautiously + escalated.

---

## Technical Approach

**Feasibility**: **HIGH** — every remaining member reuses an existing rail. The genuinely new infrastructure is now one read-only sensor (GSC-Links for C), one outreach table already in the domain model, one new pack, and one outbound-email integration. The GA4 sensor the PRD called for has since shipped.

**Architecture Notes**
- **Observer agents are a sanctioned exception** to "every agent traverses the loop." A read-only member that emits a report (not `work_queue`/`change_set` rows) is not a parallel *acting* system — it has nothing to gate. (New `CONTEXT.md` term: `observer_agent`.) `main` already has a precedent: `.claude/agents/research-agent.md` is read-only and never modifies files.
- **Loop A vs Loop B asymmetry matters for B and D.** Repo-based edits hit the automated `eval_gate`; live-CMS and GBP edits (Loop B) do **not** — the human approval flip is the only gate (ADR-0002). D and CMS-side B therefore lean entirely on the human gate + brand-safety review.
- **`vertical_config` (ADR-0003)** binds `cro-audit` and `link-prospect`: their value-prop language and pitch angles are vertical-specific, so they read `VERTICAL`/`SERVICE_TAXONOMY`/`STAT_SOURCES` from `CLAUDE.md`, not hardcoded construction copy.
- **ADR-0001 frozen-schema constraint** applies to the new `link_prospects` table: it must be identical across client repos and gets `client_id` at the multi-tenant migration.
- **Conversion attribution is deliberately separate.** `attribute-conversions.mjs` writes `learned_patterns_conv`, not the shared `learned_patterns`, because folding conversions in would rescale the GSC anchor. Any B-side prioritization must respect that split.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|---|---|---|
| GBP API access approval delays D | H | Start access request now (parallel); v1 fallback = paste-in review feed |
| CRO edit silently brushes positioning | M | Always-gated; brand-safety eval on Loop A; human flip on Loop B |
| GA4 attribution noise misreads conversion lift | M | Trailing 28-day window; guardbands, not single-week reactions (roadmap warning) |
| New `link_prospects` table drifts across client repos | L | Treat as frozen shared schema (ADR-0001 §2); extract to shared package before client #5 |
| B re-specced against the stale `conversions` metric | M | The metric is `organic_conversions` / `ai_conversions`; check `sql/schema.sql:36` before writing the skill |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends |
|---|-------|-------------|--------|----------|---------|
| 1 | A — CMO Reporter | Weekly digest observer: read memory layer → GitHub Issue + job summary + email | pending | - | - |
| 2 | B — Conversion Optimizer | `cro-audit` drafting skill over the shipped GA4 feed; always-gated edits | pending | with 3 | 1 |
| 3 | C — Link Prospector | `link-prospect` skill + `link_prospects` table + `ai_citations`/GSC-Links sensor | pending | with 2 | 1 |
| 4 | D — GBP Agent | `change_set.platform='gbp'` + `packs/gbp/apply.mjs` + `review-reply` skill | pending | - | 1 |
| — | E — Competitor Watch | Classify + citation-gap enqueue + analyst gate | **shipped** (ADR-007) | - | - |

### Parallelism Notes

A is the keystone (cheap, makes the rest observable) — everything depends on it only for
visibility, not function. B and C are fully independent (different sensors, different output
paths) and run concurrently; B no longer depends on C's sensor patterns now that E has shipped
and the GA4 feed exists. D is gated on external GBP API access and runs last.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Roster scope | A–D agents + E sensor; F/G deferred | Force F/G into v1 | F/G fork the outcome/attribution layer = a parallel system |
| F deferral reason | Learning layer keyed on `url`, not `asset` | Ship F non-learning | Honest about the seam; filed [BUI-62](https://linear.app/buildsmarterholdings/issue/BUI-62) |
| B conversion source | GA4 Data API | Form events / manual CSV | Lowest marginal cost (reuses Google stack); makes B truly closed-loop. **Shipped.** |
| B outcome metric | `organic_conversions` / `ai_conversions` + `learned_patterns_conv` | A single `conversions` metric folded into `learned_patterns` | Folding in would rescale the GSC anchor; superseded the PRD's original naming |
| C identity | `link-prospect` + `link_prospects` table | New `offsite-authority` skill | Conform to existing domain model (`CONTEXT.md`), don't invent a parallel name |
| D identity | `change_set` `platform='gbp'`, Loop B | New artifact path | Conform to `gbp_platform` term; permanently gated per ADR-0002 |
| E form | Sensor, not a drafting agent | New "competitor" skill | It perceives + routes to existing skills; drafting it would duplicate them. **Shipped with an analyst gate on top.** |
| Model tiers | Haiku + Sonnet only | Opus for any | No member clears the Opus bar; protects the credit pool |
| Linear home | BSM-AI team | New SEO team / Operations | Roster graduates to the bsm-ai product (ADR-0001 migration) |

---

## Research Summary

**Market / domain context**
Mirrors the four-layer autonomous pattern in `AGENTIC-ROADMAP.md` (sensing → orchestration → memory → guardrails) and its autonomy matrix; this PRD fills the *non-on-site* quadrants the roadmap names but doesn't staff.

**Technical context (codebase, with file references — verified 2026-07-10)**
- Rails: `orchestrator/run.mjs` (dispatch + PR), `scripts/eval-judge.mjs` (Loop A gate), `scripts/collect-outcomes.mjs` (GSC + GA4), `scripts/prioritize.mjs` (reprioritization, blends `learned_patterns_conv`).
- Shipped since drafting: `scripts/sensor-ai-referrals.mjs`, `scripts/attribute-conversions.mjs`, `scripts/classify-competitors.mjs`, `scripts/analyze-citation-events.mjs`.
- Memory + vocabulary: `sql/schema.sql`, `sql/ai-search-schema.sql`, `CONTEXT.md` (defines `link_prospects`, `gbp_platform`, `vertical_config`, `client_id` — the first two are still vocabulary-only).
- Decisions: lowercase `docs/adr/0001` (repo-per-client → multi-tenant), `0002` (human-gate policy), `0003` (single configurable skill). Uppercase `ADR-007` governs the shipped competitor/citation intelligence.
- Publish model: `CONTEXT.md` "approval-to-publish loop" Loop A (repo/PR) vs Loop B (live CMS/GBP).

---

*Drafted 2026-06-24 · Reconciled against `main` 2026-07-10 · Next: plan Phase 1 (CMO Reporter).*
