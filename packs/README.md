# Live-CMS apply layer (WordPress + Webflow)

The orchestrator's default flow assumes **repo → PR → deploy**. WordPress and Webflow are
live CMSes you write to over an API — there's no git in the loop. This layer relocates the
three jobs git did for free, so the autonomous loop works on a live CMS too.

| Git gave you | This layer's equivalent |
|---|---|
| Code diff to review | A **change_set** row per field edit (page ID → new value) |
| PR review gate | A human flips `change_set.status` `pending → approved` (or your review UI) |
| `git revert` | **Snapshot to Supabase before every overwrite**, then re-apply on rollback |
| Diff base (no clobber) | **Drift check**: re-read live value; if it changed since generation, escalate |
| Vercel preview vitals | WordPress **staging** URL / Webflow **PSI canary after publish** |

## Flow

```
orchestrator/sensors  →  change_set rows (status=pending, with base_value)
human review          →  flip rows to status=approved   (the gate)
apply                 →  snapshot live value → drift-check → write
   WordPress: write is LIVE (point WP_BASE_URL at staging first)
   Webflow:   write STAGES the change (draft) until publish
publish (Webflow)     →  global site publish (opt-in) + PSI canary
rollback              →  re-apply the snapshot
```

## WordPress

- REST + Application Password; supports Yoast or Rank Math (`SEO_PLUGIN`).
- SEO meta keys must be REST-exposed — install `packs/wordpress/seo-rest-bridge.php` as an mu-plugin (from the base kit) or use WP-CLI on the host.
- **Meta writes are immediately live.** Run against a **staging clone** (`WP_BASE_URL`) and keep the human-approval gate; WP post revisions are a second safety net alongside the snapshot.

```bash
npm run wp:apply                                   # applies approved rows to WP
npm run wp:rollback -- --page-id 412 --field title # restores the snapshot
```

## Webflow

- Data API v2, Bearer token. Page SEO (`title`/`description`) writes **stage** the change; nothing is live until a publish.
- **A site publish is GLOBAL** — it flushes *every* pending change on the site, not just the agent's. `publish.mjs` refuses to run unless `WEBFLOW_ALLOW_SITE_PUBLISH=true`, so you publish on a controlled cadence after reviewing staged changes in the Designer. (CMS-item-only changes can instead be published selectively, ≤100 itemIds.)
- After publishing it runs a PSI canary on a sample URL and fails loudly on a CWV regression.

```bash
npm run webflow:apply                                  # stage approved rows (draft)
WEBFLOW_ALLOW_SITE_PUBLISH=true npm run webflow:publish # go live (global) + canary
npm run webflow:rollback -- --page-id 65a... --field title
```

## Workflow

`.github/workflows/seo-apply-cms.yml` runs WordPress apply on a schedule and Webflow
apply/publish via `workflow_dispatch` (publish is an explicit opt-in input). Set the
secrets/vars in `.env.example` (`WP_*`, `WEBFLOW_*`, `SEO_PLUGIN`).

## Why WP/Webflow stay more human-gated than the repo flow

In the repo flow, "merge" is a reversible event behind branch protection. Here, a write is
**immediately live** (WordPress meta) or **globally live** (Webflow publish). So for these
platforms: keep the approval gate on longer, restrict fully-auto classes to the lowest-risk
edits (alt text, schema, internal links), always snapshot, and publish Webflow on a cadence —
never let a single run both generate and globally publish unattended.
