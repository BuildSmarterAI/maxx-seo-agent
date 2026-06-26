# ADR-003 — Model tier routing

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

The orchestrator, subagents, and eval-gate all invoke the Anthropic API. Each job has
different reasoning requirements. Headless usage draws from a metered credit pool that
does not roll over, so unconstrained Opus usage is a real cost exposure.

## Decision

| Job | Model | Rationale |
|---|---|---|
| Orchestrator (`run.mjs`) | Sonnet 4.6 (default; `ORCHESTRATOR_MODEL` overrides) | Plans + dispatches; needs solid reasoning but not max capability |
| `seo-fixer` subagent | Inherits orchestrator model via Agent SDK | One skill per URL; same tier as orchestrator is appropriate |
| Eval-judge (`eval-judge.mjs`) | Haiku 4.5-20251001 (hardcoded in workflow) | Structured JSON scoring; cheap model is sufficient; runs on every PR |
| Planning / complex multi-file reasoning | Opus 4.8 (manual only; not in automated loop) | Reserve for human-driven sessions where cost is a one-off |

## Rationale

Haiku for the eval-judge: it runs on every `seo-auto` PR, often multiple times. The task
is structured (score a diff, return JSON) and well within Haiku's capability. Running
Sonnet or Opus here would multiply the per-PR cost with no quality benefit.

Sonnet for the orchestrator: complex enough to plan and route correctly; cheaper than
Opus for a job that runs nightly.

`ORCHESTRATOR_MODEL` env override allows temporary escalation to Opus for debugging
without a code change.

## Consequences

- Do not change `JUDGE_MODEL` in the workflow without a cost review.
- If the judge starts failing on legitimate content, lower `JUDGE_MIN_SCORE` before
  upgrading the model (OPERATIONS.md §3).
- The `seo-fixer` inheriting the orchestrator model is intentional. If subagent quality
  degrades, override it explicitly in the agent definition rather than upgrading
  the orchestrator tier globally.

## Files affected

- `orchestrator/run.mjs` — `ORCHESTRATOR_MODEL` env var, default `claude-sonnet-4-6`
- `.github/workflows/seo-eval-gate.yml` — `JUDGE_MODEL: claude-haiku-4-5-20251001`
- `scripts/eval-judge.mjs` — reads `JUDGE_MODEL` from env
