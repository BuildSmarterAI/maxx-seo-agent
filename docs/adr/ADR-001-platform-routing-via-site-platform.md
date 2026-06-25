# ADR-001 — Platform routing via SITE_PLATFORM env var

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

The orchestrator needs to know whether to produce git-branch file edits (repo path) or
Supabase `change_set` rows (CMS path) for each run. The `work_queue` has no platform
column. Two options were considered: a per-run env var vs. a per-row column on the queue.

## Decision

Use a single `SITE_PLATFORM` env var (`repo` | `wordpress` | `webflow`). One value per
repo instance. All URLs in a given run are treated as the same platform.

## Rationale

The repo is already instantiated once per client. A per-row queue column adds schema
complexity and sensor changes without delivering value until a client has mixed-platform
needs. That is a future problem.

## Consequences

- The orchestrator branches on `IS_CMS` at startup, not per-URL.
- Adding a new platform requires a new env var value and a new `runCms`-style handler.
- Mixed-platform clients (WordPress + Webflow in one install) are not supported in this
  design. If that need arises, add a `platform` column to `work_queue` and revisit.

## Files affected

- `orchestrator/run.mjs` — reads `SITE_PLATFORM`, routes to `runRepo()` or `runCms()`
- `.github/workflows/seo-sensors.yml` — passes `vars.SITE_PLATFORM` to the orchestrate step
