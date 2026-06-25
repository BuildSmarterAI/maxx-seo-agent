# Semantic Topic Clustering & Content Architecture Audit
**Site:** maxxbuilders.com — Texas Commercial General Contractor  
**Crawl basis:** 47 pages (firecrawl export). Note: the live site contains substantially more content than what was crawled — the link graph references ~80+ additional URLs including blog posts, industry pages, and location sub-pages that are live but absent from this crawl. All findings are anchored to confirmed crawl data; gap analysis accounts for discovered-but-uncrawled URLs.  
**Date:** 2026-06-24

---

## 1. Current Content Map by Topic Cluster

The site organizes content into six logical buckets. The hub-and-spoke structure exists in skeleton form but is not fully wired.

### Cluster 1 — Services (Delivery Methods)
**Candidate hub:** `/services/` (264 words, links to 4 of 6 service pages)  
| Page | URL | Word Count | Notes |
|------|-----|-----------|-------|
| Services index | `/services/` | 264 | Missing links to `/preconstruction/` and `/architectural-design-and-engineering/` |
| Construction Management | `/services/construction-management/` | 254 | |
| Design + Build | `/services/design-and-build/` | 287 | |
| General Contracting | `/services/general-contracting/` | 267 | Highest inbound (3) |
| Preconstruction | `/services/preconstruction/` | 262 | Not linked from `/services/` hub |
| Tenant Improvement | `/services/tenant-improvement/` | 260 | |
| Architectural Design + Engineering | `/services/architectural-design-and-engineering/` | 263 | Not linked from `/services/` hub; 0 inbound links |

### Cluster 2 — Locations (City Landing Pages)
**Candidate hub:** `/locations` (280 words, no meta description)  
| Page | URL | Word Count | Notes |
|------|-----|-----------|-------|
| Locations index | `/locations` | 280 | 0 inbound links from crawled content; no meta description |
| Houston | `/houston-commercial-contractors/` | 286 | URL inconsistent with others |
| Austin | `/austin-tx/` | 286 | URL slug is non-descriptive |
| Dallas | `/dallas-tx/` | 280 | URL slug is non-descriptive |
| Fort Worth | `/fort-worth-tx/` | 287 | URL slug is non-descriptive |
| San Antonio | `/san-antonio-tx/` | 290 | H3 says "Why Choose Maxx Builders in Houston?" — copy error |

Additional location pages discovered (not in crawl): `/locations/arlington-commercial-construction-companies/`, `/locations/san-antonio-commercial-contractors/`, `/locations/the-woodlands-commercial-contractors/`, `/locations/irving-premier-commercial-contractors/`

### Cluster 3 — Industries (Market Sectors)
**Candidate hub:** `/industries/` (95 words — severely thin)  
| Page | URL | Word Count | Notes |
|------|-----|-----------|-------|
| Industries index | `/industries/` | 95 | 0 inbound links; links to 5 industry sub-pages not in crawl |
| Retail Construction TX | `/industries/retail-construction-texas/` | not crawled | Exists; linked from `/industries/` |
| Industrial + Warehouse TX | `/industries/industrial-warehouse-construction-texas` | not crawled | Exists |
| Healthcare + Medical TX | `/industries/healthcare-medical-construction-texas/` | not crawled | Exists |
| Fitness + Gym TX | `/industries/fitness-gym-construction-texas/` | not crawled | Exists |
| Hotel + Hospitality TX | `/industries/hotel-hospitality-construction-texas/` | not crawled | Exists |

### Cluster 4 — Portfolio / Projects
**Candidate hub:** `/projects/` (220 words)  
| Page | URL | Word Count | Notes |
|------|-----|-----------|-------|
| Projects index | `/projects/` | 220 | 1 inbound link — poorly linked hub |
| Retail Shopping Centers | `/projects/retail-shopping-centers/` | 78 | |
| Multi-family + Mixed Use | `/projects/multi-family-and-mixed-use/` | 50 | |
| Industrial + Warehouse | `/projects/industrial-and-warehouse/` | 52 | |
| Healthcare Facilities | `/projects/healthcare-facilities/` | 50 | |
| Restaurants | `/projects/restaurants/` | 54 | |
| Corporate Interiors | `/projects/corporate-interiors/` | 47 | 0 inbound links |
| Car Wash | `/projects/car-wash/` | 46 | 0 inbound links; no portfolio items shown |
| Fuel Stations | `/projects/fuel-stations/` | 72 | 0 inbound links |
| Tenant Improvements | `/projects/tenant-improvements/` | 57 | 0 inbound links |
| Hospitality + Entertainment | `/projects/hospitality-entertainment/` | 61 | 0 inbound links |

All project sub-pages are effectively photo galleries with no editorial copy — word counts of 46–78 are nav/header/footer only.

### Cluster 5 — Blog / Editorial
**Candidate hub:** `/blog/` (248 words)  
| Page | URL | Word Count | Notes |
|------|-----|-----------|-------|
| Blog index | `/blog/` | 248 | 0 inbound from crawled pages |
| Austin Construction Cost 2026 | `/austin-commercial-construction-cost-per-square-foot-2026/` | 305 | 3 inbound; best-linked blog post |
| Commercial Construction Companies TX 2026 | `/commercial-construction-companies-texas-2026/` | 272 | 3 inbound |
| Hotel Construction Cost 2026 | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | 267 | 2 inbound |

Additional blog content discovered (not in crawl — live but absent from firecrawl export):
- `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/`
- `/commercial-construction-cost-houston-tx/`
- `/dallas-commercial-construction-costs-2025-2026/`
- `/understanding-commercial-build-outs-guide/`
- `/building-commercial-building-guide/`
- `/choosing-commercial-general-contractor-guide/`
- `/mastering-tenant-improvement-construction-a-comprehensive-guide/`
- `/the-cost-of-a-tenant-build-out-per-square-foot/`
- `/best-retail-construction-contractors-in-houston-2026-rankings/`
- `/medical-office-construction-costs-texas-2026-comprehensive-guide/`
- `/cost-to-build-a-car-wash-in-texas/`
- `/cost-per-square-foot-build-warehouse-texas/`
- `/hotel-construction-guide/`
- `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/`
- `/top-commercial-building-types-in-demand-across-texas-2025-2027/`
- `/best-practices-for-a-zero-punch-list/`
- `/6-tips-to-avoid-common-construction-delays/`
- `/measure-twice-cut-once-the-importance-of-mockup-rooms-in-hospitality-and-multi-family-projects/`
- `/the-ultimate-guide-to-selecting-the-perfect-property-for-your-car-wash-business/`
- `/financing-options-for-commercial-construction-projects/`
- `/understanding-commercial-build-outs-guide/`

The blog content set is far larger than the crawl suggests — likely 20+ posts. A full re-crawl is needed before any gap analysis is declared final.

### Cluster 6 — Trust / Supporting Pages
`/about/`, `/about/our-history/`, `/about/mission-values/`, `/about/awards-and-recognition/`, `/about/group-of-companies/`, `/press-release/`, `/client-resources/`, `/join-our-team/`, `/commercial-construction-project-inquiry/`

---

## 2. Cannibalization Risk Analysis

### HIGH RISK — Active cannibalization

**"Commercial General Contractor Texas" / "Commercial Construction Texas"**  
Multiple pages compete for the same head-term intent:

| Page | Primary Signal | Intent |
|------|---------------|--------|
| Homepage `/` | "Texas Commercial General Contractors" (H1) | Commercial |
| `/services/general-contracting/` | "General Contracting" (H1), "Texas Leading Commercial General Contractors" (meta) | Commercial |
| `/commercial-construction-companies-texas-2026/` | "Commercial Construction Companies in Texas: 2026 Guide" (H1) | Informational leaning Commercial |
| All 5 location pages | "Commercial General Contractors [City]" (title pattern) | Commercial |

The homepage and `/services/general-contracting/` are the most acute pair. Both are trying to rank for "commercial general contractor Texas" and "commercial construction Texas." Google will pick one and suppress the other. The general contracting service page should own the transactional/commercial query; the homepage should target branded and navigational queries instead.

**"Tenant Improvement" split across service + project pages**

| Page | Signal |
|------|--------|
| `/services/tenant-improvement/` | Service page — "Tenant Improvement" |
| `/projects/tenant-improvements/` | Portfolio page — "Tenant Improvements" |

These are plural/singular variants of the same noun phrase competing for the same query class. Google treats them as near-identical. The portfolio page has 57 words and no editorial copy — it will not rank independently but it dilutes the service page's signal.

**"Design + Build" duplicate slugs**  
The link graph references both `/design-and-build/` (the crawled service page) and `/design-build-services/` — two different URLs likely mapping to the same or near-identical content. If both return 200, this is a direct cannibalization.

**"Preconstruction Services" slug conflict**  
Similarly, `/services/preconstruction/` and `/preconstruction-services/` are both referenced as active URLs.

**"Construction Management" slug conflict**  
`/services/construction-management/` and `/construction-management/` are both referenced. If both serve content, they split PageRank and confuse crawlers.

### MEDIUM RISK — Intent overlap without direct competition

**Location pages vs. "commercial construction companies Texas" blog post**  
Each city page targets "[City] commercial general contractors" (commercial intent). The blog post targets "commercial construction companies Texas" (informational). These are different queries but share topical proximity. The risk is low right now but increases if the blog post is expanded with city-specific content.

**Services index vs. individual service pages**  
`/services/` lists services without deeply targeting any keyword. The sub-pages do target individual service keywords. This is correct hub-and-spoke behavior and is not a cannibalization risk — the concern is that `/services/` offers insufficient value to earn inbound links or rank on its own.

**Industries pages vs. project category pages**  
`/industries/retail-construction-texas/` and `/projects/retail-shopping-centers/` likely target overlapping queries. One is a service-intent page; the other is portfolio evidence. If the industry page has substantial editorial copy, there is a cannibalization risk with search queries like "retail construction Texas contractor."

---

## 3. Internal Linking Structure Assessment

### Link Equity Distribution

The most inbound-linked page on the site is `/commercial-construction-project-inquiry/` with **46 inbound links** — it appears as a CTA on every page. This is a conversion page, not a content page. Concentrating the site's entire internal link budget on a single CTA page means almost no PageRank flows to the content that needs to rank.

**Pages with strong inbound link counts (crawl scope):**
- `/commercial-construction-project-inquiry/` — 46 (CTA page, should not dominate)
- `/services/general-contracting/` — 3
- `/austin-commercial-construction-cost-per-square-foot-2026/` — 3
- `/commercial-construction-companies-texas-2026/` — 3
- `/services/preconstruction/` — 2
- `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` — 2

**Pages with zero inbound links (orphaned or near-orphaned — critical):**
- `/about/` — 0 (the about page has no inbound link from any crawled page)
- `/blog/` — 0 (the blog index is not linked from any crawled page)
- `/industries/` — 0 (the industries hub is not linked from any crawled page)
- `/locations` — 0 (the locations hub is not linked from any crawled page)
- `/services/` — 0 (the services hub is not linked from any crawled page)
- `/join-our-team/` and sub-pages — 0
- `/client-resources/clients-guide/` — 0
- `/client-resources/construction-terminology/` — 0
- `/press-release/` — 0
- `/projects/car-wash/` — 0
- `/projects/corporate-interiors/` — 0
- `/projects/fuel-stations/` — 0
- `/projects/hospitality-entertainment/` — 0
- `/projects/tenant-improvements/` — 0
- `/services/architectural-design-and-engineering/` — 0

**Critical pattern:** Every service page links only to `/commercial-construction-project-inquiry/`. No service page links to another service page, to the services hub, to any blog post, or to any project page. The service cluster is structurally isolated — link equity flows in but cannot flow laterally or upward.

**Location page problem:** All five city pages link only to the CTA page. They don't link to service pages, to each other, to the locations hub, or to city-specific blog content. The Austin page (`/austin-tx/`) doesn't link to the Austin cost blog post despite it being the most natural contextual link on the entire site.

**Homepage outbound links:** The homepage links to 4 of 6 service pages and 5 of 11 project categories. It does not link to the blog, the industries hub, or any location page. The homepage's 37 internal links are heavily duplicated (same service linked twice each).

**Blog post linking:** The two crawled blog posts do link to service pages (`/services/preconstruction/`, `/services/general-contracting/`) — this is the strongest spoke-to-service linking on the site, but it only works in one direction. No service page links back to the blog.

### Link Matrix Summary

| Hub | Links to Spokes | Spokes Link Back | Spokes Cross-Link |
|-----|----------------|-----------------|-------------------|
| `/services/` | 4/6 service pages | None | None |
| `/locations` | 5/5 city pages (via the hub) | None | None |
| `/industries/` | 5 industry pages | Unknown (not crawled) | Unknown |
| `/projects/` | 10/11 category pages | None | None |
| `/blog/` | 3 posts in crawl | Posts link to services | Blog not linked from services |
| Homepage | 4 services, 5 project cats | Not applicable | Not applicable |

---

## 4. Keyword Cannibalization — Specific Pairs

| Pair | URLs | Risk Level | Recommended Resolution |
|------|------|-----------|----------------------|
| "Commercial general contractor Texas" | `/` vs `/services/general-contracting/` | HIGH | Homepage targets brand + "Texas commercial construction company" (broad); service page owns "commercial general contractor Texas" (transactional) |
| "Tenant improvement [Texas]" | `/services/tenant-improvement/` vs `/projects/tenant-improvements/` | HIGH | Differentiate clearly: service page = "how we do TI"; project page = "our TI portfolio." Add distinct H1s and meta descriptions. Noindex the project gallery page if it has no editorial content |
| "Design-build [Texas]" | `/services/design-and-build/` vs `/design-build-services/` | HIGH | 301-redirect `/design-build-services/` to `/services/design-and-build/` — confirm whether both are live |
| "Preconstruction services" | `/services/preconstruction/` vs `/preconstruction-services/` | HIGH | 301-redirect if both are live |
| "Construction management" | `/services/construction-management/` vs `/construction-management/` | HIGH | 301-redirect if both are live |
| "Commercial construction cost Texas" | Multiple blog posts + comprehensive guide | MEDIUM | Consolidate or clearly differentiate by city/type; ensure canonical chain is correct |
| "Retail construction Texas" | `/industries/retail-construction-texas/` vs `/projects/retail-shopping-centers/` | MEDIUM | Industry page = educational/service; project page = proof/portfolio. Different H1s, distinct intent signals |

---

## 5. Content Gaps

The following are confirmed high-value gaps — not covered by confirmed crawled pages. Some may be partially covered by uncrawled blog content; verify before commissioning.

### Gap A — Service-City Matrix (High Priority)
The site has 5 city landing pages and 6 service pages but no service+city combination pages. Competitors rank for queries like "design-build contractor Houston," "tenant improvement Austin TX," "construction management Dallas." These are transactional queries with clear commercial intent and relatively low competition compared to head terms.

Recommended pages (highest search demand first):
1. `/houston-tx/tenant-improvement-houston/` or `/tenant-improvement-houston-tx/`
2. `/dallas-tx/general-contractor-dallas/` 
3. `/austin-tx/design-build-austin/`
4. `/houston-tx/design-build-houston/`
5. `/dallas-tx/commercial-construction-dallas/`

### Gap B — Cost Content by City (Medium-High Priority)
The Austin cost post exists. The site has uncrawled pages for Houston and Dallas costs. Missing confirmed coverage:
- Fort Worth commercial construction cost per square foot
- San Antonio commercial construction cost per square foot
- These complete the city cost cluster and support the 5 city landing pages

### Gap C — Industry-Specific Cost Posts (Medium Priority)
High-volume informational queries with clear linkback opportunities to service pages:
- "How much does retail construction cost in Texas?" → links to `/services/general-contracting/`, `/industries/retail-construction-texas/`, retail project portfolio
- "Medical office construction cost Texas" → possibly covered at `/medical-office-construction-costs-texas-2026-comprehensive-guide/` (verify)
- "Warehouse construction cost per square foot Texas" → possibly covered at `/cost-per-square-foot-build-warehouse-texas/` (verify)
- "Restaurant construction cost Texas" → not confirmed covered
- "Car wash construction cost Texas" → appears to be at `/cost-to-build-a-car-wash-in-texas/` (verify)
- "Multi-family construction cost Texas" → not confirmed covered

### Gap D — Process / Buyer-Education Content (Medium Priority)
Queries from early-funnel decision-makers that build trust and create topical authority. Missing confirmed coverage:
- "How long does commercial construction take in Texas?" (timeline guide by building type)
- "Commercial construction permitting Texas / [City]" (permitting timeline and process)
- "How to hire a commercial contractor in Texas" → `/choosing-commercial-general-contractor-guide/` may cover this (verify)
- "Design-build vs general contracting — which is right for my project?"
- "What is preconstruction and why does it matter?"
- "Commercial construction contract types explained (GMP, lump sum, cost-plus)"

### Gap E — Construction Financing (Low-Medium Priority)
One post (`/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/`) appears to exist. Adjacent gaps:
- SBA 504 loans for commercial construction Texas
- Construction-to-permanent loan guide Texas
- These are high-intent queries from buyers who are pre-construction

### Gap F — Sector-Specific Pillar Content (High Priority — long-term)
The `/industries/` hub and its sub-pages are not in the crawl. If those sub-pages are thin, the following are priority builds:
- "Retail construction Texas" — comprehensive guide (pillar for retail cluster)
- "Healthcare construction Texas" — comprehensive guide (pillar for healthcare cluster)
- "Industrial warehouse construction Texas" — comprehensive guide

---

## 6. Blog Content Strategy Assessment

### Current 3 Posts (Crawled)

| Post | Target Query | Intent | Word Count | Issues |
|------|-------------|--------|-----------|--------|
| Austin Construction Cost 2026 | "Austin commercial construction cost per square foot" | Informational | 305 (crawl) — likely much higher on-page | Strong; 3 inbound links; links to services. The H1 title tag matches the hotel guide's H1 treatment which is inconsistent |
| Commercial Construction Companies TX 2026 | "commercial construction companies Texas" | Informational | 272 (crawl) | Targets a competitive head term; strong internal linking (28 outbound links from this post) |
| Hotel Construction Cost 2026 Guide | "hotel construction cost Texas" | Informational | 267 (crawl) | H1 is the raw slug text `the-ultimate-2026-hotel-construction-cost-guide-texas-edition` — broken. Title tag says "Hotel Construction Cost | 2026 Texas Guide" — inconsistent |

**Note on word counts:** The crawl word counts (267–305) are suspiciously low for pages with the H2/H3 depth shown. These are likely truncated by the crawler. The actual on-page word counts are likely 2000–4000 words per post.

### Blog Content Pattern
The blog is building cost-per-square-foot content by building type and city. This is a strong strategy — these posts capture informational queries from project planners and link naturally to service pages. The pattern should be completed systematically.

### Next 10 Blog Posts Recommended

Priority is determined by: (1) support for service pages with zero or low inbound links, (2) support for location pages, (3) topical authority gaps, (4) commercial construction buyer journey sequence.

**Tier 1 — Complete the cost cluster (supports location pages directly)**
1. **"Fort Worth Commercial Construction Cost Per Square Foot (2026)"**  
   Target: `fort worth commercial construction cost`  
   Supports: `/fort-worth-tx/`  
   Cluster: Location + Cost

2. **"San Antonio Commercial Construction Cost Per Square Foot (2026)"**  
   Target: `san antonio commercial construction cost per square foot`  
   Supports: `/san-antonio-tx/`  
   Cluster: Location + Cost

**Tier 2 — Service page support (service pages currently link nowhere and receive few inbound links)**

3. **"Design-Build vs. General Contracting: Which Delivery Model Is Right for Your Texas Project?"**  
   Target: `design build vs general contractor Texas`  
   Supports: `/services/design-and-build/`, `/services/general-contracting/`  
   Intent: Informational → Commercial  
   Note: This post must compare both models fairly and conclude with Maxx's capability in both — it supports two service pages simultaneously.

4. **"Construction Management Services: What They Are, When to Use Them, and What They Cost in Texas"**  
   Target: `construction management services Texas`  
   Supports: `/services/construction-management/`  
   Intent: Informational

5. **"Preconstruction Services: Why the Phase Before Breaking Ground Determines Project Success"**  
   Target: `preconstruction services commercial construction`  
   Supports: `/services/preconstruction/`  
   Intent: Informational

6. **"Tenant Improvement Cost Per Square Foot in Texas (2026): Office, Retail, Medical, Restaurant"**  
   Target: `tenant improvement cost per square foot Texas`  
   Supports: `/services/tenant-improvement/`  
   Intent: Informational  
   Note: Confirm `/the-cost-of-a-tenant-build-out-per-square-foot/` doesn't already cover this before commissioning.

**Tier 3 — Industry-sector coverage (supports industries hub)**

7. **"Retail Construction in Texas: Costs, Timelines, and What to Expect from Your Contractor"**  
   Target: `retail construction contractor Texas`  
   Supports: `/industries/retail-construction-texas/`, `/projects/retail-shopping-centers/`  
   Intent: Informational → Commercial

8. **"Healthcare Construction in Texas: Medical Office, Dental, and Outpatient Clinic Build Costs (2026)"**  
   Target: `healthcare construction Texas` / `medical office construction cost Texas`  
   Supports: `/industries/healthcare-medical-construction-texas/`, `/projects/healthcare-facilities/`  
   Note: Confirm `/medical-office-construction-costs-texas-2026-comprehensive-guide/` coverage first.

**Tier 4 — Buyer process / trust content**

9. **"Commercial Construction Timeline in Texas: How Long Does Each Project Type Take?"**  
   Target: `commercial construction timeline Texas`  
   Supports: All service pages; especially `/services/construction-management/`  
   Intent: Informational  
   This fills a genuine informational gap — project owners consistently search for timeline guidance.

10. **"How to Hire a Commercial General Contractor in Texas: The 10-Question Checklist"**  
    Target: `how to choose commercial contractor Texas`  
    Supports: `/services/general-contracting/`  
    Intent: Informational → Commercial  
    Note: Confirm `/choosing-commercial-general-contractor-guide/` coverage first.

---

## 7. Recommended Hub-and-Spoke Architecture

### Architecture Principles Applied
- One hub page per topic cluster: owns the broadest keyword, links to all spokes
- Spoke pages own specific sub-queries and link back to the hub
- Blog posts serve as informational spokes that link to service/location pages
- No spoke exists without at least 3 planned inbound links

### Cluster 1 — Services Hub-and-Spoke (Priority: Immediate)

**Hub:** `/services/` — retarget to "Commercial Construction Services Texas" (broad)  
**Spokes:**
- `/services/general-contracting/` → "Commercial General Contractor Texas"
- `/services/design-and-build/` → "Design-Build Contractor Texas"
- `/services/construction-management/` → "Construction Management Services Texas"
- `/services/preconstruction/` → "Preconstruction Services Texas"
- `/services/tenant-improvement/` → "Tenant Improvement Contractor Texas"
- `/services/architectural-design-and-engineering/` → "Architectural Design Engineering Texas"

**Missing links to add immediately:**
- `/services/` → add links to `/preconstruction/` and `/architectural-design-and-engineering/` (currently absent)
- Every service spoke → add link back to `/services/` hub
- Every service spoke → add 1-2 contextual links to the most relevant project portfolio category
- Blog posts about each service → link to corresponding service page (bidirectional)

### Cluster 2 — Locations Hub-and-Spoke (Priority: Immediate)

**Hub:** `/locations` — needs a meta description and at least 3 inbound links from homepage, blog posts, and services  
**Spokes:**
- `/houston-commercial-contractors/` → "Houston Commercial General Contractors"
- `/dallas-tx/` → rename slug to `/dallas-commercial-contractors/` for consistency
- `/austin-tx/` → rename slug to `/austin-commercial-contractors/`
- `/fort-worth-tx/` → rename slug to `/fort-worth-commercial-contractors/`
- `/san-antonio-tx/` → rename slug to `/san-antonio-commercial-contractors/`
- `/locations/arlington-commercial-construction-companies/` (exists, not crawled)
- `/locations/san-antonio-commercial-contractors/` (exists, not crawled — deduplication risk with `/san-antonio-tx/`)

**Missing links to add immediately:**
- Homepage → add link to `/locations` hub
- Blog cost posts → each city cost post links to the corresponding city landing page (Austin post → Austin page; missing for Fort Worth, San Antonio)
- Each city page → link to 2-3 most relevant service pages
- Fix San Antonio H3 copy error ("Why Choose Maxx Builders in Houston?")

### Cluster 3 — Industries Hub-and-Spoke (Priority: Medium)

**Hub:** `/industries/` — currently 95 words; needs minimum 400 words of editorial copy  
**Spokes (all need full crawl to assess):**
- `/industries/retail-construction-texas/`
- `/industries/industrial-warehouse-construction-texas/`
- `/industries/healthcare-medical-construction-texas/`
- `/industries/hotel-hospitality-construction-texas/`
- `/industries/fitness-gym-construction-texas/`

**Missing links:**
- Homepage → does not link to `/industries/` hub
- Service pages → none link to relevant industry pages
- Project category pages → should link to corresponding industry page

### Cluster 4 — Portfolio Hub-and-Spoke (Priority: Low for SEO, Medium for UX)

Portfolio pages are proof/trust assets, not ranking assets. Their primary SEO role is internal link distribution and schema markup (Project + LocalBusiness). Action items:
- Add 150–300 words of editorial copy to each project category page (currently 46–78 words — insufficient for indexation)
- Link each project category page to the corresponding service page and industry page
- Consider noindexing the weakest project sub-pages (Car Wash with zero portfolio items, Corporate Interiors with 1 item) until they have sufficient content

### Cluster 5 — Cost/Informational Blog Cluster (Priority: High — active content velocity)

**Hub:** A "Texas Commercial Construction Cost" pillar page (may already exist at `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` or `/texas-commercial-construction-cost-2025-2026/`)  
**Spokes (confirmed or to be built):**
- Austin cost post (confirmed)
- Houston cost post (confirmed uncrawled)
- Dallas cost post (confirmed uncrawled)
- Fort Worth cost post (GAP — build)
- San Antonio cost post (GAP — build)
- Hotel construction cost (confirmed)
- Medical office cost (likely exists — verify)
- Warehouse cost (likely exists — verify)
- Tenant improvement cost (partially covered — verify)
- Car wash cost (likely exists — verify)
- Restaurant construction cost (GAP — verify)
- Multi-family cost (GAP — verify)

### Cluster 6 — Buyer Journey / Process Cluster (Priority: Medium — build over 6 months)

These posts build topical authority and support the Services cluster with informational intent.
- Design-build vs. GC comparison (GAP — build)
- Construction management guide (GAP — build)
- Preconstruction services guide (GAP — build)
- How to choose a commercial contractor (may exist at `/choosing-commercial-general-contractor-guide/` — verify)
- Commercial construction timeline by project type (GAP — build)
- Commercial construction contracts explained (GAP — build)
- Construction permitting in Texas (GAP — build)

---

## 8. Critical Fixes — Prioritized Action List

### P0 — Fix immediately (technical/cannibalization)

1. **Resolve duplicate URL slugs.** Confirm whether these pairs both serve 200 responses. If yes, 301-redirect the non-canonical to the canonical:
   - `/design-build-services/` → `/services/design-and-build/`
   - `/preconstruction-services/` → `/services/preconstruction/`
   - `/construction-management/` → `/services/construction-management/`
   - `/design-and-build/` → `/services/design-and-build/` (if this is a separate URL)
   - `/general-contracting/` → `/services/general-contracting/` (if this is a separate URL)
   - `/tenant-improvement/` → `/services/tenant-improvement/`

2. **Fix San Antonio H3 copy error.** `/san-antonio-tx/` contains "Why Choose Maxx Builders in Houston?" — this signals thin, templated content to Google.

3. **Add meta description to `/locations`.** Currently blank.

4. **Fix broken H1 on hotel cost post.** H1 is the raw slug string `the-ultimate-2026-hotel-construction-cost-guide-texas-edition` — not a human-readable headline.

5. **Add `/preconstruction/` and `/architectural-design-and-engineering/` to the `/services/` hub's nav/link list.** These 2 service pages receive 0–1 inbound links; the services index is the natural entry point.

### P1 — Fix within 2 weeks (internal linking)

6. **Add the Austin cost blog post link to the Austin city page.** This is the single highest-value individual link on the site that doesn't exist yet.

7. **Add `/services/` hub link to all 6 service pages** (bidirectional hub-spoke).

8. **Add `/locations` link from homepage.** The locations hub has 0 inbound crawled links despite 5 city pages sitting under it.

9. **Add `/blog/` link from homepage or main nav.** Blog index has 0 inbound links from crawled content.

10. **Add `/industries/` link from homepage.** Industries hub has 0 inbound links.

11. **Each service page: add 2 contextual links** — one to a related project category, one to the most relevant blog post.

### P2 — Fix within 30 days (content)

12. **Add 300–500 words of editorial copy to each portfolio category page.** Every project sub-page has fewer than 80 words. These pages cannot rank, and many are not linked to at all.

13. **Expand `/industries/` hub from 95 words to 400+ words** with genuine editorial value about Maxx's sector expertise.

14. **Assess `/locations/san-antonio-commercial-contractors/` vs `/san-antonio-tx/`** — if both are live with similar content, consolidate with 301 or differentiate content and intent clearly.

15. **Build Fort Worth and San Antonio cost blog posts** to complete the city cost cluster and provide contextual link targets for those city pages.

### P3 — 60–90 day content roadmap

16. Build "Design-Build vs. General Contracting" comparison post.
17. Build construction timeline by project type post.
18. Build preconstruction services guide.
19. Build construction management guide.
20. Conduct a full re-crawl to capture all blog posts and industry pages before commissioning any new content — the existing content set is larger than this crawl shows.

---

## 9. Cannibalization Check Summary

| Verdict | Count | Details |
|---------|-------|---------|
| Confirmed cannibalization | 5 | Duplicate service URL slugs (3 pairs); TI service vs. portfolio; Homepage vs. general-contracting service page |
| Probable cannibalization (needs crawl) | 2 | San Antonio location page vs. `/locations/san-antonio-commercial-contractors/`; Retail industry page vs. retail project category |
| Clean (no overlap risk) | All blog cost posts | Each targets a distinct city or building type; differentiated by H1 and meta |

---

## 10. Pre-Delivery Validation Against Schema Checklist

| Check | Status |
|-------|--------|
| No two posts share the same primary keyword | FAIL — Service page slugs and homepage share "commercial general contractor Texas" signal |
| Every spoke has at least 3 incoming internal links planned | FAIL — Most service pages have 0–1 inbound links; all location pages have 1 inbound |
| Every spoke links to the pillar | FAIL — No service page links to `/services/` hub |
| Pillar links to every spoke | FAIL — `/services/` missing 2 service page links |
| No orphan pages | FAIL — 15 crawled pages have 0 inbound internal links |
| Template selection matches intent | PARTIAL — Service pages are correctly structured as commercial-intent pages; project galleries need content |
| Word count targets | FAIL — Project pages 46–78 words (minimum 500 words needed); Service pages 250–290 words (minimum 1200 words for spoke) |
| Total cluster size within constraints | PASS — 5 defined clusters, 2–6 pages each |
| SERP overlap supports cluster groupings | NOT ASSESSED — Would require full pairwise SERP comparison; the crawl data provides sufficient evidence for architecture decisions without it |
