# Workflow Rules — maxx-seo-agent

## Before touching any file

1. **Read root `CLAUDE.md` for SEO thresholds.** CWV limits, metadata char caps, doorway
   guardrail numbers, and the never-touch list all live there. Do not guess them.
2. **Check the queue.** `node scripts/mem.mjs queue` shows pending items. Don't invent
   tasks or act on URLs not in the queue unless doing an interactive audit.
3. **Check the kill switch.** If `control.paused = true` in Supabase, stop. Nothing
   should proceed when the system is paused.
4. **Check `do_not_touch`.** Any URL in that table is off-limits regardless of what
   the queue or audit says.

## Task execution pattern

Approach every task as: **understand → plan → act → validate → report**.

- **Understand:** read the relevant skill file in `.claude/skills/` before starting.
  Skills define inputs, steps, outputs, and guardrails for their task type.
- **Plan:** for multi-file changes, write a one-paragraph plan (what changes, what
  validates, what stays the same) before touching any file.
- **Act:** prefer skill-based execution over ad-hoc edits. If a `.claude/skills/`
  entry covers the task, invoke it.
- **Validate:** run all applicable validators after every edit (see below).
- **Report:** log to `decision_log` via `node scripts/mem.mjs log ...`. Mark queue
  rows done or escalated.

## Validators to run after edits

| Changed file | Validator to run |
|---|---|
| `schema/*.jsonld` | `node scripts/validate-json.mjs FILENAME` |
| `metadata-changes.csv` | `npm run validate:metadata` |
| PR diff | `npm run diff-size` (checks against `MAX_DIFF_LINES`) |
| Any content change | `npm run judge` (LLM-as-judge, optional but informative) |

## Risk-class discipline

The orchestrator must classify every action before acting.

| Risk class | What it covers | Action |
|---|---|---|
| `safe` | Metadata (title/description), schema generation/repair, internal links, broken links, alt text, sitemap hygiene, CWV template fixes, decayed-post refresh under size + uniqueness thresholds | Proceed, validate, log, open PR |
| `gated` | Brand/pricing/positioning, YMYL (legal/financial/health/safety), new page batches above threshold, merges/deletes with backlinks, 301 redirects, GBP/NAP changes | Log `action='escalate'` via `mem.mjs`, mark status `escalated`, do NOT act |

When the risk class is unclear, escalate. The system is designed to be conservative; a
missed safe-class item costs one run cycle. A wrongly-applied gated item can damage
rankings or violate brand policy.

## Branch and PR discipline

- Branch name: `seo/auto-YYYY-MM-DD-NNNNN` (the orchestrator creates this automatically).
- `git add -A` only after all validators pass and no errors are logged.
- Commit message: `seo: <description> [skip ci]` only for non-content chores; content
  changes should not carry `[skip ci]` so the eval-gate runs.
- One PR per orchestrator run. Don't open multiple PRs from the same run.
- Never merge, rebase, or squash PRs manually — the `seo-auto-merge` workflow handles
  this after all required checks pass.

## Interactive vs. headless operating modes

**Interactive (Claude Code session):**
- File tools, Supabase MCP, and `.claude/skills/` are all available.
- Use this mode for exploration, audits, artifact generation, and debugging runs.
- `npm run orchestrate` runs the full orchestration loop locally if needed.
- Commit and push when satisfied; the PR flow is the same.

**Headless (orchestrator via GitHub Actions):**
- `settingSources: ["project"]` loads this entire `.claude/` directory: CLAUDE.md,
  rules, skills, and hooks all load automatically.
- The orchestrator's goal prompt is defined in `orchestrator/run.mjs`. Modifying it
  changes what the agent produces and may cause the eval-gate judge to fail.
- `scripts/mem.mjs` is the Bash-callable queue interface — no MCP approval friction.

## Programmatic page guardrail

Before any batch of generated pages:
- Run the quality gates in `programmatic-plan` skill: eligibility, uniqueness ≥ 0.5,
  unique intro + recommendation block per page, minimum content threshold, ≥ 3 internal
  links per page.
- Warn at 30 pages generated. Hard-stop at 50 and require human manifest review before
  any apply step.
- Never let a single run both generate and publish unattended — generate → human reviews
  manifest → apply → (Webflow only) human-triggered publish.
