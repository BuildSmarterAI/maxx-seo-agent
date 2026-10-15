# Wave 1 manifest: scaffold removal + broken links (2026-10-15)

**Status: STAGED ONLY.** These payloads are NOT inserted into `change_set` (Supabase) and
NOT applied to WordPress. Production WordPress has no staging. Re-validate them once
PR #104 (`fix/apply-layer-hardening`) merges, because `main` lacks the `scaffold-label`,
`ai-summary-heading` and `social-sharing-heading` guard rules.

Source plan: `docs/superpowers/plans/2026-10-15-seo-audit-remediation.md` (on the #104
branch), Wave 1.

## How these were produced

1. **Mechanism re-check.** Each target got a public anonymous GET on 2026-10-15. A page counts
   as Elementor-built only when a `data-elementor-type="wp-post|wp-page"` container's
   `data-elementor-id` equals the `postid-N` body class.
2. **Base value.** `base_value` is the live `post_content` (`content.raw`, `context=edit`),
   read with the GET-only `scripts/cms-read.mjs` on 2026-10-15.
3. **Minimal edit.** Every edit is an exact-string edit whose anchor was asserted unique. Each
   payload's `edits` array records what was removed (and its replacement, if any).
4. **Validation.**
   - The payload was parsed with `parseChangesetPayload` from both `main` and the #104 branch.
   - #104 `scanPlaceholders(new_value)` returned `[]`.
   - #104 `scanPlaceholders(base_value)` named the expected rules (scaffold rows).
   - For link rows, the bad `href` is present in the original and absent from the new value.
     No Wave 1 bad URL remains anywhere in any `new_value`.
   - The #104 `check-content-guards` CLI passed on all 10 new bodies ("10 file(s) clean") and
     found 6 issues across the 5 original scaffold bodies.
5. **Diff check.** The diff of old → new for each page shows only the intended hunks.

| Page (post id) | Fix | change_type | Mechanism re-check | Validation | Hunks |
|---|---|---|---|---|---|
| `/importance-of-mock-up-rooms-in-the-hospitality-industry/` (300) | Remove Slug/Title (53 chars)/Meta description (150 chars)/Canonical lines + "Answer-First Intro" H2 label | `restructure-for-citation` | Not Elementor (post_content renders) | new `[]`; original `scaffold-label` | 2 |
| `/medical-office-construction-costs-texas-2026-comprehensive-guide/` (5913) | Remove Slug/Meta description/Canonical lines | `restructure-for-citation` | Not Elementor (post_content renders) | new `[]`; original `scaffold-label` | 1 |
| `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/` (5910) | Remove 3 `[Insert Table: …]` + 1 `[Insert Chart: …]` placeholders, 1 drafting-note paragraph, the "AI Summary (150 words)" H2 | null | Not Elementor (post_content renders) | new `[]`; original `insert-placeholder`, `ai-summary-heading` | 5 |
| `/financing-options-for-commercial-construction-projects/` (5906) | Remove "AI Summary (150 words)" H3 | null | Not Elementor (post_content renders) | new `[]`; original `ai-summary-heading` | 1 |
| `/cost-efficient-strategies-restaurant-construction/` (2463) | Remove "Social Sharing Buttons:" H2 + 4 ChatGPT-conversation share links | null | Not Elementor (post_content renders) | new `[]`; original `social-sharing-heading` | 1 |
| `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` (3536) | Repoint `/preconstruction-services/` → `/services/preconstruction/` | `internal-link-graph` | Not Elementor (post_content renders) | bad href 1 → 0; new `[]` | 1 |
| `/financing-options-for-shopping-center-projects-ultimate-guide/` (2504) | Unlink `/tag/shopping-center-financing/` (anchor text kept) | `internal-link-graph` | Not Elementor (post_content renders) | bad href 1 → 0; new `[]` | 1 |
| `/following-franchise-design-guidelines/` (2509) | Unlink `/tag/franchise-design/` | `internal-link-graph` | Not Elementor (post_content renders) | bad href 1 → 0; new `[]` | 1 |
| `/picking-profitable-locations-warehouse-development/` (2440) | Unlink `/tag/warehouse-development/` | `internal-link-graph` | Not Elementor (post_content renders) | bad href 1 → 0; new `[]` | 1 |
| `/selecting-prime-spots-for-shopping-centers/` (2505) | Unlink `/tag/shopping-center-construction/` | `internal-link-graph` | Not Elementor (post_content renders) | bad href 1 → 0; new `[]` | 1 |

All rows: `platform: wordpress`, `field: post_content`, `risk_class: safe`, `page_id` set.
Replacement target `/services/preconstruction/` returned 200 with 0 redirects
(`/services/design-and-build/` likewise 200 with 0 redirects). The old URLs return 404.

Payload files (in `change_set/`):

- `restructure-for-citation-mock-up-rooms-2026.json` (new)
- `restructure-for-citation-medical-office-2026.json` (merged; see below)
- `scaffold-removal-construction-loans-2026.json`
- `scaffold-removal-financing-options-2026.json`
- `scaffold-removal-restaurant-strategies-2026.json`
- `internal-link-graph-tx-cost-per-sqft-2026.json`
- `internal-link-graph-shopping-center-financing-2026.json`
- `internal-link-graph-franchise-design-2026.json`
- `internal-link-graph-warehouse-locations-2026.json`
- `internal-link-graph-shopping-center-sites-2026.json`

## Judgment calls

- **Mock-up, medical.** The "Last Updated" and "Author" lines in the same paragraph are
  reader-facing, so they are kept. Only the drafting lines are removed. On the mock-up page,
  the answer paragraph under the "Answer-First Intro" label is kept. The `<hr>` separators
  are kept.
- **Medical merge.** The existing `restructure-for-citation-medical-office-2026.json` was
  rewritten as the valid scaffold-removal payload. Its 2026-06-24 proposal is preserved
  verbatim under `superseded_2026_06_24`, but its answer block was NOT carried into
  `new_value`, for four reasons:
  - The live page already opens answer-first ($200–$450/sq ft).
  - The block's $350–$800/SF figures conflict with the live page. New price figures are
    gated (plan Wave 7, Blocker 6: pricing reconciliation).
  - Its `base_value` no longer exists on the page.
  - Its `field: "content"` is not an accepted change_set field.
- **Mock-up.** No existing restructure-for-citation file existed, so this is a new file.
- **Loans.** The `[Insert Chart: …]` placeholder was not in the plan's list. It is the same
  `insert-placeholder` class, which the apply-time guard would block, so it was removed. The
  paragraph "(Use Gordian, contractor bid comps, and internal cost databases to populate
  ranges; …)" is a writer instruction for the removed cost table, so it was removed too.
- **AI Summary headings.** On loans and financing, only the heading block is removed. The
  summary prose under it is real copy and is kept.
- **Restaurant.** Only the H2 and the share-link line are removed. A pre-existing empty
  `<h3></h3>` directly after them was left untouched (out of scope; see follow-ups).
- **Tag links.** Removed to plain text; no new link was invented in their place.

## Removed `[Insert …]` placeholders: real tables the operator can commission

These are all from `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/`.
Loan terms and pricing are gated, so no tables or figures were invented.

1. `[Insert Table: Texas Construction Loan Options (2025) — Loan Type | Typical Term | Indicative Rate Band | Equity / Down Payment | Best For]`
2. `[Insert Chart: 2024 vs. 2025 Construction Loan Volume by Metro (Houston, DFW, Austin, San Antonio, Fort Worth)]`
3. `[Insert Table: 2025 Texas Cost per Square Foot (Indicative Ranges) — Office | Retail | Industrial/Warehouse | Medical | Education across Houston, Dallas, Austin, San Antonio; note: include shell vs. build-out bands and core MEP escalation.]`
   - The writer note that followed it was also removed: "(Use Gordian, contractor bid comps, and internal cost databases to populate ranges; reflect higher shells and TI in Austin/Houston core and mid-tier in San Antonio/Fort Worth)."
4. `[Insert Table: Texas Construction Debt Comparison (2025) — Bank vs. SBA vs. Private (Speed, Rate, Leverage, Typical Fees, Ideal Use-Case)]`

## Skipped, and why

- **`/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` (5975): now Elementor.**
  - `data-elementor-type="wp-post" data-elementor-id="5975"` matches `postid-5975`. The plan
    (2026-10-14) listed it as Gutenberg.
  - Its two bad links render from `_elementor_data` and are absent from `post_content`.
  - Its `post_content` also still holds unrendered Slug/Canonical/"Answer-First Intro"
    scaffolding.
  - **Operator Elementor-editor task:** repoint `/design-build-services/` →
    `/services/design-and-build/` and `/preconstruction-services/` →
    `/services/preconstruction/`.
  - The existing `restructure-for-citation-hotel-2026.json` likewise cannot render via
    `post_content`.
- **`/top-commercial-building-types-in-demand-across-texas-2025-2027/` (5867).**
  - The plan's slug `/building-types-in-demand-across-texas-2025-2027/` returns 404. The live
    post is at the `top-` prefixed URL.
  - The live heading is a plain "AI Summary" with no "(N words)" drafting count, over real
    summary prose. It does not trip the #104 rule.
  - Treated as an editorial heading, not a leak. The operator can decide to rename it.
- **`/best-retail-construction-contractors-in-houston-2026-rankings/` (5917).** Same situation:
  a plain "AI Summary" H2 over real prose, with no word count. Not staged.

## Out-of-scope follow-ups noticed (not changed)

- `/picking-profitable-locations-warehouse-development/`: the CTA "Click here to request a
  quote" links to a ChatGPT conversation URL (`chat.openai.com/c/…#link-to-quote`). It is the
  same defect class as the restaurant share links, but no replacement target was approved.
- `/cost-efficient-strategies-restaurant-construction/`: an empty `<h3></h3>` remains.
- The mock-up, medical and hotel bodies contain their own `<h1>`. Check for a duplicate H1
  alongside the theme title.

## Operator steps still required before insertion

1. **Wait for #104 to merge,** then re-run the payload validation against `main`:
   `scanPlaceholders(new_value)` must return `[]` for every file.
2. **Backup/export.** Confirm a restorable full production backup (files + DB). Export the 10
   posts above (ids 300, 5913, 5910, 5906, 2463, 3536, 2504, 2509, 2440, 2505).
3. **Drift re-check (manual).**
   - The WordPress adapter does NOT drift-check `post_content` (`driftCheckable` returns
     false for content rows), so a stale `new_value` would overwrite any edit made since
     2026-10-15.
   - Immediately before insertion, re-read each page with
     `node --env-file=.env scripts/cms-read.mjs --url <URL> --platform wordpress --field post_content --out <tmp>`
     and confirm the result equals the payload's `base_value` byte for byte.
   - If it differs, regenerate the payload.
4. **Supabase access (SEO-15).** Restore an approved credential path. Then run the checks:
   - kill switch: `control.paused = false`, plus the budget
   - `npm run mem -- dnt <url>` must print OK for each URL
5. **Insert the rows.** Run `npm run mem -- changeset --file change_set/<file>.json` once per
   file. This inserts a `pending` row.
6. **Approve in batches of 10 or fewer,** and only after
   `select count(*) from change_set where status = 'approved';` returns 0. The nightly
   `seo-apply-cms` cron (07:30 UTC) applies every approved row.
7. **After each batch:**
   - The `wp:apply` tally must read "applied N" for the approved count.
   - GET each URL. The scaffolding grep must return 0 matches, and the repointed links must
     return 200.
   - Rollback: `npm run wp:rollback -- --page-id <id> --field post_content`.
8. **Operator Elementor edit** of the hotel guide's two links (see Skipped).
