# Session Handoff — 2026-06-30 (audit sprint SHIPPED; home continuation)

> You're reading this on branch **`chore/repo-audit-2026-06-30`**, which also holds the full
> audit at `docs/REPOSITORY-AUDIT-2026-06-30.md`. Point-in-time handoff for cross-machine
> continuation. **`git fetch --all` first** — `origin/main` advanced to `0f99e32` during the
> office sessions. This file was rewritten at the home machine after all 7 audit PRs merged; it
> **supersedes** the earlier "6 PRs still open" version (that state is now stale).

## TL;DR
The 12-phase audit is done and **all 7 audit-sprint PRs are MERGED to `origin/main` (HEAD
`0f99e32`).** Local `main` (`962ed20`) is a clean fast-forward, 9 behind. Four PRs remain open
(#14 feature + #17/#18/#19 preservation). One correction: **REC-5/AH1 is only ~¼ done** — PR #41
closed just one of its four sub-items (see §4). The one branch that held unpushed unique work
(`worktree-grill-docs-reconcile`) has been pushed to origin as a backup.

---

## 1. Shipped — merged to `origin/main` (verified via `gh pr list` + `git log origin/main`)

| PR | Commit | Finding | Post-merge apply step |
|---|---|---|---|
| **#38** | `62fae8f` | **P0** — eliminate command injection on the CMS path (REC-1/REC-2); fail-closed env-gated allowlist; Write-scoping; `node -e`→`validate-json.mjs` | See §"env-gated hooks" below |
| **#40** | `3af9a63` | REC-4 — task-vocabulary fix (`KIT_TASKS`); route `link-graph.mjs` through `enqueue()`+`do_not_touch`; `learned_patterns_geo` table (stops weekly clobber) | Apply `sql/ai-search-schema.sql` in Supabase (idempotent) — **verify done (§3)** |
| **#33** | `15a828c` | REC-9 — atomic `increment_spend` RPC + single CMS cost accounting | Apply `sql/schema.sql` in Supabase (idempotent) — **verify done (§3)** |
| **#36** | `4a796cb` | REC-3 — stop hardcoding `[skip ci]` on repo-mode content PRs | Confirm branch protection **requires** the `eval-gate` check |
| **#34** | `02837e6` | REC-6 — commit missing `check-vitals.sh` PSI canary; stop false-failing | Optional `PAGESPEED_API_KEY` for higher PSI quota |
| **#35** | `1054a68` | REC-12 (partial) — pin Supabase MCP server version (drop `@latest`) | — |
| **#41** | `0f99e32` | REC-5/AH1 (**PARTIAL** — see §4) — route PAA + AI-citation sensors through `enqueue()` (`do_not_touch` + dedup) | — |

Also already on `main` from earlier in the session: **#37** (`9405fcc`, auto competitor-classifier)
and **#39** (`7dce4bb`, `COMPETITOR_MIN_CONFIDENCE=0.85` wired into the citation sensor).
`competitor_domains` was backfilled with 83 domains (36 competitor / 38 reference / 9 noise).

## 2. First moves from home
1. `git fetch --all --prune` (done) → fast-forward local `main`: `git checkout main && git merge --ff-only origin/main`.
2. Decide next work — the top open item is now **REC-5/AH1 completion (§4)**, the highest-value
   remaining safety fix. Cut a fresh worktree off `origin/main`, don't reuse a stale one.
3. Housekeeping when convenient: worktree/branch prune (§7) and open a PR for this audit branch.

## 3. ⚠️ VERIFY (merged, but confirm before relying on the loop)
- **Supabase schema for #40 + #33.** Both PRs need their SQL applied (idempotent, apply via the
  Management API per standing practice — do NOT ask for the SQL editor). Re-run
  `sql/ai-search-schema.sql` (→ `learned_patterns_geo`) and `sql/schema.sql` (→ `increment_spend`
  RPC) to be safe. Code falls back gracefully if absent, but the loop isn't fully wired until both exist.
- **GitHub Actions `ANTHROPIC_API_KEY` secret** — value still unconfirmed. eval-gate passed on the
  merged PRs (good sign it's funded), but verify before relying on the Monday cron / orchestrator —
  all die on a dead key. Local note: a **stale `$env:ANTHROPIC_API_KEY`** (`…api03-I…`, dead/401) can
  shadow the funded key in `node --env-file` runs — remove it from the PowerShell profile / Windows env.

## 4. ⚠️ CORRECTION — REC-5/AH1 is NOT fully closed (only sub-item (a) done)
The earlier handoff and PR #41's framing imply the `do_not_touch` gap is closed. It is not — verified
against current `origin/main`. REC-5/AH1 had **four** sub-items; #41 did one:
- **(a) DONE** — `sensor-paa.mjs` + `sensor-ai-citations.mjs` now route through `enqueue()` with
  `doNotTouch()` filtering + dedup (matches what #40 did for `link-graph.mjs`).
- **(b) OPEN** — no `dnt` CLI: `scripts/mem.mjs` dispatch handles only `queue/apply/changeset/log/status`.
  The `doNotTouch()` helper exists in `supabase.mjs` but is never exposed as `node scripts/mem.mjs dnt <url>`.
- **(c) OPEN** — no apply-boundary check: `orchestrator/lib/cms.mjs` `applyRow()` gates on
  `supports → snapshot → drift → write → verify` and **never consults `do_not_touch`** before `adapter.write(row)`.
  `cms.mjs` doesn't even import `doNotTouch`.
- **(d) OPEN (live bug)** — `.claude/agents/seo-fixer.md:32` still tells the agent to check `do_not_touch`
  via `node scripts/mem.mjs queue`, but that runs `pendingQueue()` which reads the **`work_queue`** table,
  not `do_not_touch` (`supabase.mjs` ~L74) — it reads the wrong table and would never abort on a protected URL.

→ **Next-fix candidate:** finish (b)+(c)+(d). Small, well-scoped, `safe`-class code + one agent-doc line.

## 5. Open PRs (4) — all `mergeStateStatus: DIRTY` (need rebase onto new `origin/main`)

| PR | Branch | What | Status / next |
|---|---|---|---|
| **#14** | `claude/autoresearch-agent-design-yx4dl4` | AutoResearch Phase A substrate + eval-set/judge calibration (RO-6/RO-1) | **CI green** (test+eval-gate pass). Most shovel-ready real feature — just needs a rebase. ⚠️ local branch is named `autoresearch-update` but tracks this remote — push with the tracked ref, not a new branch. Touches `sql/schema.sql` (see §8). |
| **#18** | `seo/auto-2026-06-24-test-push` | Preserve warehouse operator cost data (named author, Maxx Houston pricing) | Preservation-only, no CI run. Human triage — extract drafts before any close. |
| **#19** | `seo/auto-2026-06-24-75455` | Preserve medical-office cost draft + node 22 bump | Preservation-only. The **node 22 bump may be worth cherry-picking** independently. |
| **#17** | `docs/agent-roster-prd` | Preserve agent-roster PRD + ADRs + domain model | Docs preservation-only, no worktree checked out. |

## 6. Unpushed / at-risk work — now resolved
- **`worktree-grill-docs-reconcile`** (`71b677f`, 4 ahead / 35 behind) held ADR-007/008/009, a
  Yoast→Semrush proxy-auth spike, and code edits to `goal.mjs`/`sensor.mjs`/`sensor-gsc.mjs`/`schema.sql`.
  It existed on **no remote**. **Pushed to `origin/worktree-grill-docs-reconcile` this session** as a backup
  (preservation only — not merge-ready; see conflict risks §8). Needs a PR + rebase if the ADRs are wanted.
- Verified there is **no other** unpushed-unique branch. (`worktree-fix+change-type-task-guardrail` looked
  unpushed but is PR #29 squash-merged as `09aa6e1` in main — content fully absorbed, safe to prune.)

## 7. Worktree & branch hygiene (all verified vs `origin/main`)

**Safe to prune — content fully in `origin/main`** (`git worktree remove` + `git branch -D`):
- `fix/pr10-lock-sync` (0 ahead; upstream gone) · `worktree-repo-activity-review` (0 ahead, PR #12)
  · `fix/lockfile-marked-sync` (0 ahead, PR #16, upstream gone)
- `worktree-gsc-pagination-retry` (PR #24 — `gsc.mjs`/`gsc.test.mjs` byte-identical to main)
- `worktree-fix+change-type-task-guardrail` (PR #29, verified absorbed)
- Merged-PR local refs, 1-ahead only from squash patch-id (delete the ref): `chore/pin-volatile-deps`(#35),
  `feat/deepen-learning-loop`(#20), `fix/ai-search-contracts`(#40), `fix/atomic-spend-counter`(#33),
  `fix/check-vitals-script`(#34), `fix/cms-command-injection`(#38), `fix/content-pr-eval-gate`(#36),
  `fix/skip-ci-content-prs`(#32, identical SHA to #36's branch), `feat/finish-cms-apply-seam`(#13).

**Follow-up pushed, but no open PR** (safe on origin; open a PR if the work is wanted):
- `chore/geo-ai-seo-audit` (5 ahead) — post-#11 commits: fresh `seo-audit.md` + AI-SEO WP change-set
  manifest + metadata CSV. **This is a pending CMS change-set — human manifest review before any apply.**
- `seo/blog-city-cost-guides` (3 ahead) — post-#8 commits: Fort Worth + San Antonio cost guides + review companions.

**7 orphan scratch worktrees** (`worktree-agent-*`, all at `28a4b3b`, 39 behind, one uncommitted draft each).
Verified by per-draft diff vs main/#18/#19 — **no operator cost data, bylines, or project specs at risk**
(all byte-identical to `origin/main`). The only unique content is small `## Internal Links` blocks:
- **Discard directly** (superset already in main/#18): `hotel-construction-guide.md` (a19e16…),
  `design-build-construction-houston.md` (a5818e…), `cost-per-square-foot-build-warehouse-texas.md` (af9481…,
  a pre-correction draft — its "Ace Steel" ref was *deliberately removed* as inaccurate).
- **Port the 3-link `## Internal Links` block onto the canonical `origin/main` draft, then discard**:
  `medical-office-…-guide.md` (a1cbc8…), `warehouse-construction-cost-per-square-foot.md` (a20f27…),
  `the-ultimate-2026-hotel-…-edition.md` (a3735d…), `importance-of-mock-up-rooms-…-industry.md` (aa9a7a…).
  Low-value, reconstructable links, but they exist nowhere else and satisfy the ≥3-internal-links gate.

## 8. Conflict risks to expect on rebase
- **`sql/schema.sql`** is touched by BOTH open PR #14 AND `worktree-grill-docs-reconcile`, and they make the
  **same deletion** (both remove the `increment_spend()` function + its revoke/grant block, still present in
  main from #33). Direct overlapping-hunk conflict on whichever rebases second — keep main's #33 version.
- **`scripts/sensor-gsc.mjs`** in `grill-docs-reconcile` re-inlines `googleapis` and drops the
  `import … from '../orchestrator/lib/gsc.mjs'` seam — conflicts with the merged GSC pagination/retry
  refactor (#24), where `origin/main`'s `sensor-gsc.mjs` imports from the `gsc.mjs` seam.

## Operational note — env-gated hooks (from #38)
`.claude/hooks/guard-publish.sh` + `guard-write.sh` enforce the strict allowlist / write-scoping **only when
`SEO_AGENT_GUARDED=1`** (set by `orchestrator/run.mjs` for the autonomous agent). Interactive Claude Code
leaves it unset → lenient (original denylist; normal dev allowed). If you ever see "DENIED by
guard-publish/guard-write" interactively, `SEO_AGENT_GUARDED` is set in your env — unset it.

## Open follow-ups (audit findings still not done — pick up here)
- **REC-5/AH1 (b)+(c)+(d)** — the biggest remaining item (§4): `mem.mjs dnt`, `cms.mjs` apply-boundary check,
  fix `seo-fixer.md:32`.
- **REC-7** — test `git-delivery.mjs` (`git reset --hard` on failure) + `preflight.mjs` (budget/kill-switch) —
  untested destructive/money paths.
- **GEO blend (ADR)** — `learned_patterns_geo` now persists (#40) but `prioritize.mjs` doesn't read it yet;
  decide how to blend citation delta with GSC lift (incompatible scales) and wire it.
- **REC-12 remainder** — exact-pin the agent SDK + declare `zod`; both need a `package-lock.json` change
  (lockfiles are "Never touch" — needs explicit OK or a clean `npm install`).
- **REC-8/10/11** — consolidate the two Supabase clients + two schema files; README/doc index + repoint the
  phantom ADR links in `CONTEXT.md`; de-dupe markdown→HTML + the re-introduced CSV bug.
- **Untracked `.codex/` + `.agents/` harnesses** — still carry the old `node -e` pattern and broken
  `do_not_touch` check; reconcile from `.claude` sources or remove. (Neither is git-tracked.)

## Local artifacts NOT in the repo
- P0 plan: `~/.claude/plans/p0-command-injection-cozy-parasol.md` (home dir, not pushed) — reference only; #38 shipped.
- Untracked in the working tree: `.agents/`, `.codex/`, `blog-ideas.md`, `output/wp-7340-backup-2026-05-18-17-57-58.json`.

## Read order to get oriented
1. This file.
2. `docs/REPOSITORY-AUDIT-2026-06-30.md` (this branch) — the full 12-phase audit, REC-1…REC-17.
3. The 4 open PRs (each body is self-contained).
