# Session Handoff — 2026-06-30 (continue from office)

> Read-only handoff. This branch (`docs/session-handoff-2026-06-30`) is NOT meant to be
> merged to `main` — read it, then delete the branch. (Prior handoff docs got flagged by
> code review when they rode along in a feature PR.)

## TL;DR
All of **this session's** work is **merged to `main` and pushed**. To continue from the
office: `git fetch && git checkout main && git pull`. Nothing of this session is stranded
locally. The one thing that still needs you is re-setting the GitHub `ANTHROPIC_API_KEY`
secret (see OPEN #1) — without it the Monday automation fails.

## Shipped this session (all merged to `main`)
- **PR #37** (`9405fcc`) — **auto competitor-classifier.** The AI-search loop now discovers
  every domain answer engines cite (`ai_citations.sources`), classifies each new one
  `competitor` / `reference` / `noise` via Haiku, and scores citation gaps against
  high-confidence rivals — no hand-curated list. New `competitor_domains` table,
  `lib/classify.mjs`, `scripts/classify-competitors.mjs`, wired into
  `sensor-ai-citations.mjs` + `.github/workflows/ai-search-sensors.yml` (classify step runs
  before the citation sensor). 17 unit tests. DB + code reviewed before merge.
- **PR #39** (`7dce4bb`) — wired the `COMPETITOR_MIN_CONFIDENCE` repo var into the citation
  sensor (it was inert otherwise).
- **Backfill done** — `competitor_domains` seeded with all 83 baseline domains:
  **36 competitor / 38 reference / 9 noise**, spot-checked accurate (Arrant/Turner =
  competitor; RSMeans/Procore/Autodesk = reference; Reddit/Google = noise). Cost ~$0.02
  (4 Haiku calls, 6,613 tokens — the classifier now logs real token usage per run).

## Config changed this session
- **`.env`** (local, gitignored — NOT pushed): added + validated `PERPLEXITY_API_KEY`,
  `OPENAI_API_KEY`, `SERPAPI_KEY`; replaced `SUPABASE_ACCESS_TOKEN` with a working Supabase
  **Management PAT** (`sbp_…`) — the old `sb_p…` value 401'd the Management API.
- **GitHub secrets set:** `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `SERPAPI_KEY`.
- **GitHub var set:** `COMPETITOR_MIN_CONFIDENCE = 0.85` (tightens scoring to ~29
  high-confidence direct GC rivals; code default stays 0.7 when unset).
- **Supabase:** applied `sql/ai-search-schema.sql` (incl. the new `competitor_domains`
  table + CHECK constraints) via the Management API. Schema changes are now applied this
  way going forward (see memory `feedback-apply-schema-via-mgmt-api`).

## OPEN — needs you (from the office)
1. **Re-set the GitHub `ANTHROPIC_API_KEY` secret to the FUNDED key** (`sk-ant-…api03-S…`).
   The currently-active stale key (`…api03-I…`) is **dead (401)**. Until this is fixed, the
   **Monday `ai-search-sensors` cron, the eval-judge (PRs can't pass CI), and the
   orchestrator all fail.** `.env` locally already has the good key; GitHub does not (or has
   the dead one). `gh secret list` shows names only — just re-set it to be safe.
2. **Stale local `$env:ANTHROPIC_API_KEY`** (`…api03-I…`) shadows `.env` because Node
   `--env-file` yields to a real env var. Remove it from your PowerShell profile / Windows
   env so local `node --env-file` runs use `.env`. (Office machine may not have this set.)
3. Optional: document `COMPETITOR_MIN_CONFIDENCE` in
   `.claude/rules/technical-defaults.md`'s env table.

## Repo state — OTHER sessions' work (left untouched, NOT mine)
- The main working dir cycled through a concurrent session's branches during my session:
  `fix/cms-command-injection` (REC-1), now **`fix/ai-search-contracts`** (REC-4, commit
  `fae45fa`, **already pushed**). That's a different session's security/contract work — I
  did not touch it.
- **7 stale `worktree-agent-*` worktrees** each have ONE uncommitted modified draft
  (hotel / medical-office / warehouse / design-build / mock-up drafts) on an old branch
  (`28a4b3b`). Abandoned agent WIP from a much earlier era — **not committed/pushed.**
  Decide whether to preserve or discard; if you want them, they need committing on their
  own branches first (they won't transfer to the office otherwise).

## How to continue
1. `git fetch && git checkout main && git pull` — gets the shipped classifier.
2. Re-set the `ANTHROPIC_API_KEY` GitHub secret (OPEN #1).
3. The competitor classifier + citation sensors run automatically **Monday 06:30 UTC**;
   or trigger `ai-search-sensors` via `workflow_dispatch` to test sooner once the secret is fixed.

_Full running state is also in the local memory file `project-agentic-seo-state.md`._
