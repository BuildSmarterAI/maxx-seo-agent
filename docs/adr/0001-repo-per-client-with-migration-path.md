# ADR-0001: Repo-per-client architecture with defined migration path to multi-tenancy

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris Khan (BuildSmarter Holdings)

---

## Context

The SEO orchestrator was built as a single-client system for Maxx Builders. Extending it to serve Buzz Digital Agency's client portfolio requires a decision on client isolation architecture.

Two options were evaluated:

- **Option A — Repo-per-client:** Fork this repo for each client. Schema stays single-tenant. Config (CLAUDE.md, .env) is per-repo.
- **Option B — Multi-tenant monorepo:** One repo, one Supabase project. Add `client_id` to all core tables. Orchestrator fans out to all clients.

The current schema has six core tables (`work_queue`, `change_set`, `decision_log`, `outcomes`, `snapshots`, `learned_patterns`) with no tenancy column. Adding one retroactively is a 1–2 day migration.

---

## Decision

**Start with Option A (repo-per-client). Migrate to Option B when the trigger fires.**

**Migration trigger:** 10 active client repos OR Buzz Digital Agency requests a unified cross-client dashboard — whichever comes first.

---

## Rationale

At the current client count (1–5), repo-per-client is strictly better:
- Zero migration cost today
- Blast radius isolation — a runaway orchestrator on one client cannot corrupt another's data
- Per-client billing maps naturally to the `control.spend_usd` cap
- Per-client `CLAUDE.md` operating brain is the system's core design; it fits naturally in per-repo isolation
- Independent deploys — skills can be upgraded per-client without coordinating across all clients

The multi-tenant migration cost (1–2 days) becomes worthwhile only when the operational overhead of N separate repos exceeds it. That crossover happens around 10 active clients or when cross-client reporting is needed.

---

## Migration path constraints (must be followed during Phase A)

These constraints make the eventual Option B migration mechanical rather than archaeological. Violating any of them increases migration cost.

### 1. Canonical `client_id` slug per repo

Every client repo must define a canonical slug immediately — in `config/client.json` or as `CLIENT_ID` in the `.env` template. The slug is kebab-case, URL-safe, and permanent:

```
maxx-builders
buzz-roofing-co
buzz-hvac-pros
```

This slug is not enforced in the DB schema during Phase A, but it becomes the `client_id` value when tables are merged.

### 2. Frozen core schema

`work_queue`, `change_set`, `decision_log`, `outcomes`, `snapshots`, and `learned_patterns` must be **identical** across all client repos. No per-client columns. No per-client constraints. Treat the schema as shared library code — a change applies to all repos on the same version, or not at all.

### 3. Client-prefixed batch names

The orchestrator currently names batches `seo/auto-{date}-{rand5}`. During Phase A, prefix the client slug:

```
maxx-builders/auto-2026-06-24-abc12
buzz-roofing-co/auto-2026-06-24-def34
```

This ensures batch IDs are globally unique across all client repos, so rows can be merged into a single table without collision.

### 4. Extract skills to a shared package before client #5

Skills copied into each client repo and modified locally are the primary source of schema drift. Before onboarding the 5th active client, extract the platform-neutral skills (`.claude/skills/`) into a versioned shared package (e.g., `@buildsmarter/seo-skills` or a git submodule). Client repos pull from this upstream; per-client customization happens through `CLAUDE.md` config, not skill file edits.

---

## Migration procedure (when trigger fires)

1. Collect all client `client_id` slugs and assign each a UUID or integer PK.
2. For each client repo, export all six core tables to CSV with the client's slug as an added column.
3. Merge into the monorepo's unified Supabase project:
   - Add `client_id TEXT NOT NULL DEFAULT ''` to each core table
   - Bulk-load each client's CSV rows
   - Add `NOT NULL` constraint after load
   - Add RLS policies: `WHERE client_id = current_setting('app.client_id')`
4. Update the orchestrator to load per-client config and set `app.client_id` at the start of each run.
5. Archive the per-client repos (read-only; don't delete — audit history lives in git log).

---

## Consequences

**Accepted costs:**
- Skill updates must be patched across N repos until the shared package is extracted (step 4 above caps this at 4 clients).
- No unified escalation dashboard during Phase A. Cross-client visibility requires querying N Supabase projects.
- A global kill switch (pause all clients) requires touching N `control` tables or automating via a script.

**Deferred costs:**
- Multi-tenancy RLS design
- Credential fan-out (GSC, CMS, Supabase per client in one orchestrator)
- Cross-client reporting schema
