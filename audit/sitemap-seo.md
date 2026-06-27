# Sitemap SEO Audit — maxxbuilders.com
**Date:** 2026-06-24
**Platform:** WordPress + Yoast SEO
**Sitemap index:** https://www.maxxbuilders.com/sitemap_index.xml

---

## 1. Sitemap Index

| Sub-sitemap | Index lastmod | URL count |
|---|---|---|
| post-sitemap.xml | 2026-06-25T00:16:57+00:00 | 83 |
| page-sitemap.xml | 2026-06-24T22:35:56+00:00 | 44 |
| portfolio-sitemap.xml | 2026-02-12T20:21:11+00:00 | 37 |
| locations-sitemap.xml | 2025-05-27T22:23:00+00:00 | 5 |
| project-type-sitemap.xml | 2026-02-12T20:21:11+00:00 | 10 |
| project-attributes-sitemap.xml | 2026-02-12T20:21:11+00:00 | 9 |
| geo-sitemap.xml | 2025-10-22T15:55:55+00:00 | 1 (KML only) |

**Total indexed URLs: 189**
Well within the 50,000-URL per-file limit. No splitting required.

---

## 2. Validation Checks

| Check | Result | Notes |
|---|---|---|
| XML well-formed | PASS | All 7 sub-sitemaps parse cleanly |
| Correct namespace | PASS | `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` present in all |
| Encoding declared | PASS | UTF-8 on all files |
| Under 50,000 URLs per file | PASS | Max is 83 (post-sitemap) |
| `priority` tags present | INFO | geo-sitemap.xml has `<priority>1</priority>` — ignored by Google, remove |
| `changefreq` tags present | PASS (none found) | Not used anywhere |
| XSL stylesheet references | INFO | All sitemaps reference Yoast's XSL via `//www.maxxbuilders.com/...` (protocol-relative). Harmless, cosmetic only |

---

## 3. Status Code Audit — Problem URLs

### 3a. HARD FAIL — 404 in sitemap

| URL | Sitemap | Status | Action |
|---|---|---|---|
| https://www.maxxbuilders.com/get-a-quote/ | page-sitemap.xml | **404** | Remove immediately. Crawl confirms: title "Page not found", 25-word body. This is a broken page being actively submitted to Google. |

### 3b. Redirects in sitemap (301)

| URL in sitemap | Redirects to | Sitemap file | Action |
|---|---|---|---|
| https://www.maxxbuilders.com/industries/industrial-warehouse-construction-texas | /industries/industrial-warehouse-construction-texas/ | page-sitemap.xml | Update to the trailing-slash canonical |

Note: `/locations` (without trailing slash) appears in the crawl data but not in locations-sitemap.xml — the sitemap correctly uses `/locations/`. The crawl captured the redirect source.

### 3c. Pages in sitemap with noindex/thin content risk (not confirmed noindex, but flag for review)

| URL | Sitemap | Concern |
|---|---|---|
| https://www.maxxbuilders.com/opt-out-from-email-and-sms/ | page-sitemap.xml | Utility/compliance page — should be noindexed and removed from sitemap |
| https://www.maxxbuilders.com/single-page/ | page-sitemap.xml | Name suggests a test/staging page — verify intent; likely remove |
| https://www.maxxbuilders.com/thank-you/ | page-sitemap.xml | Post-conversion page; Google best practice is noindex + sitemap removal |
| https://www.maxxbuilders.com/client-resources/faq/ | page-sitemap.xml | Crawl did not capture this page — verify it has real content |
| https://www.maxxbuilders.com/contact/contact-information/ | page-sitemap.xml | Contact utility page — typically noindexed by best practice |
| https://www.maxxbuilders.com/latest-news-updates/ | page-sitemap.xml | Crawl did not capture; verify content depth |
| https://www.maxxbuilders.com/client-resources/project-planning-guide/ | page-sitemap.xml | Crawl did not capture; verify content depth |
| https://www.maxxbuilders.com/client-resources/industry-news-and-trends/ | page-sitemap.xml | Crawl did not capture; verify content depth |
| https://www.maxxbuilders.com/expert-tips-insights/ | page-sitemap.xml | Crawl did not capture; verify — may be an archive/filter page |
| https://www.maxxbuilders.com/industry-trends/ | page-sitemap.xml | Crawl did not capture; verify — may be an archive/filter page |

---

## 4. Cross-Reference: Crawled Pages vs. Sitemap

### 4a. Crawled but MISSING from all sitemaps (should be added if indexable)

| Crawled URL | Likely reason missing |
|---|---|
| https://www.maxxbuilders.com/locations | 301 redirect — correct to exclude (redirect source should never be in sitemap) |

All other 46 crawled pages were found in at least one sub-sitemap. Coverage is strong.

### 4b. In sitemap but NOT crawled (partial crawl gap — 47-URL crawl is shallow)

The Firecrawl crawl captured 47 URLs. The sitemap contains 189. The gap is expected — the crawl was shallow and did not traverse blog posts, portfolio detail pages, or sub-resource pages. The pages below are in the sitemap but absent from the crawl; they are **not** confirmed broken — only unverified:

**Blog/posts (83 URLs in post-sitemap):** The crawl captured only 3 blog posts directly (`austin-commercial-construction-cost-per-square-foot-2026/`, `commercial-construction-companies-texas-2026/`, `the-ultimate-2026-hotel-construction-cost-guide-texas-edition/`). The remaining 80 posts are in the sitemap but uncrawled.

**Portfolio pages (37 in portfolio-sitemap):** None of the `/portfolio/` detail pages were crawled. These are all listed in portfolio-sitemap.xml with individual lastmod dates ranging 2025-03-31 to 2026-02-12 — valid.

**Page-sitemap utility pages (10 uncrawled):** opt-out, single-page, thank-you, FAQ, contact-information, latest-news-updates, project-planning-guide, industry-news-and-trends, expert-tips-insights, industry-trends.

---

## 5. Lastmod Analysis

### post-sitemap.xml
A significant pattern: most posts show `2026-05-18` as lastmod, regardless of original publish date. Posts from 2018, 2019, 2020 all carry the same May 18 timestamp. This is a Yoast behavior that stamps lastmod when any site-wide setting or plugin update touches the post record — not when content actually changed.

**Impact:** Google has stated it ignores lastmod when it detects the date is unreliable. A mass same-day lastmod across 60+ posts from different years is a strong signal of unreliable dates. Google will ignore the field for these posts.

**Exceptions (realistic lastmod):**
- `build-out-costs-retail-space/` — 2026-06-24 (appears genuinely recent)
- `10-key-steps-to-a-successful-commercial-construction-project/` — 2026-06-24
- `understanding-commercial-build-outs-guide/` — 2026-06-24
- `best-retail-construction-contractors-in-houston-2026-rankings/` — 2026-06-24
- `commercial-construction-cost-houston-tx/` — 2026-06-24
- `cost-to-build-a-car-wash-in-texas/` — 2026-06-24
- `importance-of-mock-up-rooms-in-the-hospitality-industry/` — 2026-06-24
- `cost-per-square-foot-build-warehouse-texas/` — 2026-06-24
- `medical-office-construction-costs-texas-2026-comprehensive-guide/` — 2026-06-25
- `the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` — 2026-06-25

### page-sitemap.xml
Realistic, varied dates from 2024-01-31 through 2026-06-24. No mass-same-date problem.

### portfolio-sitemap.xml
Nearly all show 2025-03-31 (same day), which is plausible as a bulk import date. Two exceptions with later dates suggest real edits. Low risk since these are portfolio pages, not content pages.

### locations-sitemap.xml
Dates range 2025-05-21 to 2025-05-27. Plausible for a batch of pages created around the same time.

---

## 6. project-type-sitemap.xml and project-attributes-sitemap.xml — Taxonomy Risk Assessment

### project-type-sitemap.xml (10 URLs)

These are WordPress custom taxonomy archive pages for portfolio project types.

| URL | Concern |
|---|---|
| /project-type/corporate-interiors/ | Only 1 portfolio item (J.D. Byriders). Thin archive. |
| /project-type/fitness/ | 1 item (Anytime Fitness). Thin archive. |
| /project-type/fuel-stations/ | 7 items. Borderline. |
| /project-type/healthcare-facilities/ | 2 items. Thin. |
| /project-type/hospitality-entertainment/ | 5 items. |
| /project-type/industrial-warehouse/ | 2 items (including Ace Steel). Thin. |
| /project-type/multi-family-mixed-use/ | 1 item (Pearl Apartment). Thin. |
| /project-type/restaurants/ | 3 items. |
| /project-type/retail-shopping-centers/ | 12 items. Adequate. |
| /project-type/tenant-improvements/ | 5 items. |

**Verdict:** Six of ten taxonomy archives have 1-3 portfolio items. These pages contain minimal unique text beyond a list of project tiles. They duplicate intent with the `/projects/` category pages (e.g., `/projects/healthcare-facilities/` mirrors `/project-type/healthcare-facilities/`). These are thin taxonomy archives. Recommended action: add `noindex` to all `/project-type/` pages with fewer than 5 portfolio items, and remove them from the sitemap. For the ones with adequate depth, add descriptive text before indexing.

### project-attributes-sitemap.xml (9 URLs)

These are geographic attribute taxonomies on portfolio items.

| URL | Items |
|---|---|
| /project-attributes/houston/ | Multiple (largest) |
| /project-attributes/league-city/ | 1-2 (Calder Plaza area) |
| /project-attributes/pasadena/ | 1 (Kool Korner Mart) |
| /project-attributes/pearland/ | 1 (Lus Barbershop) |
| /project-attributes/pflugerville/ | 1 (Holiday Inn Express) |
| /project-attributes/rd-katy/ | 1-2 (Y-Shops Greenhouse) |
| /project-attributes/richmond/ | 1 (Riverpointe) |
| /project-attributes/rosenberg/ | Multiple (Anytime Fitness area) |
| /project-attributes/sugarland/ | 1 (Express Mart) |

**Verdict:** These are effectively duplicate content — same portfolio item cards filtered by a city tag. They provide zero unique editorial content. Eight of nine have 1-2 items. **All `/project-attributes/` pages should be noindexed and removed from the sitemap immediately.** These are the highest doorway-page risk on the site despite the low total count, because each page is simply "here are our projects in [city]" with no location-specific body copy.

---

## 7. geo-sitemap.xml — Location Page Assessment

### What the geo-sitemap actually contains

The geo-sitemap.xml contains **one URL**: `https://www.maxxbuilders.com/locations.kml`

This is a KML file (Google Earth format), not an HTML location page. It is generated by the Yoast SEO: Local plugin and represents the single business location point. This is technically valid but provides no SEO value — Google does not use KML files for indexation signals.

**The geo-sitemap is misleadingly named.** It does not contain HTML location pages.

### Actual location page inventory

Location pages are split across two different URL structures:

**Structure 1 — Root-level city pages (in page-sitemap.xml, 5 pages):**
- /houston-commercial-contractors/
- /dallas-tx/
- /austin-tx/
- /fort-worth-tx/
- /san-antonio-tx/

**Structure 2 — /locations/ sub-directory (in locations-sitemap.xml, 5 pages):**
- /locations/ (archive/hub page)
- /locations/san-antonio-commercial-contractors/
- /locations/arlington-commercial-construction-companies/
- /locations/irving-premier-commercial-contractors/
- /locations/the-woodlands-commercial-contractors/

**Total indexable location pages: 9 HTML pages** (plus /locations/ hub = 10 total location-intent pages)

This is well under the WARNING threshold of 30.

### Location page URL structure conflict

San Antonio has two pages competing for the same intent:
- `/san-antonio-tx/` (page-sitemap.xml, lastmod 2026-02-17)
- `/locations/san-antonio-commercial-contractors/` (locations-sitemap.xml, lastmod 2025-05-27)

This is active keyword cannibalization. Both pages target "San Antonio commercial contractors" and both are in the sitemap. One should be consolidated into the other with a 301 redirect, and the losing URL removed from the sitemap.

The crawl confirmed the `/locations/` hub page has a missing meta description (null). This should be fixed before it accrues more crawl attention.

---

## 8. Summary of Required Actions

### Critical (fix before next crawl)

1. **Remove /get-a-quote/ from page-sitemap.xml** — confirmed 404. Every Googlebot visit to this sitemap entry wastes crawl budget on a dead page. In WordPress: either restore the page or set Yoast to exclude it. If the page was intentionally deleted, the link from the homepage (`/get-a-quote/` appears as an internal link) also needs fixing.

2. **Fix or remove all 9 /project-attributes/ taxonomy pages from sitemap** — add `noindex` via Yoast at the taxonomy level (`SEO > Search Appearance > Taxonomies > Project Attributes = No`), which will auto-remove them from the sitemap. These are thin geo-filtered portfolio lists with no editorial content.

### High priority

3. **Update /industries/industrial-warehouse-construction-texas (no trailing slash) in page-sitemap.xml** — change to `/industries/industrial-warehouse-construction-texas/`. Yoast may auto-correct this; check the page's canonical in WP admin.

4. **Resolve San Antonio cannibalization** — decide canonical between `/san-antonio-tx/` and `/locations/san-antonio-commercial-contractors/`. 301 the loser, remove from sitemap.

5. **Audit and noindex thin project-type taxonomy pages** — set Yoast `noindex` on `/project-type/` archives with fewer than 5 portfolio items: corporate-interiors, fitness, healthcare-facilities, industrial-warehouse, multi-family-mixed-use. Retail-shopping-centers (12 items) can stay indexed if descriptive text is added.

6. **Remove utility/transactional pages from sitemap** — thank-you, opt-out-from-email-and-sms, single-page. Set these to noindex in Yoast individually (`SEO meta box > Advanced > noindex`). They will drop from the sitemap automatically.

### Medium priority

7. **Remove `<priority>1</priority>` from geo-sitemap.xml** — Google ignores this tag; it was deprecated for ranking purposes. It can only be removed by configuring the Yoast Local plugin settings.

8. **Add meta description to /locations/** — crawl shows this page has a null meta description. 280 words of body content but missing the description entirely.

9. **Evaluate /expert-tips-insights/ and /industry-trends/** — these archive-style pages appear in the sitemap but were not crawled. If they are thin tag/category archives with no unique editorial content, noindex them.

### Low priority / informational

10. **Post lastmod reliability** — The mass `2026-05-18` lastmod on 60+ posts indicates a bulk Yoast update touched all posts. Google will likely ignore lastmod on these. No urgent action required, but avoid bulk-editing posts without real content changes as it further degrades lastmod trust.

11. **geo-sitemap KML URL** — The geo-sitemap.xml contains only the `.kml` file, not HTML pages. This is expected Yoast Local behavior. Consider whether the Yoast Local plugin is still needed; if not, disabling it removes this sitemap entry cleanly from the index.

---

## 9. Sitemap URL Count by Type

| Type | Count | Status |
|---|---|---|
| Blog posts | 83 | OK — real content, varied dates |
| Pages (core/utility) | 44 | 4-6 need noindex/removal |
| Portfolio items | 37 | OK — individual project pages with images |
| Location pages | 5 | OK — in locations-sitemap; watch San Antonio duplicate |
| Project type taxonomies | 10 | 6 need noindex |
| Project attribute taxonomies | 9 | All 9 need noindex and removal |
| Geo/KML | 1 | KML file, not HTML — informational only |
| **Total** | **189** | **Well under 50k limit** |
