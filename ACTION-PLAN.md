# SEO Action Plan — maxxbuilders.com
**Generated:** 2026-06-24  
**Based on:** 11-specialist parallel audit (technical, content, schema, sitemap, performance, visual, GEO, local, backlinks, cluster, SXO)  
**Overall SEO Health Score: 42 / 100**

---

## CRITICAL — Fix within 48 hours

These issues are either breaking revenue directly or are live trust failures visible to users and Google today.

### C1. Redirect /get-a-quote/ → /commercial-construction-project-inquiry/ (P0 Revenue)
**Impact:** Every "Get A Quote" click on the site-wide sticky nav hits a 404. The homepage hero CTA also links here. This is the highest-conversion-path failure on the site.  
**Fix:** Add 301 redirect in WordPress (Yoast Redirects or Redirection plugin): `/get-a-quote/` → `/commercial-construction-project-inquiry/`  
**Also:** Update the nav button href in the Wilmer/Elementor header from `/get-a-quote/` to `/commercial-construction-project-inquiry/`  
**Also:** Remove `/get-a-quote/` from `page-sitemap.xml` (set to noindex via Yoast or delete the page stub)

### C2. Fix San Antonio page H3 copy-paste error (Live trust failure)
**Location:** `/san-antonio-tx/` — H3 reads "Why Choose Maxx Builders in **Houston**?"  
**Fix:** Change to "Why Choose Maxx Builders in San Antonio?"  
**Note:** This is live and indexed. A quality rater viewing this page will flag it as machine-generated doorway content.

### C3. Fix /general-contracting/ redirect (Broken redirect chain)
**Problem:** `/general-contracting/` 301-redirects to `wp-content/uploads/2023/06/General-Contracting.webp` — a raw image file, not a page.  
**Fix:** Update the redirect destination to `/services/general-contracting/` in Yoast Redirects / Redirection plugin.  
**Note:** The other three short aliases work correctly (`/construction-management/`, `/design-and-build/`, `/tenant-improvement/`).

### C4. Align schema Sunday hours with visible page hours (E-E-A-T failure)
**Problem:** `openingHoursSpecification` in schema says Sunday open 09:00–17:00. Every page header says "Sunday: Closed."  
**Fix:** Yoast SEO → Local → Business Info → Opening Hours → remove Sunday hours.  
**Also:** Correct weekday open time in schema from 09:00 to 08:30 to match the page header.

### C5. Fix three conflicting founding years (E-E-A-T failure)
**Found in:**  
- `/about/our-history/` meta description: "since 1995"  
- `/about/our-history/` body text: "Established in 2008"  
- `/about/` body text: "Founded in 2005"  
**Fix:** Determine the correct founding year and update all three locations. Also update the Yoast Organization schema `foundingDate` field in the Yoast Knowledge Graph settings.

### C6. Fix hotel cost guide H1 (Production error on a ranking page)
**Location:** `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/`  
**Problem:** H1 is the raw URL slug text: "the-ultimate-2026-hotel-construction-cost-guide-texas-edition"  
**Fix:** Change H1 to: "Hotel Construction Cost Guide: Texas 2026 Edition" (or match the existing title tag "Hotel Construction Cost | 2026 Texas Guide")

### C7. Remove live "HUMAN EDIT REQUIRED" placeholder from hotel guide (Live production error)
**Problem:** The blog index crawl shows this text in the published hotel guide: "Author: [HUMAN EDIT REQUIRED — insert real, credentialed author name + title]"  
**Fix:** Update the post author to Harris Khan (or the appropriate named author). Create a WordPress author profile with bio, credentials, and photo.

---

## HIGH — Fix within 2 weeks

### H1. Enable WordPress page cache (Core Web Vitals — LCP)
**Problem:** TTFB is 2,629 ms wall-clock — PHP running on every request, no static HTML cache.  
**Fix:** Install WP Rocket or enable host-native page caching (Kinsta/WP Engine). This is the single highest-leverage performance fix — drops TTFB from ~2.6 s to <200 ms, which unblocks LCP improvement.

### H2. Convert hero image to WebP + add fetchpriority (LCP 8,296 ms — 3.3x over threshold)
**Problem:** `h1-img-06-maxxbuilders.jpg` is 699 KB served as a CSS `background-image` — invisible to the browser preload scanner. Lighthouse LCP: 8,296 ms.  
**Fix sequence:**  
1. Convert to WebP (target ≤120 KB at 80% quality)  
2. Convert from CSS `background-image` to `<img>` tag with `fetchpriority="high"` and `loading="eager"`  
3. Add `<link rel="preload" as="image" href="...hero.webp" fetchpriority="high">` in `<head>`

### H3. Enable gzip/Brotli compression (Core Web Vitals)
**Problem:** No `Content-Encoding` header on any response. 84 KB HTML, 282 KB CSS served uncompressed.  
**Fix:** Enable `gzip on;` in nginx.conf or activate via host control panel. Add Cloudflare free tier for automatic Brotli.

### H4. Dequeue dashicons and unused icon packs from frontend (Render-blocking CSS)
**Problem:** `dashicons.min.css` (36 KB) loads on every public page — it's admin-only. Seven separate icon font packs load site-wide.  
**Fix:** Add to child theme functions.php:  
```php
add_action('wp_enqueue_scripts', function() {
    wp_deregister_style('dashicons');
});
```
Then audit which single icon pack is actually used and dequeue the other 5–6 via `wp_dequeue_style()`.

### H5. Add security response headers
**Problem:** Zero security headers on all responses — no HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.  
**Fix (nginx):**  
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```
Note: Do not add a restrictive CSP without testing — Elementor and Yoast will conflict.

### H6. Align schema email to match visible contact email
**Problem:** Organization schema uses `info@maxxbuilders.com`. Every visible page and the LocalBusiness schema blocks use `businessdevelopment@maxxbuilders.com`. Google cross-references these.  
**Fix:** Yoast → Knowledge Graph → Email → change to `businessdevelopment@maxxbuilders.com`.

### H7. Fix priceRange conflict in schema
**Problem:** Yoast Organization block says `$$`. All five location page custom GeneralContractor blocks say `$$$`. Two values on the same page.  
**Fix:** Set Yoast Organization `priceRange` to `$$$` (correct for a $3M–$20M commercial GC). Update all custom LocalBusiness blocks to match.

### H8. Noindex all 9 /project-attributes/ taxonomy pages (Doorway page risk)
**Problem:** Nine city-filtered portfolio lists (`/project-attributes/pearland/`, `/project-attributes/richmond/`, etc.) — each has 1–2 portfolio items, zero editorial content, and is indexed.  
**Fix:** Yoast SEO → Search Appearance → Taxonomies → Project Attributes → set to "No" (noindex). This auto-removes them from all sitemaps.

### H9. Fix homepage CTA links — correct /blog-pages/ and short service URLs
**Problem:** Homepage links to `/blog-pages/` (blog is at `/blog/`). Also links to `/construction-management/`, `/design-and-build/`, `/general-contracting/` without the `/services/` prefix.  
**Fix:** In Elementor, update homepage links:  
- `/blog-pages/` → `/blog/`  
- `/construction-management/` → `/services/construction-management/`  
- `/design-and-build/` → `/services/design-and-build/`  
- (Note: `/general-contracting/` now redirects to an image — fix C3 first, then update the link)

### H10. Fix duplicate meta description (/industries/ and /projects/corporate-interiors/)
**Problem:** Both pages share the identical meta description about "Corporate Interiors projects."  
**Fix:** Write a unique meta description for `/industries/` that describes Maxx's industry coverage (retail, healthcare, industrial, hospitality, restaurant). The `/projects/corporate-interiors/` description can remain.

### H11. Fix LinkedIn sameAs http:// → https://
**Problem:** `sameAs` array contains `http://www.linkedin.com/company/maxxbuilders` — the only non-HTTPS URL in the array.  
**Fix:** Yoast → Social → LinkedIn → update URL to `https://www.linkedin.com/company/maxxbuilders`

### H12. Expand location pages to 800+ words with city-specific content
**Problem:** All 5 location pages are 280–290 words of identical template with city name swapped. Cannot compete for "commercial general contractor [city] TX" — SERP benchmark is 1,500–3,000 words.  
**Required elements per city page:**  
- 2–3 named completed local projects with sq ft, building type, and client (if permitted)  
- City-specific market context (permitting timeline, labor market, construction cost range for that metro)  
- Named local project manager or point-of-contact  
- City-specific phone number (or at minimum, confirm the 832 number is actively answered)  
- Embedded Google Map  
- LocalBusiness JSON-LD schema (see H13)  
- Link to city's cost blog post (Austin → Austin cost post; Fort Worth and San Antonio need posts built)

### H13. Add LocalBusiness JSON-LD schema to all 5 location pages
**Required fields:**  
```json
{
  "@type": "GeneralContractor",
  "name": "Maxx Builders",
  "areaServed": {"@type": "City", "name": "[City]", "containedInPlace": {"@type": "State", "name": "Texas"}},
  "geo": {"@type": "GeoCoordinates", "latitude": [city-center lat], "longitude": [city-center lng]},
  "openingHoursSpecification": [corrected hours after fixing C4],
  "sameAs": ["[GBP URL for this market]"],
  "telephone": "+1-832-871-4166",
  "email": "businessdevelopment@maxxbuilders.com",
  "priceRange": "$$$"
}
```

### H14. Resolve San Antonio duplicate location pages
**Problem:** Two pages compete for "San Antonio commercial contractors":  
- `/san-antonio-tx/` (in page-sitemap.xml)  
- `/locations/san-antonio-commercial-contractors/` (in locations-sitemap.xml)  
**Fix:** Pick one as canonical (recommend keeping `/san-antonio-tx/` for URL consistency with other city pages). 301-redirect the other. Remove the losing URL from its sitemap.

### H15. Add homepage links to /locations, /blog/, and /industries/ hubs
**Problem:** Homepage has 37 internal links. Zero point to the blog, locations hub, or industries hub.  
**Fix:** Add a "Locations We Serve" section to the homepage with links to all 5 city pages (and the /locations hub). Add a "From Our Blog" section linking to the 3 main posts. Add "Industries We Serve" linking to /industries/.

---

## MEDIUM — Fix within 30 days

### M1. Add named author bylines to all blog posts
All three crawled blog posts have no credentialed author attribution. The hotel guide author field shows "master" (WordPress default).  
**Fix:** Create a WordPress user profile for Harris Khan (or another named author) with: full name, professional title (Licensed GC, years of Texas construction experience), photo. Assign all posts to this profile. Add a bio page (`/author/harris-khan/`).

### M2. Noindex thin project-type taxonomy archives
Yoast SEO → Search Appearance → Taxonomies → Project Type → set to "No" for archives with fewer than 5 portfolio items (corporate-interiors: 1 item, fitness: 1 item, healthcare-facilities: 2 items, industrial-warehouse: 2 items, multi-family-mixed-use: 1 item).

### M3. Noindex utility pages and remove from sitemap
Pages to noindex (set via Yoast meta box → Advanced → Robots → noindex):  
- `/thank-you/`  
- `/opt-out-from-email-and-sms/`  
- `/single-page/` (likely a theme demo page — verify content first)

### M4. Fix /services/ hub — add missing links to preconstruction and architecture pages
`/services/` currently links to 4 of 6 service pages. Missing: `/services/preconstruction/` and `/services/architectural-design-and-engineering/`.  
**Also:** Each service page should link back to the `/services/` hub. Currently none do.

### M5. Add internal links from Austin city page to Austin cost blog post
The Austin page (`/austin-tx/`) doesn't link to `/austin-commercial-construction-cost-per-square-foot-2026/`. This is the single highest-value contextual link gap on the site.  
**Pattern:** Extend to all city pages once Fort Worth and San Antonio cost posts are published.

### M6. Add FAQPage schema to cost guide blog posts
The Austin cost guide and hotel cost guide already have FAQ H3 sections. Adding FAQPage JSON-LD won't trigger Google rich results on a commercial site, but it does signal structured Q&A to AI citation systems (ChatGPT, Perplexity, AI Overviews).

### M7. Add physical address to visible page text
No street address appears in the crawlable body text of any location page. The Stafford HQ address (4150 Bluebonnet Dr. Suite 102, Stafford TX 77477) should appear in visible footer or location page body text — not just in schema.

### M8. Expand /industries/ hub from 95 to 400+ words
Currently 95 words and receives 0 inbound links from any crawled page. Add editorial content: which industries Maxx serves, why commercial construction in each sector differs, and link to each industry sub-page.

### M9. Add "TL;DR / Quick Answer" blocks to blog posts
None of the blog posts have a summary block at the top. AI citation systems (Google AI Overviews, Perplexity) pull the opening 150–200 words as the citation excerpt. Add a structured answer block above each article's first H2.

### M10. Fix /services/construction-management/ meta description (166 chars — over limit)
Trim to ≤155 characters. Currently truncates in SERPs.

### M11. Fix /about/our-history/ meta description (151 chars — "since 1995" conflicts with body)
Trim to ≤155 characters and remove the "since 1995" reference until the founding year is resolved (C5).

### M12. Audit and confirm /blog-pages/ vs /blog/ situation
One may be a redirect source, the other the canonical. Confirm in WordPress which is the actual blog archive URL. Ensure only one is indexed; 301 or noindex the other.

### M13. Set hero photo as Yoast featured image on homepage
`primaryImageOfPage` in schema currently resolves to the logo (2560×2560px). Set a hero/content photo as the Yoast SEO featured image in the homepage post settings.

### M14. Remove KML from geo-sitemap.xml
The geo-sitemap.xml contains only `locations.kml` — a KML file, not an HTML page. Remove it or disable the Yoast Local plugin's geo sitemap feature if the KML isn't serving a purpose.

### M15. Self-host Google Fonts and reduce font variants
250 KB across 11 font files, 5 external DNS lookups to `fonts.gstatic.com`. Use `google-webfonts-helper` to self-host Yantramanav. Subset to Latin. Drop unused weight variants.

---

## LOW — Next sprint / backlog

### L1. Enable IndexNow
Yoast SEO Premium includes IndexNow natively. Enable it for faster Bing/Yandex indexation of new and updated content.

### L2. Add server_tokens off to nginx
`Server: nginx` header exposes server technology. Minor information disclosure: `server_tokens off;` in nginx.conf removes it.

### L3. Set explicit AI crawler policy in robots.txt
GPTBot, ClaudeBot, PerplexityBot, Bytespider are currently unrestricted. Make an intentional decision: allow (they contribute to AI citation) or block. Either way, document it explicitly.

### L4. Restructure Organization schema hierarchy
Current: `["Organization","Place","GeneralContractor"]` — `Place` is semantically unusual here.  
Preferred: `["LocalBusiness","GeneralContractor"]` with `Place` as a nested `location` property.  
Low priority as current implementation is not invalid, just non-standard.

### L5. Add aggregateRating to location page schemas
If Maxx Builders has Google reviews, pull the rating and count into LocalBusiness schema `aggregateRating`. Enables star ratings in organic SERPs — significant CTR lift for contractor queries.

### L6. Add hasMap property to LocalBusiness schema
Link each location page LocalBusiness schema node to a Google Maps embed URL via `hasMap`. Reinforces local entity association.

### L7. Build Fort Worth and San Antonio cost blog posts
Completes the city cost cluster. Required to provide contextual link targets for those two city pages and support the hub-and-spoke cost content architecture.  
**Titles:** "Fort Worth Commercial Construction Cost Per Square Foot (2026)" and "San Antonio Commercial Construction Cost Per Square Foot (2026)"

### L8. Expand project category pages from stubs to portfolio pages
All 10 `/projects/*/` category pages have 46–78 words. Each needs 300–500 words of industry-specific editorial copy plus embedded project items. This converts them from thin stubs to genuine portfolio landing pages.  
Priority order: healthcare, industrial, retail (highest commercial intent for portfolio queries).

### L9. Add Award names and dates to /about/awards-and-recognition/
Page currently uses anonymized placeholder award descriptions ("Recognized for our innovative use..."). Replace with actual award names, awarding organizations, and years. The Inc. 5000 2017 recognition is the only specific award on the site and it's on the press release page, not here.

### L10. Enable Elementor Improved Asset Loading
Loads only the CSS/JS widgets used on each page instead of all Elementor assets globally. Reduces render-blocking CSS count. Enable in Elementor → Settings → Experiments → Improved Asset Loading.

---

## Content Roadmap (Next 90 days)

Priority blog posts to commission (confirm none already exist in the uncrawled 80+ post archive before writing):

| Priority | Title | Target Keyword | Supports Page |
|----------|-------|----------------|---------------|
| 1 | Fort Worth Commercial Construction Cost Per Square Foot (2026) | fort worth commercial construction cost | /fort-worth-tx/ |
| 2 | San Antonio Commercial Construction Cost Per Square Foot (2026) | san antonio commercial construction cost | /san-antonio-tx/ |
| 3 | Design-Build vs General Contracting: Which Is Right for Your Texas Project? | design build vs general contractor texas | /services/design-and-build/ |
| 4 | Construction Management Services Texas: What They Are and What They Cost | construction management services texas | /services/construction-management/ |
| 5 | Preconstruction Services: Why the Phase Before Groundbreaking Defines Project Success | preconstruction services commercial | /services/preconstruction/ |
| 6 | Retail Construction in Texas: Costs, Timelines, and What to Expect | retail construction contractor texas | /industries/retail-construction-texas/ |
| 7 | Healthcare Construction in Texas: Medical Office and Outpatient Build Costs (2026) | healthcare construction texas | /industries/healthcare-medical-construction-texas/ |
| 8 | Commercial Construction Timeline in Texas: How Long Does Each Project Type Take? | commercial construction timeline texas | /services/construction-management/ |

**Before commissioning any new content:** Run a full re-crawl to capture all 80+ blog posts. Several of the above may already exist.

---

## Key Metrics to Track (Establish Baseline Now)

- LCP (lab): 8,296 ms → target ≤2,500 ms (Lighthouse)
- Lighthouse Performance: 69 → target ≥90
- Indexed pages via GSC (confirm location pages are indexed)
- Organic clicks for "commercial general contractor [city]" queries (GSC)
- Conversion rate: inquiry form completions per session (after /get-a-quote/ fix)
- Core Web Vitals pass rate in CrUX (field data, available in GSC after ~4 weeks of traffic)

---

*Generated from: audit/technical-seo.md, audit/content-seo.md, audit/schema-seo.md, audit/sitemap-seo.md, audit/performance-seo.md, audit/visual-seo.md, audit/local-seo.md, audit/cluster-seo.md, audit/sxo-seo.md + pending GEO and backlinks reports*
