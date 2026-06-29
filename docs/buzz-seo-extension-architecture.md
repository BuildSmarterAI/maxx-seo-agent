# Buzz Digital Agency — SEO System Extension Architecture

> Extends the existing maxx-seo-agent (L2 orchestrator, single-client) to cover the full SEO
> department for Buzz Digital Agency's multi-client portfolio.
>
> All domain vocabulary defined in `/CONTEXT.md`. Architectural decisions in `/docs/adr/`.

---

## What exists today (maxxbuilders.com baseline)

| Layer | What's built |
|---|---|
| Sensing | GSC decay + striking distance, sitemap diff, AI citation tracker, deploy webhook |
| Orchestration | L2 orchestrator (Claude Agent SDK), branch-per-run, PR auto-merge |
| Skills | metadata-generate, schema-generate, blog-write, blog-audit, cwv-audit, seo-audit, internal-linking, faq-schema, ai-info-page, gsc-opportunity-mining |
| Apply | `packs/wordpress/`, `packs/webflow/` (Loop B live-CMS) |
| Gates | eval_gate (eval-judge + diff-size), ADR-0002 permanent gates, do_not_touch |
| Memory | decision_log, work_queue, change_set, snapshots, outcomes, learned_patterns, control |
| AI search | ai_queries, ai_citations, paa_questions, ai_referrals |
| Reporting | None |

---

## What's being added (Buzz extension)

Five functions in delivery sequence. Each section states: new schema, new sensors, new skills, new apply packs, new config fields, and any gate changes.

---

### Phase C-1 — Ops reporting (Buzz internal, weekly)

**What it does:** Monday-morning digest sent to Buzz account managers. Tasks completed, escalations pending, spend vs. budget, eval_gate failures.

**New GitHub Action:** `.github/workflows/seo-report-ops.yml`
- Schedule: `0 8 * * 1` (Monday 08:00 UTC)
- Calls: `scripts/reporter-ops.mjs`

**New script:** `scripts/reporter-ops.mjs`
- Queries: `decision_log` (last 7 days), `work_queue` (pending + escalated), `control.spend_usd`, `change_set` (failed rows)
- Renders: markdown → HTML via simple template
- Sends: Resend API → `REPORT_OPS_RECIPIENTS`

**New config in `CLAUDE.md`:**
```
REPORT_OPS_RECIPIENTS: ops@buzzdigitalagency.com, am@buzzdigitalagency.com
```

**No new schema.** Reads existing tables only.

---

### Phase C-2 — Client reporting (end-client-facing, monthly)

**What it does:** Monthly performance report sent to each GC client. Rankings, traffic, AI search citations, content published, technical fixes applied.

**New GitHub Action:** `.github/workflows/seo-report-client.yml`
- Schedule: `0 9 1 * *` (1st of month, 09:00 UTC)
- Calls: `scripts/reporter-client.mjs`

**New script:** `scripts/reporter-client.mjs`
- Queries: `outcomes` (28-day vs. prior-28-day), `ai_citations` (monthly citation rate), `decision_log` (action=applied, last 30 days), `change_set` (status=published, last 30 days)
- Renders: branded HTML email (client-readable, no operational data exposed)
- Sends: Resend API → `REPORT_CLIENT_RECIPIENTS`

**New config in `CLAUDE.md`:**
```
REPORT_CLIENT_RECIPIENTS: owner@clientdomain.com
CLIENT_BRAND_NAME: Buzz Roofing Co        # used in report header
```

**No new schema.**

---

### Phase E — Programmatic SEO

**What it does:** Extends the existing doorway-gated page builder to handle multiple verticals via `vertical_config` in `CLAUDE.md`. No new infrastructure — config-driven adaptation of existing skills.

**Modified skills:** `blog-write`, `ai-info-page`, `metadata-generate`
- Each skill reads `VERTICAL`, `SERVICE_TAXONOMY`, `LOCAL_MODIFIERS`, `STAT_SOURCES`, `PRIMARY_ENTITIES` from `CLAUDE.md` at dispatch time
- Prompt structure: shared scaffolding + vertical-injected section
- Orchestrator preflight validates all five fields are present before dispatching any content skill

**New orchestrator preflight check:** `lib/validate-vertical-config.mjs`
- Reads `CLAUDE.md`, asserts all five `vertical_config` fields are non-empty
- Exits with clear error if any field is missing (prevents silent generic output)

**New config in `CLAUDE.md`:**
```
VERTICAL: roofing
SERVICE_TAXONOMY: roof replacement, storm damage repair, flat roofing, gutters, fascia
LOCAL_MODIFIERS: Houston TX, Harris County, Katy TX, The Woodlands TX
STAT_SOURCES: NRCA, NOAA Storm Event Database, Harris County permit data
PRIMARY_ENTITIES: Buzz Roofing Co, LLC | Buzz Roofing | https://linkedin.com/company/...
```

**No new schema. No new sensors. No new apply packs.**

See: [ADR-0003](adr/0003-single-configurable-skill-over-vertical-templates.md)

---

### Phase B — Local SEO / Google Business Profile

**What it does:** Reads GBP data, audits for NAP consistency, missing categories, unanswered Q&A, low review response rate. Generates approved edits and posts them to GBP via the write API after human sign-off. Permanently gated per ADR-0002.

**New vendor:** Google Business Profile API (OAuth 2.0 — same `googleapis` package, new scope: `https://www.googleapis.com/auth/business.manage`)

**New sensor:** `scripts/sensor-gbp.mjs`
- Schedule: weekly (add to `seo-sensors.yml`)
- Reads: GBP locations, recent reviews, Q&A, photo count, category list
- Enqueues: `work_queue` tasks with `task = 'gbp-audit'`, `risk_class = 'gated'`

**New skill:** `.claude/skills/gbp-audit/`
- Reads GBP data snapshot (passed via work_queue context or fetched live)
- Generates `change_set` rows with `platform = 'gbp'`
- Fields: `description`, `category`, `hours`, `review_reply`, `qa_answer`
- All rows land at `status = pending` — no auto-apply path exists for GBP

**New apply pack:** `packs/gbp/apply.mjs`
- Reads: `change_set` rows where `platform = 'gbp'` and `status = 'approved'`
- Calls: GBP write API per field type
- On success: `setStatus(id, 'applied')`
- On error: `setStatus(id, 'failed')` + `logDecision(url, 'skip', 'gated', 'GBP write failed')`
- Note: GBP has no equivalent of "staged draft" — writes are live immediately. Snapshot is captured before every write.

**New GitHub Action step** in `seo-apply-cms.yml`:
```yaml
- name: Apply (GBP)
  if: ${{ github.event.inputs.platform == 'gbp' }}
  env:
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
    GOOGLE_REFRESH_TOKEN: ${{ secrets.GOOGLE_REFRESH_TOKEN }}
    GBP_ACCOUNT_ID: ${{ vars.GBP_ACCOUNT_ID }}
  run: node packs/gbp/apply.mjs
```

**New config in `CLAUDE.md`:**
```
GBP_LOCATION_ID: accounts/123456789/locations/987654321
GBP_NAP_NAME: Buzz Roofing Co, LLC
GBP_NAP_ADDRESS: 1234 Main St, Houston TX 77001
GBP_NAP_PHONE: +17135551234
```

**Schema change:** `change_set.platform` enum gains `'gbp'` as a valid value. No new table needed.

---

### Phase D — Competitor / gap analysis

**What it does:** Weekly SERP scan via DataForSEO identifies keywords where target clients rank 11–30 and competitors rank 1–10 (gap opportunities). Enqueues content creation or refresh tasks into `work_queue`.

**New vendor:** DataForSEO API (`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` in `.env`)

**New sensor:** `scripts/sensor-serp.mjs`
- Schedule: weekly (add to `seo-sensors.yml`)
- Calls: DataForSEO SERP API for each keyword in `config/target-keywords.json`
- Records competitor rankings for configured `COMPETITOR_DOMAINS`
- Enqueues `work_queue` tasks: `task = 'competitor-gap'`, `risk_class = 'safe'` for gaps, `risk_class = 'gated'` for YMYL/pricing keywords

**New skill:** `.claude/skills/competitor-gap/`
- Reads SERP snapshot from sensor output (stored in new `serp_snapshots` table)
- Identifies content angle, missing entities, word count gaps vs. ranking competitor
- Outputs: `work_queue` entry for `blog-write` (new content) or `blog-audit` (refresh existing), with competitor analysis context passed as task metadata

**New config in `CLAUDE.md`:**
```
COMPETITOR_DOMAINS: competitor1.com, competitor2.com, competitor3.com
TARGET_KEYWORDS_FILE: config/target-keywords.json   # existing file, extend per client
```

**New schema table:**
```sql
create table if not exists serp_snapshots (
  id            bigint generated always as identity primary key,
  keyword       text not null,
  engine        text default 'google',
  results       jsonb,           -- top-10 SERP results with URL, title, position
  captured_at   timestamptz default now()
);
create index on serp_snapshots (keyword, captured_at desc);
```

---

### Phase A — Link building

**What it does:** Prospects backlink opportunities from DataForSEO backlink API (competitor backlink profiles, broken link targets, resource page opportunities). Drafts personalized outreach emails. Humans review, approve, and send from their own inbox. Pipeline tracked in `link_prospects`.

**New sensor:** `scripts/sensor-backlinks.mjs`
- Schedule: weekly (add to `seo-sensors.yml`)
- Calls: DataForSEO Backlinks API for `COMPETITOR_DOMAINS` (reuses Phase D vendor)
- Identifies: sites linking to competitors but not to us (gap opportunities)
- Enqueues: `work_queue` tasks with `task = 'link-prospect'`, `risk_class = 'gated'`

**New skill:** `.claude/skills/link-prospect/`
- Given a target domain + linking page URL from the backlink gap
- Researches the linking site (content relevance, contact page, editor name)
- Generates: pitch angle, subject line, personalised body
- Writes: `link_prospects` row at `status = 'drafted'`

**New schema table:**
```sql
create table if not exists link_prospects (
  id                bigint generated always as identity primary key,
  domain            text not null,
  contact_email     text,
  linking_page_url  text,
  target_page_url   text not null,   -- our page we want linked to
  pitch_angle       text,
  draft_subject     text,
  draft_body        text,
  status            text default 'drafted',
  -- status machine: drafted → approved → sent → replied → won | lost | skipped
  batch             text,
  created_at        timestamptz default now(),
  sent_at           timestamptz,
  outcome_at        timestamptz
);
create index on link_prospects (status, created_at desc);
```

**No apply pack.** Humans copy approved drafts from Supabase and send from their own email client. Status is flipped to `sent` manually (or via a future thin UI).

**No new GitHub Action.** Sensor runs within `seo-sensors.yml`. The skill is dispatched by the orchestrator like any other gated work_queue task.

---

## New schema summary (full diff vs. baseline)

| Change | Type | Detail |
|---|---|---|
| `change_set.platform` | Enum extension | Add `'gbp'` as valid value |
| `serp_snapshots` | New table | SERP results per keyword per week |
| `link_prospects` | New table | Outreach pipeline rows |

All existing tables (`work_queue`, `change_set`, `decision_log`, `outcomes`, `snapshots`, `learned_patterns`, `control`) are **unchanged**. Frozen schema per ADR-0001.

---

## New vendor / credential summary

| Vendor | New? | Credentials needed | Used by |
|---|---|---|---|
| DataForSEO | Yes | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | sensor-serp, sensor-backlinks |
| GBP API | Yes (new OAuth scope) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GBP_ACCOUNT_ID` | sensor-gbp, packs/gbp/apply.mjs |
| Resend | Yes | `RESEND_API_KEY` | reporter-ops, reporter-client |

---

## New per-client `CLAUDE.md` fields (full list)

```
# Existing (required by baseline)
CLIENT_ID: buzz-roofing-co

# Phase C reporting
REPORT_OPS_RECIPIENTS: ops@buzzdigitalagency.com
REPORT_CLIENT_RECIPIENTS: owner@clientdomain.com
CLIENT_BRAND_NAME: Buzz Roofing Co

# Phase E programmatic SEO
VERTICAL: roofing
SERVICE_TAXONOMY: roof replacement, storm damage repair, flat roofing, gutters
LOCAL_MODIFIERS: Houston TX, Harris County, Katy TX
STAT_SOURCES: NRCA, NOAA Storm Event Database, Harris County permit data
PRIMARY_ENTITIES: Buzz Roofing Co, LLC | Buzz Roofing | https://...

# Phase B GBP
GBP_LOCATION_ID: accounts/123456789/locations/987654321
GBP_NAP_NAME: Buzz Roofing Co, LLC
GBP_NAP_ADDRESS: 1234 Main St, Houston TX 77001
GBP_NAP_PHONE: +17135551234

# Phase D competitor analysis
COMPETITOR_DOMAINS: competitor1.com, competitor2.com, competitor3.com
```

---

## Delivery sequence

| Phase | Function | New files | Gate | Est. complexity |
|---|---|---|---|---|
| C-1 | Ops reporting | `scripts/reporter-ops.mjs`, 1 workflow | n/a (outbound only) | Low |
| C-2 | Client reporting | `scripts/reporter-client.mjs`, 1 workflow | n/a (outbound only) | Low |
| E | Programmatic SEO | `lib/validate-vertical-config.mjs`, CLAUDE.md config | existing eval_gate | Low-medium |
| B | Local SEO / GBP | `scripts/sensor-gbp.mjs`, `.claude/skills/gbp-audit/`, `packs/gbp/apply.mjs` | change_set human gate | Medium |
| D | Competitor / gap | `scripts/sensor-serp.mjs`, `.claude/skills/competitor-gap/`, `serp_snapshots` table | existing eval_gate | Medium |
| A | Link building | `scripts/sensor-backlinks.mjs`, `.claude/skills/link-prospect/`, `link_prospects` table | gated work_queue | High |

---

## What doesn't change

- Core orchestrator (`orchestrator/run.mjs`) — no changes needed; new skills and sensors plug into existing dispatch logic
- Approval loops A and B — no changes; new platforms extend existing patterns
- ADR-0002 gate list — GBP writes are permanently gated; no new safe-class exceptions introduced
- Schema for the six frozen tables — frozen per ADR-0001
