# System Context — BuildSmarter Agentic SEO Orchestrator

Canonical domain vocabulary for this repo. Use these terms exactly in code, prompts,
ADRs, and runbooks. Do not substitute synonyms.

---

## Architecture layers

**sensing layer** — scripts that poll external APIs (GSC, sitemap) and write items into
the `work_queue`. No LLM involved. Sources: `scripts/sensor-gsc.mjs`,
`scripts/sensor-sitemap.mjs`.

**orchestrator** — the master agent (`orchestrator/run.mjs`) that reads the `work_queue`,
dispatches `seo-fixer` subagents, and routes output to either the repo path or the CMS
path based on `SITE_PLATFORM`. Runs on Sonnet 4.6 by default.

**subagent** — a bounded child agent the orchestrator dispatches via the Agent SDK. The
only subagent defined today is `seo-fixer`. Do not call subagents "components."

**seo-fixer** — the subagent that executes one kit skill against one URL. In repo mode it
edits files; in CMS mode it resolves `page_id`, reads `base_value`, generates a new
value, and writes a `change_set` row via `mem.mjs`. Never writes to a live CMS directly.

**eval-gate** — the GitHub Actions required check (`seo-eval-gate.yml`) that runs on
every `seo-auto` PR. Contains two steps: diff-size guard and LLM-as-judge
(`scripts/eval-judge.mjs`, Haiku 4.5). Fails closed on any error. Not a rubber stamp.

**learning loop** — the weekly pipeline: `collect-outcomes.mjs` → `attribute.mjs` →
`prioritize.mjs`. Snapshots GSC metrics into `outcomes`, attributes click lift to
`change_type` in `learned_patterns`, then re-scores the `work_queue` by priority.

---

## Publishing paths

**repo path** — for code-accessible sites (Next.js, static). Orchestrator creates a git
branch, `seo-fixer` edits files, orchestrator opens a PR, eval-gate runs, auto-merge
fires if all checks pass. Human merge is the gate when checks fail.

**CMS path** — for WordPress and Webflow. Orchestrator runs `seo-fixer` to write
`change_set` rows (status=`pending`) into Supabase. A human flips rows to `approved`.
The `seo-apply-cms` workflow applies them via the platform pack. Nothing goes live
without human approval.

**platform pack** — the adapter that reads `approved` rows from `change_set` and writes
to a live CMS. Located in `packs/wordpress/` and `packs/webflow/`. Packs always
snapshot before writing and escalate on drift.

---

## Supabase tables (memory layer)

**work_queue** — pending actions. Columns: `url, task, risk_class, priority, status,
source`. Status values: `pending | in_progress | done | escalated`.

**change_set** — one row per field edit the `seo-fixer` wants to make on a CMS page.
Columns: `platform, page_id, url, field, base_value, new_value, status, change_type`.
Status values: `pending | approved | applied | published | failed | escalated | rolledback`.
The `base_value` is what the agent read from the live CMS when generating the change —
used for drift detection at apply time.

**snapshots** — pre-overwrite backups written by the pack before every CMS write. The
rollback tape. No equivalent needed in repo path (git revert fills that role).

**decision_log** — audit trail of every action the orchestrator took or refused.
Columns: `url, action, risk_class, change_type, reason, agent, pr_url`.
Action values: `applied | escalate | skip | queued | rolledback`.

**do_not_touch** — URLs the agent must never edit. Seeded manually. Checked by sensors
and orchestrator before any action.

**outcomes** — weekly snapshots of per-URL metrics (clicks, impressions, position,
citations, conversions). Primary source: GSC. Secondary: CSV imports.

**learned_patterns** — one row per `change_type`, storing `avg_effect` (blended
click/impression/position lift, per ADR-006 #1) and `n` (sample count). Feeds `prioritize.mjs`. **`change_type` uses the `task`
vocabulary** — the kit-skill name (`metadata-generate`, `blog-write`, `seo-audit`, …),
the same value space as `work_queue.task`. The orchestrator enforces this by logging
every applied decision with `--type <task>` (see `orchestrator/goal.mjs` and
`run.mjs`), so `attribute` keys patterns by the task name and `reprioritize` joins them
back with `patterns.get(row.task)`. This shared key is what makes the learning loop
actually reweight the queue. A `decision_log` row whose `change_type` is *not* a task
name — e.g. a CMS apply that fell back to a field name because the `change_set` carried
no `--type` (`packs/*/apply.mjs`) — produces a `learned_patterns` row that no queue row
can ever match: dead weight, never a join. `reprioritize` logs the match rate so such a
no-op is visible rather than silent.

**control** — single-row table. Holds the kill switch (`paused`) and monthly spend
tracker (`spend_usd`, `month`). Orchestrator checks both at preflight.

**sitemap_seen** — tracks every URL ever seen in the sitemap so the sensor only enqueues
newly discovered URLs.

---

## Key concepts

**risk_class** — every `work_queue` row and `decision_log` entry is tagged `safe` or
`gated`. Safe items are acted on automatically within thresholds. Gated items are always
escalated to a human.

**SITE_PLATFORM** — env var that tells the orchestrator which publishing path to use.
Values: `repo` (default), `wordpress`, `webflow`. One value per repo instance.

**base_value** — the live CMS field value at the moment the `seo-fixer` generated a
proposed change. Stored in `change_set`. Re-read at apply time; if it changed, the pack
escalates (drift). Prevents the agent from clobbering a human edit.

**drift** — when the live CMS value no longer matches `base_value` by apply time. The
pack escalates and skips rather than overwrite.

**kill switch** — `UPDATE control SET paused = true WHERE id = 1`. Stops every
orchestrator run at preflight. Also available via disabling the GitHub Actions workflows.

**eval-judge** — the LLM-as-judge step inside the eval-gate. Runs on Haiku 4.5. Scores
quality, brand safety, fact-checkability, and information gain. Fails closed: any
unparseable output, low score, or fabrication risk → exit 1 → PR blocked.

**mem.mjs** — CLI wrapper the orchestrator's Bash calls use for all Supabase writes in
headless/CI mode. Commands: `queue`, `log`, `status`, `changeset`. Avoids MCP
tool-approval friction in autonomous runs.

---

## Reverse-engineered dependencies

None currently. If any are added, document them here with a **fail-soft** note: the
integration must degrade gracefully behind a feature flag and never hard-break a run.

---

## Terms NOT used in this system

Do not use these synonyms — they introduce ambiguity with the canonical terms above.

| Avoid | Use instead |
|---|---|
| component | subagent |
| boundary | seam |
| backlog | work_queue |
| pipeline | learning loop (for the weekly feedback path) |
| agent loop | orchestrator |
| content agent | seo-fixer subagent |
