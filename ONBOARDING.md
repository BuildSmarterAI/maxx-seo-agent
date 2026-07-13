# Onboarding Guide: maxx-seo-agent

> Structural orientation for developers new to this repo. For **SEO thresholds, entity
> data, and platform rules** read the root [CLAUDE.md](CLAUDE.md); for **how to work
> inside the repo** read [.claude/CLAUDE.md](.claude/CLAUDE.md) and [.claude/rules/](.claude/rules/).

## Overview

An **agentic SEO orchestration platform** for BuildSmarter Holdings / Maxx Builders (a
Texas commercial construction company). It runs a closed-loop cycle — **sensors detect
opportunities → orchestrator dispatches subagents to fix them → a PR is opened → a human
merges → outcomes feed back into prioritization.** Critically, *this repo is the agent
runtime, not the site it optimizes.* The target site is a separate WordPress deployment
this system writes to over an API.

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js **≥22**, pure ES Modules | `.mjs` only, no `require()`, no `.cjs`. Run via `node --env-file=.env` — no `dotenv` |
| Agent loop | `@anthropic-ai/claude-agent-sdk` `0.1.77` | `query()` autonomous loop in [orchestrator/run.mjs](orchestrator/run.mjs) |
| Memory / DB | Supabase Postgres via `@supabase/supabase-js` | All access funnels through [orchestrator/lib/supabase.mjs](orchestrator/lib/supabase.mjs) |
| Sensing | Google Search Console (`googleapis`) + sitemap/CrUX diffs | [scripts/](scripts/) `sensor-*.mjs` |
| Validation | `zod`, `marked`, hand-rolled deterministic guards | [scripts/validators/](scripts/validators/), [scripts/](scripts/) `check-*.mjs` |
| CI/CD | 8 GitHub Actions workflows | [.github/workflows/](.github/workflows/) |
| Model routing | Haiku (judge/sensors) · Sonnet (orchestrator) · Opus (planning) | Set via `ORCHESTRATOR_MODEL` env, **not** hardcoded |
| Tests | Node's built-in `node:test` runner | `npm test` → 34 test files in [test/](test/) |

## Architecture

This is a **single-repo, multi-mode orchestrator**, not a web app. There is no server and
no request/response. The "entry point" is a batch job (`npm run orchestrate`) triggered on
a schedule (nightly sensors) or manually. It runs in one of two modes decided at startup
by the `SITE_PLATFORM` env var:

- **`repo` mode** → agent edits artifact files, `git-delivery.mjs` opens a PR (`runRepo`).
- **`wordpress`/`webflow` (CMS) mode** → agent writes `change_set/` JSON rows for later
  human-approved apply (`runCms`).

```
        ┌─────────────┐   writes to    ┌──────────────┐
        │  SENSORS    │───────────────▶│  work_queue  │  (Supabase)
        │ gsc/sitemap │                └──────┬───────┘
        │ cwv/ai/paa  │                       │ pending, priority-ordered
        └─────────────┘                       ▼
                                     ┌──────────────────┐
                                     │  preflight.check │  paused? budget? do_not_touch?
                                     └────────┬─────────┘
                                              │ {ok, queue}
                                              ▼
                                   ┌────────────────────────┐
                                   │  orchestrator (query)  │  goal prompt = goal.mjs
                                   │  dispatches seo-fixer   │──▶ one subagent per SAFE url
                                   └──────────┬─────────────┘    runs a .claude/skills/ skill
                                     safe     │     gated
                              ┌──────────────┘     └────────────┐
                              ▼                                 ▼
                    repo: PR via git-delivery       escalate → decision_log → Linear
                    cms:  change_set/ JSON row          (human resolves)
                              │
                              ▼  human merges PR / approves apply
                    ┌───────────────────┐
                    │  LEARN (weekly)   │  outcomes → attribute → prioritize → re-rank queue
                    └───────────────────┘
```

## Key Entry Points

- **Orchestrator:** [orchestrator/run.mjs](orchestrator/run.mjs) — thin coordinator;
  `main()` calls preflight, then `runRepo` or `runCms`.
- **Goal prompts:** [orchestrator/goal.mjs](orchestrator/goal.mjs) — the natural-language
  "what to do" the agent follows. **This is the real business logic.** Changing it can
  fail the eval-gate.
- **Memory seam:** [orchestrator/lib/supabase.mjs](orchestrator/lib/supabase.mjs) — every
  table read/write. Raw client stays private in [lib/client.mjs](orchestrator/lib/client.mjs).
- **Headless queue CLI:** [scripts/mem.mjs](scripts/mem.mjs) — how the agent reads/writes
  the queue from Bash (no MCP approval friction).
- **Task vocabulary:** [orchestrator/lib/tasks.mjs](orchestrator/lib/tasks.mjs) — the
  `KIT_TASKS` set is the shared string space joining `work_queue.task` ↔ skill name ↔
  `learned_patterns.change_type`. Keep it in sync when adding a skill.
- **DB schema:** [sql/schema.sql](sql/schema.sql) + [sql/ai-search-schema.sql](sql/ai-search-schema.sql)
  — idempotent, run once in the Supabase SQL editor.

## Directory Map

| Directory | Purpose |
|-----------|---------|
| `orchestrator/` | Entry point (`run.mjs`, `goal.mjs`) + `lib/` seams (Supabase, git delivery, preflight, CMS) |
| `scripts/` | Sensors, validators, eval-judge, `mem` CLI, attribution/learning loop |
| `scripts/validators/`, `scripts/lib/` | Reusable validation + CSV/schema/wp-content helpers |
| `.claude/skills/` | **Action modules** — one skill per SEO task type (16 dirs, each a `SKILL.md`) |
| `.claude/hooks/` | Deterministic guardrails (`guard-write.sh`, `guard-publish.sh`, `post-validate.sh`) — enforced only for the autonomous agent |
| `.claude/rules/` | `workflow.md`, `technical-defaults.md`, `security.md` — detailed operating rules |
| `.claude/agents/` | Subagent definitions (`seo-fixer`, `research-agent`) |
| `packs/wordpress/`, `packs/webflow/` | Live-CMS apply layer (REST / Data API v2) — the platform-specific "APPLY" step |
| `sql/` | Supabase schema (idempotent DDL) |
| `drafts/`, `schema/`, `change_set/`, `output/`, `metadata-changes.csv` | **The only paths the autonomous agent may write** (enforced by `guard-write.sh`) |
| `audit/` | Read-only SEO audit reports + baselines + screenshots |
| `test/` | `node:test` suites, one per module |

## Orchestration Lifecycle (trace one run)

Trace `npm run orchestrate`:

1. **Preflight** — [preflight.check()](orchestrator/lib/preflight.mjs) returns
   `{ok:false, reason}` or `{ok:true, queue}`. It stops on `control.paused`, monthly
   `spend_usd ≥ budget`, or an empty queue, and **parks** any `do_not_touch` URLs that
   slipped in (status `skipped-dnt`).
2. **Mode split** — `SITE_PLATFORM` decides `runRepo` vs `runCms`.
3. **Agent loop** — the SDK `query()` runs with the `goal.mjs` prompt. The agent calls
   `node scripts/mem.mjs queue` (Bash), then for each `risk_class === "safe"` row
   dispatches the inline **`seo-fixer`** subagent to run the named `.claude/skills/` skill
   against the URL.
4. **Risk gate** — anything not `safe` (brand/pricing/YMYL/301/delete/`do_not_touch`) is
   **escalated, not acted on**: a JSON log file → `mem.mjs log --file` → status
   `escalated`. When unclear, escalate.
5. **Validation** — the subagent runs validators (schema JSON-LD, metadata CSV, vitals);
   on failure it reverts that file.
6. **Delivery** — repo mode commits + pushes + opens **one** PR
   ([openPR](orchestrator/lib/git-delivery.mjs)); CMS mode leaves `change_set/` rows for
   human-approved apply. Spend is recorded on *every* terminal path (even crashes) so the
   budget gate can't be flown blind.
7. **CI eval-gate** — the PR triggers [seo-eval-gate.yml](.github/workflows/seo-eval-gate.yml):
   diff-size → content guards → citation density → artifact validators → **Haiku
   LLM-as-judge**. Bot PRs (`seo-auto` label) are enforced; human PRs pass automatically.
8. **Learn (weekly)** — `npm run learn` chains outcomes → attribution → prioritize,
   re-ranking the queue from realized lift.

## Conventions

- **Files:** kebab-case `.mjs`; module header comment explaining *why the seam exists*,
  not just what it does. Tests are `test/<module>.test.mjs` using `node:test`.
- **Dependency injection:** functions take `(args, deps = {})` where `deps` defaults to
  real implementations — this is the dominant testability pattern; follow it for anything
  with I/O.
- **Error handling:** never swallow. Every `.catch()` logs+exits or re-throws. Seam
  helpers `throw new Error("<fn> failed: …")` on DB errors so a missing migration fails
  loudly. Some reads **fail closed** (e.g. `doNotTouch` throws rather than returning an
  empty set, because empty would disable every do_not_touch guard).
- **Security (load-bearing):** untrusted values go through JSON files, never Bash args;
  status changes key on the integer row `id`, not the URL. Never log/echo credentials.
- **Git:** conventional commits (`feat:`, `fix:`, `docs:`), one squash-merged PR per
  change referencing `#NN`. Bot branches are `seo/auto-YYYY-MM-DD-NNNNN`. **Never push to
  `main`.** Attribution is disabled globally.

## Common Tasks

| Task | Command |
|------|---------|
| Run tests | `npm test` |
| Run sensors (populate queue) | `npm run sensors` |
| Full orchestration loop locally | `npm run orchestrate` |
| Read the queue (as the agent does) | `npm run mem queue` |
| Validate a schema artifact | `node scripts/validate-json.mjs schema/<file>.jsonld` |
| Validate metadata CSV | `npm run validate:metadata` |
| Check diff size (mirrors CI gate) | `npm run diff-size` |
| LLM-as-judge on current diff | `npm run judge` |
| Weekly attribution/learning | `npm run learn` |
| Apply approved changes to WordPress (prod!) | `npm run wp:apply` |

## Where to Look

| I want to... | Look at... |
|--------------|-----------|
| Change what the agent *does* | [orchestrator/goal.mjs](orchestrator/goal.mjs) (⚠ affects eval-gate) |
| Add a new SEO task type | New dir in [.claude/skills/](.claude/skills/) **+** add its name to `KIT_TASKS` in [orchestrator/lib/tasks.mjs](orchestrator/lib/tasks.mjs) |
| Add a DB read/write | Extend [orchestrator/lib/supabase.mjs](orchestrator/lib/supabase.mjs) (never inline a client elsewhere) |
| Add a sensor | New `scripts/sensor-*.mjs` that calls `enqueue()` |
| Add a CI quality gate | [.github/workflows/seo-eval-gate.yml](.github/workflows/seo-eval-gate.yml) + a `scripts/check-*.mjs` |
| Change the DB schema | [sql/schema.sql](sql/schema.sql) (idempotent; run in Supabase SQL editor) |
| Understand SEO thresholds/entities | Root [CLAUDE.md](CLAUDE.md) |
| Understand how to work in the repo | [.claude/CLAUDE.md](.claude/CLAUDE.md) + [.claude/rules/](.claude/rules/) |

## Watch Out For (repo-specific gotchas)

- **`README.md` is a stub** (one line). The real docs are `CLAUDE.md`, `.claude/CLAUDE.md`,
  `AGENTS.md`, `CONTEXT.md`, `OPERATIONS.md`, and the `AGENTIC-*` / `AUTORESEARCH-*` design docs.
- **No WordPress staging.** All `wp:apply` runs are **production**. Backup + small-batch +
  verify (per root `CLAUDE.md`).
- **`startBranch` refuses a dirty tree** — the orchestrator's `git add -A` / `reset --hard`
  would otherwise sweep or destroy your WIP. Commit/stash before running it locally.
- **Two credentials, two contexts:** service-role key (CI/headless via `supabase.mjs`) vs.
  personal access token (interactive MCP via `.mcp.json`). Don't cross them.
- **Adding a skill without updating `KIT_TASKS`** silently drops its changes out of
  attribution — they can never join back to a queue task.
