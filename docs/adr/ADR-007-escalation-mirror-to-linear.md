# ADR-007 — Escalation mirror to Linear

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

The orchestrator escalates `gated`-class work_queue rows (redirects, YMYL, brand/pricing,
host/plugin config the CMS packs can't apply) by setting `status='escalated'` and logging
the decision. Until now those items lived only in Supabase — a human had to query the
`work_queue` table to find them. There was no human-facing surface, so escalations were
easy to miss. We needed escalated items to show up where the team already tracks work
(Linear) without making Linear a second source of truth.

## Decision

`scripts/push-escalations.mjs` mirrors escalated work to Linear, **one-directionally**:

- Reads `work_queue` rows with `status='escalated'` and `linear_issue_id IS NULL`.
- Creates one Linear issue per row via the Linear **GraphQL API** (`issueCreate`), in a
  fixed team/project.
- Writes the created issue id back into `work_queue.linear_issue_id`, so re-runs never
  duplicate (idempotent mirror).
- Runs inside the weekly `learn` job. No LLM involved.
- Closing the loop (Linear done → `work_queue` done) stays a **human/SQL action**.

Supabase remains the single source of truth; Linear is a mirror.

## Rationale

- **GraphQL direct, not the MCP server:** CI is headless and the claude.ai Linear MCP
  requires interactive auth. The script talks to `api.linear.app/graphql` with
  `LINEAR_API_KEY` so it works unattended.
- **One-directional:** a two-way sync introduces write-back conflicts and a second
  authority over queue state. v1 deliberately keeps Supabase authoritative; reopening or
  closing is a deliberate human act.
- **Idempotent via `linear_issue_id`:** the null-pointer check is the dedupe key. A
  per-row failure is logged and left unmirrored so the next run retries it — a transient
  Linear error must never fail the whole `learn` job or drop an item silently.

## Consequences

- `LINEAR_API_KEY` is a required secret for the `learn` job. Missing key → the script
  throws at startup (it is the last step, so attribution still completes).
- `escalatedQueue()` surfaces a missing `linear_issue_id` column as a hard error (loud
  fail), not a silent empty result — run the `schema.sql` migration before enabling.
- Team/project IDs are **hardcoded** in `push-escalations.mjs`. Moving the project or
  team requires a code change. This is the main fragility; revisit if it churns.
- Closing escalated items is manual. If escalation volume grows, a two-way close-sync
  (Linear webhook → `work_queue` done) is the natural follow-up (tracked as R3).

## Files affected

- `scripts/push-escalations.mjs` — the mirror
- `orchestrator/lib/supabase.mjs` — `escalatedQueue()`, `setLinearIssueId()`
- `sql/schema.sql` — `work_queue.linear_issue_id` column (idempotent `alter table`)
- `.github/workflows/` — the `learn` job runs the mirror after attribution
