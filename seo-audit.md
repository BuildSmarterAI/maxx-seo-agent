# Maxx Builders — Technical SEO Audit

Audit date: 2026-10-08
Site: https://www.maxxbuilders.com (WordPress, Yoast)
Mode: read-only. Supersedes the 2026-07-06 audit (preserved in git history).

**Inputs:** live fetch of all 239 sitemap URLs (7 sub-sitemaps, 235 × 200, 4 × 301); `robots.txt`; GSC Search Analytics via `orchestrator/lib/gsc.mjs` (28d 2026-09-10→10-05 vs prior 28d); `config/urls.txt` (16 priority URLs).

**Not measured:** Core Web Vitals. PSI returned HTTP 429 on all 16 calls even with `PAGESPEED_API_KEY` set, CrUX returned 403 PERMISSION_DENIED, and `scripts/check-vitals.sh` can't run here (`jq` not installed, exit 3). See F-1.
**Not checked:** internal links to URLs outside the sitemap (the orphan and link-to-redirect counts cover sitemap URLs only). No crawl export exists (`./crawl/` absent), so link data comes from an in-house HTML fetch, not Screaming Frog.

**Guardrail:** the homepage is in Supabase `do_not_touch` (per the July audit; not re-verified). Homepage findings are report-only.

---

## Score: 55 / 100 (July: 48)

| Component | Wt | Score | Basis |
|---|---|---|---|
| Crawl/index hygiene | 20 | 15 | Clean robots, 0 noindex, 1-hop redirects, host variants 301 correctly. Minus: 4 redirecting sitemap URLs, `.kml` and `blog__trashed` canonical in sitemap |
| Metadata | 15 | 9 | Missing descriptions 210 → 81; 51 over 155 chars; 78 titles over 60; 2 priority pages still description-less |
| Content / intent | 20 | 10 | Money pages deep (1.4k–6.4k words) but 4 cannibalized clusters; double H1 template bug; 90 thin pages |
| Internal linking | 15 | 6 | 99 orphans (July 82); 2 priority pages with 0 inbound; flagship hotel guide has 4 |
| Schema / E-E-A-T | 10 | 5 | JSON-LD valid (0 parse errors), FAQPage on 47 pages — but `Organization/GeneralContractor` on 234 of 235 pages and 110 of 117 Articles bylined "Maxx Builders" |
| CWV | 10 | 5 | Unmeasured; neutral score |
| Search trend | 10 | 5 | Clicks 566 → 539 (−5%, July was −26%) but impressions 182k → 123k (−32%) |

## Progress since July
Missing meta descriptions 210 → 81. Broken sitemap-to-sitemap links 6 → 2 (redirecting targets). Bylines "Maxx Builders" 114 → 110 (7 now credit Harris Khan). Orphans worsened 82 → 99. Four redirecting sitemap URLs are unchanged.

---

## Critical

None. No noindex conflicts, no non-200 money pages, no schema parse errors.

## High

**F-1 · CWV cannot be verified — tooling is broken.**
Affected: all priority URLs. PSI 429 with a key set means the key's GCP project has no PSI quota/API enabled; CrUX 403 means the Chrome UX Report API isn't enabled for it either. `jq` missing breaks `check-vitals.sh` on this machine.
Fix: enable PageSpeed Insights API and Chrome UX Report API on the key's GCP project, install `jq`, rerun `/cwv-audit`. Until then the field-CWV sensor (`sensor-cwv.mjs`) is also a no-op. Needs no pack.

**F-2 · Double H1 on priority pages — second H1 contains the raw URL slug.**
Affected (9 pages, re-verified by live fetch of all 239 sitemap URLs): `/cost-per-square-foot-build-warehouse-texas/`, `/medical-office-construction-costs-texas-2026-comprehensive-guide/`, `/importance-of-mock-up-rooms-in-the-hospitality-industry/`, `/guide-commercial-construction-bids/`, `/10-steps-to-build-an-apartment-complex/`, and 4 location pages (The Woodlands, Irving, Arlington, San Antonio). On the three money pages the second H1 is the slug itself (e.g. `importance-of-mock-up-rooms-…`), which points to a template or builder-module bug rather than content.
Fix: find the source (theme/page-builder block outputting `post_name` as H1), fix at template level. Needs theme access; outside the WP REST pack.

**F-3 · Org schema is site-wide, not homepage-only.**
`Organization/Place/GeneralContractor` (with OfferCatalog, OpeningHours, ContactPoint) appears on all 234 HTML pages in the sitemap (re-verified; the 235th 200 URL is `locations.kml`). Violates the "Organization on homepage only; LocalBusiness per location" rule and bloats every page.
Fix: restrict the full entity to the homepage and reference it by `@id` elsewhere; location pages carry their own LocalBusiness subtype. `/schema-generate` + `/entity-authority`; applied via Yoast schema settings or the WP pack.

**F-4 · Generic bylines on 110 of 117 Article schemas.**
Author is "Maxx Builders"; only 7 name a person (Harris Khan). Breaches the named-author E-E-A-T rule. Fix requires operator input on real authors per post — gated on attribution truth. `/entity-authority`.

**F-5 · CTR gaps on pages already ranking in the top 10** (28d).

| Page | Impr | Clicks | Pos |
|---|---|---|---|
| `/understanding-commercial-build-outs-guide/` | 9,621 | 9 | 9.0 |
| `/guide-to-4-different-types-of-shell-structures/` | 10,176 | 47 | 6.6 |
| `/texas-commercial-construction-cost-2025-2026/` | 8,093 | 37 | 7.3 |
| `/medical-office-construction-costs-texas-2026-comprehensive-guide/` | 2,918 | 13 | 5.2 |
| `/importance-of-mock-up-rooms-in-the-hospitality-industry/` | 1,917 | 5 | 4.4 |
| `/restaurant-construction-cost-per-square-foot-guide-2024/` | 2,273 | 4 | 9.5 |
| `/commercial-construction-project-timelines/` | 1,836 | 6 | 8.9 |

Fix: rewrite title/description to lead with the query intent (`/metadata-generate`, safe-class; apply via `wp:apply`). The build-outs guide absorbed a 301 (F-9), so its snippet should be checked first. Note the `restaurant…2024` slug and year in title likely depress CTR.

**F-6 · Two priority pages have no meta description** (same as July): `/design-build-construction-houston-2/` (the service/transactional page) and `/importance-of-mock-up-rooms-in-the-hospitality-industry/`. `/metadata-generate`, then `wp:apply`.

## Medium

**F-7 · Orphans: 99 sitemap URLs with zero inbound links** (53 posts, 25 pages, plus 10 project-type and 9 project-attribute archives).
Priority pages affected: `/8-key-considerations-for-building-a-restaurant/` (0), `/3-most-common-obstacles-in-commercial-construction-projects/` (0). Low inbound: hotel cost guide (4), restaurant strategies (4), timelines (3), mock-up rooms (2), design-build (6).
Fix: whole-graph pass with `/internal-link-graph`, then `/internal-linking`; link the flagship hotel guide from the homepage and from hospitality portfolio pages.

**F-8 · Missing and over-length metadata.** 81 pages lack a description; 51 exceed 155 chars (up to 239); 78 titles exceed 60. Mostly older posts (e.g. "office-construction-trends-to-watch-in-2024"). `/metadata-generate` in batches; `npm run validate:metadata` before apply.

**F-9 · Four redirecting URLs still listed in the sitemap, two still linked internally.**
- `/texas-commercial-building-costs-guide/` → `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` (0 inbound)
- `/dental-office-construction-cost-guide/` → `/dental-office-construction-guide/` (**5 internal links still point at the redirector**)
- `/the-cost-of-a-tenant-build-out-per-square-foot/` → `/understanding-commercial-build-outs-guide/` (0)
- `/choose-a-commercial-contractor/` → `/services/architectural-design-and-engineering/` (**4 inbound**; the target looks topically unrelated to the source)
Fix: drop all four from the sitemap (Yoast), update the 9 inbound links to final targets. Confirm the `choose-a-commercial-contractor` redirect is intended. Redirect changes themselves are gated.

**F-10 · Cannibalization — five live clusters.**
- *Tenant improvement:* `/mastering-tenant-improvement-construction-…`, `/tenant-improvement-contractors-guide/`, `/enhancing-commercial-spaces-tenant-improvements-guide/`, `/understanding-commercial-build-outs-guide/` split the same queries, all at pos 28–87.
- *Generic "commercial construction cost":* six pages share it (pos 8–83).
- *Dental:* `/dental-office-construction-guide/` vs `/build-your-dream-dental-clinic-step-by-step-…`.
- *Restaurant:* known pair (`8-key-considerations…` pos 27, `cost-efficient-strategies…` pos 15).
- *Statewide cost:* the redirect in F-9 sends the statewide-cost redirector to `/comprehensive-guide-…-texas-2025/`, which ranks pos 18.6 with 5,628 impressions — but the keyword map designates `/texas-commercial-construction-cost-2025-2026/` as the statewide page. Two live statewide pages compete.
Fix: merge/redirect decisions are gated. Run `/blog-audit` for keep/refresh/merge classification.

**F-11 · Sitemap contains non-page and bad-canonical URLs.**
`/locations.kml` (no title, no canonical, in `geo-sitemap.xml`). `/latest-news-updates/` canonicals to `/blog__trashed/latest-news-updates/`, a trashed-post path. Fix: exclude the `.kml`; correct the canonical or retire the page (retirement is gated).

**F-12 · Impressions down 32% across the board** (182,041 → 123,306): homepage −43%, medical-office −65%, Houston −54%, statewide −49%, hotel guide −45%. Clicks held (−5%), and average position improved on several pages. I can't tell from this data whether the drop is real demand loss, a reporting change or SERP changes. Verify against GSC's UI before treating it as a ranking loss.

## Low

**F-13 · Thin pages: 90 under 400 words.** Mostly archive/portfolio shells (`/projects/*` category pages at 51–84 words, `/join-our-team/`, utility pages like `/single-page/` at 23). Not money pages. Consider noindexing the utility pages and adding intro copy to the project-type archives; do not generate more.

**F-14 · `llms.txt` is live (200) with no `X-Robots-Tag`.** Per CLAUDE.md it should be kept accurate and noindexed. Add the header at the server/plugin level.

**F-15 · GSC still reports the `http://www` homepage** (41 impressions on "maxx builders", 10 clicks). Host variants 301 correctly, so this is residual reporting; no action unless it persists.

## Passing
robots.txt (Yoast, `Disallow:` empty, sitemap declared) · 0 noindex pages · 0 JSON-LD parse errors · FAQPage on 47 pages · 1 canonical per page (self-referencing except F-11) · 0 images missing alt · no duplicate titles · http and apex both 301 to `https://www` · max one redirect hop.

---

## Top 5 actions (ROI ÷ effort)

1. **Rewrite titles/descriptions on the 7 CTR-gap pages (F-5, F-6).** ~34k impressions already in the top 10. `/metadata-generate` → `wp:apply`, small batch, safe-class.
2. **Fix the double-H1 template bug (F-2).** One template fix clears 9 pages including 3 money pages. Needs theme access.
3. **Repair internal links (F-7, F-9).** Re-point 9 links off redirectors; link the 2 zero-inbound priority pages and the hotel guide. `/internal-link-graph` → `/internal-linking`.
4. **Restore CWV measurement (F-1).** Enable PSI + CrUX APIs on the key's project and install `jq`; every CWV decision is blind until then.
5. **Scope Org schema to homepage + location pages (F-3).** Template-level, removes 234 redundant entities. Pair with real author bylines (F-4) once the operator supplies names.

## Needs a platform pack or operator decision
- **`wp:apply` (safe-class):** F-5, F-6, F-8, F-9 link updates, F-3 if done through Yoast meta/schema fields. No staging exists, so each batch needs a backup/export first.
- **Theme/builder access (not covered by the pack):** F-2, F-14.
- **Gated, operator decision:** F-4 (author attribution), F-10 and F-11 (merges, redirects, retiring pages), anything on the homepage.
