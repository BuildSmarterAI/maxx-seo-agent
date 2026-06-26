# AutoResearch Roadmap — Evolving `maxx-seo-agent` into a Self-Improving System

Version 1.0 · 2026-06-25 · companion to `AGENTIC-ROADMAP.md` and `ACTION-PLAN.md`

## What this is

`maxx-seo-agent` is an **agent-assisted, partially-closed-loop SEO orchestration platform**.
It already implements the outer loop the AutoResearch framing asks for — sense → plan →
act → verify → learn — but **every component that *decides* is a hand-frozen human
artifact**. The loop optimizes the *content of the website*; nothing optimizes *the loop
itself*.

This is a **research roadmap, not an implementation**. It catalogues where humans are the
bottleneck, proposes autonomous research loops (Objective → Metrics → Experiments →
Evaluation → Next Experiment) that run without a human in the inner loop, identifies
multi-agent collaborations, lists continuous-optimization triggers, and ranks everything
for build order. A companion design-only spec for the first phase lives in
`AUTORESEARCH-PHASE-A.md`.

---

## 1. What the system is today (verified from source)

**Product.** A four-layer autonomous SEO system. The target site is external WordPress
(`maxxbuilders.com`); this repo is the *agent runtime* that writes changes to it.

**How it runs (the existing outer loop):**

1. **Sense** — `scripts/sensor-gsc.mjs` (decay ≥25% click drop → `blog-write` p3;
   striking-distance pos 5–20, ≥50 impressions → `metadata-generate` p2),
   `sensor-sitemap.mjs` (new URL → `seo-audit` p1), `sensor-indexation.mjs` (not-indexed →
   `seo-audit` p4). Each writes rows to Supabase `work_queue`. Nightly via
   `.github/workflows/seo-sensors.yml`.
2. **Plan / Act** — `orchestrator/run.mjs` (Sonnet 4.6) reads `work_queue`, dispatches a
   `seo-fixer` subagent (Sonnet, 15 turns) per **safe**-class item, which runs one of
   **11 skills** (`.claude/skills/*/SKILL.md`) and validates. Repo mode → git PR; CMS mode
   → `change_set` rows awaiting human approval.
3. **Verify** — `seo-eval-gate.yml`: `check-diff-size.mjs` (≤ `MAX_DIFF_LINES`=400) +
   `eval-judge.mjs` (Haiku 4.5, scores quality / brand_safety / fact_checkability /
   information_gain 1–5, fail if any < 3 or `fabrication_risk`). `vitals-pr.yml` runs PSI
   on deploy. `seo-auto-merge.yml` squash-merges safe PRs once checks pass.
4. **Learn** — weekly `seo-learn.yml`: `collect-outcomes.mjs` (GSC/GA4 → `outcomes`),
   `attribute.mjs` (blended lift = clickLift·0.7 + posLift·0.3, 28-day lag, MIN_N=3 →
   `learned_patterns.avg_effect`), `prioritize.mjs` (priority = BASE[source] +
   round(avg_effect·5), clamp 0–10), `push-escalations.mjs` (gated items → Linear).

**Memory.** Supabase: `work_queue, decision_log, outcomes, learned_patterns, change_set,
snapshots, do_not_touch, sitemap_seen, control` (kill switch `paused` + `spend_usd`
budget cap).

**Guardrails.** `guard-publish.sh` (PreToolUse, exit 2 denies delete/301/publish/push-main),
`post-validate.sh` (PostToolUse, JSON-LD validation + audit log), risk classes
`safe`/`gated`, a static model-routing table.

**Maturity (per `AGENTIC-ROADMAP.md`):** at **L3 → L4 partial**. Self-healing, citation
tracking, a dashboard, and any *meta-optimization* are explicitly **not built**.

---

## 2. The meta-gap: everything that decides is frozen by hand

| Decision surface | Where it lives | How it's set today | Ever optimized? |
|---|---|---|---|
| Orchestrator goal prompt | `orchestrator/goal.mjs` | Hand-written; AGENTS.md says "don't edit it" | ❌ frozen by fear |
| 11 skill prompts | `.claude/skills/*/SKILL.md` | Hand-authored | ❌ |
| Eval-judge rubric + threshold | `eval-judge.mjs`, `JUDGE_MIN_SCORE=3` | Hand-written, Haiku | ❌ never validated vs. outcomes |
| Attribution weights / lag / MIN_N | `attribute.mjs` (0.7/0.3, 28d, 3) | Hand-set constants | ❌ no confounder control |
| Prioritization weights | `prioritize.mjs` BASE{gsc:2…}, WEIGHT=5 | Hand-set | ❌ |
| Sensor thresholds | `sensor-*.mjs` (25%, 5–20, 50) | Hand-set guesses | ❌ |
| Risk class (safe/gated) | CLAUDE.md + goal prompt | Hand-coded policy | ❌ never learns from approvals |
| Model routing | `technical-defaults.md` | Static task→tier map | ❌ |
| Signal → skill mapping | sensor `thresholds` | Fixed (decay→blog-write) | ❌ |

**Thesis.** The highest-leverage autonomous research is not *more SEO actions* — it is
**closing the loop around these nine frozen surfaces**. Each becomes an objective with a
metric the system already collects (`outcomes`, `decision_log`, `learned_patterns`). The
website loop generates the reward signal for the meta-loop "for free."

**Evidence the human bottleneck is real and costly.** `ACTION-PLAN.md` (a one-time,
human-commissioned 11-specialist audit, health 42/100) found *live* trust failures that
sat in production — a copy-paste H3 ("Why Choose Maxx Builders in **Houston**?" on the
San Antonio page), three conflicting founding years, and a literal
`Author: [HUMAN EDIT REQUIRED …]` placeholder published on a ranking page. Episodic human
audits let these dwell.

---

## 3. Research Opportunities

Each follows: Problem · Human bottleneck · Objective metric · Experiments · Success
measure · Next-experiment generation · Cadence · Business impact · Difficulty (1–5) ·
Confidence (1–5).

### RO-1 — Eval-judge calibration loop ("judge the judge")
- **Problem:** `eval-judge.mjs` gates *every* auto-merge with a frozen rubric on Haiku,
  never validated. Two failure modes: false-pass (bad content reaches Google →
  brand / Scaled-Content-Abuse risk) and false-block (good content stalls, throughput dies).
- **Human bottleneck:** humans wrote the rubric once and manually override/merge blocked
  PRs; no calibration to what actually ranks.
- **Objective metric:** AUC of judge score (and pass flag) vs. realized 28-day click lift
  from `outcomes`/`learned_patterns`; human override rate on `seo-auto` PRs; regression
  rate traced to merged PRs.
- **Experiments:** assemble a labeled set (merged PR diff → realized lift, plus human
  overrides as hard labels); A/B rubric-prompt variants and `JUDGE_MIN_SCORE`;
  Haiku-vs-Sonnet judge tier; add few-shot exemplars of historical false-passes.
- **Success:** higher AUC; lower override rate at constant safety.
- **Next experiment:** confusion matrix → generate rubric variants targeting the dominant
  error mode (e.g., if false-pass is fabricated stats, strengthen `fact_checkability`
  instructions + add negatives).
- **Cadence:** weekly (after `seo-learn` refreshes outcomes).
- **Impact:** High — the judge is the single safety gate. **Difficulty 2 · Confidence 4.**

### RO-2 — Skill-prompt optimizer (blog-write, metadata-generate first)
- **Problem:** `SKILL.md` prompts are frozen. `blog-write` output needs heavy 80%-rule
  human verification; `metadata-generate` titles may underperform CTR.
- **Human bottleneck:** prompt engineering is manual; a "don't touch prompts" culture.
- **Objective metric:** per-skill `learned_patterns.avg_effect`; for metadata, GSC CTR
  delta on touched pages; first-pass judge approval rate; human-edit volume on drafts.
- **Experiments:** maintain N prompt variants per skill; route queue items across variants
  via a multi-armed bandit; reward = downstream lift + judge pass − human edits.
  DSPy/GEPA-style optimization with outcomes as reward.
- **Success:** avg_effect ↑, first-pass approval ↑, human-edit minutes ↓.
- **Next experiment:** bandit shifts traffic to winners; losers regenerated from winner +
  error analysis.
- **Cadence:** continuous (bandit), promote weekly through the existing eval-gate + one
  human sign-off.
- **Impact:** Very High — directly raises content ROI and cuts the largest human-review
  cost. **Difficulty 3 · Confidence 4.**

### RO-3 — Attribution model upgrade (crude blend → causal)
- **Problem:** `attribute.mjs` uses fixed 0.7/0.3 weights, 28-day lag, MIN_N=3, and **no
  confounder control**. `AGENTIC-ROADMAP.md` explicitly warns attribution is noisy (core
  updates, seasonality). Every prioritization decision rides on it.
- **Human bottleneck:** someone hand-set the weights/lag; no one re-derives them.
- **Objective metric:** out-of-sample predictive error — does this period's `avg_effect`
  predict next period's lift on a holdout of URLs?
- **Experiments:** difference-in-differences vs. unchanged control URLs; CUPED variance
  reduction; seasonality / core-update covariates; lag sweep (14/28/56); learn weights by
  regression on a holdout; synthetic-control matching.
- **Success:** lower holdout error; effect estimates stable across a core update.
- **Next experiment:** select covariate set / lag minimizing holdout error; write back as
  config (not hard-coded constants).
- **Cadence:** monthly refit; weekly score.
- **Impact:** High — improves the quality of *every* future run's prioritization.
  **Difficulty 4 · Confidence 3.**

### RO-4 — Sensor-threshold & prioritization-weight optimizer
- **Problem:** thresholds (decay 25%, pos 5–20, impressions 50) and BASE source weights +
  `PRIORITY_WEIGHT=5` are hand-set guesses that determine what enters the queue and in
  what order.
- **Human bottleneck:** hand-tuned constants, never revisited against yield.
- **Objective metric:** precision = fraction of queued items that produced positive
  realized lift; yield = lift per dollar spent.
- **Experiments:** offline sweep thresholds against historical GSC + `outcomes`; Bayesian
  optimization over the constant vector; precision/recall of the striking-distance band.
- **Success:** higher positive-lift rate per run; less spend on low-yield items.
- **Next experiment:** BO proposes the next threshold vector from the observed yield surface.
- **Cadence:** monthly.
- **Impact:** Medium-High — better queue quality + cost efficiency.
  **Difficulty 3 · Confidence 4.**

### RO-5 — Risk-classification learner (safely widen the `safe` envelope)
- **Problem:** `safe`/`gated` is hand-coded. Every gated item **and every `change_set`
  row** needs human approval — the single biggest human-time sink. Some gated contexts may
  be reliably safe; the policy never learns.
- **Human bottleneck:** humans approve all gated/change_set items; classification never
  updates from approve/reject history in `decision_log` + Linear + `change_set`.
- **Objective metric:** predicted-vs-actual human approval rate per (change_type, context);
  shadow accuracy; auto-merge regression/rollback rate must not rise.
- **Experiments:** train a classifier on `decision_log` (escalate/applied), Linear
  resolutions, and `change_set` approve/reject; run in **shadow mode** (predict, compare to
  human) before any authority grant; propose threshold expansions for human sign-off only.
- **Success:** fewer human approvals at constant safety (no rise in `rolledback`/regressions);
  high shadow accuracy pre-promotion.
- **Next experiment:** contexts the model is confident on *and* humans always approved →
  propose moving to safe (human ratifies once).
- **Cadence:** monthly governance review.
- **Impact:** Very High leverage on human effort — **but safety-sensitive; permanent human
  ratification gate.** **Difficulty 3 · Confidence 3.**

### RO-6 — Eval-dataset & benchmark auto-builder
- **Problem:** there is **no eval set, no benchmark, no regression suite** for skill
  outputs. Quality is judged ad hoc per PR. This is the substrate RO-1/RO-2 need.
- **Human bottleneck:** building eval sets is manual labor; here it is simply absent.
- **Objective metric:** discriminative power (does the set separate historically high-lift
  vs. low-lift outputs?) and coverage of known failure modes.
- **Experiments:** auto-construct a golden set from high-lift vs. low-lift pages in
  `outcomes`; synthesize negatives (doorway pages, fabricated stats, cannibalizing intros,
  the leaked-placeholder pattern); freeze as a CI regression suite run on every
  prompt/model change.
- **Success:** every prompt/model change gets a numeric score pre-merge; regressions caught
  before production.
- **Next experiment:** misclassified/edge examples added to the set; the set compounds.
- **Cadence:** per change (CI) + monthly refresh.
- **Impact:** High — foundation for the whole meta-layer. **Difficulty 3 · Confidence 4.**

### RO-7 — Self-healing regression sensor + diagnosis loop
- **Problem:** `AGENTIC-ROADMAP.md` lists self-healing as unbuilt. Rank/CWV/citation drops
  aren't auto-detected or diagnosed; humans notice and investigate.
- **Human bottleneck:** drop detection + root-cause is manual and episodic.
- **Objective metric:** time-to-detect and time-to-recover (MTTR); fraction of regressions
  recovered.
- **Experiments:** changepoint detection on `outcomes` per URL → high-priority `work_queue`
  item; a diagnosis subagent correlates the drop to recent `decision_log` changes / deploys
  / core-update dates; the safe path auto-reverts via `snapshots`/git, else escalates.
- **Success:** MTTR ↓, recovered-ranking % ↑, fewer silent declines.
- **Next experiment:** false-positive review tunes changepoint sensitivity.
- **Cadence:** nightly sensor; event-driven diagnosis.
- **Impact:** High — protects revenue; closes the L3 → L4 gap.
  **Difficulty 3 · Confidence 4.**

### RO-8 — AI-citation tracking sensor + GEO optimizer
- **Problem:** citation tracking is an optional CSV. `AGENTIC-ROADMAP.md` cites
  AI-referred traffic converting **14.2% vs. 2.8%** organic — a citation drop is a revenue
  signal, with no closed loop on it.
- **Human bottleneck:** no continuous AI-citation measurement or optimization.
- **Objective metric:** citation share in ChatGPT/Perplexity/AI-Overviews for target
  queries; AI-referral sessions/conversions.
- **Experiments:** a scheduled synthetic query panel probing AI surfaces for the keyword
  clusters in CLAUDE.md; attribute citation presence to answer-first/schema/freshness
  features; run `blog-write`/`schema-generate` variants optimized for extractability;
  measure citation lift.
- **Success:** citation share ↑ on tracked queries; AI-referral conversions ↑.
- **Next experiment:** which structural feature moved citations → propagate to skill
  prompts (feeds RO-2).
- **Cadence:** weekly probe.
- **Impact:** Very High (revenue per the conversion gap) and strategic.
  **Difficulty 4 · Confidence 3** (measurement is sampling-noisy — treat as directional).

### RO-9 — Model-routing cost/quality optimizer
- **Problem:** the task→model map is static. Headless usage draws a **separate metered,
  non-rolling credit pool** (`security.md`) — cost is real exposure.
- **Human bottleneck:** the routing table is hand-set in rules.
- **Objective metric:** quality-per-dollar per task type (judge pass + realized lift per $).
- **Experiments:** route a fraction of each task type across tiers; measure outcome vs.
  `control.spend_usd` delta; learn a cheap-first router that escalates on low confidence /
  validator failure.
- **Success:** equal outcomes at lower spend, or better outcomes at equal spend.
- **Next experiment:** shift allocation toward the Pareto-optimal tier; escalate only hard
  cases.
- **Cadence:** continuous; review monthly.
- **Impact:** Medium-High (direct cost). **Difficulty 2 · Confidence 4.**

### RO-10 — Continuous technical / E-E-A-T audit agent
- **Problem:** the 42/100 audit was one-time and human-triggered; live trust failures
  dwelled in production.
- **Human bottleneck:** audits are episodic; humans commission them.
- **Objective metric:** defect-detection coverage + dwell-time for on-page trust failures;
  an auto-tracked health score over time.
- **Experiments:** a nightly crawl-diff agent running the audit dimensions on changed/
  sampled URLs; an entity-consistency checker (NAP / founding-year / hours across page-text
  ↔ schema ↔ GBP, byte-for-byte per CLAUDE.md); a doorway/uniqueness scorer; enqueue
  findings.
- **Success:** trust-failure dwell time ↓; health-score trend visible and rising.
- **Next experiment:** defect types found later by humans become new deterministic checks.
- **Cadence:** nightly sample + on-deploy.
- **Impact:** High — these are live E-E-A-T failures Google's quality raters flag.
  **Difficulty 3 · Confidence 4.**

### RO-11 — Internal-link graph / recommendation optimizer
- **Problem:** `internal-linking` proposes links heuristically; per-link effect on
  equity/rank is unmeasured.
- **Human bottleneck:** link strategy reviewed manually.
- **Objective metric:** money-page rank/click lift; orphan count; clicks-from-home depth.
- **Experiments:** build a repo link graph + embedding similarity; A/B placements; measure
  rank/click change on link targets.
- **Success:** orphans → 0; money-page rank lift.
- **Next experiment:** link patterns that moved rank get reinforced; ineffective ones pruned.
- **Cadence:** monthly. **Impact:** Medium. **Difficulty 3 · Confidence 3.**

### RO-12 — Onboarding / repo-knowledge-graph builder (multi-site scale)
- **Problem:** onboarding a new site = manual CLAUDE.md entity data, keyword/cannibalization
  map, `config/urls.txt`, `do_not_touch` seeding. BuildSmarter is a holding co — every new
  client repeats this.
- **Human bottleneck:** per-site human setup is the gate on scaling the *product* to new
  customers.
- **Objective metric:** time-to-first-safe-PR for a new domain; config completeness /
  error rate.
- **Experiments:** an onboarding agent crawls a new domain, extracts entities/NAP/keyword
  clusters/cannibalization risks, drafts CLAUDE.md, seeds tables, proposes `do_not_touch`.
- **Success:** setup time ↓; fewer misconfigs.
- **Next experiment:** human corrections to drafts feed the onboarding templates.
- **Cadence:** per new site. **Impact:** High (product scaling).
  **Difficulty 3 · Confidence 3.**

### RO-13 — Validator / test-case generator from production failures
- **Problem:** validators are thin (char limits, diff size, JSON-parse). Deterministic
  failures (the leaked `HUMAN EDIT REQUIRED` placeholder) should never need an LLM judge —
  they're a regex.
- **Human bottleneck:** new validators are written reactively by hand.
- **Objective metric:** fraction of past production defects now caught deterministically
  pre-merge.
- **Experiments:** a loop that turns each post-mortem defect into a `post-validate.sh`/CI
  check + a regression case in RO-6's suite.
- **Success:** zero recurrence of a known defect class.
- **Next experiment:** new defect → new check.
- **Cadence:** event-driven (per incident). **Impact:** Medium-High (cheap, compounding
  safety). **Difficulty 2 · Confidence 4.**

### RO-14 — Doc/config-consistency optimizer (recursive housekeeping)
- **Problem:** overlapping docs (CLAUDE.md, CONTEXT, AGENTIC-*, rules) can drift from code
  constants (`MAX_DIFF_LINES`, doorway 30/50, attribution weights).
- **Human bottleneck:** doc/code drift is caught by chance.
- **Objective metric:** count of detected contradictions between documented thresholds and
  code.
- **Experiments:** an agent diffs documented constants vs. source-of-truth values; flags
  drift.
- **Cadence:** weekly. **Impact:** Low-Medium (governance hygiene).
  **Difficulty 2 · Confidence 4.**

---

## 4. Multi-agent collaboration workflows

### MAW-1 — Skill/Prompt Improvement Loop (implements RO-2 + RO-6 + RO-1)
**Research Agent** (mines `learned_patterns` + judge logs → names the weakest skill &
failure mode) → **Experiment Agent** (generates prompt variants targeting that mode) →
**Evaluator Agent** (scores variants on the RO-6 offline set, then bandit-routes a traffic
slice in prod) → **Reviewer Agent** (brand/safety + regression check vs. eval-gate) →
**Planner Agent** (promote / iterate / abandon) → **Implementation Agent** (opens a
`SKILL.md` PR through the *normal* eval-gate).
- **Handoffs:** weakest-skill report → variant set → scored variants → safety verdict →
  promotion decision → PR.
- **Required context:** `outcomes`, `decision_log` (extended with `prompt_variant_id`),
  judge logs, the RO-6 eval set, CLAUDE.md brand rules.
- **Stopping conditions:** a variant beats incumbent at statistical significance on realized
  lift, OR N rounds with no gain, OR the budget slice is exhausted.
- **Eval metrics:** avg_effect, first-pass judge rate, human-edit volume.

### MAW-2 — Attribution & Prioritization Science Loop (implements RO-3 + RO-4)
**Data Agent** (assembles a panel: decisions × outcomes × covariates incl. core-update
calendar) → **Modeler Agent** (fits DiD/CUPED/weight variants) → **Validator Agent**
(holdout backtest, out-of-sample error) → **Planner Agent** (writes new weights/lag to
config, not constants).
- **Stopping:** holdout error plateaus or worsens.
- **Metrics:** out-of-sample prediction error; effect stability across a core update.

### MAW-3 — Continuous Audit & Self-Heal Swarm (implements RO-10 + RO-7 + RO-13)
**Crawl-diff Sensor** → parallel **specialist auditors** (technical · schema · content ·
local · entity-consistency · doorway — mirrors the one-time 11-specialist audit, now
continuous) → **Triage/Dedup Agent** → **Risk Classifier** (RO-5) → **`seo-fixer`** (safe) /
**Escalation** (gated → Linear) → **Verifier** → outcome logged.
- **Required context:** crawl export, CLAUDE.md entity/NAP truth, `do_not_touch`,
  `snapshots` for revert.
- **Stopping:** queue drained or budget/`paused` hit.
- **Metrics:** defect dwell-time, MTTR, health-score trend.

### MAW-4 — Judge-Calibration Loop (implements RO-1)
**Ground-truth Builder** (merged PR → realized lift + human-override labels) →
**Judge-variant Generator** → **Meta-evaluator** (AUC vs. outcomes, override rate) →
**Promoter** (swaps rubric/threshold/tier via env, through human sign-off).
- **Stopping:** AUC gain below threshold.
- **Metrics:** judge AUC, override rate, post-merge regression rate.

> **Governance invariant for all MAWs:** meta-optimizers may only alter *safe*-class
> behavior; every promotion still passes the existing eval-gate plus one human
> ratification; all run under `control.paused` + the budget cap; statistical significance +
> trailing windows guard against core-update noise.

---

## 5. Continuous-optimization triggers ("every X → a loop learns")

| Trigger (already emitted by the system) | AutoResearch loop it feeds |
|---|---|
| Every **generated output** (draft/metadata/schema) | label row for RO-6 eval set + reward for RO-2 once attributed |
| Every **PR merge / human override** | RO-1 judge-calibration label |
| Every **escalation + Linear resolution** | RO-5 risk-classifier training row |
| Every **`change_set` approve/reject + drift** | RO-5 + drift-pattern learning |
| Every **failed validator / hook denial** | RO-13 test-case generator + guardrail tuning |
| Every **deploy** (`vitals-pr.yml`) | RO-10 re-audit changed routes |
| Every **model upgrade** | re-run RO-6 benchmark, re-fit RO-9 routing, re-calibrate RO-1 judge |
| Every **GSC poll / search** | RO-4 threshold learning |
| Every **regression** | RO-7 self-heal + post-mortem → RO-13 |
| Every **new site/customer** | RO-12 onboarding agent |
| Every **week of `outcomes`** | RO-3 attribution refit |

---

## 6. Recursive layer — systems that improve the systems

- **Prompt optimizer + evaluator + generator** → RO-2 + RO-6.
- **Judge calibrator** → RO-1.
- **Attribution / benchmark auto-builder** → RO-3 + RO-6.
- **Synthetic query/user generator** → RO-8's probe panel (also generates RO-6 negatives).
- **Regression detector** → RO-7.
- **A/B experiment generator** → the bandit infra under RO-2/RO-9 (an `experiments` table +
  arm assignment).
- **Feature/threshold prioritizer** → RO-4 + RO-5.
- **Agent-instruction optimizer** → RO-2 applied to the *orchestrator goal* and *seo-fixer*
  prompt (the surfaces AGENTS.md says not to touch — unfrozen behind eval-gate +
  significance).
- **Memory optimizer** → upgrade `learned_patterns` granularity from `change_type` to
  `change_type × context` (page type, cluster, intent) so prioritization personalizes.
- **Tool/skill-selection optimizer** → today the signal→skill map is fixed
  (decay→`blog-write`); learn which skill best resolves each signal type.
- **Repository knowledge-graph builder** → RO-12, also powering RO-11's link graph.

---

## 7. Rankings

**Scores 1–5 (5 = best on that axis).**

| RO | Biz value | Leverage | Easy-to-automate | Human-effort ↓ | Compounding | Notes |
|---|---|---|---|---|---|---|
| RO-6 Eval/benchmark builder | 4 | 5 | 4 | 3 | 5 | substrate for the meta-layer |
| RO-1 Judge calibration | 5 | 5 | 4 | 4 | 5 | safety gate; rides on RO-6 |
| RO-2 Prompt optimizer | 5 | 5 | 3 | 5 | 5 | biggest content-ROI + review-cost win |
| RO-5 Risk-class learner | 4 | 5 | 3 | 5 | 4 | top human-time saver; safety-gated |
| RO-7 Self-heal | 5 | 4 | 3 | 4 | 4 | revenue protection; L3→L4 |
| RO-3 Attribution upgrade | 4 | 5 | 2 | 3 | 5 | improves every future run |
| RO-9 Model routing | 4 | 3 | 5 | 3 | 3 | easiest; direct cost |
| RO-10 Continuous audit | 4 | 4 | 3 | 4 | 4 | kills live trust-failure dwell |
| RO-8 Citation loop | 5 | 4 | 2 | 3 | 4 | highest strategic upside, noisy |
| RO-13 Validator generator | 3 | 3 | 5 | 3 | 4 | cheap compounding safety |
| RO-4 Threshold BO | 3 | 4 | 3 | 3 | 4 | queue quality + cost |
| RO-12 Onboarding | 4 | 4 | 3 | 4 | 3 | scales product to new clients |
| RO-11 Link optimizer | 3 | 3 | 3 | 2 | 3 | |
| RO-14 Doc consistency | 2 | 2 | 5 | 2 | 2 | housekeeping |

**Recommended build order (phased):**

- **Phase A — Measurement substrate:** RO-6 (eval/benchmark) + RO-13 (validator generator)
  + RO-1 (judge calibration). Add an `experiments` table and extend `decision_log` with
  `prompt_variant_id`, `model`, `cost`. *Without a trustworthy measurement layer, every
  later optimizer overfits to noise.* (Design-only spec: `AUTORESEARCH-PHASE-A.md`.)
- **Phase B — Optimize the actors:** RO-2 (prompt/bandit) + RO-9 (routing) + RO-3
  (attribution).
- **Phase C — Close & protect the loop:** RO-7 (self-heal) + RO-10 (continuous audit) +
  RO-5 (risk-class learner, shadow → ratified).
- **Phase D — Strategic & scale:** RO-8 (citations) + RO-12 (onboarding) + RO-4
  (thresholds) + RO-11/RO-14.

---

## 8. Infrastructure the meta-layer needs (design notes, not code)

- **`experiments` table** (Supabase): `id, surface (skill|judge|router|threshold),
  variant_id, arm, allocation, metric, value, status, started_at` — the A/B/bandit registry
  every optimizer writes to.
- **Extend `decision_log`:** `prompt_variant_id`, `model`, `cost_usd` — so attribution can
  join *which variant* produced *which lift at what cost*.
- **`eval_set` table:** golden + synthetic-negative examples with labels (RO-6).
- **Reuse, don't rebuild:** the `orchestrator/lib/supabase.mjs` named-helper pattern, the
  `learned_patterns` attribution join, the eval-gate + `seo-auto-merge` PR flow (every
  promotion is just another `seo-auto` PR), `control.paused` + the budget cap as the
  meta-layer's kill switch.

See `AUTORESEARCH-PHASE-A.md` for the design-only implementation spec of Phase A.

---

## Limitations & risks

- **Attribution noise is the binding constraint.** Core updates, seasonality, and SERP
  volatility confound every reward signal here. Use trailing windows, holdouts, and
  significance gates — never react to a single week. RO-3 exists precisely because the
  current loop does not.
- **Meta-optimization must not escape the safe envelope.** Every optimizer in this roadmap
  touches only `safe`-class behavior and promotes through the existing eval-gate + a human
  ratification. The Scaled-Content-Abuse and YMYL/brand gates from `AGENTIC-ROADMAP.md`
  stay permanent.
- **Cost compounds with autonomy.** Bandits, judge-variant panels, and synthetic query
  probes all spend metered tokens. Each meta-loop runs under `control.paused` + the monthly
  budget cap, with the same model-routing discipline.
- **LLM-as-judge calibrates format and lift correlation, not truth.** RO-1 improves the
  judge's agreement with outcomes; it does not replace the named-human operator-truth step.
- **Self-healing can mask root causes** — log every auto-revert so a silent fix stays
  auditable (RO-7 + RO-13).
