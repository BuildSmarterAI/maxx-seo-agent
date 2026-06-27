# Content Quality SEO Audit — Maxx Builders (maxxbuilders.com)
**Audit date:** 2026-06-24  
**Pages crawled:** 47  
**Auditor standard:** Google Quality Rater Guidelines, September 2025  
**Platform:** WordPress  

---

## Summary Scores

| Dimension | Score | Notes |
|-----------|-------|-------|
| Overall Content Quality | 31 / 100 | Site-wide thin content is the primary drag |
| E-E-A-T (composite) | 28 / 100 | No named authors, founding year conflict, vague credentials |
| AI Citation Readiness | 42 / 100 | Blog posts have structure; service/location pages have none |
| Thin Content Risk | Critical | 37 of 47 pages fall below their page-type minimum |

---

## Critical Data Note: Crawl Word Count Interpretation

The Firecrawl export truncates `bodyText` at 2,000 characters and the `wordCount` field reflects only that captured excerpt — not the full on-page word count. This is most visible on the three blog posts, where 9–12 H2 sections are present but the reported `wordCount` is 267–305. True word counts for those posts are likely 2,000–4,000+ words based on heading depth. **All thin-content flags below apply the Firecrawl `wordCount` as a floor, but the blog posts must be re-counted against the live DOM before acting on their word-count findings.**

All other findings (E-E-A-T signals, structure, duplicate text, metadata errors) are directly observable from the crawl data and are reliable.

---

## E-E-A-T Breakdown

| Factor | Score | Weight | Findings |
|--------|-------|--------|----------|
| Experience | 18 / 100 | 20% | Three hotel portfolio projects named with sq-ft specifics on the hotel guide. Project gallery names exist but zero project-level detail: no dates, no sq ft, no client quotes, no photos with captions in crawlable text. |
| Expertise | 30 / 100 | 25% | Founders Harris Khan and Hira Khan named only on `/about/our-history/`. No professional titles, licenses (GC license number, NASCLA, AGC membership ID), or named project managers appear anywhere. Service pages use general marketing language, not technical depth. |
| Authoritativeness | 38 / 100 | 25% | Inc. 5000 recognition (2017) is documented on `/press-release/` with links to PR Newswire and PR Web — this is a genuine authority signal. AGC of America membership listed. Four press releases linked. No third-party citations or case studies with verifiable outcomes. |
| Trustworthiness | 32 / 100 | 30% | Phone and email in header/footer across all pages is positive. Physical address not visible in crawled text. Privacy policy and T&C exist. **Critical issue: founding year is stated as 2005 on `/about/` and `/press-release/`, but as 2008 on `/about/our-history/`.** This is a direct trust signal failure — QRGs specifically flag factual inconsistency as evidence of low trustworthiness. No GC license number displayed. No BBB or state licensing link. |

**Composite E-E-A-T: 28/100**

The primary drag is universal: no named author bylines on any page, no professional credentials attached to any individual, and zero client testimonials with attribution in crawlable text. The Inc. 5000 award and named portfolio clients (Home2Suites by Hilton, Heartland Dental, Anytime Fitness) are the strongest authority signals on the site and are under-leveraged everywhere except the hotel guide.

---

## Thin Content Analysis by Page Type

### Critical — Below 100 Words (Navigation/Gallery Shells)

These pages contain only a headline, a list of project names, and a CTA. They provide no topical value and are indexable doorway-grade content in their current state.

| URL | Word Count | Page Type | Minimum |
|-----|-----------|-----------|---------|
| /projects/car-wash/ | 46 | Portfolio category | 500 |
| /client-resources/clients-guide/ | 46 | Resource page | 500 |
| /client-resources/construction-terminology/ | 46 | Resource page | 500 |
| /projects/corporate-interiors/ | 47 | Portfolio category | 500 |
| /projects/multi-family-and-mixed-use/ | 50 | Portfolio category | 500 |
| /projects/healthcare-facilities/ | 50 | Portfolio category | 500 |
| /projects/industrial-and-warehouse/ | 52 | Portfolio category | 500 |
| /projects/restaurants/ | 54 | Portfolio category | 500 |
| /projects/tenant-improvements/ | 57 | Portfolio category | 500 |
| /projects/hospitality-entertainment/ | 61 | Portfolio category | 500 |
| /projects/fuel-stations/ | 72 | Portfolio category | 500 |
| /projects/retail-shopping-centers/ | 78 | Portfolio category | 500 |
| /industries/ | 95 | Hub page | 500 |
| /about/group-of-companies/ | 105 | About sub-page | 300 |

**Recommendation:** Portfolio category pages (/projects/\*) are the highest-priority fix. Each represents a high-commercial-intent vertical (healthcare, restaurant, retail) where competitors run 800–1,500 word industry-specific pages. Either expand each to a genuine industry landing page or consolidate them under `/industries/` with proper redirects and add the editorial depth there.

### High — Below Service-Page Minimum (250–300 Words Reported, True Count Likely 250–500)

All six service pages and all five location pages fall in the 254–290 word range in the crawl. Given the 2,000-char bodyText truncation, true word counts may be slightly higher — but the heading structure (one H2, two H3s on most) confirms these are short pages regardless.

| URL | Reported WC | Severity |
|-----|------------|----------|
| /services/construction-management/ | 254 | High |
| /services/tenant-improvement/ | 260 | High |
| /services/preconstruction/ | 262 | High |
| /services/architectural-design-and-engineering/ | 263 | High |
| /services/ | 264 | High |
| /services/general-contracting/ | 267 | High |
| /services/design-and-build/ | 287 | High |
| /houston-commercial-contractors/ | 286 | High |
| /austin-tx/ | 286 | High |
| /dallas-tx/ | 280 | High |
| /fort-worth-tx/ | 287 | High |
| /san-antonio-tx/ | 290 | High |

**Recommendation:** Service pages need to reach 800+ words of topical coverage: process steps, what to expect, how Maxx handles subcontractor coordination in Texas, typical timelines, and at least one named project example per service. Location pages need city-specific market data, project examples from that metro, and local permitting context — not generic "we love Austin" prose.

### Medium — Homepage, About, and Blog Hub

| URL | Reported WC | Issue |
|-----|------------|-------|
| / (Homepage) | 270 | Below 500-word homepage minimum; relies on visual content |
| /about/ | 298 | Core YMYL-adjacent page; needs founder bios |
| /blog/ | 248 | Blog index page; mostly auto-generated listing |

---

## Duplicate and Near-Duplicate Content

### Location Pages — Template Clone (High)

All five location pages share the identical template structure:
- H2: "Experience/Discover the Maxx Builders Difference in [City]"
- H3: "Why Choose Maxx Builders in [City]?" + "Ready to Get Started?"
- Body text uses city-swapped variants of the same four-paragraph pattern: local expertise, collaboration, customized solutions, quality

The **San Antonio page** has a broken template — its H3 reads "Why Choose Maxx Builders in Houston?" (copy-paste error). This is a direct trust signal failure and needs an immediate fix.

Content overlap is high enough that Google may treat these as near-duplicates. Each page needs genuinely differentiated content: San Antonio gets different content than Houston because the permitting environment (City of San Antonio Development Services vs. City of Houston permitting), subcontractor labor pool, and project mix differ materially. Document those differences.

### Service Pages — Structural Repetition (Medium)

All six service pages follow the same prose cadence: "At Maxx Builders, we believe in [principle]... Our [team/experts] [verb] your [project/vision]..." The construction management and design+build pages share near-identical paragraphs about collaboration, communication, and quality. While the topic headings differ, the generic marketing prose is structurally repetitive in a way a quality rater would identify as low-effort content.

### Portfolio Category Pages — True Duplicates (High)

Every portfolio category page (/projects/restaurants/, /projects/healthcare-facilities/, etc.) contains only the site header, the category name, a list of project names as H3s, and the CTA footer. They are functionally identical shells with only the category name changed. There is zero differentiating editorial content. These are the clearest thin-content doorway risk on the site.

---

## Specific Page Flags by Severity

### CRITICAL

**`/about/our-history/` — Founding Year Conflict**  
States "Established in 2008." The `/about/` page states "Founded in 2005." The `/press-release/` page states "Since 2005." This factual contradiction appears on a page explicitly about company history. A quality rater checking basic facts will flag this immediately. Fix: align to one founding year across all pages and update accordingly.

**`/san-antonio-tx/` — Wrong City in H3**  
H3 reads "Why Choose Maxx Builders in Houston?" on the San Antonio location page. This is a copy-paste error that visually signals low editorial care to both users and quality raters.

**`/get-a-quote/` — 404 with No Canonical**  
This URL (25 words, "Page not found") is linked from the homepage hero CTA and multiple pages. It has no canonical tag and returns what appears to be an error state. A primary conversion path is broken.

**`/projects/car-wash/` through all portfolio category pages — Indexable Shell Pages**  
Ten portfolio category pages have fewer than 80 words of editorial content. They are discoverable, indexable, and offer no topical value beyond a list of project names. At a minimum, these should be noindexed pending expansion or consolidation.

### HIGH

**All five location pages — Thin + Near-Duplicate**  
286–290 words, identical structure, city-swapped prose. No city-specific project data, no permitting context, no local subcontractor network information, no local market pricing. These pages compete on terms like "Houston commercial contractors" and "Austin commercial construction" but provide no market-specific signal to justify ranking.

**All six service pages — Below Minimum + Generic Prose**  
254–287 words. Missing: process specifics, typical project timelines, how subcontractor management works in Texas, what a client actually experiences during each phase. The construction management page has four section headings but the body under each is a generic paragraph that could apply to any GC in any state.

**`/industries/` hub — 95 Words**  
This is the only industries hub page in the crawl and links to five industry sub-pages. Those sub-pages (retail, hotel, healthcare, etc.) do not appear in the 47-page crawl, suggesting either they are not yet published or were not crawled. At 95 words, the hub itself is non-functional as a topical authority signal.

**`/about/awards-and-recognition/` — Vague Award Descriptions**  
307 words. The page references "multiple industry awards" but the award descriptions are anonymized placeholders: "Recognized for our innovative use of sustainable materials," "Lauded for our exceptional project management." No award names, no awarding organizations, no years. The Inc. 5000 recognition is the only specific award on the site, and it's on the press release page, not here. Either list real awards with specifics or remove the placeholder text.

**`/` (Homepage) — Below Minimum, No E-E-A-T Anchors**  
270 words. The homepage hero and service sections rely on visual elements (sliders, image grids) that produce no crawlable text. No social proof, no named project stats, no founder statement is visible in the crawled body text. Homepage should carry the primary E-E-A-T load for the domain.

### MEDIUM

**`/about/` — No Founder Bios**  
298 words. Harris Khan and Hira Khan are named only on the history page. The about page — which is the logical place for E-E-A-T demonstration — lacks named people, credentials, or a founder statement. The "skilled workforce" reference is generic. Add headshots, named bios, and professional backgrounds here.

**`/client-resources/` (hub and sub-pages) — Empty Resource Shells**  
The Client Resources hub (157 words), Clients Guide (46 words), and Construction Terminology (46 words) are empty content shells. The Clients Guide links to one car wash guide. These pages were presumably built to demonstrate expertise but contain nothing. Either publish the actual content or noindex.

**`/press-release/` — Underdeveloped Authority Page**  
245 words. This page has genuine authority signals (Inc. 5000, PR Newswire, 24-7 Press Release links) but they are presented as four brief entries without dates on most entries. Press release pages can carry strong authoritativeness signals for QRGs — invest in making this page complete with dates, project details, and links.

**`/blog/` index — Author Attribution Gap**  
The blog index shows three authors across posts: `harrismaxxbuilders-com` and `master`. The "master" author byline on the hotel guide is a WordPress default indicating no real author profile was set up. All posts should be attributed to a named, credentialed author with a bio page.

### LOW

**`/join-our-team/vendors/` and `/join-our-team/subcontractors/` — Thin Utility Pages**  
195 and 208 words respectively. These pages serve a functional purpose (vendor application, SmartBidNet login) so thin content is partially justified. However, no descriptive content about what types of subcontractors/vendors Maxx works with, trade categories, or geographic coverage exists. A 300-word expansion would cover the topic adequately.

**`/locations` — Missing Meta Description**  
The locations hub has no meta description in the crawl. The page itself (280 words) consists largely of Texas county names from what appears to be an SVG map element — those county names are crawlable text but are not editorial content.

---

## Blog Post Deep Evaluation

### Important Caveat
All three blog posts show reported word counts of 267–305 in the Firecrawl export, but this is an artifact of the 2,000-character `bodyText` truncation. The H2 heading count (9–12 per post) and the H3 FAQ structures confirm these are substantially longer articles. True word counts should be verified against the live pages before any editorial decisions. The structural and E-E-A-T analysis below is based on what is observable in the crawl.

---

### `austin-commercial-construction-cost-per-square-foot-2026` — Best Page on Site

**What works:**
- Opens with a direct, specific claim: 50% tariffs on steel/aluminum, ~500,000 worker shortage, 6–12 week Austin permitting timeline. These are quotable, citable facts — exactly what AI overviews pull.
- Data table with building type cost ranges (warehouse $145–$235/sqft through restaurant $300–$700/sqft) is structured, specific, and differentiated by building type.
- H2 structure covers the full query intent: baseline costs, Texas market comparison, full project budget, FAQ, and a CTA.
- Five FAQ H3s directly target common question formats: "How much does commercial construction cost per square foot in Austin?" — this is textbook FAQ Schema territory.
- Mentions Austin's 6–12 week permitting environment as a first-hand operational insight — a real Experience signal.

**What's missing:**
- No named author or byline. A cost guide without a credentialed author (a licensed GC, a project manager with 10+ years Texas experience) is an E-E-A-T gap.
- No specific Austin projects cited with completed costs or client names. The hotel guide does this; the Austin cost guide should too.
- The data sources for the cost ranges are not attributed. Citing Dodge, RSMeans, or actual subcontractor bids would dramatically improve trustworthiness.
- The "Frequently Asked Questions" section appears in H2 but is not marked up with FAQ Schema (this cannot be confirmed from the crawl but should be verified in the live page source).

**AI Citation Readiness: 68/100** — Strong structure, specific data, FAQ format. Gaps: no source citations, no author authority.

---

### `commercial-construction-companies-texas-2026` — Solid Framework, Needs Depth

**What works:**
- Answer-first opening paragraph establishes context immediately (Texas ranks top for nonresidential construction, cites AGC of America and Dodge Construction Network).
- H2 structure is logically organized: what GCs do → delivery model types → Texas costs → city-by-city → how to choose → Maxx Builders position → FAQ.
- Delivery model section (GC lump sum, CMAR, design-build, agency CM) demonstrates genuine technical knowledge.
- Six FAQ H3s target high-volume comparison queries.

**What's missing:**
- Same author gap as the Austin post.
- The Texas cost section (H2: "Commercial Construction Costs in Texas (2026)") and city-by-city section likely contain pricing tables — these are the most AI-citable elements and should be verified to include specific data.
- The guide positions Maxx Builders in the How to Choose section, but without specific differentiators backed by data (project count, on-time delivery rate, licensed GC number) this section reads as a generic pitch.

**AI Citation Readiness: 55/100** — Good outline, credible sources cited in intro. Missing: author authority, verifiable differentiators.

---

### `the-ultimate-2026-hotel-construction-cost-guide-texas-edition` — Strongest E-E-A-T, Weakest Execution Signal

**What works:**
- Opens with a real project experience block naming three actual hotel projects: Home2Suites by Hilton in Richmond (90,500 sq ft), Comfort Suites in Pasadena, Holiday Inn Express in Pflugerville (114,700 sq ft). This is the only first-hand Experience signal in the entire 47-page crawl — and it's a strong one.
- H2 structure is the most granular of the three posts: 9 numbered sections including cost-per-key vs. cost-per-SF metrics, amenity multipliers, CSI division breakdown, city-by-city differences, and a 100-key pro forma example. This is comprehensive topical coverage for a high-intent hospitality development query.
- Five FAQ H3s targeting specific hotel cost questions.
- City-by-city cost differentials (Houston +5–8%, Austin +8–12%, DFW baseline, San Antonio -5%) are the kind of specific, quotable numbers AI overviews cite.

**Critical issues:**
- The H1 is the URL slug: "the-ultimate-2026-hotel-construction-cost-guide-texas-edition". This is a publishing error — the H1 should be the article title. This is the most important on-page SEO tag and it reads as raw data.
- The author byline uses "master" — the WordPress default admin username. This is a direct quality signal failure. A cost guide of this depth attributed to "master" with no bio is a trust failure.
- The blog index entry includes this in the visible text: "Author: [HUMAN EDIT REQUIRED — insert real, credentialed author name + title]" — a production placeholder leaked into the published content. This must be fixed immediately.

**AI Citation Readiness: 58/100** — First-hand project data and specific cost differentials are excellent citation material. H1 error and author placeholder undercut the authority signals.

---

## Portfolio Pages Assessment

The portfolio category pages (/projects/retail-shopping-centers/, /projects/healthcare-facilities/, etc.) are navigation shells, not content pages. They contain:
- A headline (the category name)
- A list of project names as H3 links
- The CTA footer

What they do not contain: square footage, project year, scope, client name, location within Texas, delivery method, challenges overcome, or any differentiating information. A quality rater would categorize these as having "no original content" — they exist solely to link to portfolio items.

The `/projects/` index page (220 words) lists 37 project names across categories. It demonstrates that Maxx has a wide project history but provides no depth on any individual project.

**For E-E-A-T purposes:** Portfolio pages are the highest-leverage E-E-A-T investment available to this site. Each named project (Home2Suites, Heartland Dental, King Spa, Anytime Fitness, Shoe Palace) is a real credential. Adding 200–300 words per portfolio item — client name, city, square footage, delivery method, timeline, one challenge solved — would create genuine Experience signals across dozens of pages.

---

## AI Citation Readiness: Overall Assessment

**Score: 42/100**

The site is partially positioned for AI citation on the blog posts but almost entirely uncitable for the service and location pages.

**What earns AI citations:**
- Specific cost ranges in tables (Austin post, hotel guide)
- Named city-by-city cost differentials (hotel guide)
- First-hand project experience blocks with real project specs (hotel guide opener)
- FAQ H3s with question-format headings (all three blog posts)
- Named external organizations as authority backing (AGC, Dodge, Inc. 5000)

**What blocks AI citations:**
- No named expert author on any page
- Service pages use generic marketing prose — zero quotable facts
- Location pages have no market-specific data
- Homepage has no structured data visible in crawled text
- No TL;DR summary blocks anywhere on the site (the hotel guide intro comes close but is not formatted as a distinct summary)
- No comparison tables on service or location pages

**Priority fixes for AI citation readiness:**
1. Add a named author bio with credentials to all three blog posts
2. Add a "Quick Answer" / TL;DR box at the top of each blog post (150 words max, answer the primary query directly)
3. Publish an Organization schema block with founded date, named founders, Inc. 5000 recognition, and GC license number
4. Add LocalBusiness schema to each location page with NAP, service radius, and area served

---

## Strongest Content on the Site

**#1 — Hotel Construction Cost Guide**  
Reason: Only page with first-hand project experience, most granular H2 structure, city-by-city cost data, real project names with square footage. Despite the H1 and author errors, this is the most citeable and most editorially serious piece on the site.

**#2 — Austin Commercial Construction Cost Per Square Foot (2026)**  
Reason: Opens with specific market drivers (tariffs, labor shortage, permitting timelines), contains a multi-row cost table by building type, and has five question-format FAQs. If the live page includes the full article text and the Firecrawl truncation is confirmed, this is likely the second-deepest post.

**#3 — Commercial Construction Companies Texas 2026**  
Reason: Covers the decision-making framework a buyer uses when selecting a GC, cites credible external sources, and addresses delivery model differences (a genuinely technical topic). The structure mirrors what Google's own quality raters look for in "how to choose" guides.

**#4 — Press Release page**  
Reason: Unique among commercial contractor sites for documenting real press coverage with outbound links to PR Newswire and PR Web. The Inc. 5000 2017 recognition is a strong third-party authority signal. This page is under-used as an E-E-A-T asset.

---

## Top-Priority Fixes (Ordered by Impact)

1. **Fix the founding year conflict** — `/about/` says 2005, `/about/our-history/` says 2008, `/press-release/` says 2005. Align all three to one accurate year. This is a trust signal failure on an E-E-A-T evaluation.

2. **Fix the San Antonio H3 copy error** — `/san-antonio-tx/` H3 reads "Why Choose Maxx Builders in Houston?" — a direct quality signal failure visible to quality raters and users alike.

3. **Fix the hotel guide H1** — Currently the URL slug, not a human-readable title. Should be "Hotel Construction Cost Guide: Texas 2026 Edition" or similar.

4. **Remove the author placeholder from the hotel guide** — "Author: [HUMAN EDIT REQUIRED]" is live in the published content per the blog index crawl.

5. **Fix /get-a-quote/ 404** — This is a primary CTA destination linked from the homepage and multiple pages.

6. **Add named author bylines with bio pages** — Harris Khan (or the appropriate team member) should be the declared author on all blog posts with a bio page listing professional background, years in Texas commercial construction, and license/credential information.

7. **Expand or consolidate portfolio category pages** — Either add 400+ words of industry-specific content to each /projects/\*/ page (making them real industry landing pages) or consolidate them into the /industries/ hub, redirect the /projects/\*/ URLs, and build out /industries/ properly.

8. **Add Organization + LocalBusiness schema** — Homepage needs Organization schema with founder names, founded date, sameAs links (LinkedIn, GBP, AGC profile). Each location page needs LocalBusiness schema with matching NAP.

9. **Add a physical address** — No street address appears in the crawled body text of any page. This is a trust signal gap for a commercial contractor and a local SEO gap for the location pages.

10. **Expand all five location pages to 600+ words with city-specific content** — Replace the four-paragraph generic template with: metro-specific project examples, local permitting context (Houston vs. Austin vs. Dallas processing times differ), and local market pricing context that references the blog posts.

---

## Metadata Issues

| URL | Issue | Severity |
|-----|-------|----------|
| / | Title is 61 chars (at limit) | Low |
| /locations | Missing meta description | High |
| /get-a-quote/ | Missing canonical, missing meta, 404 state | Critical |
| Blog posts | Crawl-visible title on hotel guide is the slug, not the article title | High |

---

*Findings based on Firecrawl crawl export (47 pages). Body text truncated at 2,000 characters per page in the export; word counts for pages with rich content (blog posts) should be re-measured against live DOM before editorial decisions.*
