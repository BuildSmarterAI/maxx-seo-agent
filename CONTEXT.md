# CONTEXT.md — SEO Orchestrator Domain Glossary

> Canonical vocabulary for this codebase. Implementation details belong in docs/; this file is a glossary only.
> Updated inline during domain modeling sessions. See `docs/adr/` for architectural decisions.

---

## Terms

### blast_radius

The reasoning framework used to assign a `risk_class` label to a task before it enters the `work_queue`. Describes the *consequence surface* of a failure — how many pages, how much live traffic, or how many downstream systems are affected if the action goes wrong. Not a stored column; a classification criterion.

- Low blast radius → `risk_class = safe` (e.g., updating one page's meta title)
- High blast radius → `risk_class = gated` (e.g., a global Webflow site publish that flushes all pending changes across every page)

Related: `risk_class`, `work_queue`

### risk_class

A stored enum on `work_queue` rows. Assigned at enqueue time based on `blast_radius` reasoning.

Values:

- `safe` — orchestrator auto-dispatches; no human approval needed before execution
- `gated` — orchestrator escalates; human must approve before the action runs

Related: `blast_radius`, `work_queue`, `eval_gate`

### work_queue

A task enqueued by a sensor or operator, representing a unit of SEO work to be dispatched. Each row says "run this skill against this URL."

Key fields: `url`, `task` (skill name), `risk_class`, `priority`, `status` (pending → in_progress → done | escalated), `source` (gsc | sitemap | deploy | citation | manual)

A single `work_queue` row is the *input unit*. Its execution produces zero or more `change_set` rows (the output units). The `batch` field on `change_set` rows is the implied link back to the triggering run — not enforced as a foreign key.

Related: `change_set`, `risk_class`, `blast_radius`

### change_set

A field-level edit produced when the orchestrator executes a skill against a `work_queue` task. One `work_queue` task fans out to 0..N `change_set` rows (e.g., a metadata-generate task on one URL produces one row for `title` and one for `description`).

Key fields: `platform` (wordpress | webflow), `page_id`, `url`, `field` (title | description | canonical), `base_value` (drift baseline captured at decision time), `new_value`, `status` (pending → approved → applied → published | failed | escalated | rolledback), `batch`

**Authorship:** `change_set` rows are created by the Claude agent executing the skill (LLM-side), not by Node.js code. The apply layer (`packs/*/apply.mjs`) only reads approved rows and updates status — it never inserts.

**Approval gate:** rows sit at `status=pending` until a human flips them to `approved`. Only then does the apply layer execute the write.

Related: `work_queue`, `approval-to-publish loop`, `snapshot`

### eval_gate

A required CI check (`.github/workflows/seo-eval-gate.yml`) that runs on every PR with the `seo-auto` label. Blocks auto-merge if either sub-check fails. Human-authored PRs bypass it.

Two sub-checks:

1. **eval-judge** (`scripts/eval-judge.mjs`) — LLM-as-judge (Haiku 4.5) scores the PR diff on four dimensions:
   - `quality` (1–5)
   - `brand_safety` (1–5)
   - `fact_checkability` (1–5)
   - `information_gain` (1–5)

   Pass requires ALL scores ≥ `JUDGE_MIN_SCORE` (default: 3) AND `fabrication_risk = false`.

   Hard fail regardless of scores:
   - `fabrication_risk = true`
   - Diff adds unverifiable statistics
   - Edits pricing, brand/positioning claims
   - Edits YMYL content (legal, financial, health, safety)

   Fails closed: model error or unparseable output → exit 1.

2. **diff-size** (`scripts/check-diff-size.mjs`) — blocks if total changed lines (additions + deletions) exceeds `MAX_DIFF_LINES` (default: 400).

Related: `risk_class`, `approval-to-publish loop`

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

Related: `eval_gate`, `change_set`, `snapshot`, `risk_class`

### snapshot

A pre-overwrite backup captured by the apply layer immediately before writing a `change_set` row. Stored in the `snapshots` table. Consumed by `rollback.mjs` to restore the prior live value if an apply goes wrong. One snapshot per `change_set` row, per apply attempt.

Related: `change_set`

### client_id

A canonical kebab-case slug that uniquely identifies a client across all repos in the Phase A architecture (e.g., `maxx-builders`, `buzz-roofing-co`). Defined in `config/client.json` or the `.env` template per repo. Not enforced as a DB column during Phase A — used as a batch name prefix and as the future migration key when the system moves to multi-tenancy.

See: [ADR-0001](docs/adr/0001-repo-per-client-with-migration-path.md)

Related: `work_queue`, `change_set`

---

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
