# Full SEO Audit Report — maxxbuilders.com
**Audit date:** 2026-06-24  
**Platform:** WordPress + Yoast SEO Premium + Elementor (Wilmer theme)  
**Business type:** Texas Commercial General Contractor (Service Area Business)  
**Markets:** Houston, Austin, Dallas, Fort Worth, San Antonio  
**Pages crawled:** 47 (via Chrome DevTools fetch + DOMParser — no Firecrawl credits used)  
**Specialists run in parallel:** Technical, Content, Schema, Sitemap, Performance, Visual, GEO, Local, Backlinks, Cluster, SXO

---

## Overall SEO Health Score: 42 / 100

| Category | Weight | Score | Status |
|----------|--------|-------|--------|
| Technical SEO | 22% | 54 | Needs Work |
| Content Quality (E-E-A-T) | 23% | 31 | Failing |
| On-Page SEO | 20% | 48 | Needs Work |
| Schema / Structured Data | 10% | 52 | Needs Work |
| Performance (CWV) | 10% | 25 | Failing |
| AI Search Readiness | 10% | 42 | Needs Work |
| Images | 5% | 30 | Needs Work |

**Weighted composite: 42 / 100**

The site has a strong strategic foundation — the cost-per-square-foot blog content is ranking and the service taxonomy is logical — but it is being undermined by seven critical production errors, a 3.3× LCP failure, and thin content across the pages that need to rank most (location pages, service pages, project galleries). The GBP and backlink dimensions are pending full assessment.

---

## Executive Summary

### Top 5 Critical Issues (Fix This Week)

1. **`/get-a-quote/` is a hard 404 — it's in the site-wide sticky nav on every page.** Every visitor who clicks "Get A Quote" anywhere on the site hits a dead page. For a commercial contractor targeting $2M–$20M projects, this destroys trust on first contact. 30-second fix: 301 redirect to `/commercial-construction-project-inquiry/`.

2. **San Antonio location page H3 reads "Why Choose Maxx Builders in Houston?" — live and indexed.** Copy-paste error that signals to Google this page is machine-assembled doorway content. One field edit in WordPress.

3. **LCP is 8,296 ms — 3.3× over the 2.5 s threshold.** Root cause: 699 KB hero JPEG served as a CSS `background-image` (invisible to the preload scanner), no WordPress page cache (TTFB 2.6 s), and no gzip compression. Every service and location page visitor waits 8+ seconds for the largest element to load.

4. **Three different founding years appear across the site.** The `/about/our-history/` meta description says "since 1995," the page body says "Established in 2008," and the About page says "Founded in 2005." Google's quality raters explicitly flag founding year inconsistency as a trust failure.

5. **All five location pages are 280–290 word templated pages** with city name swapped in 8–10 places. SERP benchmark for "commercial general contractor [city] TX" is 1,500–3,000 words with project portfolios, testimonials, local schema, and local contact data. The current pages cannot compete.

### Top 5 Quick Wins (Can Deploy Today)

1. 301 redirect `/get-a-quote/` → `/commercial-construction-project-inquiry/` and update nav button href
2. Fix San Antonio H3 — change "Houston" to "San Antonio"
3. Fix `/general-contracting/` redirect destination (currently points to a `.webp` image, not the service page)
4. Fix schema Sunday hours in Yoast → Local → Business Info (schema says open, page says closed)
5. Noindex all 9 `/project-attributes/` taxonomy pages in Yoast → Search Appearance → Taxonomies (one toggle, eliminates doorway-page risk across 9 URLs)

---

## 1. Technical SEO — Score: 54 / 100

**Auditor:** technical-seo specialist  
**Data sources:** Live HTTP checks, sitemap XML fetch, redirect chain testing, source HTML inspection

### Crawlability
- `robots.txt`: Open to all crawlers — no paths disallowed. Correct.
- Sitemap index: 7 sub-sitemaps, 189 total URLs, all return HTTP 200. Well-structured.
- No critical crawl blocks detected.

### Critical Technical Issues

**`/get-a-quote/` returns 404 and is submitted in page-sitemap.xml.**  
This URL is linked from the homepage (twice) and appears in the site-wide nav. It has no canonical, no meta description, and a `noindex` robots meta — meaning it is discovered by Googlebot via internal links, crawled, and confirmed as a broken page. This wastes crawl budget and breaks the primary conversion path.

**`/general-contracting/` 301-redirects to a WebP image file.**  
`https://www.maxxbuilders.com/wp-content/uploads/2023/06/General-Contracting.webp` is the current redirect destination. The other three service aliases redirect correctly:
- `/construction-management/` → `/services/construction-management/` ✓  
- `/design-and-build/` → `/services/design-and-build/` ✓  
- `/tenant-improvement/` → `/services/tenant-improvement/` ✓  
- `/general-contracting/` → `.webp` image ✗

Any backlinks or bookmarks pointing at `/general-contracting/` deliver users and crawlers to a raw image.

**Three founding years across the site:**
- `/about/our-history/` meta description: "since 1995"
- `/about/our-history/` body text: "Established in 2008"
- `/about/` body text: "Founded in 2005"

### Security Headers: FAIL
Zero security response headers on any page. No HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy. The `Server: nginx` header exposes server technology.

### URL Structure Issues
- `/locations` (no trailing slash) serves content but canonical is `/locations/` — minor redirect inconsistency
- `page-sitemap.xml` lists `/industries/industrial-warehouse-construction-texas` without trailing slash (redirects 301 to slash version)
- `/blog-pages/` vs `/blog/` — homepage links to `/blog-pages/`, Yoast uses `/blog/` — needs investigation

### Metadata Snapshot (Flagged Pages)

| URL | Issue |
|-----|-------|
| `/services/construction-management/` | Meta desc 166 chars (over 155 limit) |
| `/services/preconstruction/` | Meta desc 161 chars (over 155 limit) |
| `/locations` | Meta desc missing |
| `/get-a-quote/` | 404, no meta desc, no canonical |
| `/industries/` and `/projects/corporate-interiors/` | Duplicate meta description |
| `/` | Title 61 chars (1 over guideline) |
| `/houston-commercial-contractors/` | Meta desc 157 chars (2 over limit) |

### JavaScript Rendering: PASS
Critical content (H1, meta, schema, canonical) is all in server-rendered HTML. Elementor generates bloated HTML (84 KB homepage, 94 `<script>` tags, 46 `<link>` tags) but the site does not rely on client-side rendering for indexable content.

### IndexNow: Not configured
Enable via Yoast Premium for faster Bing/Yandex indexation.

---

## 2. Content Quality & E-E-A-T — Score: 31 / 100

**Auditor:** seo-content specialist  
**Standard:** Google Quality Rater Guidelines (Sept 2025)

### E-E-A-T Breakdown

| Factor | Score | Key Finding |
|--------|-------|-------------|
| Experience | 18/100 | Hotel cost guide opens with named project specs (Home2Suites, 90,500 SF; Holiday Inn Express, 114,700 SF). Nowhere else on the site. |
| Expertise | 30/100 | Founders Harris Khan and Hira Khan named only on history page. No credentials, license numbers, or professional associations visible on service pages. |
| Authoritativeness | 38/100 | Inc. 5000 2017 recognition exists on press-release page (strong signal, under-leveraged). AGC membership listed. |
| Trustworthiness | 32/100 | Three conflicting founding years. Sunday hours conflict between schema and page. No physical address in visible page text. |

**Composite E-E-A-T: 28/100**

### Thin Content — Critical Volume

37 of 47 crawled pages fall below their page-type minimum word count. The 10 project category pages (46–78 words each) are pure navigation shells with no editorial content.

| Tier | Pages | Count |
|------|-------|-------|
| Under 80 words (navigation shells) | All /projects/* category pages, /client-resources/clients-guide/, /client-resources/construction-terminology/ | 12 |
| 80–200 words (below minimum) | /industries/, /about/group-of-companies/, /client-resources/, /press-release/ | 4 |
| 200–300 words (thin for page type) | All 6 service pages (254–287 words), all 5 location pages (280–290 words), homepage (270 words) | 13+ |

### Duplicate and Near-Duplicate Content

**Location pages — template clone (High risk):** All five pages share identical H2/H3 structure with city name swapped. San Antonio page incorrectly uses "Houston" in H3 — direct evidence of find-and-replace assembly.

**Service pages — structural repetition (Medium risk):** All six service pages use the same marketing prose cadence. Construction management and design+build share near-identical paragraphs.

**Portfolio category pages — true duplicates (High risk):** Every `/projects/*/` page contains only a headline, project name list, and CTA footer. Functionally identical shells.

### Blog Post Assessment

| Post | E-E-A-T Signals | AI Citability | Key Issue |
|------|----------------|---------------|-----------|
| Austin Construction Cost 2026 | Market data, cost tables, FAQ format | 68/100 | No named author, no source citations for cost data |
| Commercial Construction Companies TX 2026 | Cites AGC, Dodge Construction Network | 55/100 | No author authority, generic company pitch section |
| Hotel Construction Cost 2026 | **Best on site** — named projects (Home2Suites, Comfort Suites, Holiday Inn Express) with SF | 58/100 | H1 is raw URL slug, live placeholder text in author field |

### Production Errors on Published Content

- Hotel guide H1 is the URL slug, not a title
- Hotel guide contains live placeholder: "Author: [HUMAN EDIT REQUIRED — insert real, credentialed author name + title]"
- San Antonio page H3 references Houston
- `/about/awards-and-recognition/` uses anonymous placeholder award descriptions ("Recognized for our innovative use of sustainable materials") with no award names, organizations, or years

---

## 3. On-Page SEO

### Title Tags
- All crawled pages have unique titles except one (see duplicate meta desc issue)
- All within length guidelines except homepage (61 chars, 1 over)
- Yoast implementation is consistent

### H1 Structure
- All 47 pages have exactly one H1 — no missing or multiple H1s
- `/services/` H1 ("Our Services") is below the fold on desktop — decorative "BUILD SMARTER" text fills the hero visually
- Hotel guide H1 is the raw URL slug (Critical — see C6 in action plan)

### Internal Linking Architecture — Structural Failures

The single most impactful internal link gap on the site:

| Hub Page | Inbound Links from Crawled Pages |
|----------|----------------------------------|
| `/commercial-construction-project-inquiry/` | **46** (CTA page — should not dominate) |
| `/services/` | **0** |
| `/industries/` | **0** |
| `/locations` | **0** |
| `/blog/` | **0** |
| `/about/` | **0** |

Every location page receives exactly 1 inbound internal link (from `/locations` archive only). The homepage has 37 internal links — zero point to any city page or blog post. Every service page links only to `/commercial-construction-project-inquiry/` and nothing else.

The Austin city page (`/austin-tx/`) does not link to the Austin construction cost blog post — the most natural contextual link on the site.

---

## 4. Schema / Structured Data — Score: 52 / 100

**Auditor:** seo-schema specialist  
**Platform note:** Two JSON-LD blocks on most pages — Yoast auto-graph + custom-injected blocks. They are not linked via `@id`.

### What's Working
- Yoast emits WebPage, BreadcrumbList, WebSite, ImageObject on every page
- Custom blocks correctly add GeneralContractor per location page, Service per service page, Article + FAQPage on blog posts
- Blog post Article schema includes a real named author (Harris Khan) — correct for E-E-A-T
- All URLs absolute, all dates ISO 8601, `@context` correct

### Critical Schema Failures

**Sunday hours mismatch:** `openingHoursSpecification` says Sunday open 09:00–17:00. Every page header says Sunday: Closed. Google surfaces schema hours in local results — this is a live incorrect business data issue.

**`priceRange` conflict on the same page:** Yoast Organization block (`$$`) conflicts with custom GeneralContractor blocks (`$$$`) on all five location pages. Two values for the same property on the same page.

**LinkedIn `sameAs` uses `http://`:** Only non-HTTPS URL in the sameAs array. Minor but creates a redirect in the schema reference chain.

### Structural Issues

**Dual-block architecture without `@id` linking:** The Yoast Organization node and the custom GeneralContractor node represent the same business entity but are not connected. Google may treat them as separate entities.

**Location page GeneralContractor blocks missing:**
- `geo` coordinates (city-specific — current geo is Stafford HQ in the Yoast block)
- `aggregateRating` (no star ratings in SERPs)
- `image`/`logo`
- `openingHoursSpecification`

**Duplicate BreadcrumbList on location pages:** Yoast emits one, the custom block emits another with a broken intermediate item (`/locations/` returns a redirect).

**Organization schema emits on all 47 pages** via Yoast (not just homepage). Not a spec violation but adds maintenance surface area.

### Missing Schema Opportunities
- `aggregateRating` on all location pages (star ratings in SERP)
- `FAQPage` on Austin, Dallas, Fort Worth, San Antonio location pages (Houston already has it)
- `hasMap` on all LocalBusiness nodes
- Expanded `Person` entity for Harris Khan (needs `url`, `sameAs`, `jobTitle`, `worksFor`)

---

## 5. Sitemap Architecture

**Auditor:** seo-sitemap specialist  
**Total indexed URLs:** 189 (well under the 50k limit)

### Sub-Sitemap Summary

| Sitemap | URLs | Status |
|---------|------|--------|
| post-sitemap.xml | 83 | 60+ posts show same lastmod (2026-05-18) — bulk Yoast touch; Google ignores these dates |
| page-sitemap.xml | 44 | Contains confirmed 404 (/get-a-quote/) and redirect URL (industrial page missing trailing slash) |
| portfolio-sitemap.xml | 37 | Individual portfolio items — valid |
| locations-sitemap.xml | 5 | Contains the 4 /locations/ subdirectory pages — NOT the 5 main city pages |
| project-type-sitemap.xml | 10 | 6 of 10 have 1–3 portfolio items each — thin archives, should be noindexed |
| project-attributes-sitemap.xml | 9 | All 9 are thin geo-filtered portfolio lists — **noindex all** |
| geo-sitemap.xml | 1 | Contains only `locations.kml` — a KML file, not an HTML page |

### Critical Sitemap Finding: Location Page Architecture Split

The 5 main city pages live at root level (`/houston-commercial-contractors/`, `/austin-tx/`, etc.) but are **not in the locations-sitemap.xml**. The locations-sitemap contains 4 different pages under `/locations/` subdirectory. This means there are effectively 9+ location-intent pages split across two URL architectures, with San Antonio having two competing pages.

Also: the 5 root-level city pages breadcrumb schema references `/locations/` as their parent, but their URLs are not nested under it. This breadcrumb is incorrect.

---

## 6. Performance — Score: 25 / 100

**Auditor:** seo-performance specialist  
**Tool:** Lighthouse 13.0.3 (mobile simulation)

### Core Web Vitals

| Metric | Measured | Threshold | Status |
|--------|----------|-----------|--------|
| **LCP** | **8,296 ms** | ≤2,500 ms | **FAIL — 3.3× over** |
| CLS | 0 | ≤0.1 | PASS |
| TBT (INP proxy) | 17 ms | ≤200 ms INP | PASS |
| FCP | 3,196 ms | ≤1,800 ms | Needs work |
| TTFB (wall-clock) | 2,629 ms | ≤800 ms | FAIL |

**Lighthouse Performance Score: 69 / 100 (mobile)**

CLS is clean and interactivity is fine. LCP is the single failing CWV metric, and it is severe.

### Root Causes (Priority Order)

**1. No WordPress page cache — TTFB 2.6 s**  
Every request does a full PHP execution. No static HTML cache layer detected. Enabling WP Rocket or host-native caching typically drops TTFB from 2,600 ms to <200 ms — the single highest-leverage fix.

**2. 699 KB uncompressed hero JPEG as CSS background-image**  
`h1-img-06-maxxbuilders.jpg` is 715 KB (94% of total image payload) served with no `Content-Encoding`. As a CSS `background-image`, it is invisible to the browser preload scanner — discovered late, loaded late, measured as LCP late.

**3. No gzip/Brotli compression**  
No `Content-Encoding` header on any response. 84 KB HTML, 282 KB CSS, fonts all served uncompressed.

**4. 43 render-blocking CSS files**  
Lighthouse identifies 43 stylesheets in the critical render path. Notable offenders:
- `dashicons.min.css` (36 KB) — admin icon font loading on public frontend
- `modules.min.css` (100 KB)
- 7 separate icon font packs (Font Awesome, Elegant Icons, Ion Icons, Simple Line Icons, Linear Icons, Linea Icons, Dripicons)

**5. 250 KB of web fonts across 11 files**  
4 Yantramanav weight variants loaded from `fonts.gstatic.com` (5 external DNS lookups). Self-hosting and subsetting to Latin removes these DNS lookups and reduces payload ~40%.

### Fix Sequence
Execute in this order — each unblocks the next:
1. Enable page cache (WP Rocket / host-native) → fixes TTFB
2. Enable nginx gzip → 60–70% HTML/CSS size reduction
3. Convert hero to WebP + `<img>` with `fetchpriority="high"` → directly attacks LCP
4. Dequeue dashicons + unused icon packs → reduces render-blocking CSS
5. Enable Elementor Improved Asset Loading → per-page CSS loading
6. Self-host Google Fonts, subset Latin only
7. Defer LeadConnector/RevSlider scripts

Steps 1–3 alone should move LCP from 8.3 s to ~2.5–3.5 s. Steps 4–5 should reach the ≤2.5 s threshold.

---

## 7. Visual & Mobile SEO

**Auditor:** seo-visual specialist  
**Tool:** Playwright 1.58 / Chromium, 8 screenshots (4 pages × 2 viewports)

### Critical Visual Finding: /get-a-quote/ is 404 on every screenshot
Both desktop and mobile. The "Get A Quote" button in the header is visible even on the 404 page itself — a recursive dead link visible to users.

### LCP Element Issues
On desktop, the homepage and services page hero images are not rendering in synthetic testing. The hero appears to be a JS-driven slider or CSS `background-image` that doesn't paint within the `networkidle` window. Lighthouse and Google's rendering stack will report the same degraded LCP — a logo image (<300px wide) instead of the intended hero photo.

### No CTA Above the Fold

| Page | Desktop | Mobile |
|------|---------|--------|
| Homepage | CTA visible ✓ | CTA visible ✓ |
| /services/ | No CTA above fold ✗ | No CTA above fold ✗ |
| /houston-commercial-contractors/ | No CTA above fold ✗ | No CTA above fold ✗ |

### Mobile Positives
- Viewport meta correctly set, user scaling not blocked
- Base font 18px across all pages (above 16px minimum)
- No horizontal scroll detected
- Hamburger nav tap target passes 48px guideline

### Houston Mobile Hero Image Mismatch
Desktop serves the Houston skyline photo (geo-relevant). Mobile serves a generic "blueprints on a desk" stock image. Undermines local visual relevance on the viewport where local searches most often occur.

---

## 8. Local SEO — Score: 39 / 100

**Auditor:** seo-local specialist

### Business Type: Service Area Business (SAB)
All 5 location pages use the Stafford HQ address (4150 Bluebonnet Dr. Suite 102, Stafford TX 77477) — no local offices in Austin, Dallas, Fort Worth, or San Antonio.

### Location Page Assessment

| Signal | Houston | Austin | Dallas | Fort Worth | San Antonio |
|--------|---------|--------|--------|------------|-------------|
| City-specific projects | No | No | No | No | No |
| Local testimonials | No | No | No | No | No |
| City-specific phone | No | No | No | No | No |
| Local permitting context | No | No | No | No | No |
| H3 city name correct | Yes | Yes | Yes | Yes | **No — says Houston** |
| Word count | 286 | 286 | 280 | 287 | 290 |

**Doorway page verdict: High risk on 4 of 5 pages.** Houston is partially insulated by FAQPage schema with specific Houston stats (340+ projects, $127M, cost ranges $150–$400/SF). That schema content is not visible on the page — it only benefits crawlers, not users.

### Location Architecture Conflict
- Root-level city pages (`/houston-commercial-contractors/`, `/austin-tx/` etc.) — in page-sitemap.xml but NOT in locations-sitemap.xml
- Subdirectory pages (`/locations/san-antonio-commercial-contractors/` etc.) — in locations-sitemap.xml  
- San Antonio has active pages in both structures — active keyword cannibalization

### Internal Linking: Location Pages Are Orphaned
Each location page receives exactly **1 inbound internal link** — from `/locations` archive only. The homepage has 37 internal links with zero pointing to any city page. Services pages link nowhere near city pages.

### NAP Consistency Issues
| Source | Email |
|--------|-------|
| Visible page header | businessdevelopment@maxxbuilders.com |
| LocalBusiness schema | businessdevelopment@maxxbuilders.com |
| Organization schema | **info@maxxbuilders.com** |

`priceRange` also conflicts: Organization block `$$`, LocalBusiness blocks `$$$` — on the same page.

---

## 9. Semantic Cluster & Content Architecture

**Auditor:** seo-cluster specialist

### Current Cluster Map

Five natural clusters exist in skeleton form, but hub-to-spoke and spoke-to-hub links are almost entirely missing.

**Cluster 1 — Services:** Hub `/services/` links to only 4 of 6 service pages (missing: `/services/preconstruction/` and `/services/architectural-design-and-engineering/`). No service page links back to the hub. No service page links to any blog post.

**Cluster 2 — Locations:** Hub `/locations` receives 0 inbound links from crawled pages. City pages receive 1 inbound each.

**Cluster 3 — Industries:** Hub `/industries/` (95 words) receives 0 inbound links. Five industry sub-pages exist but were not crawled.

**Cluster 4 — Portfolio:** Hub `/projects/` receives 1 inbound link. All 10 category sub-pages have 0 inbound links except from the hub.

**Cluster 5 — Blog:** Hub `/blog/` receives 0 inbound links. Blog posts link to service pages (good) but no service pages link back to blog posts.

### Confirmed Cannibalization

| Pair | Risk |
|------|------|
| Homepage vs. `/services/general-contracting/` — both target "commercial general contractor Texas" | HIGH |
| `/services/tenant-improvement/` vs. `/projects/tenant-improvements/` | HIGH |
| `/san-antonio-tx/` vs. `/locations/san-antonio-commercial-contractors/` | HIGH |
| `/design-build-services/` vs. `/services/design-and-build/` (if both live) | HIGH |
| `/preconstruction-services/` vs. `/services/preconstruction/` (if both live) | HIGH |
| `/construction-management/` vs. `/services/construction-management/` (redirects to image, not page) | HIGH |

### Key Content Discovery (Uncrawled)
The cluster audit discovered links to 20+ blog posts not in the 47-page crawl. The blog has substantially more content than the initial crawl captured. Before commissioning new posts, run a full re-crawl to avoid duplicating existing work. Known live (uncrawled): `commercial-construction-cost-houston-tx`, `dallas-commercial-construction-costs-2025-2026`, `medical-office-construction-costs-texas-2026`, `cost-to-build-a-car-wash-in-texas`, and others.

---

## 10. Search Experience Optimization (SXO) — Score: 42 / 100

**Auditor:** seo-sxo specialist

### SERP Page-Type Mismatch — Critical

| Page | Target Query | SERP Requires | Current | Gap |
|------|-------------|---------------|---------|-----|
| /houston-commercial-contractors/ | "commercial general contractor Houston TX" | 1,500–3,000 word service-location hybrid with portfolio, testimonials, schema, local NAP | 286 words, no proof | **CRITICAL** |
| /dallas-tx/ | "commercial general contractor Dallas TX" | Same | 280 words, same template | **CRITICAL** |
| /austin-tx/ | "commercial general contractor Austin TX" | Same | 286 words | **CRITICAL** |
| /services/construction-management/ | "construction management services Texas" | Deep service page explaining CM vs. GC vs. CMAR with process breakdown | 254 words, 2 H3s | **HIGH** |
| /austin-commercial-construction-cost-per-square-foot-2026/ | "construction cost per square foot Texas" | Informational data guide | Structurally correct — **this is working** | MEDIUM |

### Persona Scores

| Persona | Landing Page | Score | Primary Failure |
|---------|-------------|-------|-----------------|
| Industrial/Warehouse Owner (Dallas) | /dallas-tx/ | 22/100 | No industrial verticals mentioned |
| Property Developer (Houston) | /houston-commercial-contractors/ | 26/100 | No portfolio proof, no local projects |
| Retail Tenant | /services/tenant-improvement/ | 32/100 | No build types, no timelines |
| Property Developer | /services/construction-management/ | 38/100 | No CM vs. GC comparison |
| Industrial Owner | Cost guides entry | 52/100 | Guide good, funnel breaks at 52-word portfolio page |
| Retail Tenant | /commercial-construction-project-inquiry/ | 58/100 | No project-type differentiation on form |

### Conversion Path Failures
1. Primary CTA (`/get-a-quote/`) is a 404 across the entire site
2. Single conversion endpoint for all intent stages — awareness-stage blog readers hit the same "project inquiry" form as decision-ready developers
3. No phone number or direct email on any service or location page
4. Funnel breaks between cost guides (working content) and project portfolio (52-word stubs)

---

## 11. AI Search Readiness / GEO — Score: 42 / 100

*(Synthesized from content, technical, and SXO audits; GEO specialist output unavailable)*

### AI Crawler Access
- `robots.txt`: `Disallow:` line is blank — open to all crawlers including GPTBot, ClaudeBot, PerplexityBot, Bytespider
- No explicit allow/deny decision documented for LLM training crawlers
- No `llms.txt` file present at `https://www.maxxbuilders.com/llms.txt`
- Recommendation: Make an intentional policy decision. Allowing AI crawlers keeps the site eligible for AI citation; blocking protects content from LLM training. Current state is passive admission with no strategy.

### Citability Assessment

| Page | AI Citation Score | Reason |
|------|-----------------|--------|
| Hotel Construction Cost Guide | 58/100 | Named projects with SF, city cost differentials, FAQ format — but H1 error and author placeholder undercut authority |
| Austin Construction Cost Guide | 68/100 | Cost table by building type, FAQ format, Austin-specific market data — strongest citation target |
| Commercial Construction Companies TX | 55/100 | External source citations (AGC, Dodge), FAQ format — good structure |
| Location pages | ~10/100 | Generic prose, no quotable facts, no structured data |
| Service pages | ~15/100 | Marketing language only, zero specific claims |

### Structural Citability Gaps
- No "Quick Answer" / TL;DR block at the top of any blog post (AI systems pull the opening text as citation excerpt)
- No comparison tables on service or location pages
- No source attribution for cost data ranges in blog posts
- Service pages have zero quotable, specific claims
- No `llms.txt` file (pending GEO audit for full assessment)

---

## 12. Backlinks — Pending

*(Backlinks agent is still running Common Crawl queries. Findings will be appended when available.)*

Known from schema `sameAs` data:
- GBP likely present (Maps shortlink in sameAs)
- Social profiles: Facebook, LinkedIn, Instagram, YouTube, Twitter/X confirmed
- Yelp, BBB, Angi directory presence: unknown

---

## Scoring Summary

| Dimension | Score | Primary Drag |
|-----------|-------|-------------|
| Technical SEO | 54/100 | 404 CTA, broken redirect, security headers absent |
| Content Quality | 31/100 | 37/47 pages thin; E-E-A-T 28/100; no author bylines |
| On-Page SEO | 48/100 | Internal linking failures; orphaned hub pages |
| Schema | 52/100 | Sunday hours conflict; priceRange conflict; org email mismatch |
| Performance | 25/100 | LCP 8,296 ms; no cache; no gzip; 699 KB hero JPEG |
| AI Search Readiness | 42/100 | Blog posts are citable; service/location pages have zero quotable claims |
| Images | 30/100 | Hero JPEG 699 KB; no WebP conversion; no AVIF |
| **COMPOSITE** | **42/100** | |

---

## Appendix: Audit Files

| File | Description |
|------|-------------|
| `audit/technical-seo.md` | Full technical audit with metadata snapshot of all 47 pages |
| `audit/content-seo.md` | E-E-A-T scoring, thin content analysis, blog post evaluation |
| `audit/schema-seo.md` | Full JSON-LD validation with recommended additions |
| `audit/sitemap-seo.md` | Sub-sitemap analysis, status code audit, taxonomy archive assessment |
| `audit/performance-seo.md` | Lighthouse 13.0.3 results, CWV root cause analysis |
| `audit/visual-seo.md` | 8 screenshots with above-fold, LCP, and CTA analysis |
| `audit/local-seo.md` | Location page assessment, NAP consistency, schema validation |
| `audit/cluster-seo.md` | Hub-spoke architecture, cannibalization map, content gap analysis |
| `audit/sxo-seo.md` | SERP backwards analysis, persona scoring, conversion path audit |
| `audit/lighthouse-home.json` | Raw Lighthouse 13.0.3 JSON output |
| `audit/screenshots/` | 8 screenshots (desktop + mobile for 4 pages) |
| `.firecrawl/crawl.json` | 47-page crawl export with full metadata |
| `ACTION-PLAN.md` | Prioritized fix list (Critical → High → Medium → Low + content roadmap) |

---

*Audit conducted 2026-06-24. Awaiting: GEO (AI crawler rules, llms.txt, passage citability) and Backlinks (Common Crawl referring domain analysis) reports — these will be appended when available.*
