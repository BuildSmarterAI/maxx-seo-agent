# Local SEO Audit — Maxx Builders
**Domain:** https://www.maxxbuilders.com
**Audit date:** 2026-06-24
**Auditor:** Local SEO Agent (Claude Sonnet 4.6)
**Scope:** 5 location pages from `.firecrawl/crawl.json` + live schema fetch + sitemap

---

## Local SEO Score Summary

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|---------|
| GBP Signals | 25% | 42/100 | 10.5 |
| Reviews & Reputation | 20% | 35/100 | 7.0 |
| Local On-Page SEO | 20% | 28/100 | 5.6 |
| NAP Consistency & Citations | 15% | 55/100 | 8.3 |
| Local Schema Markup | 10% | 58/100 | 5.8 |
| Local Link & Authority Signals | 10% | 22/100 | 2.2 |
| **TOTAL** | 100% | — | **39.4 / 100** |

**Overall: 39 / 100 — Critical gaps across content differentiation, internal linking, and GBP signals.**

---

## Business Type

**Service Area Business (SAB)**

Signals detected:
- No visible street address on any location page body text
- Phone number (832.871.4166) listed as company-wide, not city-specific
- Schema `areaServed` lists target cities rather than showing a local office address for each
- Physical address in schema (4150 Bluebonnet Dr. Suite 102, Stafford TX 77477) is the corporate HQ applied identically to all 5 pages — not a local presence in Austin, Dallas, Fort Worth, or San Antonio

---

## Industry Vertical

**Home Services / Commercial Construction (General Contractor)**

Signals: service area language, licensed/insured implied, project-based inquiry flow, no storefront. Schema type `GeneralContractor` correctly applied on all pages.

---

## Location Page Inventory

| Page | URL | In Sitemap | Word Count |
|------|-----|-----------|------------|
| Houston | /houston-commercial-contractors/ | No (not in locations-sitemap.xml) | 286 |
| Austin | /austin-tx/ | No | 286 |
| Dallas | /dallas-tx/ | No | 280 |
| Fort Worth | /fort-worth-tx/ | No | 287 |
| San Antonio | /san-antonio-tx/ | No | 290 |

**Critical finding: None of the 5 audited location pages appear in `/locations-sitemap.xml`.** The sitemap contains 4 different pages under `/locations/` subdirectory (The Woodlands, Irving, Arlington, San Antonio under `/locations/` path). This means these 5 pages may be missing from the active XML sitemap Google is crawling, or they live under a different sitemap file not checked here. Verify via GSC > Sitemaps.

---

## 1. Content Differentiation Analysis

### Word Counts
All 5 pages are identically thin: 280–290 words each. Google's quality threshold for competitive B2B pages is generally 800–1,200 words minimum.

### H-Tag City Name Usage

| Page | H1 Contains City | H2 Contains City | H3 Contains City |
|------|-----------------|-----------------|-----------------|
| Houston | Yes | Yes | Yes (x2) |
| Austin | Yes | Yes | Yes (x2) |
| Dallas | Yes | Yes | Yes (x2) |
| Fort Worth | Yes | Yes | Yes (x2) |
| San Antonio | Yes | Yes | **NO — H3 says "Why Choose Maxx Builders in Houston?"** |

**Critical bug on San Antonio:** The H3 heading is a copy-paste error from the Houston page. It reads "Why Choose Maxx Builders in Houston?" on the San Antonio URL. This is a direct doorway-page signal to Google.

### Structural Template Pattern

Every page follows an identical skeleton:
- H2: "Experience the Maxx Builders Difference in [City]" (or minor variant)
- H3: "Why Choose Maxx Builders in [City]?"
- H3: "Ready to Get Started?"

The only differences are:
1. City name swaps in headings and a few body sentences
2. The "Why Choose" section has city-flavored bullet names (e.g. Austin uses "Embracing Creativity / Sustainable Focus", Dallas uses "Precision Craftsmanship / Industry Expertise")

### Content Similarity Scores (difflib SequenceMatcher)

| Pair | Similarity |
|------|-----------|
| Houston vs San Antonio | 14.2% |
| Dallas vs San Antonio | 22.1% |
| Fort Worth vs San Antonio | 16.6% |
| Houston vs Dallas | 10.8% |
| Houston vs Fort Worth | 10.7% |
| Austin vs Fort Worth | 8.2% |

Raw string similarity is low because each page has different "Why Choose" bullet copy. However, the structural and intent fingerprint is identical across all pages. Google does not assess similarity by raw string diff — it assesses **query intent uniqueness**. By that measure these pages are functionally duplicates: same service, same company, same phone, same address, city name swapped.

### Local Trust Signals

| Signal | Houston | Austin | Dallas | Fort Worth | San Antonio |
|--------|---------|--------|--------|------------|-------------|
| City-specific projects mentioned | No | No | No | No | No |
| Local client testimonials | No | No | No | No | No |
| Local permit/license references | No | No | No | No | No |
| Local subcontractors named | No | No | No | No | No |
| Neighborhood/district references | No | No | No | No | No |
| Local phone number | No (shared) | No | No | No | No |
| City-specific imagery confirmed | No (logo only for Houston) | Yes (Austin skyline) | Yes (Dallas skyline) | Yes (FW skyline) | Yes (SA skyline) |

Houston is the only page using the company logo as its primary image rather than a city photo — a missed opportunity for local visual relevance.

---

## 2. NAP Consistency Audit

### NAP Extracted from Page Text (visible body)

All 5 pages show identical visible NAP in the header/top bar:
- **Phone:** 832.871.4166
- **Email:** businessdevelopment@maxxbuilders.com
- **Address:** Not visible in page body — no street address shown

### NAP from JSON-LD Schema

**Organization block (shared across all pages via `#organization` ID):**
- Name: Maxx Builders
- Phone: +1-832-871-4166
- Email: info@maxxbuilders.com (different from visible page email)
- Address: 4150 Bluebonnet Dr. Suite 102, Stafford, TX 77477

**LocalBusiness (`#localbusiness`) block per page:**
- Phone: +1-832-871-4166
- Email: businessdevelopment@maxxbuilders.com
- Address: 4150 Bluebonnet Dr. Suite 102, Stafford, TX 77477

### NAP Discrepancy Table

| Source | Email |
|--------|-------|
| Visible page header | businessdevelopment@maxxbuilders.com |
| LocalBusiness schema | businessdevelopment@maxxbuilders.com |
| Organization schema | **info@maxxbuilders.com** |

**Flag:** The Organization-level schema uses `info@maxxbuilders.com` while every other source uses `businessdevelopment@maxxbuilders.com`. Minor inconsistency — fix for citation hygiene.

**Flag:** The `priceRange` property conflicts between schema blocks on the same page. The Organization block shows `$$` while the LocalBusiness block shows `$$$`. Resolve to a single value.

### Hours Discrepancy

**Visible page header:** Mon–Fri 8:30 AM – 6:00 PM, Saturday 9:00 AM – 5:00 PM, Sunday Closed

**Schema `openingHoursSpecification`:** All 7 days (Mon–Sun) `opens: 09:00`, `closes: 17:00`

**Flag (Critical):** Schema hours do not match visible page hours. Saturday hours wrong (schema says 9–5, page says 9–5 — matches), but weekday open time wrong (schema 9:00 AM vs. page 8:30 AM), and Sunday schema says open 9–5 while page says Closed. Google may surface incorrect Sunday hours in local results.

---

## 3. LocalBusiness Schema Validation

### Schema Type Assessment

`GeneralContractor` is the correct schema.org subtype for a commercial GC. This is properly used on all pages via the `#localbusiness` node. No deprecation issues.

### Dual-block Architecture

Each page has two `@graph` payloads:
1. Yoast-generated block: Organization + WebPage + WebSite + PostalAddress + ImageObject
2. Custom-injected block: GeneralContractor (LocalBusiness) + BreadcrumbList + FAQPage (Houston only)

This creates a structural inconsistency — the Yoast Organization block and the custom GeneralContractor block both represent the same entity but are not linked via `@id` reference.

### Property Completeness by Page

| Property | Houston | Austin | Dallas | Fort Worth | San Antonio |
|----------|---------|--------|--------|------------|-------------|
| `@type: GeneralContractor` | Yes | Yes | Yes | Yes | Yes |
| `name` | Yes | Yes | Yes | Yes | Yes |
| `address` | Yes | Yes | Yes | Yes | Yes |
| `telephone` | Yes | Yes | Yes | Yes | Yes |
| `url` (page URL) | Yes | Yes | Yes | Yes | Yes |
| `areaServed` (city) | Yes | Yes | Yes | Yes | Yes |
| `geo` (coordinates) | On Org block only | Same | Same | Same | Same |
| `geo` precision (5 decimal) | 4 decimal (29.6249) | Same | Same | Same | Same |
| `openingHoursSpecification` | On Org block only | Same | Same | Same | Same |
| `aggregateRating` | No | No | No | No | No |
| `hasMap` | No | No | No | No | No |
| `sameAs` (GBP URL) | On Org block (Maps shortlink) | Same | Same | Same | Same |
| FAQPage | Yes | No | No | No | No |
| `image` (local photo) | No | No | No | No | No |

**Critical gaps:**
- `aggregateRating` absent on all location pages — prevents star ratings in SERPs
- `geo` only exists on the Organization block (Stafford HQ coords) — LocalBusiness node has no geo
- `geo` precision is 4 decimal places (29.6249 / -95.5570) — recommended is 5+ decimals for precision
- FAQPage schema only on Houston — Austin, Dallas, Fort Worth, San Antonio missing this entity enhancement
- `hasMap` missing — no Google Maps embed linked from schema

---

## 4. GBP Signals on Page

| Signal | Detected | Notes |
|--------|----------|-------|
| Google Maps embed (iframe) | Not detected in crawl | Cannot confirm without visual render |
| Place ID reference | Not detected | `goo.gl/maps/CK4gqaWr1LaQtr1d6` in sameAs (Org block) — a Maps shortlink, not Place ID |
| Review widget | Not detected | No `aggregateRating` in schema, no review embed found |
| GBP post indicators | Not detected | |
| Photo gallery (local projects) | Not detected | City skyline stock photos only |
| Driving directions link | Not detected | |
| "Get Directions" CTA | Not detected | |
| Local phone number (city-specific) | No | Single number for all cities |

**GBP score rationale (42/100):** A GBP likely exists (sameAs Maps link present, brand is established) but zero GBP signals surface on these location pages. No embed, no review pull-through, no city-specific phone, no local photos of actual projects.

---

## 5. Review Health Snapshot

| Metric | Status |
|--------|--------|
| `aggregateRating` in schema | Absent on all location pages |
| Visible rating/count on page | Not detected |
| Review widget/embed | Not detected |
| Houston FAQ mentions "top-rated" | Yes — "Maxx Builders is a top-rated commercial general contractor in Houston with 340+ completed projects worth over $127 million" |
| Review response pattern | Cannot assess without GBP access |
| Review velocity (18-day rule) | Cannot assess without GBP access |

**Flag:** The Houston FAQ schema references "top-rated" and "Inc. 5000 / EY Entrepreneur of the Year" — strong E-E-A-T signals — but this content is buried in schema only, not visible on-page. Move this to visible body content.

---

## 6. Citation Presence — Tier 1 Directories

Cannot perform live citation checks without paid tools (BrightLocal, Whitespark). Assessed via schema `sameAs` signals only.

| Directory | Status |
|-----------|--------|
| Google Business Profile | Likely present (Maps shortlink in sameAs) |
| Yelp | Not referenced in sameAs — status unknown |
| BBB | Not referenced in sameAs — status unknown |
| Facebook | Confirmed (facebook.com/maxxbuildersco in sameAs) |
| LinkedIn | Confirmed (linkedin.com/company/maxxbuilders in sameAs) |
| YouTube | Confirmed (@buildsmarttv in sameAs) |
| Instagram | Confirmed |
| Twitter/X | Confirmed |

---

## 7. Internal Linking Audit

### Inbound Links to Location Pages (from crawled site)

| Location Page | Unique Pages Linking In | Source(s) |
|---------------|------------------------|-----------|
| Houston | 1 | /locations |
| Austin | 1 | /locations |
| Dallas | 1 | /locations |
| Fort Worth | 1 | /locations |
| San Antonio | 1 | /locations |

**Critical finding:** Every location page receives exactly 1 inbound internal link, from the `/locations` taxonomy archive only. No links from:
- Homepage (37 internal links, zero point to any city page)
- /services/ pages (6 links, none to city pages)
- /about/ pages
- /projects/ pages (10 project gallery pages — none link to city pages)
- Blog posts

### Outbound Links from Location Pages

Every location page links only to `/commercial-construction-project-inquiry/` (twice on Houston/Austin/Dallas/Fort Worth, once on San Antonio). No cross-links between city pages, no links to service pages, no links to relevant project galleries.

### /locations Archive Page

- Canonical: `https://www.maxxbuilders.com/locations/`
- Robots: `index, follow`
- The /locations page is indexable, which is correct — it serves as the hub for city pages

**Inconsistency:** The 5 audited location pages live at root level (e.g., `/houston-commercial-contractors/`) while the sitemap and breadcrumb schema reference a `/locations/` parent directory (e.g., breadcrumb shows Home > Locations > Houston). The actual URLs are not nested under `/locations/` — these are orphaned pages from a URL architecture perspective.

---

## 8. Sitemap Analysis

### locations-sitemap.xml Contents

| URL in Sitemap | Last Modified |
|----------------|--------------|
| /locations/ | 2025-05-27 |
| /locations/the-woodlands-commercial-contractors/ | 2025-05-21 |
| /locations/irving-premier-commercial-contractors/ | 2025-05-21 |
| /locations/arlington-commercial-construction-companies/ | 2025-05-21 |
| /locations/san-antonio-commercial-contractors/ | 2025-05-27 |

**Critical finding:** The 5 audited pages (`/houston-commercial-contractors/`, `/austin-tx/`, etc.) are NOT in this sitemap. There is also a `/locations/san-antonio-commercial-contractors/` in the sitemap that appears to be a duplicate or alternate version of `/san-antonio-tx/`. This creates a potential duplicate content issue for San Antonio specifically.

The sitemap only lists 4 location pages under `/locations/` subdirectory — which appear to be different pages from the 5 audited. Total location page count across both sets: at least 8–9, potentially more.

---

## 9. Doorway Page Assessment

**Verdict: High doorway page risk on 4 of 5 pages.**

Google's doorway page policy targets pages "created to rank for similar queries and funnel users to the same destination." These pages meet multiple criteria:

| Doorway Signal | Present? |
|----------------|---------|
| Identical template structure | Yes — H2, H3, CTA identical across all pages |
| City name swap as primary differentiation | Yes — city name is swapped in ~8–10 places; everything else is generic |
| Single conversion destination | Yes — all pages link only to /commercial-construction-project-inquiry/ |
| No unique local content (projects, staff, quotes) | Yes — no city-specific proof points on any page |
| Thin content (<300 words) | Yes — all at 280–290 words |
| Copy-paste errors left in | Yes — San Antonio H3 references Houston |
| No local phone per city | Yes — shared 832 number on all pages |

**Houston** is partially insulated because it has FAQPage schema with specific Houston cost data ($150–$400/sqft) and project stats (340+ projects, $127M). If that FAQ content were surfaced on-page, Houston would clear the doorway bar. The other four pages have no equivalent differentiators.

---

## Top 10 Prioritized Actions

### Critical

**1. Fix San Antonio copy-paste error immediately**
The H3 heading on `/san-antonio-tx/` reads "Why Choose Maxx Builders in Houston?" This is a live, indexable error that signals to Google this page was not written for San Antonio. Fix in WordPress before any other work.

**2. Fix schema hours vs. visible hours mismatch**
`openingHoursSpecification` says Sunday open 9–5 and weekday open 9:00 AM. Page header says Sunday Closed and weekdays open 8:30 AM. Google surfaces schema hours in local results — incorrect hours erode trust and may trigger GBP suspensions if they conflict with GBP hours. Align schema to match the visible header exactly.

**3. Add FAQPage schema to Austin, Dallas, Fort Worth, San Antonio**
Houston already has city-specific FAQ schema (cost ranges, project types). Replicate this with city-appropriate data for the other four pages. This is the single fastest schema win with SERP impact (rich results + AI citation eligibility).

**4. Surface location pages from homepage and service pages**
Zero location links from the homepage (37 links, none to city pages). Add a "Cities We Serve" section to the homepage linking all 5 cities. Add contextual city links from each `/services/` page. This is the highest-leverage internal linking fix — currently every location page is two-clicks deep from the homepage through a single link path.

### High

**5. Add 800+ words of city-specific content to each location page**
At 280–290 words, these pages cannot compete for commercial construction queries in any of these markets. Each page needs:
- 2–3 completed local project case studies with square footage and project type
- Local market context (e.g., Austin tech corridor, DFW logistics hub, SA medical district)
- Named local team member or project manager
- City-specific cost data (construction cost ranges vary by market)
- Local testimonial or client name (with permission)

**6. Add `aggregateRating` to all location page schemas**
No review data appears anywhere on these pages. If Maxx Builders has Google reviews, pull the rating and count into schema. This enables star ratings in organic SERPs — a significant CTR driver for contractor queries.

**7. Consolidate or clarify URL architecture**
There are two competing location URL structures: root-level (`/houston-commercial-contractors/`) and subdirectory (`/locations/san-antonio-commercial-contractors/`). The breadcrumb schema on the 5 audited pages implies a `/locations/` parent that doesn't match their actual URL. Either migrate the 5 root-level pages under `/locations/` or remove the subdirectory structure. Resolve the San Antonio duplicate specifically.

**8. Add `geo` coordinates to the LocalBusiness node on each city page**
Currently `geo` lives only on the Organization block (Stafford HQ) and uses 4-decimal precision. Each city's GeneralContractor node should have its own `geo` pointing to the city center (or a local project address). Use 5+ decimal places.

### Medium

**9. Fix email inconsistency between Organization schema and LocalBusiness schema**
Organization block: `info@maxxbuilders.com`. LocalBusiness block and visible page: `businessdevelopment@maxxbuilders.com`. Standardize to one email across all schema blocks. Use `businessdevelopment@maxxbuilders.com` if that is the primary contact for new business.

**10. Fix `priceRange` conflict between schema blocks**
Organization block uses `$$`, LocalBusiness block uses `$$$` — on the same page. Standardize. For a commercial GC in the $3M–$15M project range, `$$$` is more appropriate.

---

## Limitations Disclaimer

The following could not be assessed without paid tools or authenticated access:

- **Live GBP data:** Primary category, GBP review count, review velocity, Q&A presence, post cadence, photo count — require Google Business Profile API or BrightLocal
- **Local pack positions:** Real-time local pack rankings for "commercial contractor [city]" queries — require DataForSEO or SerpApi with geo-targeted requests
- **Citation audit:** Yelp, BBB, Angi, Houzz, ENR, Construction directories — require BrightLocal or Whitespark citation finder
- **Review response rate:** Cannot assess without GBP dashboard access
- **Core Web Vitals (CrUX field data):** Requires PageSpeed API or GSC CWV report
- **GSC impressions/clicks per location page:** Requires GSC access to confirm whether these pages are receiving any organic traffic
- **Backlink profile per location page:** Requires Ahrefs or Semrush
- **Indexation status:** Confirmed these pages are not in `locations-sitemap.xml` but cannot confirm their indexation status without GSC "URL Inspection" or a `site:` search

---

*Audit generated from: `.firecrawl/crawl.json` (47 pages), live JSON-LD fetch (5 pages), live sitemap fetch, live /locations robots check.*
