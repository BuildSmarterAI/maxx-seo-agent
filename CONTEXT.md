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

## Domain glossary — Phase A additions

> Reasoning and forward-looking terms from the domain-modeling session (commit 4ac53e9).
> The core terms above remain canonical; these extend them. See `docs/adr/`.

### blast_radius

The reasoning framework used to assign a `risk_class` label to a task before it enters the `work_queue`. Describes the *consequence surface* of a failure — how many pages, how much live traffic, or how many downstream systems are affected if the action goes wrong. Not a stored column; a classification criterion.

- Low blast radius → `risk_class = safe` (e.g., updating one page's meta title)
- High blast radius → `risk_class = gated` (e.g., a global Webflow site publish that flushes all pending changes across every page)

Related: `risk_class`, `work_queue`

### approval-to-publish loop

The sequence from agent output to live content. Two distinct variants exist, keyed by site platform type:

#### Loop A — Repo-based (git-managed sites: Next.js, Hugo, etc.)

```text
orchestrator → branch + PR (label: seo-auto)
→ seo-auto-merge.yml queues squash-merge
→ eval_gate required checks (eval-judge + diff-size) must pass
→ if pass: auto-merged → CI deploys
→ if fail: sits open, human reviews and merges manually
```

#### Loop B — Live CMS (WordPress, Webflow)

```text
agent writes change_set rows (status=pending)
→ human flips status=pending→approved  ← human gate (SQL or review UI)
→ seo-apply-cms.yml runs (nightly schedule or manual dispatch)
→ WordPress: writes immediately to live (staging URL recommended)
→ Webflow: stages changes (draft); nothing live yet
→ Webflow publish: separate explicit step (workflow_dispatch, publish=true + WEBFLOW_ALLOW_SITE_PUBLISH env)
```

Key difference: Loop A has an automated `eval_gate` before content goes live. Loop B's quality gate is the human who flips `status=approved` — no automated eval-judge runs in the live-CMS path.

Related: `eval-gate`, `change_set`, `snapshot`, `risk_class`

### client_id

A canonical kebab-case slug that uniquely identifies a client across all repos in the Phase A architecture (e.g., `maxx-builders`, `buzz-roofing-co`). Defined in `config/client.json` or the `.env` template per repo. Not enforced as a DB column during Phase A — used as a batch name prefix and as the future migration key when the system moves to multi-tenancy.

See: [ADR-0001](docs/adr/0001-repo-per-client-with-migration-path.md)

Related: `work_queue`, `change_set`

### vertical_config

The set of per-client fields in `CLAUDE.md` that drive the single configurable content skill. Required fields: `VERTICAL` (kebab-case name), `SERVICE_TAXONOMY` (comma-separated services), `LOCAL_MODIFIERS` (city/region list), `STAT_SOURCES` (authoritative citation sources), `PRIMARY_ENTITIES` (legal name, brand, sameAs URLs). Missing fields produce generic output — the orchestrator preflight must validate all are present before dispatching content skills.

See: [ADR-0003](docs/adr/0003-single-configurable-skill-over-vertical-templates.md)

Related: `work_queue`, `client_id`

### gbp_platform

The value `'gbp'` added to the `change_set.platform` enum to support Google Business Profile writes. GBP `change_set` rows follow Loop B (live-CMS path): agent writes rows at `status=pending`, human flips to `approved`, `packs/gbp/apply.mjs` calls the GBP write API. GBP changes remain permanently gated per ADR-0002 — no GBP row can be auto-applied regardless of risk_class.

Fields specific to GBP rows: `page_id` = GBP location ID, `field` = one of `description | category | hours | photo | review_reply | qa_answer`.

Related: `change_set`, `approval-to-publish loop`, `snapshot`

### link_prospects

A new Supabase table tracking the outreach pipeline for link building. One row per prospect domain/contact pair. Created by the `link-prospect` skill (LLM-side); humans approve drafts and send manually; status is updated post-send by operator or future automation.

Status machine: `drafted → approved → sent → replied → won | lost | skipped`

Key fields: `domain`, `contact_email`, `target_page_url` (our page we want linked to), `pitch_angle`, `draft_subject`, `draft_body`, `status`, `batch`, `client_id` (placeholder for Phase B migration), `created_at`, `sent_at`, `outcome_at`

Not part of `change_set` — link outreach is a pipeline with its own multi-stage status, not a field-level CMS edit.

Related: `work_queue`, `client_id`

---

## Architectural Decisions

- [ADR-0001](docs/adr/0001-repo-per-client-with-migration-path.md) — Repo-per-client now; migrate to multi-tenant monorepo at 10 clients or when unified dashboard is needed
- [ADR-0002](docs/adr/0002-human-gate-policy-for-live-actions.md) — Human gate policy: safe-class auto-executes within thresholds; permanently-gated actions (merges, YMYL, GBP, pricing) never auto-execute
- [ADR-0003](docs/adr/0003-single-configurable-skill-over-vertical-templates.md) — One configurable `blog-write` skill reads `vertical_config` from `CLAUDE.md` rather than a per-vertical template library; revisit at 5+ verticals or first eval regression

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
