# Session Handoff

## Transfer

- **From:** Home computer (`C:\dev\maxx-seo-agent`)
- **To:** Office computer
- **Date:** 2026-07-10
- **Repository:** `maxx-seo-agent` (`https://github.com/BuildSmarterAI/maxx-seo-agent.git`)
- **Branch:** `docs/agent-roster-prd-salvage`
- **Upstream:** none at time of writing → set to `origin/docs/agent-roster-prd-salvage` by this session's push

## Objective

Salvage the **Agent Roster PRD** that was drafted 2026-06-24, never merged (closed PR #17), and
left to rot on the `docs/agent-roster-prd` branch for ~110 commits. Land it on `main` as
`docs/agent-roster.prd.md`, **reconciled against current `main`** so a future session reads an
accurate spec rather than a stale one.

Intended outcome: agents **A (CMO Reporter)**, **C (Link Prospector)**, and **D (GBP Agent)**
remain buildable from this document as written; agent **E** is marked SHIPPED so nobody rebuilds
it; agent **B** is narrowed to the only part that is actually missing (its drafting skill).

## Work completed

1. **Recovered the PRD** from the abandoned `docs/agent-roster-prd` branch.
2. **Reconciled every claim against `main`.** Four claims were false by 2026-07-10 and were
   corrected in place rather than left to mislead (documented in the PRD's own
   "Reconciliation note (2026-07-10)" table):
   - Agent **E — Competitor Watch** was specced as new work; it is **shipped** under ADR-007
     (`classify-competitors.mjs` + `competitor_domains` + the analyst gate in
     `analyze-citation-events.mjs`). Marked **do not rebuild**.
   - Agent **B**'s sensing half is **shipped** (`sensor-ai-referrals.mjs`,
     `collect-outcomes.mjs`, `attribute-conversions.mjs`). Only the `cro-audit`/`cro-optimize`
     drafting skill remains.
   - The outcome metric `conversions` is superseded by `organic_conversions` / `ai_conversions`;
     conversion attribution goes to the separate `learned_patterns_conv` table.
   - `work_queue.source = 'competitor'` was never adopted; shipped citation enqueues use
     `source: "citation"`.
3. **Fixed one factual defect found during this handoff's validation pass** (see *Files changed*):
   the PRD asserted the uppercase ADR series runs `ADR-001`–`ADR-010`. **ADR-010 does not exist
   on `main`** — it exists only on the unmerged PR #94 branch. Rephrased to `ADR-001` onward,
   which is both true today and does not rot when ADR-011 lands.

## Files changed

| File | Why it changed |
|---|---|
| `docs/agent-roster.prd.md` | **New** (230 lines, commit `a0bedb4`). The salvaged + reconciled PRD. Adds the 2026-07-10 reconciliation note, marks E shipped, narrows B to its drafting skill, corrects the outcome-metric and `source` enum claims. |
| `docs/agent-roster.prd.md` | **Amended** (checkpoint commit). One line: `ADR-001`–`ADR-010` → `ADR-001` onward. ADR-010 is unmerged (PR #94); pinning the endpoint was both wrong and a rotting number. |
| `.claude/handoffs/docs-agent-roster-prd-salvage.md` | **New.** This file. |
| `.claude/SESSION_HANDOFF.md` | **Rewritten as a pointer.** It was dated 2026-07-03 and self-claimed to "supersede ALL earlier handoff versions" while the authoritative doc had moved to root `SESSION_HANDOFF.md` (last updated 2026-07-09, commit `4bfcdaf`). A stale file claiming supremacy is a cross-machine trap; it now redirects to root + this branch handoff. |

**No source, schema, workflow, or credential file was touched.** This branch is documentation only.

## Commits on this branch

Ahead of `origin/main` by 1 commit at session start, 2 after checkpoint:

| Commit | Subject |
|---|---|
| `a0bedb4` | `docs: salvage agent-roster PRD, reconciled against main` |
| *(checkpoint)* | `wip: checkpoint agent-roster PRD salvage for office handoff` — ADR-010 fix + handoff docs |

## Important decisions

- **PRD is corrected in place, not annotated.** A salvaged doc that carries known-false claims
  behind a "note: some of this is stale" banner re-creates the problem it was salvaged to fix.
  Every false claim was rewritten and the delta recorded in the reconciliation table.
- **Agent E is explicitly fenced off.** The shipped implementation (analyst gate on citation
  *transitions*, `AIO_SAMPLES` majority-vote) is strictly better than the PRD's original
  "trailing-window threshold" design. Any follow-on must be specced against ADR-007, not this PRD.
- **Conversion attribution stays separate.** `attribute-conversions.mjs` writes
  `learned_patterns_conv`, deliberately *not* the shared `learned_patterns` — folding them in
  would rescale the GSC anchor. Any Agent-B work must preserve this split.
- **No rotting numbers in ADR references.** Hence `ADR-001` onward rather than a pinned endpoint.
- **Roster runs Haiku + Sonnet only, no Opus** — protects the metered credit pool.
- **`.claude/SESSION_HANDOFF.md` demoted to a pointer** rather than deleted, so existing links and
  any muscle-memory `Read .claude/SESSION_HANDOFF.md` land on a signpost instead of stale truth.

## Current state

- **Working tree:** clean after the checkpoint commit. No stashes.
- **Works:** the PRD is complete, internally consistent, and every file path and `file:line`
  citation it makes resolves against `main` (verified — see *Validation performed*).
- **Incomplete:** nothing on this branch. The PRD *describes* unbuilt work (agents A, C, D and
  B's drafting skill); none of it is started, and per instruction none was started this session.
- **Worktree check:** no other worktree has `docs/agent-roster-prd-salvage` checked out. The two
  other worktrees hold unrelated branches (`feat/a8-repo-risk-gate` → PR #93, locked;
  `office/continue-2026-07-07` → 8 behind `origin/main`, no unique commits).

## Validation performed

| Command | Result | Status |
|---|---|---|
| `npm test` (`node --test`) | `tests 388 · pass 388 · fail 0` (13.7s) | **PASSED** |
| `npm run validate:metadata` | `all agent-generated rows valid (2 rows checked)`, exit 0 | **PASSED** |
| Existence check of all 15 file paths cited by the PRD | all 15 resolve | **PASSED** |
| `sql/ai-search-schema.sql:81` → `competitor_domains` | line 81 is exactly `create table if not exists competitor_domains (` | **PASSED** |
| `sql/schema.sql:36` → `organic_conversions` | line 36 is the `metric` column comment listing `organic_conversions` | **PASSED** |
| `git cat-file -e origin/main:docs/adr/ADR-010-*.md` | **ABSENT on `main`** (present only on PR #94 branch) | **FAILED → fixed** (PRD line 10 rephrased) |
| `git check-ignore .env` / `gcp.json` | both IGNORED | **PASSED** |
| Secret scan of tracked files | one match: `AGENTIC-SETUP.md:102` = `sk-ant-...` literal placeholder, pre-existing on `main`, unchanged by this branch | **PASSED** (no exposure) |
| `npm run typecheck` | script does not exist in this repo | **NOT RUN** (n/a) |
| `npm run lint` | script does not exist in this repo | **NOT RUN** (n/a) |
| `npm run build` | script does not exist in this repo | **NOT RUN** (n/a) |
| `npm run diff-size` | not run — mirrors a CI gate for `seo/auto-*` orchestrator diffs; this is a hand-authored docs branch | **NOT RUN** (out of scope) |
| `npm run judge` | not run — LLM judge burns metered `ANTHROPIC_API_KEY` credit; the eval-gate judge is label-gated on `seo-auto` and will not fire on this human PR | **NOT RUN** (deliberate) |

## Known failures or blockers

- **None blocking this branch.**
- **Pre-existing, unrelated:** `docs/agent-roster.prd.md` emits markdownlint warnings
  (`MD028` blank-line-in-blockquote, `MD060` table-pipe spacing) in the IDE. The repo has **no
  lint script and no markdown lint gate in CI**, and the same warnings occur on other repo docs.
  Not fixed — out of scope, and fixing would churn the diff.
- **Forward reference:** the PRD cites `ADR-007`, which is on `main`. It no longer cites ADR-010.
  If PR #94 merges, nothing in this doc needs updating.
- **Environment:** `npm run validate:metadata` needed `.env` (present on home machine, gitignored).
  The office machine must recreate `.env` + `gcp.json` before any `--env-file=.env` script runs.

## Exact next actions

1. **Open the PR** for `docs/agent-roster-prd-salvage` → `main` (docs-only, zero risk) and let CI
   run. *(Authorized and executed this session — verify it exists rather than re-creating it.)*
2. **Decide merge order against the 3 other open PRs** — #92 (citation self-domain + NaN guards),
   #93 (A8 repo risk gate), #94 (ADR-010 escalation mirror). They touch disjoint files; this PR
   touches only `docs/` + `.claude/handoffs/`, so it conflicts with none.
3. **Merge this PR** (human merge — never self-merge per repo constraints).
4. **Then plan Phase 1 — Agent A (CMO Reporter)**, the PRD's P0 keystone: read-only weekly-digest
   observer, Haiku, no `work_queue` rows, no gate. Start with a brainstorming pass.
5. **Before writing Agent B**, re-read the PRD's open question on `cro-audit` vs `cro-optimize`
   naming and whether `cro-optimize` should read `learned_patterns_conv`. That decision is unmade.

## Files to inspect first

Read in this order before editing anything:

1. `CLAUDE.md` (root) — SEO thresholds, entity truth, production-only WordPress policy.
2. `.claude/CLAUDE.md` — how to work inside this repo.
3. `SESSION_HANDOFF.md` (root) — **authoritative** repo-wide state as of 2026-07-09.
4. `.claude/handoffs/docs-agent-roster-prd-salvage.md` — this file, branch-specific truth.
5. `docs/agent-roster.prd.md` — the artifact this branch exists to land.
6. `docs/adr/ADR-007-ai-overview-citation-intelligence.md` — governs the shipped Agent E.
7. `.claude/rules/workflow.md` — risk-class discipline, branch/PR rules.

## Risks

- **Regression:** none. Documentation-only branch; no code, schema, workflow, or CI path touched.
  `npm test` is 388/388 on this branch.
- **Security:** none introduced. `.env` and `gcp.json` confirmed gitignored; no credential value
  appears in any changed file. The one `sk-ant-...` string in `AGENTIC-SETUP.md` is a literal
  placeholder that predates this branch.
- **Data integrity:** none. No Supabase DDL, no `work_queue`/`change_set` writes, no migration.
- **Tenancy:** the PRD's `link_prospects` table (unbuilt) inherits the ADR-0001 frozen-schema
  constraint — it must be identical across client repos and gains `client_id` at the multi-tenant
  migration. A future implementer who ignores this creates cross-repo drift.
- **Integration:** none. No external API is called by this branch.
- **Deployment:** none. This repo is the agent runtime; nothing here publishes to the live site.
- **Documentation risk (the real one):** this PRD is a *spec for unbuilt work*. Its accuracy decays
  as `main` moves. It carries a dated reconciliation note for exactly that reason. **Re-verify its
  claims before building agent A, B, C, or D** — do not trust it cold.

## Actions requiring approval

| Action | Status |
|---|---|
| Commit | **Authorized** by operator ("COMMIT AND PUSH TO PR") — done |
| Push to `origin/docs/agent-roster-prd-salvage` | **Authorized** — done |
| Open pull request | **Authorized** — done |
| **Merge the PR** | **NOT authorized.** Human merge only; never self-merge (repo constraint). |
| Deployment | **NOT authorized** and not applicable. |
| Supabase migration / DDL | **NOT authorized.** Requires an individually-named go-ahead. |
| Remote data changes (WordPress / Supabase / Linear) | **NOT authorized.** |
| Destructive git (branch delete, force-push, reset, worktree remove) | **NOT authorized.** Note the 20 merged remote branches listed in root `SESSION_HANDOFF.md §7` still await operator deletion. |

## Office startup commands

```powershell
cd C:\Users\Harris87\Documents\GitHub\maxx-seo-agent
git status
git fetch --prune origin
git switch docs/agent-roster-prd-salvage
git pull --ff-only origin docs/agent-roster-prd-salvage
git status
git log --oneline --decorate -10
```

Then verify state matches this handoff before editing:

```powershell
git rev-parse HEAD
git rev-parse "@{upstream}"
git worktree list
git stash list
gh pr list --state open
npm test
```

Expected: `HEAD` == `@{upstream}`, clean tree, no stashes, `npm test` 388/388, and 4 open PRs
(#92, #93, #94, plus this branch's PR).

> `.env` and `gcp.json` are gitignored and **do not transfer**. Recreate them before running any
> `node --env-file=.env` script (`npm run validate:metadata`, `npm run mem`, sensors). `npm test`
> needs neither.
