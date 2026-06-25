# Technical SEO Audit — maxxbuilders.com
**Date:** 2026-06-24  
**Platform:** WordPress + Yoast SEO  
**Crawl basis:** 47 pages (.firecrawl/crawl.json)  
**Live checks:** security headers, redirects, sitemaps fetched at audit time  
**Technical Score: 54 / 100**

---

## Executive Summary

The site has solid foundations (HTTPS, self-referencing canonicals on most pages, Yoast-generated structured data) but carries three issues that actively cost crawl budget and conversions: a broken CTA link to `/get-a-quote/` (hard 404 linked from the homepage), a redirect alias for `/general-contracting/` that lands on a `.webp` image file instead of the service page, and a complete absence of security response headers. The sitemap is large (241 URLs across 7 sub-sitemaps) but contains pages that are thin stubs, unused archives, and at least one URL with a missing trailing slash. Thirteen pages in the crawl set are under 100 words — several are category archive pages with no substantive content.

---

## Category Results

| Category | Status | Score |
|---|---|---|
| 1. Crawlability | PASS with warnings | 75/100 |
| 2. Indexability | FAIL | 55/100 |
| 3. Security (HTTPS + Headers) | FAIL | 30/100 |
| 4. URL Structure / Redirects | FAIL | 40/100 |
| 5. Mobile | PASS | 80/100 |
| 6. Core Web Vitals (source signals) | NEEDS WORK | 60/100 |
| 7. Structured Data | PASS with warnings | 70/100 |
| 8. JavaScript Rendering | PASS | 75/100 |
| 9. IndexNow | NOT IMPLEMENTED | 0/100 |

---

## 1. Crawlability

**Status: PASS with warnings**

### robots.txt
- `Disallow:` line is open (no paths blocked). All pages are crawlable.
- Sitemap directive present: `https://www.maxxbuilders.com/sitemap_index.xml`
- No AI crawler rules (GPTBot, ClaudeBot, PerplexityBot, Bytespider) — they are crawling freely.

### Sitemap Index Coverage

| Sitemap | HTTP | URL Count |
|---|---|---|
| sitemap_index.xml | 200 | 7 sub-sitemaps |
| post-sitemap.xml | 200 | 117 |
| page-sitemap.xml | 200 | 56 |
| portfolio-sitemap.xml | 200 | 38 |
| locations-sitemap.xml | 200 | 5 |
| project-type-sitemap.xml | 200 | 10 |
| project-attributes-sitemap.xml | 200 | 9 |
| geo-sitemap.xml | 200 | 1 (locations.kml) |
| **Total** | | **241 URLs** |

**Observation:** The crawl captured 47 pages. The sitemap indexes 241 URLs. This gap is expected (blog posts, portfolio items), but 56 page-sitemap URLs vs. 47 crawled pages means approximately 9 pages are indexed but were not crawled in this pass.

**Pages in page-sitemap NOT in crawl (uncrawled):**
- `/client-resources/faq/`
- `/client-resources/industry-news-and-trends/`
- `/client-resources/project-planning-guide/`
- `/contact/contact-information/`
- `/dallas-tx/`
- `/expert-tips-insights/`
- `/fort-worth-tx/`
- `/industry-trends/`
- `/latest-news-updates/`
- `/opt-out-from-email-and-sms/`
- `/san-antonio-tx/`
- `/single-page/`
- `/thank-you/`

Live checks confirm these pages return HTTP 200. Several (`/expert-tips-insights/`, `/industry-trends/`, `/latest-news-updates/`) are likely thin archive/stub pages — validate before keeping in sitemap.

**Issues:**
- `geo-sitemap.xml` contains `https://www.maxxbuilders.com/locations.kml` — a KML file, not an HTML page. KML should not be in a standard XML sitemap. Remove or move to a dedicated geo sitemap referenced separately.
- `page-sitemap.xml` includes `/single-page/` — almost certainly a theme demo or draft page. Verify it has indexable content or remove from sitemap and add `noindex`.
- `project-attributes-sitemap.xml` (9 URLs) likely includes taxonomy archive pages (e.g., project attribute terms) that may be thin. Audit these individually.

### AI Crawler Recommendation
Add explicit rules to `robots.txt` for AI crawlers. Example:

```
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Bytespider
Disallow: /
```
Decide intentionally whether to allow or deny. Current state is passive admission.

---

## 2. Indexability

**Status: FAIL**

### 2a. Missing Meta Descriptions

The following crawled pages have a `null` metaDescription:

| URL | Notes |
|---|---|
| `https://www.maxxbuilders.com/locations` | Thin taxonomy archive; also has canonical/URL mismatch (see 2e) |
| `https://www.maxxbuilders.com/get-a-quote/` | 404 page; no description expected but the page should not exist |

All other 45 crawled pages have meta descriptions present.

### 2b. Meta Description Length Issues

| URL | Description | Length | Issue |
|---|---|---|---|
| `/services/construction-management/` | "Maxx Builders offers expert construction management services in Texas, specializing in project planning, execution, and oversight for commercial construction projects." | 166 chars | Over 155 char limit — truncated in SERPs |
| `/about/our-history/` | "Discover the legacy of Maxx Builders, a leader in Texas commercial construction since 1995. Learn how we've built a foundation of trust and excellence." | 151 chars | Borderline; also "since 1995" contradicts bodyText which states "Established in 2008" and About page which states "Founded in 2005" |

**Critical consistency conflict:** The `about/our-history/` meta description says "since 1995," the bodyText says "Established in 2008," and the About page says "Founded in 2005." Three different founding years across the site damage E-E-A-T credibility.

### 2c. Title Tag Issues

**Duplicate titles detected:**

| Title | URLs sharing it |
|---|---|
| "Discover Maxx Builder's Corporate Interiors projects, featuring innovative designs and tailored solutions for modern office spaces that inspire productivity." | `/industries/` and `/projects/corporate-interiors/` — same meta description on both pages |

**Title length check:**
All titles within crawl set appear to be under 65 characters except:

| URL | Title | Approx Length |
|---|---|---|
| `/about/our-history/` | "Maxx Builders History \| Leading Commercial Construction in Texas" | 63 chars — OK |
| `/` | "Maxx Builders \| Texas' Premier Commercial General Contractors" | 61 chars — OK |

No critical over-length titles found.

### 2d. H1 Issues

| URL | Issue |
|---|---|
| `/about/group-of-companies/` | No H2 tags; very thin (105 words) |
| `/projects/multi-family-and-mixed-use/` | 50 words — extreme thin content |
| `/projects/industrial-and-warehouse/` | 52 words — extreme thin content |
| `/projects/healthcare-facilities/` | 50 words — extreme thin content |
| `/projects/restaurants/` | 54 words — extreme thin content |
| `/projects/corporate-interiors/` | 47 words — extreme thin content |
| `/projects/car-wash/` | 46 words — extreme thin content (zero project items listed) |
| `/projects/hospitality-entertainment/` | 61 words |
| `/projects/tenant-improvements/` | 57 words |
| `/projects/fuel-stations/` | 72 words |
| `/projects/retail-shopping-centers/` | 78 words |

**H1/Title mismatch:**

| URL | H1 | Title |
|---|---|---|
| `/` | "Texas Commercial General Contractors" | "Maxx Builders \| Texas' Premier Commercial General Contractors" — aligned in meaning |
| `/services/` | "Our Services" | "Commercial Construction Services \| Maxx Builders" — minor misalignment |
| `/industries/` | "Industries We Serve" | "Industries We Serve \| Maxx Builders" — OK |
| `/projects/multi-family-and-mixed-use/` | "Multi-family + Mixed Use" | "Multi-family + Mixed Use \| Maxx Builders" — OK |

No severe H1/title mismatches. Multiple H1s not detected; all pages have exactly one H1.

### 2e. Canonical Issues

| URL | Canonical in Source | Issue |
|---|---|---|
| `https://www.maxxbuilders.com/locations` (no trailing slash) | `https://www.maxxbuilders.com/locations/` | URL served ≠ canonical. The page loads at the non-trailing-slash URL but declares a trailing-slash canonical. This is a redirect that isn't happening — Google may index both variants. |
| `https://www.maxxbuilders.com/get-a-quote/` | `null` | 404 page has no canonical — acceptable for 404s but the page itself must be fixed. |

All other crawled pages have self-referencing canonicals matching their URL. Canonical implementation via Yoast is consistent.

### 2f. Thin Content Summary

Pages with under 200 words of body content that are indexable:

| URL | Word Count |
|---|---|
| `/projects/car-wash/` | 46 (zero projects listed — completely empty archive) |
| `/projects/corporate-interiors/` | 47 |
| `/client-resources/clients-guide/` | 46 |
| `/client-resources/construction-terminology/` | 46 |
| `/projects/multi-family-and-mixed-use/` | 50 |
| `/projects/healthcare-facilities/` | 50 |
| `/projects/industrial-and-warehouse/` | 52 |
| `/projects/restaurants/` | 54 |
| `/projects/tenant-improvements/` | 57 |
| `/projects/hospitality-entertainment/` | 61 |
| `/projects/retail-shopping-centers/` | 78 |
| `/about/group-of-companies/` | 105 |
| `/industries/` | 95 |

These are mostly category/archive hub pages that serve as navigation only. They should either receive substantive introductory copy (150–300 words minimum) or be consolidated.

---

## 3. Security

**Status: FAIL**

### HTTPS
- PASS: Site serves over HTTPS. Nginx handles TLS termination.

### Response Headers (live check: 2026-06-24)

| Header | Present | Value |
|---|---|---|
| `Strict-Transport-Security` (HSTS) | NO | Missing |
| `Content-Security-Policy` (CSP) | NO | Missing |
| `X-Content-Type-Options` | NO | Missing |
| `X-Frame-Options` | NO | Missing |
| `Referrer-Policy` | NO | Missing |
| `Permissions-Policy` | NO | Missing |
| `X-XSS-Protection` | NO | Missing |

**Observed headers:** `Connection`, `Vary`, `Age`, `X-Cache`, `Accept-Ranges`, `Content-Length`, `Cache-Control`, `Content-Type`, `Date`, `Expires`, `Last-Modified`, `Server: nginx`

Zero security response headers are set. The `Server: nginx` header exposes the web server technology — a minor information disclosure risk.

**Implementation path (WordPress + Nginx):** Add to the nginx server block or via a WordPress security plugin (e.g., Wordfence, iThemes Security, or a headers plugin):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

CSP requires a policy audit before implementation; do not add a restrictive CSP without testing — it can break Elementor/Yoast/third-party scripts.

---

## 4. URL Structure and Redirects

**Status: FAIL**

### 4a. Broken 404 Linked from Homepage

`/get-a-quote/` returns HTTP 404. This URL is linked directly from the homepage CTA and appears at least twice in the homepage `internalLinks` array. This is a conversion-critical failure — users clicking the primary CTA land on an error page.

**Fix:** Either restore the `/get-a-quote/` page, or redirect it to `/commercial-construction-project-inquiry/` (301), and update all internal links to point to the correct destination URL.

### 4b. Broken Redirect — /general-contracting/ points to an image file

| Alias Path | HTTP | Final Destination |
|---|---|---|
| `/construction-management/` | 301 | `/services/construction-management/` — CORRECT |
| `/design-and-build/` | 301 | `/services/design-and-build/` — CORRECT |
| `/general-contracting/` | 301 | `https://www.maxxbuilders.com/wp-content/uploads/2023/06/General-Contracting.webp` — BROKEN |
| `/tenant-improvement/` | 301 | `/services/tenant-improvement/` — CORRECT |

`/general-contracting/` is permanently redirected to a WebP image upload. Anyone who lands on this URL (backlinks, bookmarks, old GSC links) gets an image file instead of the service page. This also means the correct service page at `/services/general-contracting/` receives no redirect equity from `/general-contracting/`.

**Fix:** Update the redirect in WordPress (Yoast redirects, Redirection plugin, or nginx config) to:
`/general-contracting/` → `/services/general-contracting/` (301)

### 4c. /locations trailing-slash inconsistency

`/locations` (no slash) returns HTTP 301 to `/locations/` — that redirect is working. However, the crawl captured the page at `https://www.maxxbuilders.com/locations` while its canonical is `https://www.maxxbuilders.com/locations/`. The Firecrawl agent followed the redirect but stored the pre-redirect URL. Verify in GSC which variant Google has indexed.

### 4d. Missing trailing slash in sitemap

`page-sitemap.xml` contains `https://www.maxxbuilders.com/industries/industrial-warehouse-construction-texas` (no trailing slash). Live check confirms this redirects 301 to the trailing-slash version. Sitemaps should always list the canonical (trailing-slash) URL, not the redirect-source URL. Fix in Yoast sitemap settings or add a filter.

### 4e. /blog/ vs /blog-pages/ URL confusion

The homepage links to `/blog-pages/` while the sitemap and Yoast use `/blog/` as the blog archive. If `/blog-pages/` is a separate page or redirects to `/blog/`, confirm only one is indexed and the other is either noindexed or redirected. Not confirmed in this crawl — flag for manual check.

---

## 5. Mobile

**Status: PASS**

- Viewport meta tag: `<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=yes">` — present on all pages.
- Theme: Wilmer (responsive). CSS shows mobile breakpoint handling at 768px.
- `user-scalable=yes` is set — correct. Pinch-to-zoom is not blocked.
- No fixed-width pixel declarations observed in inline styles that would break mobile layout.

**Minor concern:** `user-scalable=yes` paired with explicit width targeting is correct, but verify touch targets (buttons, nav items) are at minimum 48×48px on mobile. Not verifiable from source alone — requires device testing.

---

## 6. Core Web Vitals (Source Signals)

**Status: NEEDS WORK**

These are source-level signals. Field data (CrUX) and lab data (Lighthouse) are needed for definitive scores.

### LCP Risk Factors

- Homepage HTML is 425 KB (confirmed from `Content-Length` response header). This is large for a WordPress page and suggests render-blocking or excessive DOM.
- Theme: Elementor-rendered WordPress page with `wilmer` / `wilmer-child` theme. Elementor pages typically generate bloated HTML and load many CSS/JS files.
- LCP element risk: The homepage H1 image (`h1-img-06-maxxbuilders`) has inline CSS applying `aspect-ratio: 16 / 9` and `background: #2b2b2b` (a CLS fix, which is good). However, Elementor lazy-loads images by default — if the LCP image is lazy-loaded, it will delay LCP. Confirm the hero image has `loading="eager"` and `fetchpriority="high"`.
- The inline style block includes: `img[data-lazy-src], img.lazyload { min-height: 1px; background: #f0f0f0; }` — confirms lazy loading is active site-wide.
- **Recommendation:** Preload the LCP hero image using `<link rel="preload" as="image" href="...hero.webp" fetchpriority="high">` in the `<head>`.

### INP Risk Factors (replaces FID, effective March 2024)

- Elementor builder generates significant JavaScript. Heavy JS bundles delay interactivity.
- Multiple third-party scripts are likely loading (SmartBidNet form embed on `/join-our-team/subcontractors/`, potential chat widgets, analytics).
- **Recommendation:** Audit JS load order. Defer non-critical scripts. Consider switching the SmartBidNet embed to load on user interaction.

### CLS Signals

- The crawl source includes an inline `<style id="maxx-ux-css">` block that applies CLS fixes for the header logo wrapper (explicit width/height on `.mkdf-logo-wrapper`) and reserves space for lazy-loaded images via `aspect-ratio`. This is well-implemented.
- The logo wrapper fix locks dimensions: `width: 250px; height: 58px; contain: layout size` on desktop, and `min-height: 50px` on mobile. This will prevent logo-related CLS.
- **Remaining CLS risk:** Elementor sections that load after fonts/images resolve can still shift content. Ensure all above-the-fold images have explicit `width` and `height` attributes set in the Elementor image widgets.

### Page Weight

- 425 KB HTML on the homepage is high. For a service business homepage, target under 100 KB HTML. Suggests excessive inline CSS/JS or server-side bloat from Elementor.

---

## 7. Structured Data

**Status: PASS with warnings**

Yoast SEO generates a `schema.org` graph on every page. The homepage graph includes:

| Type | Present | Notes |
|---|---|---|
| `WebPage` | YES | Correct on page level |
| `WebSite` with SearchAction | YES | Enables sitelinks search box |
| `Organization` + `Place` + `GeneralContractor` | YES | Multi-type on homepage — appropriate |
| `PostalAddress` | YES | 4150 Bluebonnet Dr. Suite 102, Stafford, TX 77477 |
| `BreadcrumbList` | YES | Homepage breadcrumb present |
| `ImageObject` for logo | YES | 512×512 logo correctly specified |

### Issues

**1. Organization schema `email` field mismatch:**
- Schema declares `"email":"info@maxxbuilders.com"`
- Visible on-page contact email is `businessdevelopment@maxxbuilders.com`
- Schema contact point email: `info@maxxbuilders.com`
- NAP consistency: email addresses should match across schema, GBP, and visible site content. Align these — pick one canonical contact email and use it everywhere.

**2. Opening Hours inaccuracy:**
Schema declares Sunday open 09:00–17:00. The visible on-page hours state Sunday: Closed. This is a direct E-E-A-T/NAP conflict and will be picked up by Google.

```json
"openingHoursSpecification": [
  { "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], "opens":"09:00","closes":"17:00" }
]
```

Fix: Remove Sunday from the openingHoursSpecification, or change it to match the visible text (Closed).

**3. `primaryImageOfPage` uses logo, not a content image:**
On the homepage, the primary image ID resolves to a 2560×2560px logo image. Google typically prefers a representative page/content image for `primaryImageOfPage`. Consider setting a hero photo as the Yoast SEO featured image instead.

**4. `GeneralContractor` subtype:**
The Organization is typed as `["Organization","Place","GeneralContractor"]`. `GeneralContractor` is a valid `LocalBusiness` subtype from schema.org. The current implementation is acceptable, but `LocalBusiness` should be the direct parent type, not `Place`. Consider restructuring to `["LocalBusiness","GeneralContractor"]` with `Place` as a `location` property.

**5. No `FAQPage` or `HowTo` schema on blog posts:**
The blog posts covering topics like "Commercial Construction Cost Per Square Foot" and "Hotel Construction Cost Guide" are high-intent pages. Adding `FAQPage` schema with Q&A blocks would increase eligibility for SERP features.

---

## 8. JavaScript Rendering

**Status: PASS**

- The site uses WordPress + Elementor. Pages are server-side rendered (SSR) by PHP.
- Critical content (H1, meta tags, body text, structured data, canonical) is present in the raw HTML source — not dependent on JS execution.
- Yoast schema graph is embedded as inline `<script type="application/ld+json">` — crawlable without JS.
- The SmartBidNet form on `/join-our-team/subcontractors/` is loaded via an iframe or embed — content inside may not be crawlable, but form content is not critical for SEO.
- No evidence of full client-side rendering (CSR-only) patterns. Googlebot can index this site without rendering JS.

---

## 9. IndexNow

**Status: NOT IMPLEMENTED**

IndexNow (Bing, Yandex, Naver) is not configured. Yoast SEO Premium includes IndexNow support natively. If using Yoast Premium, enable it in Yoast > General > Features > IndexNow.

For Yoast Free, install the "IndexNow" plugin by Microsoft or use the Bing Webmaster Tools connector. This ensures Bing is notified of content changes within minutes rather than waiting for crawl cycles.

---

## Prioritized Issue List

### Critical (Fix within 48 hours)

| # | Issue | Impact | Fix |
|---|---|---|---|
| C1 | `/get-a-quote/` returns 404; linked from homepage CTA | Conversion loss, crawl waste | Restore page or 301 redirect to `/commercial-construction-project-inquiry/`; update all internal links |
| C2 | `/general-contracting/` redirects to a `.webp` image file | Lost backlink equity, broken redirect chain | Update redirect target to `/services/general-contracting/` |
| C3 | Schema `openingHoursSpecification` lists Sunday open; visible text says Sunday Closed | E-E-A-T failure, GBP mismatch risk | Remove Sunday from schema or fix visible hours to match |
| C4 | Three different founding years (1995/2005/2008) across meta description, body text, and About page | Severe E-E-A-T credibility damage | Decide canonical year, update all instances |

### High (Fix within 2 weeks)

| # | Issue | Impact | Fix |
|---|---|---|---|
| H1 | Zero security response headers | Security risk, missing trust signals | Add HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy via nginx or WP plugin |
| H2 | Schema `email` (info@) vs on-page email (businessdevelopment@) mismatch | NAP inconsistency | Align to one email across schema, GBP, and visible contact info |
| H3 | `/projects/car-wash/` — zero projects, 46 words, fully indexable | Doorway/thin content risk | Either add project content or noindex + remove from sitemap |
| H4 | Duplicate meta description on `/industries/` and `/projects/corporate-interiors/` | Indexability signal dilution | Write unique descriptions for each |
| H5 | LCP hero image likely lazy-loaded; no confirmed `fetchpriority="high"` | LCP degradation | Add `loading="eager" fetchpriority="high"` to hero image; add `<link rel="preload">` |
| H6 | `/blog-pages/` vs `/blog/` URL split — potential duplicate index entry | Crawl budget, canonicalization | Confirm one canonical blog archive; redirect or noindex the other |

### Medium (Fix within 4 weeks)

| # | Issue | Impact | Fix |
|---|---|---|---|
| M1 | `project-attributes-sitemap.xml` (9 URLs) and `project-type-sitemap.xml` (10 URLs) likely contain thin taxonomy archives | Crawl budget dilution | Audit each; noindex or consolidate thin archives |
| M2 | `/single-page/` in page-sitemap — likely theme demo page | Thin content indexed | Add `noindex` tag; remove from sitemap |
| M3 | `geo-sitemap.xml` references `locations.kml` — not a valid sitemap entry | Sitemap spec violation | Remove KML from XML sitemap |
| M4 | `industries/industrial-warehouse-construction-texas` missing trailing slash in sitemap | Sitemap lists redirect URL, not canonical | Fix sitemap entry to include trailing slash |
| M5 | 425 KB homepage HTML — oversized | LCP, TTFB risk | Profile with Lighthouse; eliminate unused CSS/JS blocks from Elementor |
| M6 | `/about/our-history/` meta description over 155 chars (166 chars) | SERP truncation | Shorten to ≤ 155 chars |
| M7 | 11 project category pages under 80 words — thin navigation archives | Thin content, potential Panda signal | Add 150–300 word introductory copy to each category |
| M8 | `primaryImageOfPage` on homepage uses logo instead of hero/content image | Rich result quality | Set a hero photo as Yoast SEO featured image |

### Low (Next sprint)

| # | Issue | Impact | Fix |
|---|---|---|---|
| L1 | No `FAQPage` schema on cost-guide blog posts | Missed SERP feature eligibility | Add FAQ schema to `/austin-commercial-construction-cost-per-square-foot-2026/` and hotel cost guide |
| L2 | IndexNow not configured | Slower Bing/Yandex indexation | Enable via Yoast Premium or IndexNow plugin |
| L3 | `Server: nginx` header exposed | Minor information disclosure | Add `server_tokens off;` in nginx.conf |
| L4 | AI crawlers (GPTBot, ClaudeBot, etc.) unrestricted | Uncontrolled LLM training ingestion | Add explicit allow/deny rules to robots.txt |
| L5 | `Organization` schema uses `Place` co-type; should use `LocalBusiness` as parent | Schema hierarchy non-standard | Restructure to `["LocalBusiness","GeneralContractor"]` |
| L6 | No `hreflang` tags | N/A for English-only site — no action needed | — |

---

## Metadata Snapshot (All Crawled Pages)

| URL | Title Chars | Desc Chars | H1 | Canonical Match | Word Count |
|---|---|---|---|---|---|
| / | 61 | 114 | Yes | Yes | 270 |
| /about/ | 43 | 93 | Yes | Yes | 298 |
| /about/awards-and-recognition/ | 30 | 121 | Yes | Yes | 307 |
| /about/group-of-companies/ | 26 | 118 | Yes | Yes | 105 |
| /about/mission-values/ | 22 | 113 | Yes | Yes | 287 |
| /about/our-history/ | 59 | 151 | Yes | Yes | 290 |
| /industries/ | 25 | 145 | Yes | Yes | 95 |
| /services/ | 44 | 97 | Yes | Yes | 264 |
| /services/construction-management/ | 44 | 166 (OVER) | Yes | Yes | 254 |
| /services/design-and-build/ | 27 | 80 | Yes | Yes | 287 |
| /services/general-contracting/ | 30 | 103 | Yes | Yes | 267 |
| /services/preconstruction/ | 27 | 161 (OVER) | Yes | Yes | 262 |
| /services/tenant-improvement/ | 28 | 105 | Yes | Yes | 260 |
| /services/architectural-design-and-engineering/ | 42 | 119 | Yes | Yes | 263 |
| /projects/ | 45 | 90 | Yes | Yes | 220 |
| /projects/retail-shopping-centers/ | 27 | 121 | Yes | Yes | 78 |
| /projects/multi-family-and-mixed-use/ | 28 | 118 | Yes | Yes | 50 |
| /projects/industrial-and-warehouse/ | 22 | 113 | Yes | Yes | 52 |
| /projects/healthcare-facilities/ | 22 | 118 | Yes | Yes | 50 |
| /projects/restaurants/ | 13 | 113 | Yes | Yes | 54 |
| /projects/corporate-interiors/ | 19 | 145 (DUPE) | Yes | Yes | 47 |
| /projects/car-wash/ | 12 | 118 | Yes | Yes | 46 |
| /projects/fuel-stations/ | 14 | 123 | Yes | Yes | 72 |
| /projects/tenant-improvements/ | 21 | 119 | Yes | Yes | 57 |
| /projects/hospitality-entertainment/ | 26 | 126 | Yes | Yes | 61 |
| /locations | — | MISSING | Yes | MISMATCH | 280 |
| /join-our-team/ | 17 | 111 | Yes | Yes | 253 |
| /join-our-team/subcontractors/ | 15 | 115 | Yes | Yes | 208 |
| /join-our-team/vendors/ | 9 | 113 | Yes | Yes | 195 |
| /join-our-team/careers/ | 10 | 115 | Yes | Yes | 244 |
| /client-resources/ | 42 | 112 | Yes | Yes | 157 |
| /client-resources/clients-guide/ | 17 | 109 | Yes | Yes | 46 |
| /client-resources/construction-terminology/ | 24 | 88 | Yes | Yes | 46 |
| /press-release/ | 21 | 84 | Yes | Yes | 245 |
| /blog/ | 6 | 103 | Yes | Yes | 248 |
| /get-a-quote/ | 16 | MISSING | Yes (404 H1) | MISSING | 25 |
| /houston-commercial-contractors/ | 48 | 118 | Yes | Yes | 286 |
| /austin-tx/ | 59 | 115 | Yes | Yes | 286 |

---

*Audit produced by the Maxx SEO Agent — technical-seo skill. Source data: `.firecrawl/crawl.json` (47 pages) + live HTTP checks on 2026-06-24.*
