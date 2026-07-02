# AutoResearch — Phase A Implementation Spec (Measurement Substrate)

Version 1.0 · 2026-06-25 · companion to `AUTORESEARCH-ROADMAP.md`

> **Status: DESIGN ONLY.** Nothing in this document has been executed. All SQL is a
> **proposal** for a human to review and run in the Supabase SQL editor per the repo's
> idempotent convention (`sql/schema.sql`). No runtime code, prompts, or migrations were
> changed by writing this file. This is the blueprint for the first build phase, not the
> build.

## Why Phase A first

The roadmap's thesis is that the system optimizes the website but never optimizes its own
decision surfaces. Every later optimizer (RO-2 prompt tuning, RO-3 attribution, RO-9
routing, RO-5 risk learning) needs **a trustworthy way to score a change before and after
it ships**. Today that does not exist: there is no eval set, no benchmark, no experiment
registry, and `decision_log` cannot say *which prompt variant or model* produced a given
lift. Build the measurement substrate first, or every meta-loop overfits to noise.

Phase A delivers four things: an **experiment registry**, **provenance columns** on
`decision_log`, an **eval dataset** (RO-6), a **judge-calibration loop** (RO-1), and a
**validator generator** (RO-13). Together they let Phase B run A/B prompt experiments with
a real reward signal.

---

## 1. Data-model additions (proposed DDL — apply by hand)

These extend `sql/schema.sql`. They are written to be idempotent (`IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`) to match the existing schema's convention. **A human applies
these in the Supabase SQL editor; the orchestrator never runs DDL.**

```sql
-- Experiment registry: the A/B / bandit ledger every optimizer writes to.
CREATE TABLE IF NOT EXISTS experiments (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  surface      TEXT NOT NULL,           -- 'skill' | 'judge' | 'router' | 'threshold'
  target       TEXT,                    -- e.g. 'blog-write', 'metadata-generate', 'eval-judge'
  variant_id   TEXT NOT NULL,           -- stable id of the prompt/config variant under test
  arm          TEXT,                    -- 'control' | 'treatment' | bandit arm label
  allocation   NUMERIC DEFAULT 0,       -- traffic share 0..1 for this arm
  metric       TEXT,                    -- 'avg_effect' | 'judge_pass' | 'cost_usd' | 'ctr_delta'
  value        NUMERIC,                 -- realized metric value (written by the learn loop)
  n            INT DEFAULT 0,           -- samples behind `value`
  status       TEXT DEFAULT 'active',   -- 'active' | 'promoted' | 'retired' | 'shadow'
  started_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS experiments_surface_target_idx
  ON experiments (surface, target, status);

-- Provenance on every decision so attribution can join lift -> variant -> cost.
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS prompt_variant_id TEXT;
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS model             TEXT;
ALTER TABLE decision_log ADD COLUMN IF NOT EXISTS cost_usd          NUMERIC;

-- Eval dataset: golden positives + synthetic negatives for RO-6 / RO-1.
CREATE TABLE IF NOT EXISTS eval_set (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  change_type  TEXT NOT NULL,           -- which skill this example exercises
  url          TEXT,                    -- source URL when mined from production
  artifact     TEXT,                    -- the diff / draft / metadata under judgement
  label        TEXT NOT NULL,           -- 'good' | 'bad'
  failure_mode TEXT,                    -- 'doorway' | 'fabricated_stat' | 'cannibalizing' | 'placeholder' | null
  realized_lift NUMERIC,                -- 28-day blended lift when mined from outcomes
  source       TEXT,                    -- 'mined' | 'synthetic' | 'human'
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eval_set_change_type_label_idx
  ON eval_set (change_type, label);

-- Judge-calibration runs: one row per judge-variant evaluated against the eval_set.
CREATE TABLE IF NOT EXISTS judge_calibration (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  judge_variant TEXT NOT NULL,          -- rubric/threshold/model bundle id
  auc           NUMERIC,                -- judge score vs realized lift
  override_rate NUMERIC,               -- human overrides on its passes
  false_pass    NUMERIC,
  false_block   NUMERIC,
  n             INT,
  status        TEXT DEFAULT 'shadow',  -- 'shadow' | 'champion' | 'retired'
  evaluated_at  TIMESTAMPTZ DEFAULT now()
);
```

**New named helpers (proposed) in `orchestrator/lib/supabase.mjs`** — extend that file,
never write inline clients (per `technical-defaults.md`):
`recordExperiment(row)`, `updateExperimentValue(id, value, n)`, `activeVariants(surface,
target)`, `insertEvalExample(row)`, `evalSet(change_type)`, `recordJudgeCalibration(row)`,
`championJudge()`. The CLI surface in `scripts/mem.mjs` gains `experiment` and `evalset`
subcommands so headless/CI writes avoid MCP approval friction, matching the existing
`queue|log|status|changeset` pattern.

---

## 2. RO-6 — Eval-dataset & benchmark builder

**Goal.** Produce a labeled set that (a) separates historically high-lift from low-lift
skill outputs and (b) covers known failure modes, so any prompt/model change can be scored
before it ships.

**How the golden set is mined (positives + weak negatives).**
- Read `decision_log` rows with `action='applied'` joined to `outcomes` via the same
  before/after window `attribute.mjs` already uses (28-day lag).
- Top-quartile realized blended lift per `change_type` → `label='good'`,
  `source='mined'`, store the `realized_lift`.
- Bottom-quartile (or negative-lift) → `label='bad'`, `source='mined'`.
- Store the actual artifact (the merged diff / draft / metadata row) in `eval_set.artifact`
  so the judge sees exactly what shipped.

**How synthetic negatives are generated (hard negatives, one per known failure mode).**
A generator agent produces deliberately-bad artifacts and labels them `source='synthetic'`:
- `doorway` — a location page that swaps only the city name (the exact pattern CLAUDE.md's
  doorway guardrail and the San Antonio copy-paste H3 represent).
- `fabricated_stat` — a cost-guide paragraph with an unverifiable statistic and no named
  methodology (the precise thing `eval-judge.mjs` is supposed to catch).
- `cannibalizing` — a restaurant-cluster intro overlapping the two existing restaurant pages
  flagged in CLAUDE.md.
- `placeholder` — content containing `HUMAN EDIT REQUIRED` / `[insert …]` / default
  WordPress `master` author (the literal leak `ACTION-PLAN.md` C7 found live).

**Where it plugs into CI.** A `scripts/eval-benchmark.mjs` (Phase B build, scaffolded by
this spec) runs the current judge bundle over `eval_set` and emits an AUC + a
confusion matrix. This becomes a **non-blocking informational check** first, then a
required check once stable — added to `seo-eval-gate.yml` alongside the existing
`check-diff-size` + `eval-judge` steps. Every prompt/model change is scored against the
frozen set before merge.

**Compounding.** Misclassified examples (a `good` the judge blocked, a `bad` it passed) are
appended to `eval_set` with `source='human'` after review — the set grows toward the
system's real failure surface.

---

## 3. RO-1 — Judge-calibration loop (MAW-4)

**Goal.** Make `eval-judge.mjs` agree with what actually ranks, instead of trusting a
frozen rubric and `JUDGE_MIN_SCORE=3` that has never been validated.

**Label construction.**
- **Outcome labels:** for every past `seo-auto` merge, join the judge's recorded scores to
  the realized 28-day blended lift from `outcomes`. A merge that the judge passed and that
  *lost* clicks is a candidate false-pass; a block that would have *gained* clicks
  (recoverable from human-overridden merges) is a false-block.
- **Human-override labels:** when a human merges a judge-blocked PR or reverts a
  judge-passed one, that is a hard ground-truth label. These are the highest-signal rows.

**Metric.** `auc` of judge score vs. realized lift, plus `override_rate`, `false_pass`,
`false_block` — written to `judge_calibration` per evaluated variant.

**The loop (MAW-4).**
1. **Ground-truth Builder** assembles the labeled set above from `decision_log` +
   `outcomes` + override events.
2. **Judge-variant Generator** proposes rubric/threshold/model bundles targeting the
   dominant error mode (e.g., if false-pass is dominated by `fabricated_stat`, strengthen
   the `fact_checkability` instruction and inject synthetic `fabricated_stat` negatives as
   few-shot exemplars).
3. **Meta-evaluator** scores each variant over `eval_set` + the labeled history → AUC,
   override rate.
4. **Promoter** marks the winning variant `champion` in `judge_calibration`; the human
   ratifies, and the swap is applied **via env** (`JUDGE_MODEL`, `JUDGE_MIN_SCORE`, and a
   versioned rubric id) — *not* by editing the frozen prompt blindly. The promotion ships
   as an ordinary `seo-auto` PR through the existing gate.

**Cadence.** Weekly, right after `seo-learn` refreshes `outcomes`.

**Stopping condition.** AUC improvement over the current champion below a fixed threshold,
or N rounds with no gain.

**Safety.** The judge only ever gates `safe`-class auto-merges; gated/YMYL/brand items stay
human-gated regardless of any judge calibration.

---

## 4. RO-13 — Validator generator from production failures

**Goal.** Turn every post-mortem defect into a *deterministic* check so it never needs an
LLM judge again, and into a regression case so it never recurs.

**Mechanism.**
- On each incident (a defect found in production or a judge miss surfaced by RO-1), a
  generator agent proposes (a) a deterministic check for `post-validate.sh` or a CI step,
  and (b) a matching `eval_set` row with `source='human'`.
- Example mappings drawn from `ACTION-PLAN.md`:
  - leaked `HUMAN EDIT REQUIRED` / `[insert …]` / `Author: master` → a literal regex check
    in `post-validate.sh` that fails the write (exit non-zero) the way JSON-LD validation
    already does.
  - H1 equal to the raw URL slug (the hotel-guide C6 bug) → a check comparing rendered H1
    to the slug.
  - entity inconsistency (founding year / hours / NAP across page ↔ schema ↔ GBP) → a
    cross-field consistency assertion (also feeds RO-10).

**Why deterministic-first.** These are regexes and equality checks, not judgement calls.
Moving them out of the probabilistic judge into `post-validate.sh`/CI is cheaper, faster,
and fail-closed — and it shrinks the judge's job to genuinely subjective quality.

**Output.** New checks land as ordinary `seo-auto` PRs; new regression cases append to
`eval_set`. Metric: fraction of past defect classes now caught deterministically pre-merge.

---

## 5. Reuse map (extend, don't rebuild)

| Need | Existing asset to extend |
|---|---|
| All Supabase access | `orchestrator/lib/supabase.mjs` named helpers (add the Phase-A helpers here) |
| Headless/CI writes | `scripts/mem.mjs` (add `experiment`, `evalset` subcommands) |
| Before/after lift window | the join logic in `scripts/attribute.mjs` (`clicksAround`/`positionAround`, 28-day lag) |
| Promotion mechanism | the `seo-auto` PR + `seo-eval-gate.yml` + `seo-auto-merge.yml` flow — every promotion is just another gated PR |
| Kill switch + budget | `control.paused` + `spend_usd` cap, checked in `orchestrator/lib/preflight.mjs` |
| Weekly trigger | add the calibration + benchmark steps to `seo-learn.yml` |

---

## 6. Governance invariant (non-negotiable)

- Meta-optimizers touch **only `safe`-class behavior**. Gated, YMYL, brand, pricing,
  GBP/NAP, and `do_not_touch` stay permanently human-gated.
- Every promotion (a new prompt variant, judge bundle, router policy, or threshold) ships as
  a normal `seo-auto` PR through the existing eval-gate **and** requires one human
  ratification before it becomes champion.
- All meta-loops run under `control.paused` and the monthly budget cap, with the same model
  routing discipline (`technical-defaults.md`) — cheap tiers by default, escalate only hard
  cases.
- Statistical significance + trailing windows guard every promotion against core-update and
  seasonality noise. No single-week reactions.

---

## 7. Exit criteria for Phase A (when Phase B can start)

1. `experiments`, `eval_set`, `judge_calibration` tables exist (human-applied) and the
   `decision_log` provenance columns are populated by the orchestrator on every decision.
   — *Schema shipped; provenance auto-stamped by `mem.mjs log`.*
2. `eval_set` holds the synthetic negative classes (shipped) plus mined examples per
   high-volume `change_type` once outcomes + draft artifacts accrue.
   — *`scripts/build-eval-set.mjs` seeds synthetics now and enriches from mined lift as data lands.*
3. `scripts/eval-benchmark.mjs` runs and emits an AUC the team trusts. — *Shipped; runs in
   the weekly `seo-learn` job.*
4. RO-1 has produced at least one champion judge recommendation with a measured AUC.
   — *`scripts/judge-calibrate.mjs` shipped; writes `judge_calibration` and recommends (human
   ratifies via `JUDGE_*` vars). `override_rate` deferred until per-PR judge verdicts are
   persisted.*
5. RO-13 has converted the known `ACTION-PLAN.md` defect classes into deterministic checks.
   — *Shipped in the Phase-A kickoff (`scripts/validators/content-guards.mjs`).*

**Status:** the RO-6/RO-1 consumers are built and wired (weekly `seo-learn`); calibration is
informational and never gates a merge. Remaining to clear the gate: apply the schema in
Supabase (human), then let ~3–4 weeks of provenance-tagged outcomes accrue so mined examples
and lift-based labels join the synthetic seed.

With that substrate in place, RO-2 (prompt/bandit optimization) has a real, low-noise
reward signal — and the system can begin optimizing itself.
