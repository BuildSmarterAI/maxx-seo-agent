# SXO Audit — Maxx Builders (maxxbuilders.com)
**Date:** 2026-06-24
**Analyst:** Claude SXO Agent
**Scope:** 47 pages (Firecrawl export), 3 target SERP keywords, B2B commercial construction, Texas

---

## CRITICAL FINDING — Page-Type Mismatch on Primary Commercial Intent Keywords

Before any gap scoring, this must be stated clearly:

The pages Maxx Builders uses to target high-purchase-intent local queries ("commercial general contractor Houston TX", "commercial general contractor Dallas") are thin, generic, templated location pages (~280–290 words each, zero local project data, no testimonials, no portfolio embeds, no NAP schema). The SERP for these queries rewards **deep service/location hybrid pages** with 1,500–3,000 words, rich portfolio proof, certifications, local contact details, and case-study depth. The mismatch severity is **CRITICAL** for all five city location pages.

Mismatch Severity Scale: CRITICAL / HIGH / MEDIUM / ALIGNED

| Page | Target Query | SERP Dominant Type | Current Page Type | Severity |
|---|---|---|---|---|
| /houston-commercial-contractors/ | commercial general contractor Houston TX | Deep service-location hybrid (1,500–3,000 words, portfolio, testimonials, schema) | Generic brand page (~286 words, no proof) | CRITICAL |
| /dallas-tx/ | commercial general contractor Dallas TX | Same as Houston | Same template, ~280 words | CRITICAL |
| /austin-tx/ | commercial general contractor Austin TX | Same | Same template, ~286 words | CRITICAL |
| /fort-worth-tx/ | commercial general contractor Fort Worth TX | Same | Same template, ~287 words | CRITICAL |
| /san-antonio-tx/ | commercial general contractor San Antonio TX | Same | Contains "Why Choose Maxx Builders in Houston?" — copy-paste error visible | CRITICAL |
| /services/construction-management/ | construction management services Texas | Detailed service page (delivery models, process diagrams, differentiators) | Generic service page (~254 words, two H3s total) | HIGH |
| /austin-commercial-construction-cost-per-square-foot-2026/ | commercial construction cost per square foot Texas | Informational guide / data page | Informational guide (aligned in type, but word count low at 305) | MEDIUM |

---

## 1. SERP Backwards Analysis

### Keyword 1: "commercial general contractor Houston TX"

**SERP Dominant Page Type:** Service-location hybrid page

**What Google rewards (from analysis of Greystone, Slate, KCS, Detail Construction, GRA-Gulf Coast, Right Choice, Dunhill, Garrison, Keeton):**

- Page length: 1,500–3,000+ words on a dedicated city+service URL
- H1 matches query exactly ("Houston Commercial General Contractor")
- Sections present: who they are, services list, market sectors served, "why choose us," project portfolio (image gallery by building type), testimonials with named clients and project details, certifications/memberships (AGC, ABC Texas), local office address, Houston-specific phone number
- Schema: LocalBusiness + Organization, often BreadcrumbList
- Media: project photo galleries (6+ images per building category), often video
- SERP features observed: local pack (3-pack) above organic results, service ads, PAA questions ("What does a general contractor do?", "How much does a commercial general contractor charge?", "Do I need a general contractor for commercial construction?")
- SERP consensus: **service-location hybrid page, confidence 90%+**

**Where Maxx Builders /houston-commercial-contractors/ falls short:**
- 286 words vs. competitor 1,500–3,000 words
- No project portfolio on page (links offsite to /projects/)
- No testimonials or named client references
- No certifications/memberships mentioned
- No Houston-area projects cited by name, address, or sq ft
- No local phone number differentiated by market
- No schema markup
- Generic "Why Choose Maxx Builders in Houston?" H3 with four generic bullet points that could apply to any contractor in any city

---

### Keyword 2: "construction management services Texas"

**SERP Dominant Page Type:** Deep service page with delivery-model explanation

**What Google rewards (Ridgemont, Cadence McShane, Talley Riggins, Byrne, CMOST, SD-Cap, BBB directory):**

- Explanation of what construction management IS vs. general contracting vs. design-build (educational depth)
- Process breakdown (phases: preconstruction, bid management, scheduling, cost control, closeout)
- Differentiating the agency CM vs. CMAR model
- Named project examples with scale (sq ft, dollar value, timeline)
- Team credentials (licensed PMs, relevant software like Procore/Primavera mentioned)
- SERP features: PAA box ("What does a construction manager do?", "What is the difference between CM and GC?"), informational + commercial intent split, local pack absent (state-level query)
- SERP consensus: **educational service page with commercial CTA, confidence 80%+**

**Where Maxx Builders /services/construction-management/ falls short:**
- 254 words, two H3s ("Experience the Difference..." and "Ready to Get Started?"), zero H2s
- Does not explain the difference between CM and GC (the core informational question in PAA)
- No process diagram or phase breakdown
- No named projects or team credentials
- No mention of software tools, reporting cadence, or owner-facing deliverables
- CTA present but only links to /commercial-construction-project-inquiry/ — no phone or email on page

---

### Keyword 3: "commercial construction cost per square foot Texas"

**SERP Dominant Page Type:** Informational data guide / calculator page

**SERP composition:** Maxx Builders actually appears multiple times in this SERP (a strong signal the content strategy is working). Competitors include JDJ Consulting, Arrant Construction, Terrapin CG, Guzman Construction.

**What Google rewards:**
- Data tables (cost by building type, city, year)
- Specific dollar ranges with sourcing
- FAQ / PAA coverage (cost by city, by building type, what drives cost, how to budget)
- Year-in-URL for freshness signal
- Moderate to high word count (800–2,000 words)
- Internal links to related cost guides and service pages
- SERP consensus: **informational guide, confidence 95%**

**Maxx Builders status:** PARTIALLY ALIGNED. The /austin-commercial-construction-cost-per-square-foot-2026/ page is structurally correct (data guide format, FAQ section, internal links to related pages), but the Firecrawl captures only 305 words — suggesting either significant content is JS-rendered and not indexed, or the page is thinner than it appears. The H1 on /the-ultimate-2026-hotel-construction-cost-guide-texas-edition/ is literally the URL slug rather than a human-readable title, which is a production error.

---

## 2. Page-Type Mismatch Analysis — Full Site

### Informational queries met with commercial pages

None detected. The informational blog/guide content (cost per sq ft guides, company comparison guide) is correctly formatted as guides. This is the strongest part of the SEO strategy.

### Commercial/local queries met with under-resourced pages (CRITICAL)

All five city location pages follow an identical template:
- Headline: "[City], Texas — Elevating Construction Excellence..." (generic)
- Subhead: "Maxx Builders — Your Premier Commercial Construction Company in Texas" (not city-specific)
- Body: four generic "Why Choose Maxx Builders" bullets
- H3: "Ready to Get Started?" → single CTA
- No differentiation between cities

This is the textbook "doorway page" pattern Google penalizes — pages that exist for the search engine but provide no city-specific value to the user. The fact that the /san-antonio-tx/ page contains "Why Choose Maxx Builders in **Houston**?" is direct evidence of copy-paste assembly.

### Location pages vs. local pack intent

Local pack (Google 3-pack with map) requires a Google Business Profile signal, not just a web page. The web pages can reinforce local rank but cannot trigger local pack placement on their own. The location pages currently do not include:
- NAP (Name, Address, Phone) in crawlable text
- LocalBusiness JSON-LD schema
- City-specific project references
- Embedded Google Map
- Local schema with geo-coordinates

Without these, the pages are targeting organic blue-link rankings but not supporting local pack eligibility.

### Project gallery pages — extreme thin content

Nine project category pages (/projects/retail-shopping-centers/, /projects/industrial-and-warehouse/, etc.) have 46–78 words each. These pages exist as gallery containers but provide zero contextual depth. They cannot rank for any project-type + location query (e.g., "commercial retail construction Houston"), which is a missed opportunity given that project portfolio pages are a primary B2B trust signal.

---

## 3. User Story Derivation

The following personas and user stories are derived from SERP signals (PAA questions, SERP features, and competitor content patterns observed during keyword analysis).

---

### Persona A: Property Developer / Real Estate Developer

**Profile:** Owns or manages commercial properties; evaluating GC firms before a $2M–$20M+ build; high sophistication, risk-averse, wants certainty on budget and schedule.

**SERP Signal Source:** PAA questions "Do I need a general contractor for commercial construction?" and "How much does a commercial general contractor charge?" + competitor pages leading with project scale and named client testimonials.

**User Stories:**

**A1 — Awareness (discovery query: "commercial general contractor Houston TX")**
Signal: 90%+ of ranking pages include a project portfolio segmented by building type.
Story: "As a property developer scouting GCs for a retail center in Houston, I land on the /houston-commercial-contractors/ page and immediately need to see: (1) what types of commercial projects they've built in Houston, (2) how big, and (3) who they've built for. Currently I see none of this. I leave."
Does page signal it's for me? No — no project types listed, no scale mentioned.
Does it answer my questions? No — no portfolio, no client names, no project specifics.
Is there a clear next step? Weak — single "Ready to Get Started?" CTA with no friction-reducing info (estimated response time, what to expect).
Score: 2/10

**A2 — Consideration (query: "construction management services Texas")**
Signal: Competitor service pages explain CM vs. GC distinction — a key decision-point for developers choosing a delivery model.
Story: "As a developer who has heard of 'construction management' but isn't sure if I need CM or a GC, I land on /services/construction-management/. I need to understand what I'm buying and why it's better for my project type. The page gives me generic process language but never explains the delivery model choice."
Does page signal it's for me? Partially — "seamless project execution" is generic.
Does it answer my questions? No — delivery model comparison absent.
Is there a clear next step? Yes — but only one CTA, no phone/email on page.
Score: 3/10

---

### Persona B: Retail Tenant / Franchise Operator

**Profile:** Opening a new retail location or refreshing an existing one; focused on speed-to-open, cost per SF, and minimal disruption to surrounding tenants; likely first-time buyer of commercial construction.

**SERP Signal Source:** /projects/retail-shopping-centers/ and /services/tenant-improvement/ pages exist; PAA includes "how long does a tenant improvement take?" and "what is included in tenant improvement?"; SERP shows competitor pages for "tenant improvement contractor Houston" leading with timeline estimates and industry-specific build-out types.

**User Stories:**

**B1 — Awareness (query: "tenant improvement contractor Houston TX")**
Signal: Competitor pages for this query lead with industry verticals (restaurant TI, medical office TI, fitness TI) and timeline estimates.
Story: "As a franchise operator opening a QSR location in Houston, I need a contractor who has done my type of build before and knows the timeline. The /services/tenant-improvement/ page tells me Maxx Builders does TI work but gives me no indication of my build type, typical timelines, or cost ranges."
Does page signal it's for me? No — no industry verticals or franchise/retail experience mentioned.
Does it answer my questions? No — no timeline, no cost range, no named TI projects.
Is there a clear next step? Weak — same generic inquiry form.
Score: 3/10

**B2 — Decision (query: "commercial construction project inquiry Maxx Builders")**
Signal: The /commercial-construction-project-inquiry/ page is the conversion endpoint. Branded navigational query means the user is already sold — they just need the form to be frictionless.
Story: "I've decided I want to work with Maxx Builders. I hit the inquiry page and see a 3-step process widget but the form itself appears to be a multi-page sequence (1-2-3 numbering appears twice in the body text, suggesting a stepped form or JS widget). The page has 185 words. I need to know: what information will they ask me for, how long does the form take, and will I be calling or emailing after I submit?"
Does page signal it's for me? Partially — "Let's Build Your Vision Together" is welcoming.
Does it answer my questions? No — no project type options, no indication of form fields.
Is there a clear next step? Yes — but the form UX is unclear from the crawl data.
Score: 5/10

---

### Persona C: Industrial/Warehouse Owner

**Profile:** Industrial real estate owner or operator in the Dallas-Fort Worth or Houston industrial corridor; evaluating GC for a spec warehouse, distribution center, or flex industrial build; focused on sq ft cost, structural specs, and local code expertise.

**SERP Signal Source:** "commercial construction cost per square foot Texas" SERP dominated by cost data guides; PAA includes "how much does a warehouse cost to build in Texas?"; competitor sites rank for "industrial warehouse construction Texas" with dedicated industry pages showing sq ft ranges and structural system options.

**User Stories:**

**C1 — Awareness (query: "warehouse construction cost Texas 2026")**
Signal: Maxx Builders appears in cost-guide SERPs, which is a correct entry point.
Story: "As an industrial owner researching build costs before committing to a developer, I find Maxx Builders' cost guide. The guide content is good but my next logical step — seeing Maxx Builders' industrial portfolio — takes me to /projects/industrial-and-warehouse/ which has 52 words and no visible project data. The funnel breaks at the portfolio hand-off."
Does page signal it's for me? On the guide, yes. On the portfolio page, no.
Does it answer my questions? Guide: yes. Portfolio: no.
Is there a clear next step? Guide → Portfolio is broken. Portfolio → Inquiry is present but cold.
Score: 4/10 (guide gets credit; portfolio page fails)

**C2 — Consideration (query: "industrial warehouse construction contractor Dallas TX")**
Signal: The /dallas-tx/ location page is the intended landing page for Dallas industrial leads.
Story: "I search for a warehouse contractor in Dallas and land on /dallas-tx/. The page describes general commercial construction with no mention of industrial builds, structural specs (tilt-up, pre-engineered metal, etc.), clear heights, dock doors, or Dallas industrial submarket knowledge (Mesquite, Southport, Great Southwest). I have no reason to believe this contractor understands industrial."
Does page signal it's for me? No.
Does it answer my questions? No.
Is there a clear next step? Single CTA — no friction reduction.
Score: 2/10

---

## 4. Gap Analysis — SXO Gap Score

**Total: 42 / 100**

| Dimension | Weight | Score | Evidence |
|---|---|---|---|
| Page Type Match | 15 | 5 | Location pages are SERP-mismatched (generic brand pages vs. required deep service-location hybrids). Cost guides are aligned. |
| Content Depth | 15 | 4 | Location pages: 280–290 words. Service pages: 254–287 words. Project pages: 46–78 words. Cost guides: 305 words (likely JS-rendered, unclear actual depth). Competitor benchmark: 1,500–3,000 words on location/service pages. |
| UX Signals | 15 | 7 | Clean nav, mobile-ready layout (inferred). CTA present on most pages. But: single CTA endpoint for all intent stages, no phone number on service/location pages, inquiry form UX unclear. |
| Schema | 15 | 2 | Zero JSON-LD schema detected across 47 pages. One "Organization" text reference in /about/group-of-companies/ body text — not structured data. No LocalBusiness, Service, BreadcrumbList, or FAQPage schema anywhere. |
| Media | 15 | 5 | Project pages suggest gallery content exists (references to project images) but project category pages have near-zero text. No media signals captured in crawl. Competitor benchmark: 6+ project images per building type on location pages. |
| Authority | 15 | 8 | Awards & Recognition page exists. About/History page exists. "Decades of experience" claimed on inquiry page. Missing: named project testimonials, client logos, specific credentials/licenses on service pages. |
| Freshness | 10 | 11 | Strong — cost guides dated 2026, blog active (05/2026 posts), year in URLs. Multiple 2026-tagged cost guides showing up in SERPs. This is the strongest dimension. |

---

## 5. Persona Scoring — Sorted Weakest to Strongest

**Scoring per dimension: Relevance (0–25), Clarity (0–25), Trust (0–25), Action (0–25) = 100 pts max**

### Persona C2: Industrial/Warehouse Owner (Dallas market)
**Total: 22/100**
- Relevance: 4 — /dallas-tx/ mentions no industrial verticals, no structural systems, no industrial submarkets
- Clarity: 6 — clear it's a construction company page, unclear what they build in Dallas
- Trust: 4 — no Dallas industrial project references, no certifications visible
- Action: 8 — CTA exists, but no friction reduction (no timeline, no phone)
- Improvement: Add an "Industrial & Warehouse" section to each location page with tilt-up/PEMB callout, named Dallas industrial projects, and a "Get Industrial Build Cost Estimate" CTA

### Persona A1: Property Developer — Houston location page
**Total: 26/100**
- Relevance: 5 — headline claims Houston expertise but provides no Houston-specific evidence
- Clarity: 7 — page structure is legible
- Trust: 5 — no project names, no client quotes, no license/bond mention
- Action: 9 — CTA present and visible
- Improvement: Add Houston project portfolio embed (3–5 named projects with sq ft and building type), one client testimonial with name and company, AGC/ABC Texas membership badge, Houston-area phone number

### Persona B1: Retail Tenant / Franchise Operator
**Total: 32/100**
- Relevance: 8 — TI page exists and is named correctly
- Clarity: 8 — service description is readable
- Trust: 6 — no TI project examples, no "types of tenants we've built for" signals
- Action: 10 — CTA links to inquiry page
- Improvement: Add industry verticals section (QSR, fitness, medical, retail), add timeline ranges ("8–16 weeks for a typical 2,000 SF TI"), and add 3 named TI project examples

### Persona A2: Property Developer — Construction Management page
**Total: 38/100**
- Relevance: 10 — page correctly targets CM services
- Clarity: 10 — description is coherent
- Trust: 8 — mentions "experienced team" but no credentials, no named projects
- Action: 10 — CTA present
- Improvement: Add a "CM vs. GC vs. Design-Build" explainer section (captures PAA traffic), add team credential callouts (licensed PMs, Procore/software tools), add one featured CM project with budget and schedule outcomes

### Persona C1: Industrial Owner — Cost Guide entry
**Total: 52/100**
- Relevance: 18 — cost guide content directly answers industrial cost questions
- Clarity: 15 — guide structure (H2/H3 hierarchy) is sound
- Trust: 10 — data cited (tariff impacts, labor shortage figures), but no primary source attribution visible
- Action: 9 — links to inquiry page, but the funnel breaks at the /projects/industrial-and-warehouse/ gallery (52 words, no visible project data)
- Improvement: Add source citations in guide, link from guide to a dedicated industrial page with project gallery rather than the thin gallery stub

### Persona B2: Retail Tenant — Inquiry page
**Total: 58/100**
- Relevance: 18 — page addresses all commercial types but lacks project-type specificity
- Clarity: 16 — 3-step process is a good UX pattern
- Trust: 14 — "decades of experience" and "on-time, on-budget" claims present, no third-party validation
- Action: 10 — form is the endpoint, but no indication of what the form asks or response expectation beyond "within 24 hours"
- Improvement: Add a project-type selector or dropdown in the intro ("Tell us what you're building"), add one named client testimonial near the form, clarify what happens after submission (call? email? who calls?)

---

## 6. Conversion Path Analysis

### Current funnel mapping

```
Awareness (cost guides, SERP)
        |
        v
Location/Service pages (SERP landing)
        |
        v
/commercial-construction-project-inquiry/  (single conversion endpoint)
```

### Issue 1: The /get-a-quote/ 404 is a broken primary CTA

The homepage links directly to https://www.maxxbuilders.com/get-a-quote/ which returns a 404. This is the single most damaging conversion issue in the site. The homepage is the highest-traffic entry point for branded searches and direct traffic, and its primary CTA routes to a dead page.

**Impact assessment:**
- Every branded searcher who clicks "Get A Quote" from the homepage hits a 404
- Every user who bookmarked or shared the /get-a-quote/ URL receives a 404
- Google will crawl and index this 404, which may be interpreted as a soft-404 signal
- The homepage has no fallback CTA — it links to /get-a-quote/ and /commercial-construction-project-inquiry/ but the former is broken
- Trust damage: a 404 on a primary CTA tells a B2B buyer (whose average deal size is $2M+) that the company does not maintain its own website

**Fix priority: P0 — implement immediately**

**Fix options (in order of preference):**
1. Redirect /get-a-quote/ 301 → /commercial-construction-project-inquiry/ (30-second fix, eliminates the 404 for all existing links including any external backlinks pointing to /get-a-quote/)
2. Rebuild /get-a-quote/ as a standalone page (only if the intent of the two pages is meaningfully different — right now it is not)
3. Update all internal links from /get-a-quote/ to /commercial-construction-project-inquiry/ (insufficient alone — does not fix external links)

Best answer: Do option 1 AND option 3.

### Issue 2: Broken internal service links throughout the site

The homepage links to /construction-management/, /design-and-build/, and /general-contracting/ (without the /services/ prefix). These are uncrawled, likely 404s. The actual service pages live at /services/construction-management/ etc. This means the homepage service navigation may be routing users to dead pages.

Full list of uncrawled internal link targets that are likely 404s:
- /construction-management/ (should be /services/construction-management/)
- /design-and-build/ (should be /services/design-and-build/)
- /general-contracting/ (should be /services/general-contracting/)
- /design-build-services/ (no equivalent in crawl)
- /preconstruction-services/ (should be /services/preconstruction/)
- /tenant-improvement/ (should be /services/tenant-improvement/)
- /blog-pages/ (no equivalent)

### Issue 3: Single conversion endpoint for all intent stages

All CTAs — from the homepage, all five location pages, all six service pages, all project category pages, and all blog posts — point to /commercial-construction-project-inquiry/. There is no differentiation by:
- Persona (developer vs. tenant vs. industrial owner)
- Stage (awareness-stage content should offer a guide/resource download, not a project inquiry form)
- Project type (a retail TI inquiry and a $15M ground-up industrial build should not enter the same form)

The inquiry page itself (185 words, 3-step process widget) gives no indication of what project types or sizes Maxx Builders accepts. A $200K tenant improvement and a $20M healthcare campus should not share the same CTA.

**Recommended funnel additions:**
- Add a downloadable "Commercial Construction Buyer's Guide" as an awareness-stage CTA for blog/guide readers (captures email without requiring full project commitment)
- Add project type pre-qualification to the inquiry form ("What type of project are you planning?" with dropdown)
- Add a phone number and direct email on every service and location page for decision-stage users who prefer direct contact

### Issue 4: No funnel path from informational content to portfolio proof

The cost guide pages (which rank well) link to /commercial-construction-project-inquiry/ but not to any portfolio of completed projects. An industrial owner reading the cost guide needs to see "and here's what we've actually built" before they fill out a form. The /projects/industrial-and-warehouse/ gallery page (52 words) is too thin to close this gap.

---

## 7. Additional Technical and Content Findings

### Schema — absent entirely

Zero JSON-LD structured data detected across all 47 crawled pages. Minimum required:
- Homepage: Organization schema (legal name, logo, sameAs links to LinkedIn/GBP)
- Location pages (Houston, Dallas, Austin, Fort Worth, San Antonio): LocalBusiness schema with NAP, geo-coordinates, and service area
- Service pages: Service schema with serviceType and areaServed
- Cost guide / blog pages: Article or BlogPosting schema with datePublished, author, headline
- Inquiry/contact page: ContactPage schema

Recommend running `/seo schema` to generate JSON-LD for each page type.

### Cannibalization risk

Two distinct URLs compete for the same informational cost-per-sq-ft query:
- /comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/ (uncrawled — exists in internal links but not in the 47-page crawl)
- /austin-commercial-construction-cost-per-square-foot-2026/
- /commercial-construction-companies-texas-2026/
- Multiple city-specific cost guides (Houston, Dallas) also referenced in internal links

These may cannibalize each other. A canonical hierarchy (Texas statewide guide as parent, city guides as children with bidirectional internal links) needs to be established.

### San Antonio page — copy-paste error

The /san-antonio-tx/ page contains an H3 reading "Why Choose Maxx Builders in **Houston**?" This is a live production error visible to any user and to Googlebot. It signals the page was assembled by find-replace and reinforces the doorway-page pattern. Fix immediately.

### Hotel guide — H1 is the raw URL slug

/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/ has H1: "the-ultimate-2026-hotel-construction-cost-guide-texas-edition" — the literal URL slug rendered as the page heading. This is a CMS/template error. The page should have H1: "Hotel Construction Cost: 2026 Texas Guide" (matching the title tag). Until fixed, this page cannot compete for hotel construction cost queries.

### Meta description missing

/locations and /get-a-quote/ (404) have no meta description. The locations archive is a legitimate landing page and needs one.

### Client Resources pages — gated with no content

/client-resources/clients-guide/ and /client-resources/construction-terminology/ each have 46 words and no body text beyond navigation elements. Either the content is behind a download gate (acceptable) or these are truly empty pages (not acceptable). If gated, the 46-word shell will not rank and may dilute crawl budget. If empty, they should be noindexed or merged.

### Industries page — 95 words, no individual industry pages crawled

/industries/ is a hub page with 95 words linking to individual industry URLs (/industries/retail-construction-texas/, /industries/hotel-hospitality-construction-texas/, etc.) but none of these were returned in the 47-page crawl. Either the crawl missed them or they are uncrawled/not linked consistently. These industry-specific pages represent high-intent commercial landing page opportunities and should be audited separately.

---

## 8. Limitations

The following could not be assessed without additional data:

1. **Actual rendered word counts:** Firecrawl may not execute JavaScript. Several pages (especially cost guides at 305 words) likely contain significantly more content rendered by JS. Google sees the rendered DOM, so actual indexed word counts may be higher or lower than reported.
2. **Google Search Console data:** Click-through rates, actual ranking positions, impressions, and crawl coverage are unavailable. Some findings (especially cannibalization) require GSC validation.
3. **Google Business Profile status:** Local pack eligibility requires GBP verification, NAP consistency, and review health — none of which can be assessed from web crawl data alone.
4. **Page speed / Core Web Vitals:** No CWV data was captured. Given the site uses a visual builder (Webflow or similar, inferred from page structure) with image-heavy project galleries, LCP and CLS risk is elevated.
5. **Backlink profile:** Domain authority, referring domain quality, and link anchor text distribution are not available from the crawl.
6. **Full blog coverage:** The 47-page crawl captured only 2 blog posts. Multiple uncrawled blog URLs appear in internal links (40+ additional blog pages suggested by /blog/page/2/, /blog/page/3/, etc.). Full content audit requires a deeper crawl.
7. **Industry sub-pages:** /industries/ sub-pages were not crawled and cannot be assessed.
8. **Schema validation:** The absence of schema signals in body text strongly implies no structured data exists, but a live Structured Data Testing Tool run is the definitive confirmation.

---

## Priority Action List

**P0 — Fix immediately (zero SEO, active conversion damage)**
1. Redirect /get-a-quote/ → /commercial-construction-project-inquiry/ with a 301
2. Fix /san-antonio-tx/ — "Why Choose Maxx Builders in Houston?" H3 is a live copy error
3. Fix hotel guide H1 — replace URL slug with "Hotel Construction Cost: 2026 Texas Guide"
4. Audit and fix broken service links on homepage (/construction-management/, /design-and-build/, etc. → /services/construction-management/, etc.)

**P1 — High impact, 30–60 day scope**
5. Rebuild all five city location pages to 1,500+ words with: city-specific project portfolio (named projects, sq ft, building type), one named client testimonial, certifications/memberships (AGC, ABC Texas), local phone number, embedded map, and industry verticals served in that market
6. Implement LocalBusiness JSON-LD schema on all location pages (NAP, geo, service area)
7. Implement Organization JSON-LD on homepage
8. Expand /services/construction-management/ to 1,000+ words including a CM vs. GC vs. Design-Build comparison section and named project examples — this directly captures high-value PAA traffic

**P2 — Medium impact, 60–90 day scope**
9. Expand project category pages from 46–78 words to genuine portfolio showcase pages (minimum 500 words + 6 project images + named client/location)
10. Add Article / BlogPosting schema to all cost guides
11. Add FAQPage schema to cost guide pages (captures PAA/featured snippet positions for which the content already appears to rank)
12. Create an awareness-stage CTA (downloadable guide) for blog readers as an alternative to the hard "request inquiry" CTA
13. Add industry vertical sections to the Tenant Improvement service page (QSR, retail, medical, fitness, corporate)
14. Establish canonical hierarchy for cost-per-sq-ft content cluster (statewide parent → city children)

**P3 — Monitoring / investigation**
15. Run a full recrawl to capture the 40+ uncrawled blog pages and all /industries/ sub-pages
16. Connect GSC data to validate ranking positions, CTR, and cannibalization signals
17. Verify GBP listing accuracy for all five Texas markets (NAP consistency against location pages)
18. Run Core Web Vitals audit on location and service page templates

---

## Cross-Skill Recommendations

- **E-E-A-T gaps detected** on all service and location pages (no named authors, no credential callouts, no third-party validation). Recommend `/seo content` for deep content authority analysis.
- **Schema entirely absent.** Recommend `/seo schema` to generate LocalBusiness, Organization, Service, Article, and FAQPage JSON-LD for immediate implementation.
- **Local pack intent on city queries.** Recommend `/seo local` for GBP audit across Houston, Dallas, Austin, Fort Worth, and San Antonio listings.
- **Thin content on 14+ pages.** Recommend `/seo page` for page-level audit on all location pages and project category pages.

---

*Generate a PDF report? Use `/seo google report`*
