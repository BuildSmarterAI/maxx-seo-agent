# Session Handoff — Agent Roster Design

**Date:** 2026-06-24 · **Repo:** maxx-seo-agent · **Branch:** `docs/agent-roster-prd` (commit `2a36095`, off `main` `4ac53e9`)
**Continuing from:** home (different machine) — `git fetch && git checkout docs/agent-roster-prd`

---

## What this session did

Ran a `grill-with-docs` + `domain-modeling` session to design the agents that **complete the autonomous SEO/marketing department**, each riding the existing `work_queue → orchestrator → seo-fixer → eval_gate → approval → publish` loop. **No parallel systems.** Then generated the roster PRD and filed Linear issues.

## ⚠️ RECONCILE FIRST — overlaps the locked buzz-seo-extension plan

This session did **not** have `docs/buzz-seo-extension-architecture.md` loaded during the grill. That doc (+ memory `buzz-seo-extension`) already locked a 6-phase plan **earlier the same day**. The roster below independently re-derived most of it with **different labels** and **two conflicting vendor calls**. Read the architecture doc and reconcile before building:

| This session (Linear) | Buzz plan phase | Status |
|---|---|---|
| A CMO Reporter (BUI-63) | **C-1** ops reporting + **C-2** client reporting | Same (Resend). Buzz already specced `scripts/reporter-ops.mjs` + `seo-report-ops.yml`; buzz splits weekly-internal vs monthly-client — this session only specced the internal digest |
| B Conversion Optimizer (BUI-64) | — | **NET-NEW** — not in buzz plan; keep |
| C Link Prospector (BUI-65) | **Phase A** link building | Same `link_prospects` table. **CONFLICT:** buzz locked **DataForSEO backlinks**; this session recommended **free `ai_citations`+GSC-Links v1, defer paid** |
| D GBP Agent (BUI-66) | **Phase B** local/GBP | Consistent (`change_set.platform='gbp'` + `packs/gbp/`) |
| E Competitor Watch (BUI-67) | **Phase D** competitor/gap | Same function. **CONFLICT:** buzz locked **DataForSEO SERP**; this session recommended **free GEO-only via `ai_citations`, defer paid SERP** |
| — | **Phase E** programmatic SEO (`vertical_config`) | Not covered here (existing-skill config, not a new agent) |

**Label collision:** buzz "Phase A" = link building; this session's "Agent A" = reporter — opposite meanings. **Recommendation:** treat the buzz architecture doc as canonical for labels + vendor decisions; fold in this session's three genuine additions — **(1) Agent B (CRO)**, **(2) the `observer_agent` term**, **(3) the `url→asset` outcome-key ADR** — and consciously decide DataForSEO (locked) vs free-tools-first (this session) for C/E.

## State (done)

- **PRD written:** `docs/agent-roster.prd.md` — roster spec in the requested format (agent · gap · task names · tables · model+justification · blast radius · priority) + MoSCoW + phases + risks + decisions log.
- **Domain model:** added `observer_agent` term to `CONTEXT.md`.
- **Committed** on this branch (`2a36095`), 2 files, 183 insertions. Worktree at `../maxx-seo-agent-wt-roster`. **Not merged.**
- **Linear (BSM-AI team):** BUI-63 (A), BUI-64 (B), BUI-65 (C), BUI-66 (D), BUI-67 (E) — all `relatedTo` BUI-62 (F, deferred).

## The roster (build order)

| ID | Agent | Task | Model | Priority | Notes |
|---|---|---|---|---|---|
| BUI-63 | A CMO Reporter | `weekly-digest` | Haiku | **P0** | `observer_agent`; read-only; out = GitHub Issue + job summary + email (Resend) |
| BUI-64 | B Conversion Optimizer | `cro-audit` | Sonnet | P1 | GA4 sensor (`GA4_PROPERTY_ID`); always-gated; feeds `conversions` outcome |
| BUI-65 | C Link Prospector | `link-prospect` | Sonnet | P1 | **+`link_prospects` table** (already in CONTEXT.md); back half = human outreach |
| BUI-66 | D GBP Agent | `review-reply` | Haiku/Sonnet | P2 | `change_set.platform='gbp'` + `packs/gbp/`; Loop B; gated; **start GBP API access now** |
| BUI-67 | E Competitor Watch | (sensor) | Haiku/det. | P1 | extends `sensor-ai-citations`; enqueues existing tasks; trailing-window threshold |
| BUI-62 | F LinkedIn | `repurpose-social` | — | **Deferred** | forks outcome layer (url-keyed); needs `url→asset` generalization |

Whole active roster = **Haiku + Sonnet, no Opus**.

## Next task

1. `/prp-plan docs/agent-roster.prd.md` → plan **Phase 1 (A — CMO Reporter)**, the keystone (cheapest; makes the rest observable).
2. Build order after A: **B + C in parallel** (independent sensors) → **E** → **D** (gated on GBP API access).

## Open questions (carried)

- [ ] `cro-audit` naming: `-audit` = read-only by convention but B drafts. Split `cro-audit` (GA4 detect) + `cro-optimize` (draft)?
- [ ] **`url → asset` outcome-key generalization is ADR-worthy** — decide before adding *any* off-site channel (unblocks F/G; cheaper now than retrofit).
- [ ] B conversion source of truth: GA4 (chosen) vs RFP/contact-form events — revisit if forms prove more accurate.
- [ ] C: does referring-domain growth need its own `outcomes` metric, or is citation-share a sufficient proxy?

## Guardrails honored / to remember

- Reconciled to existing docs (CONTEXT.md `link_prospects`/`gbp_platform`, ADR-0001 repo-per-client migration, ADR-0002 permanent gates, ADR-0003 single configurable skill / `vertical_config`).
- New `link_prospects` table inherits ADR-0001 frozen-schema/per-repo replication; new content skills (`cro-audit`, `link-prospect`) must be `vertical_config`-driven for Buzz Digital multi-vertical.
- Loop B (CMS/GBP) has **no automated eval** — human approval flip is the only gate.
