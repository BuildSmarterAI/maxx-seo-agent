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

- Never push to `main` directly; every change reaches it through a PR. Orchestrator runs
  use `seo/auto-*` branches and `seo-auto`-labelled PRs that auto-merge when checks pass;
  interactive lanes use their own branches (see Parallel Session Operating Model).
- Never commit `.env`, `gcp.json`, or any credential file. All three are gitignored.
- Never delete `drafts/`, `schema/`, or `change_set/` files without explicit
  instruction — they are artifacts the orchestrator and packs depend on.
- Never call `wp post delete`, emit a `301`, or `DELETE FROM` a live table. The
  `guard-publish.sh` hook denies common spellings on the Bash tool (exit 2); treat that
  as a backstop, not the control.
- Never modify `.github/workflows/` or `sql/schema.sql` without stating why — both are
  shared infrastructure with downstream CI dependencies.
- Never modify the orchestrator's goal prompt (`orchestrator/goal.mjs`) without
  understanding the eval-gate judge criteria — the judge scores the diff; a prompt
  change can change what the agent produces and fail the gate.
- Always validate JSON-LD after any edit to `schema/*.jsonld`:
  `node scripts/validate-json.mjs schema/file.jsonld` (the path is passed as an argument,
  not interpolated into evaluated code — see the REC-1 command-injection fix).
- Always run `npm run validate:metadata` after editing `metadata-changes.csv`.
- Budget awareness: check `select month, spend_usd from control where id = 1;` in
  Supabase before starting any loop that will make multiple API calls.

## Parallel Session Operating Model

**Scope: interactive sessions.** Skip this section when `orchestrator/run.mjs` started
you: your prompt says "You are the SEO orchestrator", or you are its subagent assigned
one queue URL. Your goal prompt and `.claude/rules/workflow.md` govern you. Where present,
`~/.claude/docs/parallel-session-doctrine.md` (preflight detail, completion contract,
lane utilities) and `~/.claude/docs/review-doctrine.md` (review ownership, finding
disposition) add detail; the rules below stand without them.

### Repository boundary

- Sessions here work for `BuildSmarterAI/maxx-seo-agent` only. Confirm identity with
  `gh repo view --json nameWithOwner -q .nameWithOwner` and `git rev-parse --show-toplevel`
  at startup and before dispatching an agent, messaging, opening a PR, merging, or
  applying to a CMS. Print remote URLs only in sanitized form.
- Message a session only after verifying it belongs to this repository; unknown ownership
  means do not send. Address recipients individually, never a global channel or another
  repository's coordinator or workers.
- Report cross-repository dependencies to Harris in the current session. Contacting
  another repository takes Harris's explicit authorization naming destination and purpose.

### Lanes

- A **lane** is one Linear `SEO` ticket, one implementation owner, one branch
  (`<type>/seo-<n>-<slug>`), one worktree (`C:\dev\wt-maxx-seo-agent-<slug>`), one PR.
  The orchestrator's `seo/auto-*` branches are its own; interactive lanes never use that
  prefix. The main checkout is the **control plane**: coordination, inspection,
  integration.
- Before an implementation session's first edit, read toplevel, branch,
  `git status --short`, HEAD and `git worktree list`. Stop and report when the toplevel is
  the control plane, the branch is `main`, dirty files are unexplained, or another live
  lane holds the same ticket or surface.
- One writer per worktree. Conversations share one filesystem, and a worktree isolates
  git state only: credentials (`.env`, `gcp.json`), production Supabase, CMS hosts and
  messaging stay shared.
- Shared contracts (`sql/schema.sql`, `orchestrator/lib/supabase.mjs`,
  `orchestrator/goal.mjs`, `.github/workflows/`, `change_set/` and `metadata-changes.csv`
  formats, `packs/`) take one owner at a time; serialize lanes that overlap them.
- Preserve unrelated changes and every listed worktree.
- Declare at startup and in each handoff: repository; session name (`maxx-seo-agent` for
  the coordinator, else `maxx-seo-agent:<role>:<ticket|workstream|release>`); ticket;
  branch, worktree and HEAD; scope and authorized actions.

### Roles

| Role | Owns | Leaves to others |
|---|---|---|
| Coordinator (control plane) | Assignments, dependencies, blockers, Linear status, integration order; one implementation owner per ticket | Feature code; dismissing a review finding without a recorded disposition |
| Planner / Architect | Evidence-backed plans, contracts, task boundaries, acceptance criteria, validation steps | Implementing, dispatching, merging, applying; changing an active worker's scope |
| Worker | One lane: implementation, its tests, a reviewable handoff | Other worktrees, merging, applying; scope growth not raised with the coordinator |
| Reviewer | Independent review of a named base..head SHA; findings with evidence; unverified behavior named | Editing the implementation, merging, applying |
| QA / Release verifier | Integrated behavior, critical flows, integration boundaries | Production writes, applying, fixing code, unless separately authorized |
| Research (planner or specialist) | Sourced findings and recommendations | Application code, assigning work |

QA has no staging: WordPress and the documented Supabase project are production. Its
isolated environment is `npm test` plus read-only inspection; any CMS or Supabase write
is an apply.

### Tracking

- Linear team `SEO` owns assignments, decisions, dependencies and ticket status. The
  GitHub PR owns the diff, reviews and validation evidence. Link both ways: `SEO-<n>` in
  branch and PR title, PR URL on the ticket. Tracker conventions:
  `docs/agents/issue-tracker.md` (added by PR #103).
- The PR description records: ticket, owner and role, plan reference, base and head SHA,
  scope and dependencies, acceptance criteria, validation commands with the output read,
  review dispositions, blockers, next action.

### Review, integration, authority

- Workers self-check (`npm test`, validators in `rules/workflow.md`) before review. A
  review names its head SHA; a material change after review gets that change reviewed.
- The coordinator owns integration: order, readiness disposition, and re-running
  `npm test` on `main` after each merge. Green branches do not prove the combination.
- Execution of a merge, CMS apply or publish follows existing policy (`main` branch
  protection, `seo-auto-merge` for `seo-auto` PRs, ADR-0002, root `CLAUDE.md` apply rules)
  and Harris's authorization. A standing authorization covers the actions it names until
  withdrawn; ask again only for actions outside it.
- Claims that tests passed or an apply succeeded cite the command and the output read
  this session.

### Communication and stop conditions

- Send actionable updates only: handoff complete, blocker, scope conflict, failed
  validation, decision required. Wait for replies rather than polling.
- Workers raise plan gaps to the coordinator; the coordinator routes material
  architecture questions to the planner.
- When repository identity, ownership, authorization or a safe task boundary cannot be
  established, stop that action, report which check failed, and continue other
  authorized work.
- Spawn agents only when the session's assignment authorizes delegation.

### Controls are partial

Everything in this section is behavioral; repository boundary, messaging, roles and one
writer per worktree have no technical enforcement. The technical controls are narrow:
`main` protection (required `test` and `eval-gate` checks; admins exempt; no required
reviews), `guard-publish.sh` (pattern denylist on the Bash tool only; hooks fail open),
and per-machine `permissions.deny` rules. A blocked spelling does not mean an equivalent
action is blocked.
