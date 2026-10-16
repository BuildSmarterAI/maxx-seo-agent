# ADR-009 — Build order for the 2026-06-25 reconciliation survivors

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

The 2026-06-25 architecture + API reconciliation re-ran the Phase-2 API audit against the
current code and live WordPress install. It confirmed that three of ADR-006's four ranked
items are now built (position weighting, indexation sensor, `yoast_head` verify) and that
GA4 attribution — listed "unverified" in ADR-006 — is also built. After dropping all
solved/duplicate work, three new recommendations survived, each grounded in a capability
verified in Phase 2.

## Candidates (grounded in Phase-2 capabilities)

- **R1 — Retain GSC query string on striking-distance rows.** `sensor-gsc.mjs` already
  fetches `dimensions: ["page","query"]` and discards the query. Capture it.
- **R2 — `yoast/v1/get_head` as a page-aware, fail-soft verify** alongside
  `yoast_head_json`. `get_head` verified reachable (200) for any URL. Gated by ADR-008.
- **R3 — Two-way Linear close-sync** (Linear done → `work_queue` done). Extends the
  one-directional escalation mirror (ADR-010).

## Decision

Build in order **R1 → R2 → R3**, ranked by (impact × infra-reuse) / blast-radius.

| Rank | Item | Why |
|---|---|---|
| 1 | R1 query retention | Data already fetched and discarded; ~one column + a few lines. No new API, no live action. Reuses sensor→work_queue→change_set end-to-end. Sharpens every metadata-generate run. |
| 2 | R2 `get_head` verify | Read-only, behind a flag (ADR-008). Low blast, but additive over the existing verify rather than essential. |
| 3 | R3 Linear close-sync | Writes queue state and adds a second authority surface → higher blast. Do last, human-gated. |

## Smallest useful version of R1 (own-site first)

- In `sensor-gsc.mjs`, carry `row.keys[1]` (the query) through the striking-distance
  enqueue mapping to the `seo-fixer` so `metadata-generate` optimises for that query.
- New column (idempotent, matches the `linear_issue_id` pattern):
  `alter table work_queue add column if not exists target_query text;`
- No new task type; no new table. Reuses `change_set` → approval → pack apply →
  snapshot/rollback unchanged — R1 only enriches the queue row.

## Consequences

- Live/risky actions (redirects, canonicals that change routing, GBP/NAP, anything
  unattended on a client site) remain `gated` / human-only and are **not** part of this
  sequence — a hard architectural rule, not a ranking input.
- R3 stays human-gated even when built.
- Revisit this order only if a new Phase-2 capability lands; this ADR exists so routine
  reviews don't re-litigate the sequence.
