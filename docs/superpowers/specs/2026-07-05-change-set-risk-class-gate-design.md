# A8 — Deterministic risk_class gate for the change_set apply path

**Date:** 2026-07-05 · **Lane:** Panel A (core/runtime audit findings A1–A13) · **Finding:** A8

## Problem

The orchestrator classifies every action as `risk_class = safe | gated` — `safe` items are
auto-applied, `gated` items must stop for a human. Today that classification is enforced
**only in prose**, in three places:

1. `orchestrator/goal.mjs` (`GOAL_REPO` / `goalCms` templates) — tells the agent "for rows
   where risk_class == safe, act; otherwise escalate."
2. `.claude/agents/seo-fixer.md` — tells the subagent "if gated-class, return fail."
3. A human running `UPDATE change_set SET status='approved'`.

Nothing in code enforces it. Verified against live `origin/main` = `1daf1f1`:

- `work_queue.risk_class` exists (`text default 'safe'`, no CHECK constraint). Live probe
  (SELECT-only, 2026-07-05): 348/348 sampled pending rows are `'safe'` — zero `'gated'` rows
  currently pending.
- `decision_log.risk_class` exists (`text`, no CHECK constraint). Live probe: 298 `'safe'` /
  163 `'gated'` across 461 rows, all clean values (no nulls/garbage) — confirms gated
  escalations do happen historically, they just never reach `change_set`.
- **`change_set` — the table that actually drives live CMS writes — has no `risk_class`
  column at all.** `orchestrator/lib/payload.mjs:parseChangesetPayload()` explicitly strips
  any `risk_class` field the agent includes in its payload before the row reaches
  `insertChangeset()`. The field is dead on arrival.
- `applyRow()` in `orchestrator/lib/cms.mjs` — the function that calls the WordPress/Webflow
  write APIs — checks `do_not_touch`, drift, and a placeholder-content guard before writing,
  but has **no risk_class check**, because the column doesn't exist to check.

**Net effect:** under the current goal prompt, `change_set` rows are only ever created for
`work_queue` rows the agent already read as `'safe'` (the prompt never writes a change_set
row for a gated item — it escalates instead), so this is not fixing an active bug in
production today. It closes the failure mode that matters: a misclassified or hallucinated
`'safe'` tag, or any future code path that bypasses the goal-prompt logic, has nothing
stopping it from reaching a live CMS write.

## Non-goals

- **No goal-prompt wording change.** `.claude/CLAUDE.md` warns that the eval-gate judge
  scores the diff, and a goal-prompt change can shift what the agent produces and fail the
  gate. This design requires zero edits to `goal.mjs` or `seo-fixer.md` — `goalCms`'s
  seo-fixer template already writes `"risk_class": "safe"` into every payload it produces
  today (only reachable for rows the prompt already filtered to `risk_class=="safe"` at
  step 2); the fix is to stop discarding that field and start honoring it.
- **No task-type → risk_class central classifier.** Six-plus sensor files each hardcode the
  literal `risk_class: "safe"` at enqueue time with no shared source of truth — a real
  finding, but orthogonal to this one and out of scope for a single surgical PR. Noted as a
  follow-up (see Open Questions).
- **No DB-level cross-column CHECK** forbidding `risk_class='gated'` rows from ever reaching
  `status IN ('approved','applied','published')`. Considered and explicitly rejected —
  Harris's call (2026-07-05): an application-code gate is enough for the current failure
  mode (nothing enforces risk_class at all today; zero gated rows exist in production), and
  a DB-level constraint would additionally require designing a human "reclassify before
  override" workflow that isn't needed yet. Revisit if gated rows ever appear in
  `change_set` in practice.

## Design

### 1. Schema (`sql/schema.sql`)

Applied by the agent directly via the Supabase Management API (standing instruction —
`feedback-apply-schema-via-mgmt-api` memory), never as raw DDL from the orchestrator, never
by asking Harris to paste SQL. Requires its own explicit go-ahead before applying (separate
from the go-ahead to write the code).

```sql
-- change_set.risk_class: carries the row's classification into the table that actually
-- drives live CMS writes (previously absent — the whole reason applyRow() couldn't check it).
alter table change_set add column if not exists risk_class text default 'safe';

-- Garbage/typo-proofing at the DB boundary (idempotent — Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS, so wrap in a DO block and swallow duplicate_object).
do $$ begin
  alter table work_queue add constraint work_queue_risk_class_check
    check (risk_class in ('safe', 'gated'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table decision_log add constraint decision_log_risk_class_check
    check (risk_class in ('safe', 'gated'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table change_set add constraint change_set_risk_class_check
    check (risk_class in ('safe', 'gated'));
exception when duplicate_object then null;
end $$;
```

The `change_set.risk_class default 'safe'` backfills all 162 existing rows automatically —
harmless, since those rows are already applied/escalated/failed and this column only gates
*future* writes through `applyRow()`.

Pre-flight: both `work_queue.risk_class` (348/348 `'safe'`) and `decision_log.risk_class`
(298 `'safe'` / 163 `'gated'`, no nulls) already satisfy the CHECK — confirmed live,
2026-07-05. The `ADD CONSTRAINT` calls are expected to succeed with no pre-existing
violations.

### 2. `orchestrator/lib/payload.mjs`

`parseChangesetPayload()` currently drops `risk_class` from the incoming object. Change it
to carry the value through (default `'safe'` if absent, matching the existing posture in
`parseLogPayload`), and reject any value that isn't `'safe'`/`'gated'` — fail closed on a
garbage value from a misbehaving agent rather than silently defaulting it away.

No change needed to `orchestrator/lib/supabase.mjs::insertChangeset()` — it already inserts
the row object as-is (`db.from("change_set").insert(row)`), so once the parsed row includes
`risk_class`, it flows straight through.

### 3. `orchestrator/lib/cms.mjs`

In `applyRow()`, add a new escalation gate immediately after the existing `do_not_touch`
checks and before `adapter.supports(row)` — same shape as every other escalation in this
function (`setStatus(row.id, "escalated")` + `logDecision({ risk_class: "gated", ... })`,
a new reason constant):

```js
const RISK_CLASS_REASON = "risk_class: row is not safe-class — apply blocked at boundary";
// ...
if (row.risk_class !== "safe") {
  await store.setStatus(row.id, "escalated");
  await store.logDecision({ url: row.url, action: "escalate", risk_class: row.risk_class ?? "gated", change_type: row.change_type ?? null, reason: RISK_CLASS_REASON });
  return "escalated";
}
```

Fail-closed: anything other than the exact string `'safe'` (including `null`/`undefined`,
which shouldn't occur post-payload-fix but is defended anyway) escalates rather than writes.
Placed before any CMS I/O (`adapter.read`/`snapshot`/`write`) so a gated row never touches
the live site at all, matching the do_not_touch gate's placement rationale.

## Testing (TDD)

- `test/payload.test.mjs` — `parseChangesetPayload` carries `risk_class` through when
  present; defaults to `'safe'` when absent; throws on an invalid value (e.g. `'yolo'`).
  Watch RED (current behavior drops the field / has no validation) before the fix.
- `test/apply.test.mjs` — `applyRow()` escalates and never calls `adapter.write()` when
  `row.risk_class === 'gated'`; still applies normally when `'safe'`. Watch RED before the
  fix (today the row has no risk_class awareness at all, so a gated row would proceed to
  write).
- Schema CHECK constraints are not locally unit-testable (no local Postgres in CI) — verified
  live via a Management API SELECT probe before and after applying (confirms constraint
  exists, confirms it accepted existing data with zero violations).

## Rollout

1. Implement in isolated worktree `../maxx-seo-agent-a8`, branch
   `fix/change-set-risk-class-gate`, off `origin/main` (already created).
2. TDD: write failing tests, watch RED, implement, watch GREEN.
3. 4-skeptic adversarial Workflow verify (bypass / regression / caller-contract / semantics)
   before committing, per Ultracode standing instruction.
4. `database-reviewer` agent pass on the schema/constraint changes before committing.
5. Commit locally (conventional format, ≤100-char header, no `Co-Authored-By`).
6. Separate, explicit go-aheads required for: (a) applying the schema DDL via the Management
   API, (b) pushing the branch, (c) opening the PR. None of these are covered by the
   `proceed` that authorized this design/implementation.
7. Human-merge only — no `seo-auto` label.

## Open questions / follow-ups (not this PR)

- **Task-type → risk_class centralization.** `orchestrator/lib/tasks.mjs`'s `KIT_TASKS` is a
  name allowlist with no attached risk metadata; six-plus sensor files each hardcode the
  literal `"safe"` at enqueue time. A single `classifyRisk(task)` function would remove that
  duplication and close a real (if lower-severity) gap. Candidate for a later Panel A finding
  or a follow-up chore — not bundled here to keep this PR surgical.
- **DB-level cross-column CHECK** (forbidding `gated` + `approved/applied/published`) —
  explicitly deferred per Harris's call above. Revisit if a gated row is ever observed in
  `change_set` in practice, or if the human-approval workflow starts handling gated
  overrides directly.
