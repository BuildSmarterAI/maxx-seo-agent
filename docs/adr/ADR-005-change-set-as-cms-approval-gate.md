# ADR-005 — change_set table as the CMS approval gate

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

For WordPress and Webflow, a git PR is not available as the human review gate — the
platform holds the content, not the repo. The system needed a mechanism that provides:
1. A review artifact a human can inspect before anything goes live.
2. A rollback mechanism (git revert doesn't exist for live CMS writes).
3. Drift detection (a human may have edited the field between generation and apply).
4. A hard gate: the agent must never write to the live CMS directly.

## Decision

The `seo-fixer` subagent writes `change_set` rows (status=`pending`) into Supabase. A
human flips rows to `approved` via SQL or a review UI. The platform pack reads only
`approved` rows, snapshots the current live value into `snapshots`, checks for drift, and
then writes to the CMS. The `seo-fixer` is explicitly prohibited from calling the CMS API
directly.

Status lifecycle:
```
pending → approved → applied → published (Webflow only)
                  → escalated (drift, unsupported field, or human decision)
                  → rolledback
                  → failed
```

## Rationale

`change_set` rows are the CMS equivalent of a PR diff. They are inspectable, auditable,
and revocable before anything is live. The snapshot-before-write pattern replaces `git
revert`. Drift detection prevents the agent from clobbering a human edit made between
generation and apply time.

The alternative — having the agent write directly to the CMS and rely on WP post
revisions for rollback — was rejected because it removes the review gate entirely and
makes rollback dependent on the CMS's own history, which varies by plugin and host.

## Consequences

- The `seo-apply-cms` workflow runs on a schedule after the orchestrator, not in the same
  run. There is always a gap between generation and apply — this is intentional.
- WordPress meta writes are **immediately live**. `WP_BASE_URL` must point at a staging
  clone until a production workflow is established.
- Webflow page SEO writes **stage** the change (draft). Nothing is live until a site
  publish, which is a separate opt-in step gated on `WEBFLOW_ALLOW_SITE_PUBLISH=true`.
- A review UI that lets non-technical operators approve rows without SQL access is a
  future improvement; the current gate is a SQL UPDATE.
- The `base_value` column is critical: it must be populated by the `seo-fixer` at
  generation time (not left null) or drift detection cannot function.

## Files affected

- `orchestrator/run.mjs` — `runCms()` path; `seo-fixer` subagent writes via `mem.mjs`
- `scripts/mem.mjs` — `changeset` command inserts into `change_set`
- `orchestrator/lib/supabase.mjs` — `insertChangeset()` helper
- `orchestrator/lib/cms.mjs` — `approvedRows()`, `snapshot()`, `drifted()`, `setStatus()`
- `packs/wordpress/apply.mjs`, `packs/webflow/apply.mjs` — read and apply approved rows
- `sql/schema.sql` — `change_set` and `snapshots` table definitions
