# Maxx Builders — Technical SEO Audit

Audit date: 2026-07-06
Site: https://www.maxxbuilders.com (WordPress, Yoast)
Scope: full read-only technical audit — crawl/index hygiene, metadata, internal links, schema/E-E-A-T, CWV, GSC performance. Supersedes the 2026-06-25 GEO/AI-citation audit (see "Diff vs June 25" below).

**Inputs:** live crawl of all 237 sitemap URLs + 15 priority URLs (`config/urls.txt`); GSC Search Analytics 28d vs prior 28d (read-only via `orchestrator/lib/gsc.mjs`); Chrome DevTools performance traces (mobile emulation, Fast 4G, 4× CPU); June 26 cold Lighthouse baseline (`audit/lighthouse-home.json`). PSI API returned HTTP 429 on all 15 keyless calls — see F-20.

**Guardrail note:** `https://www.maxxbuilders.com/` (and http variant) is in Supabase `do_not_touch`. Homepage findings below are report-only; any homepage apply requires an explicit operator override.

---

## Score: 48 / 100

| Component | Weight | Score | Basis |
|---|---|---|---|
| Crawl/index hygiene | 20 | 14 | robots.txt clean, zero noindex conflicts, max 1 redirect hop — but 4 redirecting sitemap URLs, junk sitemap entries, 6 broken internal 404s |
| Metadata | 15 | 6 | Money pages mostly compliant; 210/237 pages missing meta description; 77 titles > 60 chars; 2 priority pages desc-less |
| Content quality / intent | 20 | 9 | Money-page depth is real (1.2k–6.3k words) but 4 cannibalized clusters, 2 orphaned priority pages, answer-first missing on 9 priority pages |
| Internal linking | 15 | 5 | 82 orphans; homepage links to 1 of 14 priority pages; flagship hotel guide has 4 inbound links total |
| Schema / E-E-A-T | 10 | 5 | JSON-LD valid everywhere, FAQ schema on money pages — but Organization schema on all 237 pages and 114 generic "Maxx Builders" bylines |
| CWV / performance | 10 | 6 | TBT/CLS pass everywhere measured; LCP passes warm Fast-4G (~1.0s) but failed June cold slow-4G sim (8.3s homepage); field data unverifiable |
| Search performance trend | 10 | 3 | Clicks −26% period-over-period (898 → 668); every priority money page declined; CTR 0.11–0.24% at positions 6–10 |

---

## Executive summary

The site is structurally sound (clean robots, one-hop redirects, valid JSON-LD, deep money pages) but **losing traffic**: clicks fell 26% over the last 28 days vs the prior 28, with every priority money page down. The three forces behind that, in order:

1. **Click-through collapse at good positions.** Pages ranking 6–10 with 9k–46k impressions earn 0.11–0.24% CTR. That is an answer-first + title/description problem in the AI-Overview era — the SERP answers the query before the user reaches the listing, and the listing copy isn't winning the residual click.
2. **Cannibalization at cluster level**, well beyond the known restaurant pair: tenant improvement (4 pages), dental office (3), Texas-wide cost guides (2 + Houston overlap), construction financing (2). Google is rotating between them; the weakest cluster member (`/8-key-considerations-for-building-a-restaurant/`) collapsed from position 13 → 27.5 and is also a zero-inbound orphan.
3. **Link equity isn't routed to money pages.** 82 sitemap pages have zero inbound links from any other sitemap page; the homepage links to exactly one priority money page; the flagship hotel cost guide has 4 inbound links and contains 2 broken 404 outbound links.

The keyword map in `CLAUDE.md` and `config/urls.txt` is also stale: the site's #2 traffic page (`/texas-commercial-construction-cost-2025-2026/`, 46k impressions) belongs to no cluster and isn't monitored, and the warehouse cluster still points at the dead old slug.

---

## Diff vs June 25 audit

| June 25 finding | Status now |
|---|---|
| Obstacles page desc = "blueprints" (10 chars) | **FIXED** — now 146 chars |
| Warehouse + design-build old slugs in sitemap | **FIXED** — sitemap carries only final slugs |
| TL;DR missing on medical, warehouse, Dallas, design-build, mock-up | **FIXED** on those five (answer-first detected) |
| Homepage title 66 chars | **IMPROVED** — 61 chars (still 1 over cap) |
| TL;DR missing on hotel, Houston, car wash, retail rankings, restaurants ×2, timelines, planning, obstacles, homepage | **OPEN** |
| Generic "Maxx Builders" Article author | **OPEN** — 114 pages; only 4 pages name Harris Khan |
| Design-build `-2` page missing meta description | **OPEN** — and title now doubles the brand ("… \| Maxx Builders \| Maxx Builders", 65 chars) |
| Duplicate/slug-like H1s (medical, warehouse, mock-up) | **OPEN** — plus 7 more pages found this run |
| Mock-up page title 71 chars + no description | **OPEN** |
| Homepage doesn't link to money pages | **OPEN** — links to 1 of 14 |
| IndexNow absent | **OPEN** — `/indexnow.txt` 404 |
| CWV unverified (PSI 429) | **PARTIALLY RESOLVED** — lab traces pass warm; cold-sim homepage LCP fails; field data still blocked (F-20) |
| Visible project proof on money pages | **NOT RE-MEASURED** this run — treat June status (weak outside hotel/mock-up/planning) as current |

---

## Critical

**F-1. Site-wide click decline −26% (898 → 668) with every priority money page down.**
URLs: all of `config/urls.txt`; worst deltas: Houston cost 35→21, hotel 23→13, medical 26→16, car wash 32→22, mock-up 15→8, restaurant 8-key 2→0 (position 13 → 27.5).
Fix: this is the composite of F-2, F-3, F-4 — treat those as the remediation. Re-measure via `npm run learn` attribution after each batch lands.
Produced by: `/gsc-opportunity-mining` (tracking), fixes via skills below.

**F-2. CTR collapse on high-impression rankings (answer-first + snippet problem).**
URLs: `/texas-commercial-construction-cost-2025-2026/` (46k imp, pos 6.1, CTR 0.11%), `/cost-per-square-foot-build-warehouse-texas/` (23k, 7.9, 0.18%), `/understanding-commercial-build-outs-guide/` (30k, 8.3, 0.12%), `/commercial-construction-cost-houston-tx/` (11k, 9.7, 0.19%), medical/hotel/car-wash/Dallas guides all < 0.25%.
Fix: answer-first blocks (TL;DR + cost table in first 30%) on the 9 priority pages still missing them, plus CTR-oriented title/description rewrites leading with concrete numbers ("$X–$Y/SF 2026").
Produced by: `/restructure-for-citation` (content blocks) + `/metadata-generate` (titles/descs). **Apply: WordPress pack, small batches.**

**F-3. Four cannibalized clusters splitting rank equity.**
- Tenant improvement: `/tenant-improvement-contractors-guide/`, `/mastering-tenant-improvement-construction-a-comprehensive-guide/`, `/enhancing-commercial-spaces-tenant-improvements-guide/`, `/understanding-commercial-build-outs-guide/` — 4 pages trading positions 30–88 on "tenant improvement" queries.
- Dental: `/dental-office-construction-guide/` (pos 11.4) vs `/building-the-perfect-smile-…/` (74.7) vs `/build-your-dream-dental-clinic-…/` (83.8).
- Texas cost: `/texas-commercial-construction-cost-2025-2026/` vs `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` vs Houston page on "commercial construction cost" (positions 11.6 / 36.4 / 71.7).
- Financing: `/financing-options-for-commercial-construction-projects/` vs `/commercial-property-construction-loans-in-texas-2026-…/`.
- Restaurant (known): `/8-key-considerations-…/` collapsed to pos 27.5, orphaned, 0 clicks.
Fix: pick one canonical page per cluster; merge/301 or sharply differentiate the rest. **Merges/redirects are `gated` risk class — escalate to human review, do not auto-apply.** The audit's recommended survivors: `/tenant-improvement-contractors-guide/`, `/dental-office-construction-guide/`, `/texas-commercial-construction-cost-2025-2026/`, `/financing-options-…/`, `/cost-efficient-strategies-restaurant-construction/`.
Produced by: `/blog-audit` (keep/refresh/merge/delete classification) → human manifest.

**F-4. Keyword map / priority set is stale — the #2 traffic page is unmanaged.**
URLs: `/texas-commercial-construction-cost-2025-2026/` (52 clicks, 46k imp — absent from `config/urls.txt` and the CLAUDE.md cluster map); `config/urls.txt` + CLAUDE.md warehouse cluster still reference dead slug `/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/` (zero GSC rows this period; live slug is `/cost-per-square-foot-build-warehouse-texas/`); design-build cluster references the pre-redirect slug.
Fix: repo-side edit — update `config/urls.txt`, CLAUDE.md keyword map, and `config/monitored-queries.json` to final slugs; add the TX cost guide as its own cluster (also resolves half of F-3's TX overlap by declaring one primary page). **No pack needed — repo files only.**

---

## High

**F-5. 82 orphan pages (zero inbound from any sitemap page), including 2 priority pages.**
URLs: `/8-key-considerations-for-building-a-restaurant/` and `/3-most-common-obstacles-in-commercial-construction-projects/` (priority, 0 inbound); ~50 blog posts; full list in audit data.
Caveat: blog pagination pages aren't in the sitemap, so "orphan" = unlinked from any indexable page — the equity-bearing definition.
Fix: contextual links from topically related money/pillar pages; fold the two priority orphans into F-3's restaurant decision and an obstacles-page link pass.
Produced by: `/internal-linking` (page-level) + `/internal-link-graph` (site-wide). **Apply: WordPress pack.**

**F-6. Homepage links to only 1 of 14 priority money pages.**
URL: `/` — 56 outbound internal links, only `/design-build-construction-houston-2/` from the priority set.
Fix: add a services/guides section linking the 6 cost guides + design-build. **Homepage is in `do_not_touch` — requires operator override before any apply.**
Produced by: `/internal-linking`.

**F-7. Broken internal links (404) from money pages.**
- `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` → `/design-build-services/` (404) and `/preconstruction-services/` (404)
- `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` → `/preconstruction-services/` (404, ×2)
- 4 tag-archive links → 404 (`/tag/franchise-design/`, `/tag/shopping-center-financing/`, `/tag/shopping-center-construction/`, `/tag/warehouse-development/`)
Fix: repoint service links to live equivalents (`/services/…`, `/design-build-construction-houston-2/`); remove dead tag links.
Produced by: `/internal-linking`. **Apply: WordPress pack.**

**F-8. Generic authorship persists: 114 pages authored as "Maxx Builders", 4 as Harris Khan.**
Fix: named-expert byline + Person schema rollout on money pages first (operator must supply the real names — brand/positioning adjacent, treat as **gated**; escalate with a proposed author-to-page map).
Produced by: `/entity-authority` + `/schema-generate`. **Apply: WordPress pack.**

**F-9. Sitemap hygiene: 4 redirecting URLs + junk entries.**
Redirecting in sitemap: `/texas-commercial-building-costs-guide/`, `/dental-office-construction-cost-guide/`, `/choose-a-commercial-contractor/`, `/the-cost-of-a-tenant-build-out-per-square-foot/`.
Junk in sitemap: `/thank-you/`, `/opt-out-from-email-and-sms/`, `/single-page/`, `/locations.kml/`, empty `project-type/*` and `project-attributes/*` taxonomy archives (all also orphaned).
Fix: Yoast — exclude redirected/utility URLs and empty taxonomies from the sitemap; noindex thank-you/opt-out pages.
Produced by: manual Yoast config change. **Apply: WordPress pack (settings).**

**F-10. Design-build money page metadata defects.**
URL: `/design-build-construction-houston-2/` — meta description absent, title 65 chars with doubled brand suffix "| Maxx Builders | Maxx Builders", only 4 inbound links, and zero GSC clicks both periods for the service cluster.
Fix: dedupe Yoast title template, write description, internal-link push from Houston/cost pages.
Produced by: `/metadata-generate` + `/internal-linking`. **Apply: WordPress pack.**

---

## Medium

**F-11. 210 of 237 pages missing meta descriptions; 77 titles over 60 chars.**
Worst titles 90–116 chars (old blog long tail). Money pages are compliant except F-10 and mock-up (71-char title, no description).
Fix: batch-generate for the ~40 pages with meaningful impressions first (GSC-ranked), then the tail.
Produced by: `/metadata-generate` (validates via `npm run validate:metadata`). **Apply: WordPress pack, small batches.**

**F-12. Duplicate/slug-like H1s on 10 pages.**
`/medical-office-construction-costs-texas-2026-comprehensive-guide/` (slug-text H1 + real H1), `/importance-of-mock-up-rooms-…/` (same), `/cost-per-square-foot-build-warehouse-texas/` (identical H1 ×2), `/guide-commercial-construction-bids/`, `/10-steps-to-build-an-apartment-complex/`, 4 `/locations/*` pages ("AWARDS & RECOGNITION" as second H1 — template defect).
Fix: template-level — one H1 per page; demote secondary headings to H2.
Produced by: `/metadata-generate` output feeds it; H1s are content edits via **WordPress pack**.

**F-13. Organization/GeneralContractor schema emitted on all 237 pages** (rule: homepage only; LocalBusiness subtype on location pages).
Fix: restrict Yoast org graph emission; keep Organization on `/`, use LocalBusiness/GeneralContractor per location page with NAP matching visible text.
Produced by: `/schema-generate`. **Apply: WordPress pack.**

**F-14. `llms.txt` live (7 KB at `/llms.txt`) — WITHDRAWN: operator decided 2026-07-06 to keep it** as a zero-cost agent-routing hedge (research confirms no SEO/citation effect either way: Google Search ignores it, AI retrieval bots rarely fetch it). CLAUDE.md policy updated to match.
Optional hardening (not scheduled): serve `X-Robots-Tag: noindex` on the file per Google's recommendation; re-verify its claims whenever brand facts change. **Apply (if ever): WordPress pack.**

**F-15. Internal links pointing at redirects (48 instances).**
6 content-relevant (e.g. dental posts → old dental slug; 4 contractor-guide posts → `/choose-a-commercial-contractor/` which now 301s to an unrelated service page — likely a wrong redirect target worth reviewing); 42 are theme date-archive links 301ing to `/`.
Fix: repoint the 6 content links to final URLs; review the `/choose-a-commercial-contractor/` redirect target (it 301s to architectural-design, not a contractor-selection page).
Produced by: `/internal-linking`. **Apply: WordPress pack.**

**F-16. Homepage LCP risk on slow connections (report-only — `do_not_touch`).**
Lab: warm Fast-4G trace LCP 996ms / CLS 0.00 (pass); June 26 cold simulated-mobile Lighthouse: LCP **8,296ms**, FCP 3,196ms, perf 69. 113 images / 94 scripts on the page. TBT fine everywhere (17ms).
Fix: preload hero/LCP image, never lazy-load it, trim below-fold image payload. Article template measured healthy (hotel guide LCP 1,019ms warm).
Produced by: `/cwv-audit`. **Apply: WordPress pack + operator override (homepage).**

---

## Low

**F-17. `/blog/` index is thin (58 words) and pagination is the only path to ~50 older posts.**
Fix: category-hub modules on the blog index linking pillar/cluster pages.
Produced by: `/internal-link-graph`.

**F-18. IndexNow absent** (`/indexnow.txt` 404). Bing/Copilot discovery nicety, unchanged since June.
Fix: generate key file + ping after approved publishes. **Apply: WordPress pack.**

**F-19. Striking-distance opportunities (free wins if F-2 lands):**
"building shells" (3,681 imp, pos 10 — `/guide-to-4-different-types-of-shell-structures/`), "hotel construction" (472 imp, pos 19.4), "commercial building construction" (431, 16.8), "2026 commercial restroom construction cost per SF" (359, 5.7), "commercial building construction schedule" (294, 8.8).
Produced by: `/gsc-opportunity-mining` → `/restructure-for-citation` per page.

**F-20. Tooling: PSI API keyless quota is zero — all 15 calls returned HTTP 429 (same as June).**
Fix: obtain a PageSpeed API key, set `PAGESPEED_API_KEY` locally and as a GitHub Actions secret (`vitals-pr.yml` and `seo-apply-cms.yml` already reference it; keyless CI runs will flake). Repo-side/infra — no pack.

---

## Top 5 actions (ROI ÷ effort)

1. **Answer-first + CTR metadata batch on the 9 gap money pages** (F-2, F-11): `/restructure-for-citation` + `/metadata-generate`. Highest-leverage safe-class work; directly attacks the −26% trend. Effort: medium. Apply: WP pack, small batches.
2. **Internal-link sprint** (F-5/F-6/F-7/F-10): fix 6 broken 404 links, repoint 6 redirect links, de-orphan 2 priority pages, add homepage → money-page links (needs `do_not_touch` override). `/internal-linking`. Effort: low. Apply: WP pack.
3. **Cluster consolidation manifest** (F-3): `/blog-audit` to produce a keep/merge/301 manifest for tenant-improvement, dental, TX-cost, financing, restaurant clusters. **Gated — human approves before any redirect.** Effort: medium; ROI: highest single ranking lever.
4. **Repo config refresh** (F-4): update `config/urls.txt`, CLAUDE.md cluster map, `monitored-queries.json` to live slugs + add TX cost guide cluster. Effort: trivial. No pack; unblocks correct sensing/monitoring for everything else.
5. **Sitemap + schema hygiene batch** (F-9, F-13): Yoast sitemap exclusions and Organization-scope fix. Effort: low. Apply: WP pack (settings-level, one change set).

---

## Method caveats

- Word counts for Elementor-built pages (`/locations/*`, `/industries/*`, `/services/*`, `/projects/*`) under-read via entry-content extraction; body-text spot-checks confirmed locations/industries pages are substantive (San Antonio 2,133 words). Only `/projects/*` galleries are genuinely text-thin. The June "location pages thin" style finding does not apply.
- CWV lab traces were warm-cache (TTFB ~12ms); cold-load numbers come from the June 26 Lighthouse baseline. Field-level (CrUX) verification is blocked until F-20 lands.
- "Orphan" = no inbound link from any of the 237 sitemap pages; blog pagination archives were not crawled.
- GSC windows: 2026-06-08→07-05 vs 2026-05-11→06-07 (28d each, 1-day lag).
- GBP/NAP not audited (no GBP access from this runtime).
