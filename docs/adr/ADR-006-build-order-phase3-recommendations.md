# ADR-006 — Build order for Phase 3 recommendations

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Candidates (verified in Phase 2 API audit)

1. Impression + position weighting in attribution
2. Webflow CMS item writes
3. Indexation sensor
4. Yoast `yoast_head` drift verification

## Ranking rationale

Ranked by (impact × infra-reuse) / blast-radius.

| Rank | Item | Why |
|---|---|---|
| 1 | Impression + position weighting | Data already in Supabase. One file, ~20 lines. No new APIs or tables. Immediately improves every future orchestrator run. |
| 2 | Webflow CMS item writes | `collection_id` already in `change_set` schema. Pack pattern identical to existing page SEO writes. High impact for Webflow clients. |
| 3 | Indexation sensor | Same GSC service account and `enqueue()` pattern as existing sensors. Medium impact, low effort. |
| 4 | Yoast `yoast_head` drift verification | Low blast radius but also lowest impact. Do last. |

## Unverified items (not scheduled until spiked)

- Live citation tracking — no API integration exists; spike required.
- GA4 conversion attribution — no integration exists; spike required.

## Consequences

Build in rank order. Do not start #2 until #1 is in production and `learned_patterns`
has at least one week of blended signals to validate against.
