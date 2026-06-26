# ADR-004 — Supabase as the memory layer

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

A fully agentic loop requires persistent state that survives across runs, is queryable
by both the orchestrator and CI workflows, and can be inspected and edited by a human
operator without touching code. The alternative was file-based state (JSON files in the
repo) or an external queue service.

## Decision

Supabase (Postgres) is the single memory layer. All persistent state lives in named
tables: `work_queue`, `change_set`, `snapshots`, `decision_log`, `do_not_touch`,
`outcomes`, `learned_patterns`, `control`, `sitemap_seen`.

Two access patterns coexist:
1. **Service-role direct** (`@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`) —
   used by scripts and CI jobs. Never exposed to a browser.
2. **MCP server** (`@supabase/mcp-server-supabase`) — used by the interactive Claude
   Code session for operator queries and manual overrides.

## Rationale

- Queryable by SQL: the operator runbook uses raw SQL to inspect queues and logs without
  a custom UI.
- Survives across CI runs: state is not lost when a workflow runner terminates.
- Single source of truth: both the orchestrator and the platform packs read the same
  tables; no sync required.
- Supabase's row-level security (not yet enabled) can scope pack access to their own
  platform rows when multi-tenant isolation is needed.

File-based state was rejected: git history is not a queryable memory layer, and JSON
files checked into the repo create merge conflicts between concurrent orchestrator runs.

## Consequences

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required secrets in every workflow
  that touches memory. Missing secrets abort the run.
- The service-role key must never be exposed to the browser or committed to the repo.
- Schema changes require running `sql/schema.sql` (idempotent, uses `IF NOT EXISTS`).
- The `control` table's single row (`id=1`) is the kill switch. Deleting it disables the
  kill switch and the spend guard simultaneously — don't delete it.

## Files affected

- `sql/schema.sql` — canonical schema, idempotent
- `orchestrator/lib/supabase.mjs` — all Supabase helpers
- `scripts/mem.mjs` — Bash-callable wrapper for headless writes
- `.mcp.json` — MCP server config for interactive sessions
