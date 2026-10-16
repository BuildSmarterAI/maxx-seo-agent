# Plan: SEO audit remediation (maxxbuilders.com)

**Status:** approved by the operator on 2026-10-14. Wave 0 code work landed on
`fix/apply-layer-hardening`.
**Source audit:** `audit/firecrawl-seo-audit-2026-10-14.md` (PR #102).
**Related spike:** `docs/spikes/wordpress-mcp-and-wp-cli-2026-10-14.md` (PR #101).

This is the durable copy of the approved session plan, plus the facts established while
executing it. It is the reference for every remediation lane.

## Context

The read-only audit found these defects on the **production-only** WordPress site, which has
no staging:

- live editorial scaffolding;
- 73 posts with injected boilerplate;
- broken and redirecting internal links;
- 78 thin pages that are indexable;
- near-duplicate `/locations/*` pages;
- generic authorship;
- an unapplied metadata backlog;
- cannibalization;
- weak local and contractor pages.

**Outcome:** every finding is fixed through the existing pipeline:

skill → artifact or `change_set` row (`pending`) → human approval → `npm run wp:apply` → verify on the rendered page.

Batches stay small, a backup comes first, and nothing is written to the live site without
approval.

## Operator decisions (2026-10-14)

| Question | Decision |
|---|---|
| Scope | "Full plan incl. gated". Gated items are sequenced behind approvals. |
| Restaurant cluster primary | "Cost guide". `/restaurant-construction-cost-per-square-foot-guide-2024/` becomes primary; root `CLAUDE.md` keyword map is updated when Wave 5 lands. |
| `/locations/*` | "Rewrite to ≥0.5 uniqueness" |
| WordPress MCP | No MCP write access to production; writes stay on `change_set` → `wp:apply` |

## Hard constraints

- **The apply pack writes only** `title | description | canonical | focus | post_content`
  (`orchestrator/lib/payload.mjs`, `packs/wordpress/apply.mjs`).
  - Schema on existing pages, noindex, post author, redirects, Yoast settings, nginx and theme
    widgets have **no automated path**. They are operator WP-Admin checklists.
  - The `guard-publish` hook forbids the agent from emitting 301s.
- **Every `change_set` row must pass these gates** (`orchestrator/lib/cms.mjs` `applyRow`):
  `url` set → `do_not_touch` → `risk_class === "safe"` → supported field → read live value →
  snapshot → drift check → `scanPlaceholders` → write.
  - **The drift check skips `post_content` rows.** The WordPress adapter sets
    `driftCheckable: (row) => !isContent(row)` (`packs/wordpress/apply.mjs`), so a stale
    content row overwrites any edit made since staging. Immediately before approving a
    `post_content` row, the operator must re-read the live page and confirm it equals the
    row's `base_value` byte for byte. If it differs, regenerate the row.
  - **Known open risk:** that manual pre-approval comparison does not protect against edits made
    after approval and before the apply run. A compare-before-write control is being built in
    a separate lane (`fix/content-drift-check`) and does not exist yet. Until it merges,
    `post_content` rows must not stay approved overnight: approve and apply them the same day.
  - `change_type` must be a kit task or null (`orchestrator/lib/tasks.mjs`).
  - Gated work is staged as `risk_class: "gated"`. The gate escalates it, and an operator
    applies it or re-stages it after sign-off.
- **The nightly `seo-apply-cms` cron (07:30 UTC) applies every `approved` row** (limit 200), so
  approval is the batch-size control. Approve **no more than 10 rows at a time**.
  - **Before approving a batch, confirm the approved WordPress queue is empty.** The cron
    selects `platform = 'wordpress' and status = 'approved'` (`approvedRows` in
    `orchestrator/lib/cms.mjs`).
    `select count(*) from change_set where platform = 'wordpress' and status = 'approved';`
    must return 0. Otherwise the
    cron applies the new batch plus every older approved row.
  - A row still `approved` after a run did not apply. Investigate it; do not approve a new
    batch on top of it.
- `/` is in `do_not_touch`. Changing the homepage needs an explicit operator override.
- One lane per wave: one branch, one worktree, one PR.
- **Rendering mechanism decides the write path.** A `post_content` write does not render on an
  Elementor-built page, because Elementor renders from `_elementor_data`.
  - Confirm each target's mechanism before staging (see below).
  - Elementor targets are operator edits in the Elementor editor.

### Rendering mechanism, verified 2026-10-14

Method: public GET. The page is Elementor-built only when a
`data-elementor-type="wp-page|wp-post"` container's `data-elementor-id` equals the page's
`postid-N` / `page-id-N` body class. A matching type attribute alone only means a theme
template.

| Mechanism | Pages | Write path |
|---|---|---|
| **Elementor** | `/houston-commercial-contractors/`, `/dallas-tx/`, `/austin-tx/`, `/fort-worth-tx/`; all 5 `/industries/*`; `/services/` `architectural-design-and-engineering`, `design-and-build`, `general-contracting`, `preconstruction`, `tenant-improvement`; **hotel cost guide** `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` (post 5975, re-verified 2026-10-15) | Operator, Elementor editor |
| **Gutenberg/classic** | All other blog and cluster posts checked (medical, warehouse, TX, Houston, Dallas cost guides, design-build, restaurant pair, car wash, retail rankings, mock-up, loans, financing); `/services/construction-management/`; **all 4 `/locations/*`** | `post_content` `change_set` rows |

**Note:** the original plan assumed `/locations/*` were Elementor. They are not, so their
rewrite goes through `change_set`. Re-check any page not listed here before choosing its path.

**Re-verified 2026-10-15 (Wave 1 staging):** the hotel cost guide is now Elementor-built. Its
Elementor container is `wp-post:5975`, which matches `postid-5975`; on 2026-10-14 it read as
Gutenberg. Consequences:
- Its 2 broken links render from `_elementor_data`, not `post_content`, so they are an
  **operator Elementor-editor task** (see Wave 1).
- The existing `change_set/restructure-for-citation-hotel-2026.json` **cannot take effect**
  through `post_content`. Its unrendered scaffolding is still in `post_content`.

## Wave 0: Preflight and safety

1. **Operator steps:**
   - Take a full production backup (files + DB) and confirm it can be restored.
   - Export every post to be touched.
2. **Kill switch, budget and `do_not_touch`:**
   - `npm run mem -- status` and `npm run mem -- dnt`
   - `control.paused` and `spend_usd`

   These need Supabase credentials, which an agent sandbox may not see (see Blockers).
3. **Rendering-mechanism check:** done for the targets above. Repeat it for new targets.
4. **Apply-layer hardening:** done on `fix/apply-layer-hardening`.
   - `snapshot()` and `approvedRows()` throw on a Supabase `{ error }`.
   - New content-guard rules: `scaffold-label`, `ai-summary-heading`,
     `social-sharing-heading`.
   - An `applyRow` test proves that a snapshot failure means outcome `failed`, zero writes, and
     status `failed`.
   - `npm test` is hermetic: `scripts/lib/hermetic-guard.mjs` forces dummy service credentials
     and blocks non-loopback fetch.

## Wave 1: Quick safe content fixes (Gutenberg targets only)

**Wave 1 payloads are staged in PR #107 (not inserted).** The manifest is
`change_set/wave1-manifest-2026-10-15.md` on that branch.

| Fix | Skill / tool | Mechanism |
|---|---|---|
| Remove leaked scaffolding (see the target list below) | `restructure-for-citation` for mock-up and medical (merge with the existing `change_set/restructure-for-citation-*-2026.json`); a direct `post_content` edit for the rest (`change_type: null`) | `scripts/cms-read.mjs --field post_content` → edit → `npm run mem -- changeset --file payload.json` |
| Repoint the 7 broken links | `internal-link-graph` | `post_content` rows, one per source page |
| Repoint in-content links that hit 301s, on the top 20 pages by traffic first | `internal-link-graph` | `post_content` rows |
| Set Person schema author on the medical, warehouse, and mock-up posts | Operator; prepare the Person spec with `entity-authority` | WP Admin: reassign the post author to the named expert's WP user |

**Scaffolding targets,** verified live 2026-10-14:
- `/importance-of-mock-up-rooms-in-the-hospitality-industry/`: `Slug:`, `Title (N chars):`,
  `Meta description (N chars):`, `Canonical:`, and an "Answer-First Intro" H2.
- `/medical-office-construction-costs-texas-2026-comprehensive-guide/`: the same labels.
  - **Live 2026-10-15:** `Slug:`, `Meta description:` (no char count) and `Canonical:`; there is
    no `Title (N chars):` line.
  - **Pricing conflict:** the live page says $200–$450/sq ft; the 2026-06-24 restructure
    proposal said $350–$800/SF. The June figure was kept out of the payload. Resolve it under
    Blocker 6 (pricing reconciliation).
- `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/`: three
  `[Insert Table: …]` placeholders, plus an "AI Summary (150 words)" heading.
  - **Live 2026-10-15** it also had 1 `[Insert Chart: …]` placeholder and a writer note. All
    were removed, not filled in; the visuals to commission are under Blockers.
- `/financing-options-for-commercial-construction-projects/`: "AI Summary (150 words)".
- `/cost-efficient-strategies-restaurant-construction/`: a "Social Sharing Buttons:" H2, plus
  share links that point to a ChatGPT conversation URL.

The audit also named the building-types-2025-2027 and retail-rankings posts for "AI Summary".
`/blog/` and `/blog/page/2/` inherit the leaks through their excerpts.
- **Re-checked live 2026-10-15:** the building-types slug 404s; the post is now
  `/top-commercial-building-types-in-demand-across-texas-2025-2027/`.
- Both posts have a plain "AI Summary" heading over real prose, with no word count, which the
  `ai-summary-heading` rule does not flag. They were treated as editorial headings and **not
  staged**.

**Broken-link sources** (7 links):

| Source page | Bad link |
|---|---|
| `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | `/design-build-services/`, `/preconstruction-services/` |
| `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` | `/preconstruction-services/` |
| `/financing-options-for-shopping-center-projects-ultimate-guide/` | `/tag/shopping-center-financing/` |
| `/following-franchise-design-guidelines/` | `/tag/franchise-design/` |
| `/picking-profitable-locations-warehouse-development/` | `/tag/warehouse-development/` |
| `/selecting-prime-spots-for-shopping-centers/` | `/tag/shopping-center-construction/` |

The replacement targets are `/services/design-and-build/` and `/services/preconstruction/`.
Remove the `/tag/` links.

**Status 2026-10-15:** 5 links on 5 posts are staged via `change_set` (PR #107). The 2 on the
hotel guide are an **operator Elementor-editor task**, because that page is now Elementor.

**Before approving any Wave 1 row:** the drift check skips `post_content` (see Hard
constraints). Re-read each page with `scripts/cms-read.mjs --field post_content` and confirm it
equals the row's `base_value` byte for byte; regenerate the row if it differs.

## Wave 2: Metadata backlog (safe, batches of 10 or fewer)

1. Re-baseline the queued 2026-07-06 rows. `wp:apply` escalates on drift, so for each batch run
   `scripts/fix-base-values.mjs` **only after** a human has reviewed the live-vs-base diff.
2. Generate the new rows with `metadata-generate`:
   - 4 brand-first titles
   - privacy policy
   - the TI, loans, and dental rows (held until their content refresh is done)
   - the 5 industry-page descriptions (currently the "Corporate Interiors" text)
   - the design-build and mock-up titles and descriptions

   Rewrite or drop the 2 queued titles that deepen overlap: the warehouse explainer and
   design-build streamlining.
3. Run `npm run validate:metadata`, then `npm run wp:import-metadata` (inserts `pending` rows),
   then approve 10 rows, then let the cron or `npm run wp:apply` run, then verify.
4. The homepage title change needs a `do_not_touch` override from the operator, or stays
   deferred.

## Wave 3: Index hygiene (operator WP-Admin checklist)

- **Yoast taxonomies:** set Project Type and Project Attributes "Show in search results" to Off
  (19 URLs).
- **Noindex:**
  - `/single-page/`, `/thank-you/`, `/opt-out-from-email-and-sms/`,
    `/contact/contact-information/`, and the empty `/client-resources/*` pages
  - `/expert-tips-insights/` and `/industry-trends/`
  - the 4 redirected source posts, so they leave `post-sitemap.xml`
- **Fix `/latest-news-updates/`:** re-parent it off the trashed `blog` page and clear the Yoast
  canonical. Set `/client-resources/project-planning-guide/` to `index, follow` once it has
  content.
- **Theme (Mikado):**
  - the blog-list widget that links the redirected zero-punch-list post
  - hide the date-archive links (381 links)
  - debug the empty `/projects/*` grid (confirm in a browser first)
- **Homepage (Elementor, `do_not_touch`):** fix the placeholder image and repoint the 7
  redirecting links.
- **Host/nginx:** make the http and apex redirects a single hop to `https://www.`. Raise the WP
  Rocket cache lifetime and enable preload. Use `cwv-audit` for diagnosis.
- **Portfolio (38 thin pages, gated):** enrich the top 10 into case studies with `blog-write`,
  operator facts only, and noindex the rest.

## Wave 4: E-E-A-T and schema (gated: brand and authorship)

- **Bylines.** Replace "Reviewed by the Maxx Builders construction management team" with named
  reviewers on 102 posts. **Blocked on operator-supplied names.** Then `post_content` rows, in
  batches of 10 or fewer.
- **`entity-authority`:** Person entities. Keep Organization on `/` only, with `@id` references
  elsewhere; this needs a Yoast filter in a mu-plugin (operator/dev deploy).
- **`faq-schema`:** FAQ blocks on design-build and mock-up. Remove the duplicate FAQPage blocks
  on `/locations/*`.
- **`schema-generate`:** GeneralContractor/LocalBusiness for the city and location pages, with
  NAP matched to the visible text and the GBP. **Blocked on staffed-office confirmation.**
  - Validate with `node scripts/validate-json.mjs schema/<slug>.jsonld`.
  - Apply manually.
- **Car wash Dallas project claim:** the operator confirms it or it is removed via
  `post_content`.

## Wave 5: Cannibalization and boilerplate (gated)

1. **Restaurant (decided).**
   - Refresh the cost guide with `blog-write` (2026 data, shell-condition and per-seat tables,
     answer-first) and its metadata through `metadata-generate`. Keep the URL.
   - 301 `/cost-efficient-strategies…/` into it (operator, Redirection plugin).
   - `/8-key-considerations…/` stays the planning guide. Remove the 19 duplicated paragraphs and
     link it to the cost guide.
   - Update the root `CLAUDE.md` keyword map.
2. **Other merges.** Use `gsc-opportunity-mining` with `blog-audit` to classify these groups.
   The operator applies the 301s, each pointing straight at the final target:
   - TX-2025 → TX 2025–26
   - warehouse explainer → warehouse primary
   - Houston "top contractors" ×3
   - choosing-a-contractor
   - planning ×4
   - schedule ×3
   - TI ×3
   - dental
   - financing
3. **Boilerplate on 73 posts.**
   - Create one canonical "Texas Commercial Construction Decision Framework" page: `blog-write`
     → `npm run wp:publish-drafts` (draft) → review.
   - Strip the appended sections and replace them with one contextual link: `post_content`
     rows, 10 per batch.

## Wave 6: Local and money pages (gated: new content, NAP)

- **`/locations/*` rewrite (decided: ≥0.5 uniqueness).**
  - Use `local-page-plan` with its uniqueness gate.
  - Give each page real local proof, drawn only from the root `CLAUDE.md` project list and
    operator input:
    - Woodlands: the oncology infusion center
    - Irving/Arlington: DFW hospitality and imaging
    - San Antonio: the 120-key hotel
  - Each page also gets a unique intro and a recommendation block, plus at least 3 internal
    links.
  - These pages are **Gutenberg/classic**, so they are applied as `post_content` rows.
  - **San Antonio:** keep `/san-antonio-tx/` and 301
    `/locations/san-antonio-commercial-contractors/` to it (operator).
- **City pages (Houston/Dallas/Austin) and industry pages (Elementor):**
  - Rebuild them around delivered projects, a named project lead, an FAQ, and a link to the
    city cost guide.
  - Fix the "Our Industrial Construction Process" copy error on the hotel and healthcare pages.
  - The operator applies these in Elementor.
  - `internal-link-graph` adds at least 3 contextual links to every service and city page.
- **Off-site (operator):** Google Business Profile, AGC Houston, Procore Network, ClearlyRated.

## Wave 7: Growth content (safe once the pricing gate clears)

- **Cost-guide upgrades:** `blog-write` refresh, plus `restructure-for-citation`.
  - hotel: "Per Key" in the title and H1, brand-family and FF&E tables
  - Houston: submarkets, floodplain and detention costs
  - Dallas: DFW submarkets
  - warehouse: clear height, ESFR and power adders
  - medical: a sources block

  **New price figures are gated:** reconcile them against
  `output/pricing/texas-construction-cost-matrix-2026.md`, and resolve the warehouse
  $45–150 vs $160–250 conflict first.
- **Restaurant and retail rankings:** `restructure-for-citation`. Retail: disclose the
  methodology and the self-inclusion.
- **New and refresh pages:** run `blog-ideas` to confirm the list, then `blog-write` →
  `wp:publish-drafts`:
  - fuel-station / c-store cost (new)
  - tilt-wall (refresh the existing URL)
  - self-storage (refresh)
  - office build-out Houston (refresh)

  Each draft must pass `check-content-guards`, `check-entity-density`, and
  `check-citation-density`, plus `npm run judge`.

## Verification

- **Before each batch:**
  - Run the validators for the artifact type.
  - `npm run mem -- dnt <url>` must return OK.
  - Confirm the export or backup exists.
  - **`post_content` rows:** re-read the live page immediately before approving and compare it
    to `base_value` byte for byte. `wp:apply` does not drift-check content rows.
- **After each batch:**
  - Read the `wp:apply` tally. "applied N", where N is the approved count, counts as a pass;
    0 does not.
  - GET each URL and confirm on the rendered page: `<title>`, `meta name="description"`, the
    scaffolding grep returns 0 matches, links return 200, and the Yoast head is updated.
- **Rollback path:** `npm run wp:rollback -- --page-id <id> --field <f>`.
- **Wave exit:** re-run `/firecrawl-seo-audit` (or its scripts) and confirm the counts dropped:
  - scaffolding 9 → 0
  - 404 links 7 → 0
  - indexable thin pages 78 → ≤10
  - the `/locations/*` uniqueness is ≥0.5
- **4–8 weeks later:** `npm run learn`, and compare GSC positions against the July baseline.

## Blockers (operator inputs)

1. Confirmed restorable production backup, plus an export of the posts to be touched.
2. Kill switch, budget, and `do_not_touch` reads, and `change_set` writes.
   - An agent session may not be able to read the Supabase service-role credentials; `mem.mjs`
     reports them unset.
   - Run them from an operator terminal, or restore credential access to the session through
     an approved path.
3. Reviewer and author names, with their credentials.
4. Whether the Dallas and Austin offices are staffed, plus their NAP.
5. Whether the car wash Dallas project claim is true.
6. Pricing reconciliation. This includes the medical guide's $200–$450/sq ft (live) vs
   $350–$800/SF (2026-06-24 proposal) conflict.
   - **Content inputs:** the loans post's removed placeholders need real visuals. Commission a
     Loan Options table, a loan volume by metro chart, a cost per sq ft table, and a debt
     comparison table. Loan terms and pricing are gated.
7. A homepage `do_not_touch` override (yes/no).
8. WP-Admin, Elementor, and host access for Waves 3 and 6.
9. **Live MCP surface.** The MCP Adapter default server is enabled on production, and which
   abilities it exposes is unverified. The operator runs the read-only abilities listing in the
   spike doc.
