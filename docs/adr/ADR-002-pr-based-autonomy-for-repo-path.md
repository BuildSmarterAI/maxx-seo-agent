# ADR-002 — PR-based autonomy for the repo path

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris / BuildSmarter

---

## Context

The orchestrator needs a mechanism for applying SEO changes to code-accessible sites
(Next.js, static) that provides a human review gate without requiring manual intervention
on every safe-class change.

## Decision

Agents open pull requests, never direct commits to main. Auto-merge is enabled only when
every required check (eval-gate: diff-size + LLM-as-judge, vitals) passes and the PR
carries the `seo-auto` label. Human merge is required when any check fails.

## Rationale

A PR is a reversible, auditable event. Closing a bad PR discards the branch with no
production impact. Git revert handles post-merge rollback. Direct commits to main would
remove the review window and make rollback harder. Auto-merge scoped to passing checks
achieves the L3 goal (human-on-the-loop, not human-in-the-loop) without removing the
gate entirely.

## Consequences

- GitHub branch protection must be configured with the eval-gate as a required check.
  (`scripts/setup-branch-protection.sh`)
- The `seo-auto` label is the signal that distinguishes bot PRs from human PRs in the
  eval-gate and auto-merge workflows. Remove or rename it and both stop working.
- PRs that fail the judge accumulate and need a human to close them. A runbook entry
  covers this (OPERATIONS.md §3).

## Files affected

- `orchestrator/run.mjs` — creates branch, commits, opens PR with `--label seo-auto`
- `.github/workflows/seo-eval-gate.yml` — required check, enforces only on `seo-auto` PRs
- `.github/workflows/seo-auto-merge.yml` — queues squash merge when checks pass
