# AGENTS.md — maxx-seo-agent

Non-discoverable landmines and workflow gotchas only. Everything else (architecture,
SEO thresholds, env-var table, npm-script reference) is in the files below — read them.

## Source of truth (read before any task)

This repo's real spec is split across three places that a non-Claude agent won't find on its own:
- **Root `CLAUDE.md`** — SEO thresholds, CWV limits, entity/NAP data, doorway guardrails, never-touch list.
- **`.claude/CLAUDE.md`** — how to work inside this repo (stack, architecture, constraints).
- **`.claude/rules/`** — `workflow.md`, `technical-defaults.md`, `security.md` (risk classes, validators, credentials).

## Landmines

- **The orchestrator wipes the working tree on failure.** `orchestrator/lib/git-delivery.mjs`
  `rollback()` runs `git reset --hard` then deletes the branch on any error or no-change run.
  Commit or stash uncommitted work before `npm run orchestrate` — it will be discarded otherwise.
- **`.claude/hooks/guard-publish.sh` hard-denies (exit 2)** destructive CMS/DB calls: `wp post delete`,
  emitting a `301`, `DELETE FROM` on a live table. Don't attempt them — the tool call fails.
- **Never push to `main`.** All changes flow through a `seo/auto-YYYY-MM-DD-NNNNN` branch → one PR →
  human merge or `seo-auto-merge` workflow. Never manually merge/rebase/squash PRs.
- **`drafts/`, `schema/`, `change_set/` are runtime artifacts** the orchestrator and `packs/` apply layer
  depend on — never delete without explicit instruction.
- **Don't edit the goal prompt in `orchestrator/run.mjs`** without understanding the eval-gate judge
  (`scripts/eval-judge.mjs`) — a prompt change alters the diff and can fail the CI gate.
- **Repo root and `drafts/` carry many untracked scratch files** (`tmp_*.mjs`, `cleanup_*.mjs`,
  `*-review.md`, ad-hoc `scripts/gen_*`). These are not part of the runtime — don't treat them as canonical.

## Commands / environment

- **Windows + PowerShell is primary.** Run scripts via `node --env-file=.env <script>` — there is no
  `dotenv` dependency, the env file is loaded by Node. Use the `npm run *` aliases (see `package.json`).
- **Tests:** `npm test` → `node --test` (Node's built-in runner; no Jest/Vitest).
- **PowerShell + Supabase Mgmt API SQL:** do NOT `ConvertTo-Json` the SQL string when POSTing to the
  `database/query` endpoint — it serializes the query as an object and returns 400. Pass the raw body.
- **Supabase has two credential paths:** interactive sessions use `SUPABASE_ACCESS_TOKEN` via MCP;
  CI/headless uses `SUPABASE_SERVICE_ROLE_KEY` through `orchestrator/lib/supabase.mjs`. Don't write
  inline Supabase clients elsewhere — extend that file.

## Before acting

Check the queue (`node scripts/mem.mjs queue`), the `control.paused` kill switch, and the
`do_not_touch` table in Supabase. A URL in `do_not_touch` is off-limits regardless of the queue.
Classify every action `safe` vs `gated` (see `.claude/rules/workflow.md`); when unclear, escalate.
