# Batch-2 metadata apply — manifest (prep-only, GATED)

**Prepared 2026-07-07. Nothing applied to the live site by this PR.** This stages the next
≤5-page metadata batch for the production WordPress apply. Rows live in `metadata-changes.csv`
(header + 2 rows) and pass `npm run validate:metadata`.

## Pages (ctr rows 6–7)

| WP id | Page | Fields to write |
|---|---|---|
| _resolve at import_ | `/3-most-common-obstacles-in-commercial-construction-projects/` | title, description, canonical |
| _resolve at import_ | `/best-retail-construction-contractors-in-houston-2026-rankings/` | title, description, canonical |

- Source of truth for the new values: `metadata-changes-ctr-2026-07-06.csv` rows 7–8 (copied byte-for-byte).
- Expected staged batch id: `metadata-csv-<applydate>`. Expected field count: **6** (2 pages × title/description/canonical).

### Value summary

| Page | current_title → new_title | current_description → new_description |
|---|---|---|
| obstacles | `Maxx Builders: 3 Commercial Construction Obstacles` → `Common Commercial Construction Obstacles & Fixes` | `…delays, outdated drawings, cost surprises and field coordination issues.` → `The most common obstacles in commercial construction are delays, outdated blueprints, unforeseen expenses, and field errors. Learn how to avoid each.` |
| retail | `Maxx Builders: Top Houston Retail Construction 2026` → `Best Retail Construction Contractors in Houston (2026)` | `…why local GCs outperform nationals.` → `Houston's top 10 retail construction contractors ranked for 2026, led by Maxx Builders. See rankings, vetting criteria, and $340–$575/sq ft cost context.` |

## Drift check (done)

Live Yoast title + meta description were fetched 2026-07-07 for both pages and **match the CSV
`current_*` exactly** (title 50/51 chars; descriptions identical). So the drift gate
(`wp:apply` escalates any row whose live value ≠ `base_value`) is satisfied as of this date.
Re-confirm at apply time if the site changed in between — the gate is fail-safe (escalates, never
clobbers).

## Apply sequence (Harris, outside the agent — production only, no staging)

1. **Confirm a restorable production backup.**
2. `npm run validate:metadata` → must exit 0.
3. `npm run wp:import-metadata` → resolves `page_id` via WP REST, stages `pending` `change_set` rows,
   prints `Batch: metadata-csv-<today>`.
4. **Approval gate (SQL):** `UPDATE change_set SET status='approved', risk_class='safe' WHERE batch='metadata-csv-<today>';`
   — must set **both** columns, or the A8 boundary escalates every row instead of applying.
5. `npm run wp:apply` → snapshots each field, writes live, logs `decision_log`, sets `applied`.
   Expect `applied 6, escalated 0, failed 0`. Verify rendered title/description on both pages.
6. **Record:** commit the applied `metadata-changes.csv` to `main` (mirrors PR #76).
7. **Rollback (per field if needed):** `npm run wp:rollback -- --page-id <id> --field <title|description|canonical>`
   (restores the pre-write snapshot).

## Follow-on (not part of this batch)

The obstacles page has a real H1 "3-vs-4" content inconsistency (H1 says "3", body has 4 sections;
this batch de-numbers the title but does **not** touch the H1). Fix the H1 to "4" as a separate
content edit — see `SESSION_HANDOFF.md` open-decisions.
