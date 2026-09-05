# Session Handoff — POINTER (not the handoff itself)

> **This file is not authoritative. Do not read it for repo state.**
>
> It previously carried a 2026-07-03 handoff that opened with *"This supersedes ALL earlier
> handoff versions."* That claim outlived its truth: the authoritative handoff moved to the
> repo root on 2026-07-09. A stale file asserting supremacy is a cross-machine trap, so the
> content was replaced with this signpost on **2026-07-10**. The old text is preserved in git
> history (`git show 7598266:.claude/SESSION_HANDOFF.md`).

## Where the real handoffs live

| Scope | File | Authority |
|---|---|---|
| **Repo-wide state** — `main`, open PRs, merged work, gated follow-ups, remote-branch cleanup | [`SESSION_HANDOFF.md`](../SESSION_HANDOFF.md) *(repo root)* | **Authoritative.** Rewrite its *Current handoff* block at the end of each session. |
| **Branch-specific state** — objective, files changed, validation, next actions for one branch | `.claude/handoffs/<sanitized-branch-name>.md` | Authoritative **for that branch only**. |

## Reading order on a new machine

1. `CLAUDE.md` (root) — SEO thresholds, entity truth, production-only WordPress policy.
2. `.claude/CLAUDE.md` — how to work inside this repository.
3. `SESSION_HANDOFF.md` (root) — repo-wide state.
4. `.claude/handoffs/<your-branch>.md` — branch-specific state, if one exists.
5. **Verify git state against those docs before editing.** Handoffs are leads, not truth.

```powershell
git fetch --prune origin
git status --short --branch
git log --oneline --decorate -10
git branch -vv ; git worktree list ; git stash list
gh pr list --state open
```

Report any drift from the handoff **before** doing work.

## Naming convention for branch handoffs

Replace `/` with `-` in the branch name:

| Branch | Handoff file |
|---|---|
| `docs/agent-roster-prd-salvage` | `.claude/handoffs/docs-agent-roster-prd-salvage.md` |
| `feat/a8-repo-risk-gate` | `.claude/handoffs/feat-a8-repo-risk-gate.md` |

## Standing safety rules (full text in `.claude/rules/`)

- Never push to `main` directly. Branch → PR → **human merge**. Never self-merge.
- No PR merges, branch/worktree deletions, Supabase DDL or Management-API calls, WordPress
  writes, or Linear mutations without explicit, **individually-named** approval. A bare
  "proceed" authorizes one named action, not a chain.
- Never print or commit secrets. `.env` and `gcp.json` are gitignored and never transfer between
  machines — recreate them locally.
- Check the kill switch and budget before any loop: `control.paused` / `control.spend_usd`.
- Read-only first, propose, then act.
