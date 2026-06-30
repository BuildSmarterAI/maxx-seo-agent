# Session Handoff — 2026-06-30 (audit + fix sprint)

> You're reading this on branch **`chore/repo-audit-2026-06-30`**, which also holds the full
> audit at `docs/REPOSITORY-AUDIT-2026-06-30.md`. This is a point-in-time handoff so the work
> can continue from another machine. `git fetch` first — `origin/main` moved during the session.

## TL;DR
Ran a 12-phase engineering audit of the repo, then shipped the top findings as **6 open PRs**
(all CI-green as of this writing, none auto-merged — each is labelled for human review, NOT
`seo-auto`). Nothing is merged yet. The biggest is the **P0 command-injection fix (#38)**.

## Read order to get oriented
1. This file.
2. `docs/REPOSITORY-AUDIT-2026-06-30.md` (on this branch) — the full 12-phase audit, ranked risks, REC-1…REC-17.
3. The 6 PRs below (each PR body is self-contained).

## Open PRs (all branched off `origin/main`; review/merge from GitHub)

| PR | Branch | Finding | Touches | Apply-step before/after merge |
|---|---|---|---|---|
| **#38** | `fix/cms-command-injection` | **REC-1/REC-2 (P0 critical)** — eliminate command injection on the autonomous CMS path; replace Bash denylist with a fail-closed, env-gated allowlist; scope the agent's new Write tool; replace the `node -e` validator | `payload.mjs`(new), `cms-read.mjs`(new), `validate-json.mjs`(new), `seo-keys.mjs`(new), `guard-write.sh`(new), `mem.mjs`, `run.mjs`, `goal.mjs`, `supabase.mjs`, `apply.mjs`, hooks, `settings.json`, `test/payload.test.mjs` | Confirm the job that runs `runCms` passes `WP_*`/`WEBFLOW_*` for `cms-read` (`seo-apply-cms.yml` does; `seo-sensors.yml` doesn't). |
| **#40** | `fix/ai-search-contracts` | **REC-4** — task-vocabulary fix (`internal-link-graph`/`entity-authority`/`faq-schema` → `KIT_TASKS`); route `link-graph.mjs` through `enqueue()`+`do_not_touch`; stop the weekly `learned_patterns` clobber via a separate `learned_patterns_geo` table | `tasks.mjs`, `tasks.test.mjs`, `ai-search-schema.sql`, `attribute-citations.mjs`, `link-graph.mjs` | Apply updated `sql/ai-search-schema.sql` in Supabase (creates `learned_patterns_geo`; idempotent). |
| **#33** | `fix/atomic-spend-counter` | **REC-9** — atomic `increment_spend` RPC + single CMS cost accounting | `supabase.mjs`, `run.mjs`, `schema.sql`, `test/spend.test.mjs` | Apply updated `sql/schema.sql` in Supabase (creates `increment_spend`; idempotent). Safe before apply (code falls back). |
| **#36** | `fix/content-pr-eval-gate` | **REC-3** — stop hardcoding `[skip ci]` on repo-mode content PRs (was dead-locking delivery). *(Replaced #32, which I closed.)* | `run.mjs` | Verify branch protection **requires** the `eval-gate` check. |
| **#34** | `fix/check-vitals-script` | **REC-6** — commit the missing `check-vitals.sh` PSI canary; stop false-failing on tool errors | `scripts/check-vitals.sh`(new), `packs/webflow/publish.mjs` | Optional `PAGESPEED_API_KEY` for higher PSI quota. |
| **#35** | `chore/pin-volatile-deps` | **REC-12 (partial)** — pin the Supabase MCP server version (drop `@latest`) | `.mcp.json` | — |

## Merge-order caveats
- `origin/main` advanced to **#37** (auto-classify cited competitor domains) during the session. #33–#38 were branched off the prior main, so their bases are slightly behind — GitHub diffs against the merge-base so they review fine, but a base-update/rebase may be wanted.
- **#33 and #38 both touch `run.mjs` (`runCms`) and `supabase.mjs`** → expect a trivial conflict on the second-merged; resolve by keeping both changes (the single-accounting refactor + the `SEO_AGENT_GUARDED` line + the `addSpend` RPC).
- **#40 is disjoint** from all the others (no overlap).

## IMPORTANT operational note — the env-gated hooks (from #38)
After #38 merges, `.claude/hooks/guard-publish.sh` and `guard-write.sh` enforce a **strict allowlist
/ write-scoping ONLY when `SEO_AGENT_GUARDED=1`** (set by `orchestrator/run.mjs` for the autonomous
agent). Interactive Claude Code sessions leave it unset → lenient (the original denylist; all normal
dev commands allowed). This matters: an earlier draft applied the strict allowlist to ALL sessions
and locked the interactive session out of `git`/`npm`/editing `.claude/` — the env gate is the fix.
If you ever see "DENIED by guard-publish/guard-write" in an interactive session, `SEO_AGENT_GUARDED`
is set in your env — unset it.

## Open follow-ups (audit findings NOT yet done — pick up here)
- **REC-5 / AH1 (HIGH, safety):** the `do_not_touch` agent-side check is a no-op — `seo-fixer` runs
  `mem.mjs queue` (reads `work_queue`), not `do_not_touch`. Add a real `mem.mjs dnt <url>` command
  (uses the existing `doNotTouch()` helper) + an apply-boundary check in `orchestrator/lib/cms.mjs`,
  and fix the `seo-fixer` step-2 instruction. (P0 #38 already added Write-scoping + the allowlist;
  this is the remaining protected-URL gap.)
- **REC-7:** test `git-delivery.mjs` (runs `git reset --hard` on failure) and `preflight.mjs`
  (budget/kill-switch gate) — the untested destructive/money paths.
- **GEO blend (ADR):** `learned_patterns_geo` now persists (PR #40) but isn't read by `prioritize.mjs`
  yet. Decide how to blend the citation delta with the GSC lift (incompatible scales) and wire it.
- **REC-12 remainder:** exact-pin the agent SDK + declare `zod` — both need a `package-lock.json`
  change (lockfiles are "Never touch" — needs an explicit OK or run `npm install`).
- **REC-8/REC-10/REC-11:** consolidate the two Supabase clients + two schema files; README/doc index
  + repoint the phantom ADR links in `CONTEXT.md`; de-dupe markdown→HTML + the re-introduced CSV bug.
- **Untracked `.codex/` harness (AH3):** still carries the old `node -e` pattern and the broken
  `do_not_touch` check; reconcile from the `.claude` sources or remove. (It is NOT git-tracked.)

## Local artifacts NOT in the repo
- Plan for the P0: `~/.claude/plans/p0-command-injection-cozy-parasol.md` (your home dir, not pushed).
  REC-4 and the P0 are both DONE (PRs #40 and #38); the plan is reference only.

## To resume in a new session
1. `git fetch origin`
2. Read this file + the audit doc (`git show chore/repo-audit-2026-06-30:docs/REPOSITORY-AUDIT-2026-06-30.md`, or check out this branch).
3. Review/merge the 6 PRs (apply the Supabase SQL steps noted above), or start **REC-5/AH1** as the next fix.
