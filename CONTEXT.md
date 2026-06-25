# System Context — BuildSmarter Agentic SEO Orchestrator

Canonical domain vocabulary for this repo. Use these terms exactly in code, prompts,
ADRs, and runbooks. Do not substitute synonyms.

---

## Architecture layers

**sensing layer** — scripts that poll external APIs (GSC, sitemap) and write items into
the `work_queue`. No LLM involved. Sources: `scripts/sensor-gsc.mjs`,
`scripts/sensor-sitemap.mjs`, `scripts/sensor-indexation.mjs` (GSC URL Inspection API,
quota-capped). Each sensor is a config object (thresholds + a `fetch`) driven by the
shared harness `orchestrator/lib/sensor.mjs`, which owns `do_not_touch` filtering, queue
mapping, `enqueue`, and per-sensor error isolation.

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
`prioritize.mjs`. Snapshots GSC metrics (and GA4 conversions/sessions when
`GA4_PROPERTY_ID` is set; CSV fallback otherwise) into `outcomes`, attributes a blended
click+position lift to `change_type` in `learned_patterns`, then re-scores the
`work_queue` by priority.

**escalation mirror** — `scripts/push-escalations.mjs`. A one-directional mirror that
reads `work_queue` rows with `status='escalated'` and a null `linear_issue_id`, creates
one Linear issue per row via the Linear GraphQL API, and writes the issue id back so
re-runs never duplicate. Runs in the weekly `learn` job. No LLM involved. Supabase stays
the source of truth; Linear is the human-facing mirror. Closing an escalated item
(Linear done → `work_queue` done) is a human/SQL action, not automated.

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
source, linear_issue_id, target_query`. Status values: `pending | in_progress | done | escalated`.
`linear_issue_id` is the escalation-mirror pointer: null until `push-escalations.mjs`
records the Linear issue it created for an escalated row (makes the mirror idempotent).
`target_query` is the GSC striking-distance query carried from `sensor-gsc.mjs` so
`metadata-generate` optimises for that exact query (ADR-009 R1); null on non-query rows.

**change_set** — one row per field edit the `seo-fixer` wants to make on a CMS page.
Columns: `platform, page_id, collection_id, url, field, base_value, new_value, status,
batch, change_type`. (`collection_id` scopes a Webflow CMS item; `batch` groups rows from
one run; `change_type` is the kit skill that produced the change, carried to
`decision_log.change_type` → `learned_patterns` for per-skill attribution.)
Status values: `pending | approved | applied | published | failed | escalated | rolledback`.
The `base_value` is what the agent read from the live CMS when generating the change —
used for drift detection at apply time.

**snapshots** — pre-overwrite backups written by the pack before every CMS write. The
rollback tape. No equivalent needed in repo path (git revert fills that role).

**decision_log** — audit trail of every action the orchestrator took or refused.
Columns: `url, action, risk_class, change_type, reason, agent, pr_url`.
Action values: `applied | escalate | skip | queued`.

**do_not_touch** — URLs the agent must never edit. Seeded manually. Checked by sensors
and orchestrator before any action.

**outcomes** — weekly snapshots of per-URL metrics (clicks, impressions, position,
citations, conversions). Primary source: GSC. Secondary: CSV imports.

**learned_patterns** — one row per `change_type`, storing `avg_effect` (relative click
lift) and `n` (sample count). Feeds `prioritize.mjs`.

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

**yoast_head verify** — the fail-soft post-write check in `packs/wordpress/apply.mjs`.
After writing a meta field it re-reads the page's documented `yoast_head` REST field and,
if the written value is absent, logs a `skip` (likely a cache flush is needed). Never
throws — if `yoast_head` is missing (plugin inactive/old) it degrades silently.

---

## Reverse-engineered dependencies

**None in use.** Verified 2026-06-25 against the live WordPress install
(`www.maxxbuilders.com`, Yoast SEO Premium v27.5). Every Yoast/WordPress surface the code
touches is **documented**, not reverse-engineered:

- **`seo-rest-bridge.php`** — an mu-plugin on the WP host that calls `register_post_meta`
  with `show_in_rest` on the Yoast/Rank Math meta keys for both `post` and `page`. This
  is the documented WP REST meta API. *Soft dependency:* it is installed on the host, not
  loaded by this repo. If it is absent, REST silently drops meta writes (the write
  succeeds, the meta no-ops). Treat its absence as a fail-soft condition, not a hard error.
- **`yoast_head` / `yoast_head_json`** — the documented Yoast REST fields on `wp/v2`
  responses. `packs/wordpress/apply.mjs` reads `yoast_head` for a fail-soft post-write
  verify (`verifyYoastHead`): if absent, it degrades silently.

**Fragile Yoast endpoints that exist on the install but the code does NOT use** (reachable,
but adopting any of them is a reverse-engineering decision — must be **fail-soft behind a
flag** and documented here first):

- `yoast/v1/get_head` — renders the full SEO head HTML for any URL (verified 200,
  unauthenticated). A simpler readback than `yoast_head_json`, but undocumented contract.
- `yoast/v1/prominent_words/*` — internal NLP indexing routes (`get_content`, `save`,
  `complete`); auth+nonce gated, **no public reader** (a direct `prominent_words/{id}`
  read returns 404). Not usable without reverse-engineering the admin nonce flow.
- `yoast/v1/semrush/related_keyphrases` — Yoast→Semrush proxy for keyword expansion.
  Spiked 2026-06-25 (`docs/spikes/semrush-proxy-auth-2026-06-25.md`): reachable headlessly
  via the existing Editor Application Password (Basic auth → 200 + real data) because a
  human pre-connected the Semrush OAuth token in WP admin. The token can't be re-created
  headlessly and spends Semrush quota — so any use stays fail-soft behind a flag.

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
