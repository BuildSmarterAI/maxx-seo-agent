# maxx-seo-agent — Claude Code Project Context

Agentic SEO orchestration platform for BuildSmarter Holdings / Maxx Builders. Runs a
closed-loop SEO improvement cycle: sensors detect opportunities → orchestrator plans and
dispatches subagents → PRs are opened → human merges → outcomes feed back into
prioritization. This repo IS the agent runtime, not the site it optimizes. The target
site (Maxx Builders, Texas construction) is a separate WordPress / Webflow / Next.js
deployment that this system writes changes to over an API.

**SEO thresholds, CWV limits, entity data, and platform-specific workflow rules live in
the root `CLAUDE.md`.** Read it first before any SEO task. This file covers how to work
*inside this repository*.

See `.claude/rules/` for detailed rule files.

## Stack

- **Runtime:** Node.js ≥22, ES Modules (`type: "module"`). Run scripts via
  `node --env-file=.env <script>`. No `require()`, no `.cjs` files.
- **Orchestration:** `@anthropic-ai/claude-agent-sdk` — `query()` autonomous loop in
  `orchestrator/run.mjs`. Dispatches an inline `seo-fixer` subagent per queue item.
- **Memory:** Supabase Postgres. All table access goes through
  `orchestrator/lib/supabase.mjs`. `scripts/mem.mjs` is the Bash-callable CLI wrapper
  for headless queue reads/writes.
- **Sensing:** Google Search Console API (`googleapis`) in `scripts/sensor-gsc.mjs` +
  sitemap diff in `scripts/sensor-sitemap.mjs`.
- **CI/CD:** 6 GitHub Actions workflows in `.github/workflows/` — sensors (nightly),
  eval-gate (PR quality check), auto-merge, learn (weekly attribution), apply-cms,
  vitals-pr.
- **CMS Apply:** WordPress REST API and Webflow Data API v2 packs in `packs/`.
- **Skills:** `.claude/skills/` — 16 skills loaded in both interactive and headless
  sessions via `settingSources: ["project"]`.

## Architecture

```
orchestrator/        Entry point (run.mjs) + Supabase/CMS helpers (lib/)
scripts/             Sensors, validators, eval-judge, mem CLI, attribution
.claude/skills/      Action modules — one skill per SEO task type
.claude/hooks/       Deterministic guardrails (guard-publish, post-validate)
.claude/rules/       Detailed rule files (workflow, technical-defaults, security)
.claude/agents/      Subagent definitions for spawning from the orchestrator
packs/               Live-CMS apply layer (WordPress + Webflow)
sql/                 Supabase schema — run once in the SQL editor, idempotent
drafts/              Blog content artifacts from blog-write skill
schema/              JSON-LD artifacts from schema-generate skill
change_set/          Pending CMS changesets (JSON) awaiting human approval + apply
output/              Misc skill output artifacts
```

The orchestrator reads `work_queue` rows, dispatches one `seo-fixer` subagent per
`safe`-class item, validates, and opens a single PR. `gated`-class items are escalated.
The `control` table has a `paused` kill switch and monthly `spend_usd` budget cap.

## Workflow / Technical Defaults

See `.claude/rules/workflow.md` and `.claude/rules/technical-defaults.md`.

## Constraints

- Never push to `main` directly. All changes go through a `seo/auto-*` branch → PR →
  human merge (or auto-merge when all CI checks pass).
- Never commit `.env`, `gcp.json`, or any credential file. All three are gitignored.
- Never delete `drafts/`, `schema/`, or `change_set/` files without explicit
  instruction — they are artifacts the orchestrator and packs depend on.
- Never call `wp post delete`, emit a `301`, or `DELETE FROM` a live table. The
  `guard-publish.sh` hook will deny the tool call (exit 2), but don't attempt it.
- Never modify `.github/workflows/` or `sql/schema.sql` without stating why — both are
  shared infrastructure with downstream CI dependencies.
- Never modify the orchestrator's goal prompt in `run.mjs` without understanding the
  eval-gate judge criteria — the judge scores the diff; a prompt change can change what
  the agent produces and fail the gate.
- Always validate JSON-LD after any edit to `schema/*.jsonld`:
  `node scripts/validate-json.mjs schema/file.jsonld` (the path is passed as an argument,
  not interpolated into evaluated code — see the REC-1 command-injection fix).
- Always run `npm run validate:metadata` after editing `metadata-changes.csv`.
- Budget awareness: check `select month, spend_usd from control where id = 1;` in
  Supabase before starting any loop that will make multiple API calls.
