# Maxx Builders LLM AI SEO Audit

Audit date: 2026-06-25  
Site: https://www.maxxbuilders.com  
Scope: read-only GEO / LLM AI search audit for Google AI Overviews / AI Mode, ChatGPT Search, Perplexity-style answer engines, Bing/Copilot discovery, and agentic search.

## Executive Verdict

**Conditional go.** Maxx Builders is technically crawlable for the major search and AI retrieval crawlers checked, and the priority pages are mostly indexable, canonical HTML pages with visible text, tables, and JSON-LD. That is enough to be eligible for AI-search retrieval surfaces.

It is **not yet AI-citation-ready at the level it should be** for commercial construction queries. The blockers are not hacks or missing AI markup. They are conventional SEO and trust gaps: generic authorship, weak answer-first formatting on several money pages, missing or weak visible project proof on most cost pages, duplicate H1s, two URL/sitemap canonical mismatches, thin internal links, and unverified CWV because PageSpeed Insights returned HTTP 429 during this audit.

Confirmed source constraints:

- Project context says Maxx Builders is a Texas commercial general contractor / construction management company, primary markets are Houston, Dallas, and Austin metro, authors must be real named experts, and proof points include Home2Suites Richmond TX, Comfort Suites Pasadena TX, and Holiday Inn Express Pflugerville TX: `C:\dev\maxx-seo-agent\AGENTS.md`.
- Priority URL set is from `config/urls.txt`.
- No `crawl/` directory was present in either `C:\dev\maxx-seo-agent` or the isolated worktree `C:\dev\maxx-seo-agent-geo-audit`, so Screaming Frog/Sitebulb/Firecrawl crawl columns were unavailable.
- Google's current AI guidance says AI Overviews / AI Mode use normal Search fundamentals: indexed pages, snippet eligibility, crawlability, helpful content, clear structure, good page experience, and no special AI-only markup requirement. Source: https://developers.google.com/search/docs/appearance/ai-features and https://developers.google.com/search/docs/fundamentals/ai-optimization-guide.
- OpenAI documents OAI-SearchBot for ChatGPT Search visibility separately from GPTBot training access. Source: https://developers.openai.com/api/docs/bots.

## Highest-Impact Fixes

1. **Replace generic authorship with real named Maxx experts.** Impact: very high. Effort: medium. Most Article JSON-LD uses `Maxx Builders` as author; only the redirected design-build page exposed `Harris Khan`. This conflicts with the project rule that authors must be real named construction experts, not generic team/byline labels.
2. **Add answer-first blocks to high-value pages that lack them.** Impact: very high. Effort: low to medium. The hotel cost, Houston cost, car wash cost, retail rankings, restaurant pages, timeline page, planning guide, homepage, and obstacles page lack a detected TL;DR / answer-first block.
3. **Add visible project evidence to money pages.** Impact: very high. Effort: medium. Hotel and mock-up pages contain the strongest proof. Medical office, warehouse, Houston cost, Dallas cost, car wash, design-build, retail ranking, restaurant, and timeline pages need proof tied to real Maxx experience or explicit "not a direct project case study" caveats.
4. **Fix URL/sitemap/canonical mismatches.** Impact: high. Effort: low. The warehouse URL in `config/urls.txt` redirects to `/cost-per-square-foot-build-warehouse-texas/`; the design-build URL redirects to `/design-build-construction-houston-2/` and had no meta description. Sitemaps include the final warehouse URL, not the old one; the original design-build URL was not found in the sitemap crawl.
5. **Clean H1/template defects.** Impact: high. Effort: low. Medical office, warehouse, and mock-up pages have duplicate H1s; mock-up also has a slug-like H1 and missing meta description.
6. **Build internal link clusters from proof-rich pages to money pages.** Impact: high. Effort: medium. The homepage linked to none of the priority URLs in fetched HTML; most money pages link only to `/`. Add contextual links among hotel, hospitality mock-up, design-build, cost, timeline, planning, and market pages.
7. **Verify CWV with real field/lab data outside this run.** Impact: high. Effort: low to medium. PSI API returned 429 for sampled URLs. HTML risk is still visible: 80+ scripts on many pages, 25 images on typical article pages, 113 images and 94 scripts on the homepage.
8. **Implement IndexNow after content edits are approved.** Impact: medium. Effort: low. `/indexnow.txt`, `/IndexNow.txt`, and `/indexnow.xml` returned 404. Bing says IndexNow notifies search engines of changed URLs but does not guarantee crawling or indexing: https://www.bing.com/indexnow/getstarted.

## Which Agent Should Improve This

- **GEO / AI Search Audit Agent for diagnosis:** own follow-up measurement, query-to-page mapping, AI citation eligibility scoring, and post-fix validation.
- **Content Brief Generator for answer-first rewrites:** rewrite briefs for TL;DR, comparison tables, project proof placement, and non-commodity expert sections.
- **Schema Generator for JSON-LD fixes:** replace generic Article authors, validate FAQ schema against visible FAQ content, and keep Organization schema to homepage-level usage where appropriate.
- **Internal Linking Agent for topical authority:** build links between cost, design-build, hospitality, project timeline, and market pages using natural anchor text.
- **CWV Audit Agent for template speed issues:** run PSI/Lighthouse/CrUX and inspect WordPress template/plugin bloat. Fix template-level TTFB, LCP, INP, and CLS issues.
- **WordPress Apply Agent only after a reviewed manifest exists:** apply approved titles, descriptions, bylines, schema, content blocks, and redirects through REST/WP-CLI. Do not live-publish without a manifest.

## Priority Page Matrix

| URL | Intent | Current Risk | AI Citation Potential | Required Fix | Evidence |
| --- | --- | --- | --- | --- | --- |
| https://www.maxxbuilders.com/ | Brand / entity / service trust | Medium | Medium | Add links to priority money pages, add concise service-area proof, keep Organization/GeneralContractor schema clean. | 200, canonical self, title 66 chars, 1 H1, no TL;DR, no FAQ, no priority URL links detected, 113 images, 94 scripts. |
| https://www.maxxbuilders.com/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/ | Hotel construction cost Texas | Medium | High | Add answer-first H2/TL;DR above "Introduction"; replace generic author; expand project proof as cited case evidence. | 200, self-canonical, title 42, desc 143, 1 H1, FAQPage, 1 table, proof hits include Home2Suites, Richmond, Comfort Suites, Pasadena, Holiday Inn Express, Pflugerville, 90,500, 114,700. |
| https://www.maxxbuilders.com/medical-office-construction-costs-texas-2026-comprehensive-guide/ | Medical office construction cost Texas | High | High | Remove duplicate slug H1, add named expert author, add visible healthcare proof or state evidence limitation, add links to planning/timeline/design-build. | 200, self-canonical, 2 H1s including slug H1, title 44, desc 127, Key Takeaways, 13 tables, no project proof hits, author `Maxx Builders`. |
| https://www.maxxbuilders.com/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/ | Warehouse construction cost TX | High | High | Update priority URL to final canonical slug, remove duplicate H1, strengthen Texas warehouse proof, add internal links. | Requested URL 200 after redirect to `/cost-per-square-foot-build-warehouse-texas/`; canonical is final slug; original URL not in sitemap; final page has 2 H1s, 9 tables, no project proof hits. |
| https://www.maxxbuilders.com/commercial-construction-cost-houston-tx/ | Commercial construction cost Houston | High | High | Add answer-first cost summary, add Houston-specific project proof, remove sidebar noise from early content if template allows, add named author. | 200, self-canonical, title 55, desc 146, 1 H1, no TL;DR, 2 tables, no project proof hits, H2 list quickly reaches Search/Categories/Latest Posts. |
| https://www.maxxbuilders.com/dallas-commercial-construction-costs-2025-2026/ | Commercial construction cost Dallas | Medium | High | Add stronger answer-first block and Dallas proof, tighten internal links to hotel/warehouse/planning pages, named author. | 200, title 56, desc 153 near threshold, 1 H1, TL;DR detected, 3 tables, no project proof hits, author `Maxx Builders`. |
| https://www.maxxbuilders.com/cost-to-build-a-car-wash-in-texas/ | Car wash construction cost TX | Medium | Medium-High | Add top TL;DR, add proof/caveat, add table comparing car wash type, site/civil, utilities, MEP/equipment, and entitlement risks. | 200, title 56, desc 144, 1 H1, no TL;DR detected, FAQ present, 2 tables, no proof hits. |
| https://www.maxxbuilders.com/design-build-construction-houston/ | Design-build Houston service | High | High | Fix source URL to final slug or redirect/canonical strategy, add meta description, ensure sitemap includes final page, keep Harris Khan author if verified. | Requested URL redirects to `/design-build-construction-houston-2/`; final canonical same; meta description 0; final page has Key Takeaways, FAQ, 3 tables, author Harris Khan; original URL not found in sitemap check. |
| https://www.maxxbuilders.com/best-retail-construction-contractors-in-houston-2026-rankings/ | Retail contractor rankings Houston | High | Medium | Add transparent ranking methodology, proof of Maxx retail work, comparison table, and conflict-of-interest statement. | 200, title 51, desc 147, no TL;DR, no tables, FAQ present, no proof hits, ranks Maxx #1. |
| https://www.maxxbuilders.com/8-key-considerations-for-building-a-restaurant/ | Restaurant construction planning | High | Medium | Decide primary role vs cost-efficiency page; add answer-first block and canonical internal link target; avoid creating a third restaurant page. | 200, title 55, desc 140, no TL;DR, no FAQ, no tables, links to cost-efficient restaurant page; AGENTS flags restaurant cannibalization risk. |
| https://www.maxxbuilders.com/cost-efficient-strategies-restaurant-construction/ | Restaurant construction cost strategy | High | Medium | Merge or differentiate from restaurant considerations page; add cost answer block, table, FAQ, and named proof. | 200, title 55, desc 135, no TL;DR, no FAQ, no tables, no proof hits, only priority link was homepage. |
| https://www.maxxbuilders.com/commercial-construction-project-timelines/ | Commercial construction timeline | Medium | Medium | Add short-answer timeline table near top and link to planning, design-build, Houston/Dallas cost pages. | 200, title 56, desc 124, no TL;DR, FAQ present, 1 table, no proof hits. |
| https://www.maxxbuilders.com/complete-guide-commercial-building-planning-execution/ | Commercial building planning guide | Medium | Medium | Add TL;DR, table of owner decisions by phase, and contextual links to cost/timeline/design-build pages. | 200, title 50, desc 141, no TL;DR, FAQ detected, proof hits for three named hospitality projects, no tables. |
| https://www.maxxbuilders.com/importance-of-mock-up-rooms-in-the-hospitality-industry/ | Hospitality mock-up rooms | High | High | Fix title/meta/H1; keep answer-first structure and proof; add Article author as real named hospitality expert. | 200, title 71, desc 0, 2 H1s including slug H1, Answer-First Intro and Key Takeaways, 1 table, strong project proof. |
| https://www.maxxbuilders.com/3-most-common-obstacles-in-commercial-construction-projects/ | Commercial construction obstacles | Medium | Low-Medium | Replace weak meta description, add answer-first problem/solution block, add table of risk, owner signal, mitigation, proof. | 200, title 50, desc `blueprints` length 10, no TL;DR, no FAQ, no tables, project proof hits for three hospitality projects. |

## AI Crawler Access

Confirmed from live https://www.maxxbuilders.com/robots.txt on 2026-06-25:

```txt
User-agent: *
Disallow:

Sitemap: https://www.maxxbuilders.com/sitemap_index.xml
```

Allowed by robots fallback:

- Googlebot: allowed.
- Bingbot: allowed.
- OAI-SearchBot: allowed.
- GPTBot: allowed.
- ChatGPT-User: allowed.
- PerplexityBot: allowed.
- ClaudeBot: allowed.
- Claude-SearchBot: allowed by fallback, checked because it is search-relevant even though the requested list only named ClaudeBot.

Blocked:

- None of the checked agents were blocked at `/` by robots.txt.

Unknown / needs log verification:

- Whether each crawler actually fetches and indexes these pages. Robots allowance is permission, not proof of crawl/index inclusion.
- Whether any firewall, CDN, WordPress security plugin, or bot protection blocks requests by IP even though robots allows them.
- Whether ChatGPT, Perplexity, Claude, or Bing currently cite these pages for target queries.

How to verify next:

- Check server/CDN logs for `Googlebot`, `Bingbot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, and `Claude-SearchBot`.
- Verify bot IPs against each provider's published ranges where available.
- In Bing Webmaster Tools, check crawl/index coverage and IndexNow receipt after implementation.
- In Google Search Console, inspect each final canonical URL for indexing and snippet eligibility.

Important distinction:

- **OAI-SearchBot** is the crawler to allow for ChatGPT Search result visibility. OpenAI says sites opted out of OAI-SearchBot will not be shown in ChatGPT search answers, though they can still appear as navigational links.
- **GPTBot** is separately controllable and relates to training. Allowing or blocking GPTBot should not be treated as the same decision as ChatGPT Search visibility. Source: https://developers.openai.com/api/docs/bots.
- **PerplexityBot** is the search-result crawler according to Perplexity; `Perplexity-User` is user-triggered retrieval. Source: https://docs.perplexity.ai/docs/resources/perplexity-crawlers.
- **ClaudeBot** is training-oriented; Anthropic also documents `Claude-SearchBot` and `Claude-User` as separate retrieval/search agents. Source: https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler.

## Content Rewrite Briefs

Do not treat these as final production copy. They are briefs for the Content Brief Generator and reviewed WordPress manifest.

### Homepage

- Target query: Texas commercial general contractor; commercial construction company Texas.
- Answer-first H2 recommendation: "What Commercial Construction Services Does Maxx Builders Provide in Texas?"
- TL;DR block: State Maxx Builders serves commercial owners across Houston, Dallas, Austin metro, and Texas with general contracting, construction management, design-build, preconstruction, and sector expertise.
- Proof points to add: Named hospitality projects, service-area text, market sectors, leadership/team credentials.
- Table/comparison opportunity: Services by owner need: budget certainty, speed, design coordination, renovation, ground-up.
- Internal links to add: hotel cost guide, Houston cost guide, Dallas cost guide, design-build Houston, planning guide.
- Schema recommendation: Keep Organization / GeneralContractor on homepage; make NAP match visible text and GBP byte-for-byte.

### Hotel Construction Cost Guide

- Target query: hotel construction cost Texas 2026.
- Answer-first H2 recommendation: "How Much Does Hotel Construction Cost in Texas in 2026?"
- TL;DR block: Give per-key and per-SF ranges, main drivers, Texas metro variance, and when owners should request preconstruction pricing.
- Proof points to add: Home2Suites by Hilton Richmond TX, Comfort Suites Pasadena TX, Holiday Inn Express Pflugerville TX, including 90,500 sq ft and 114,700 sq ft where accurate.
- Table/comparison opportunity: Cost per key vs cost per SF vs brand/amenity drivers.
- Internal links to add: mock-up rooms, planning guide, project timelines, design-build Houston.
- Schema recommendation: Article + FAQPage only where FAQ is visible; author must be a named Maxx expert.

### Medical Office Construction Costs

- Target query: medical office construction costs Texas 2026.
- Answer-first H2 recommendation: "What Does It Cost to Build a Medical Office in Texas in 2026?"
- TL;DR block: Summarize cost range, specialty buildout drivers, medical gas/radiation shielding, regulatory review triggers, and timeline risk.
- Proof points to add: Only add real healthcare project proof if Maxx can verify it; otherwise use explicit expert/process proof without claiming a case study.
- Table/comparison opportunity: Specialty type vs MEP complexity vs regulatory triggers vs cost premium.
- Internal links to add: commercial planning guide, project timelines, Houston/Dallas cost pages.
- Schema recommendation: Fix duplicate H1 first; Article + FAQPage, named expert author, no unsupported MedicalBusiness schema unless visible NAP/service details support it.

### Warehouse Construction Cost

- Target query: warehouse construction cost per square foot Texas.
- Answer-first H2 recommendation: "What Does It Cost Per Square Foot to Build a Warehouse in Texas?"
- TL;DR block: State 2026 range, how size/type/city/sitework change the number, and when a conceptual estimate is unreliable.
- Proof points to add: Real industrial/warehouse project proof if available; otherwise add a clear example budget model and label it as illustrative.
- Table/comparison opportunity: Shell warehouse vs distribution vs cold storage vs flex industrial.
- Internal links to add: planning guide, project timelines, Houston/Dallas cost pages, design-build Houston.
- Schema recommendation: Update `config/urls.txt` and WordPress internal links to final canonical `/cost-per-square-foot-build-warehouse-texas/`; remove duplicate H1; Article + FAQPage.

### Houston Commercial Construction Cost

- Target query: commercial construction cost Houston TX.
- Answer-first H2 recommendation: "How Much Does Commercial Construction Cost in Houston?"
- TL;DR block: Summarize Houston per-SF range, building-type spread, submarket/sitework drivers, permitting risk, and next estimate step.
- Proof points to add: Houston-area Maxx projects or nearby Texas project proof; do not imply a Houston office or virtual location.
- Table/comparison opportunity: Houston building type vs cost range vs biggest cost driver.
- Internal links to add: Dallas cost page, retail ranking, design-build Houston, timeline, planning guide.
- Schema recommendation: Article + FAQPage; named author; ensure FAQ schema exactly matches visible FAQ.

### Dallas Commercial Construction Cost

- Target query: Dallas commercial construction cost 2026.
- Answer-first H2 recommendation: "How Much Does Commercial Construction Cost in Dallas-Fort Worth?"
- TL;DR block: State Dallas/DFW range, escalation drivers, building-type variance, and owner controls.
- Proof points to add: Verified Dallas/DFW project proof if available; otherwise Texas project proof with transparent geography.
- Table/comparison opportunity: DFW building type vs cost range vs schedule/permit risk.
- Internal links to add: Houston cost page, warehouse cost, planning guide, timeline.
- Schema recommendation: Article + FAQPage; shorten meta description to stay comfortably under 155 chars; named author.

### Car Wash Construction Cost

- Target query: cost to build a car wash in Texas.
- Answer-first H2 recommendation: "How Much Does It Cost to Build a Car Wash in Texas?"
- TL;DR block: Summarize range by self-serve, express tunnel, and full-service; mention land, utilities, water reclamation, equipment, and permitting.
- Proof points to add: Real Maxx car wash/retail sitework proof if available; otherwise avoid case-study language.
- Table/comparison opportunity: Car wash model vs building/equipment/sitework/permit risk.
- Internal links to add: retail contractors, planning guide, project timelines, design-build Houston.
- Schema recommendation: Article + FAQPage; named author; keep cost claims consistent with visible table.

### Design-Build Houston

- Target query: design-build construction Houston.
- Answer-first H2 recommendation: "When Should a Houston Owner Use Design-Build Construction?"
- TL;DR block: Explain single-team accountability, schedule compression, preconstruction pricing, and best-fit project types.
- Proof points to add: Houston/Texas project examples where design-build or integrated preconstruction was actually used.
- Table/comparison opportunity: Design-build vs design-bid-build vs construction management.
- Internal links to add: Houston cost page, planning guide, project timelines, hotel cost guide.
- Schema recommendation: Fix canonical/sitemap/slug strategy; add meta description; keep `Harris Khan` only if he is the verified author.

### Retail Contractor Rankings

- Target query: best retail construction contractors in Houston.
- Answer-first H2 recommendation: "Who Are the Best Retail Construction Contractors in Houston?"
- TL;DR block: Summarize that rankings should be based on retail experience, scheduling discipline, occupied-site work, permitting, and preconstruction clarity.
- Proof points to add: Maxx retail projects, criteria, sources, and reviewer methodology. Add a conflict-of-interest note because Maxx ranks itself.
- Table/comparison opportunity: Contractor vs specialty vs local strengths vs caveats.
- Internal links to add: car wash cost, restaurant construction, Houston cost, planning guide.
- Schema recommendation: Article; avoid Review/Rating schema unless it meets Google's review snippet rules and visible criteria support it.

### Restaurant Construction Considerations

- Target query: restaurant construction planning Texas.
- Answer-first H2 recommendation: "What Should Owners Plan Before Building a Restaurant in Texas?"
- TL;DR block: Summarize contractor selection, location, code, kitchen layout, budget, utilities, health department, and phasing.
- Proof points to add: Verified restaurant/retail hospitality buildout proof if available.
- Table/comparison opportunity: New build vs second-generation restaurant vs remodel.
- Internal links to add: cost-efficient restaurant construction, retail ranking, planning guide.
- Schema recommendation: Decide whether this page is the planning page and the cost-efficient page is the cost-control page; add FAQPage only after visible FAQ exists.

### Restaurant Cost-Efficient Strategies

- Target query: restaurant construction cost-saving strategies Texas.
- Answer-first H2 recommendation: "How Can Owners Control Restaurant Construction Costs?"
- TL;DR block: Summarize early budgeting, equipment coordination, MEP planning, value engineering, procurement, and zoning/permitting.
- Proof points to add: Real cost-control examples or owner decision checkpoints from Maxx projects.
- Table/comparison opportunity: Cost-saving move vs risk reduced vs when to decide.
- Internal links to add: restaurant considerations, retail ranking, commercial timeline, planning guide.
- Schema recommendation: Differentiate from the considerations page or consolidate. Avoid cannibalization.

### Commercial Construction Project Timelines

- Target query: commercial construction project timeline Texas.
- Answer-first H2 recommendation: "How Long Does Commercial Construction Take in Texas?"
- TL;DR block: Summarize typical ranges by project type, then note permitting, sitework, long-lead materials, and inspections as schedule drivers.
- Proof points to add: Actual schedule lessons from named Maxx projects where publishable.
- Table/comparison opportunity: Project type vs planning/permitting/construction/punch duration.
- Internal links to add: planning guide, design-build Houston, Houston/Dallas cost pages.
- Schema recommendation: Article + FAQPage; named author; ensure FAQ visible.

### Commercial Building Planning Guide

- Target query: commercial building planning guide.
- Answer-first H2 recommendation: "What Are the Steps to Plan a Commercial Building Project?"
- TL;DR block: Summarize feasibility, site due diligence, budget, design, permits, procurement, construction, closeout.
- Proof points to add: The three named hospitality projects already appear; add what they prove, not just names.
- Table/comparison opportunity: Owner decision by phase vs Maxx deliverable vs risk avoided.
- Internal links to add: timeline, hotel cost, Houston/Dallas cost, design-build Houston.
- Schema recommendation: Article; named author; add FAQPage only if FAQ content is visible and complete.

### Mock-Up Rooms Hospitality

- Target query: hotel mock-up rooms construction.
- Answer-first H2 recommendation: Keep "Answer-First Intro" but rewrite to a natural query H2.
- TL;DR block: Summarize why mock-up rooms reduce brand, ADA, FF&E, MEP, and rework risk before full production.
- Proof points to add: Keep Home2Suites Richmond, Comfort Suites Pasadena, Holiday Inn Express Pflugerville; connect each to hospitality execution credibility.
- Table/comparison opportunity: Mock-up vs no mock-up cost/schedule/rework risk.
- Internal links to add: hotel cost guide, planning guide, project timelines.
- Schema recommendation: Fix title/meta/H1; Article with named hospitality expert author.

### Commercial Construction Obstacles

- Target query: common commercial construction problems.
- Answer-first H2 recommendation: "What Are the Most Common Commercial Construction Obstacles?"
- TL;DR block: Summarize schedule delays, outdated drawings, unforeseen costs, field errors, and mitigation.
- Proof points to add: Project-management examples from named Maxx projects if publishable.
- Table/comparison opportunity: Obstacle vs early warning sign vs owner action vs contractor mitigation.
- Internal links to add: planning guide, timeline, design-build Houston.
- Schema recommendation: Replace meta description `blueprints`; Article with named author; add FAQ only if visible FAQ exists.

## Technical SEO / AI Access Issues

### Indexability, Canonical, Sitemap, Redirects

Confirmed:

- `robots.txt` is permissive and points to `https://www.maxxbuilders.com/sitemap_index.xml`.
- Sitemap recursion found 237 URLs.
- Most priority URLs are 200, index/follow, and self-canonical.
- The warehouse URL in `config/urls.txt` redirects/canonicalizes to `https://www.maxxbuilders.com/cost-per-square-foot-build-warehouse-texas/`; the old configured URL was not found in sitemap membership.
- The design-build configured URL redirects/canonicalizes to `https://www.maxxbuilders.com/design-build-construction-houston-2/`; the original configured URL was not found in sitemap membership and the final page has no meta description.

Action:

- Update the priority URL source of truth after approval, but not in this read-only task.
- In WordPress, make the preferred design-build slug clean. Either make `/design-build-construction-houston/` the canonical final URL or update all SEO tooling and internal links to `/design-build-construction-houston-2/`.

### Structured Data

Confirmed:

- Priority article pages expose Article/WebPage/BreadcrumbList/WebSite/Organization or GeneralContractor style JSON-LD, and many expose FAQPage.
- Most Article authors are `Maxx Builders`, not a real named person. The design-build final page exposes `Harris Khan`.

Risks:

- Generic author conflicts with project E-E-A-T rule in `AGENTS.md`.
- FAQPage must match visible FAQ text exactly. This audit confirmed FAQ presence by text/schema but did not validate every FAQ entity line-by-line.
- Organization/LocalBusiness schema should not imply virtual-office location pages. Keep NAP aligned with visible text and GBP.

### Content Visibility

Confirmed:

- Main content was visible in fetched HTML for the priority pages. Word counts ranged from roughly 1,595 to 6,663 words for sampled priority pages.
- Tables were present on high-value cost pages including medical office, warehouse, Houston, Dallas, car wash, hotel, timeline, and mock-up pages.
- Several article templates expose sidebar H2s such as Search, Categories, Latest Posts, Tags, and Follow Us early in the extracted heading list. That weakens heading clarity for AI extraction.

Risks:

- Some strong answer content exists, but AI systems need fast extractability. Put the direct answer above intros, sidebars, and generic section labels.
- Avoid hiding the only useful answer inside accordions. FAQ accordions are acceptable when content is rendered in HTML and not blocked, but the direct answer should be visible before them.

### Metadata Quality

Confirmed issues:

- Homepage title length: 66 chars, above the project threshold of <= 60.
- Mock-up page title length: 71 chars and meta description missing.
- Design-build final page meta description missing.
- Obstacles page meta description is `blueprints`, length 10.
- Dallas meta description is 153 chars, within <= 155 but close to the limit.

### Internal Links

Confirmed:

- Homepage HTML contained no detected links to the configured priority URLs.
- Several priority pages linked only to `/`.
- Stronger clusters exist in some pages: Houston links to Dallas and retail ranking; Dallas links to Houston and retail ranking; mock-up links to hotel guide.

Action:

- Add contextual, body-copy internal links among the cost guides, design-build, timeline, planning guide, hospitality proof pages, and market pages.
- Use one page per intent. Do not create new restaurant pages before resolving cannibalization.

### Page Speed / CWV Risk

Confirmed:

- PageSpeed Insights API returned HTTP 429 for sampled URLs during this audit, so LCP/INP/CLS field or lab values could not be verified.
- HTML risk indicators are present: homepage had 113 images and 94 scripts; typical article pages had roughly 80+ scripts and 19-27 images.

Action:

- Run CWV Audit Agent with PSI/CrUX access later.
- Prioritize template-level fixes: TTFB, LCP image handling, script delay/defer, third-party script audit, image sizing, and no lazy-loading of the LCP element.

### AI Crawler Accessibility

Confirmed:

- Robots allows Googlebot, Bingbot, OAI-SearchBot, GPTBot, ChatGPT-User, PerplexityBot, ClaudeBot, and Claude-SearchBot through `User-agent: *` with empty `Disallow`.

Action:

- Keep OAI-SearchBot allowed if ChatGPT Search visibility is desired.
- Decide separately whether GPTBot training access should remain allowed.
- Consider explicitly documenting AI crawler policy in robots.txt only if the business wants differentiated training vs search access.

### IndexNow

Confirmed:

- `/indexnow.txt`, `/IndexNow.txt`, and `/indexnow.xml` returned 404 during this audit.

Recommendation:

- Implement IndexNow after approved content/canonical fixes. It is useful for Bing/Copilot freshness but does not guarantee indexing. Source: https://www.bing.com/indexnow/getstarted.

## Do Not Do

- Do not create fake city/location pages for Dallas, Austin, Houston suburbs, or any virtual-office market.
- Do not create keyword-variation page spam for every AI fan-out query.
- Do not use fake author bylines, "Editorial Team", or generic author identities.
- Do not add "AI chunking" for its own sake.
- Do not claim `llms.txt` is a Google ranking or AI citation hack. Google says it ignores llms.txt for Search visibility.
- Do not seek fake external mentions.
- Do not live-publish from this audit.
- Do not access or expose secrets, `.env`, API keys, CI credentials, or production data.

## Confirmed Facts vs Assumptions

Confirmed:

- `config/urls.txt` defines 15 priority URLs.
- No `crawl/*.csv` was present.
- Live robots.txt allows all checked crawlers.
- Live sitemap recursion found 237 URLs.
- Two configured URLs have canonical/sitemap problems: warehouse old slug and design-build redirect/final slug.
- Most priority pages are indexable HTML pages with visible text and JSON-LD.
- Most Article authors are generic `Maxx Builders`.
- PageSpeed Insights was blocked by HTTP 429 in this run.

Assumptions:

- Project proof points listed in `AGENTS.md` are publishable operator truth, but exact claims must still be verified against Maxx's project records before production copy.
- Harris Khan is a valid named expert author because the live design-build JSON-LD exposes him; his credentials still need human verification before broad rollout.
- GSC performance and query data may exist through MCP/export, but no local export was found and no secret-backed GSC command was run.

## Verification Log

Commands/checks run:

- `git status --short --branch` in `C:\dev\maxx-seo-agent`.
- Read SEO audit skill: `C:\dev\maxx-seo-agent\.agents\skills\seo-audit\SKILL.md`.
- Read source instructions: `C:\dev\maxx-seo-agent\AGENTS.md`.
- Read priority URLs: `config\urls.txt`.
- Checked for crawl exports: `crawl` directory missing in source checkout and isolated worktree.
- Created isolated git worktree: `git worktree add -b chore/geo-ai-seo-audit C:\dev\maxx-seo-agent-geo-audit main`.
- Read `package.json` to understand available audit commands; no apply command was run.
- Live fetched `https://www.maxxbuilders.com/robots.txt`.
- Recursed `https://www.maxxbuilders.com/sitemap.xml` / sitemap index and compared priority URL membership.
- Live fetched all priority pages and extracted status, final URL, canonical, title/meta lengths, H1/H2s, JSON-LD types/authors, tables, FAQ/TL;DR signals, proof-point hits, internal links, image/script counts.
- Checked `/indexnow.txt`, `/IndexNow.txt`, and `/indexnow.xml`; all returned 404.
- Attempted PageSpeed Insights API for mobile sampled URLs; all returned HTTP 429.
- Reviewed official docs from Google, OpenAI, Bing IndexNow, Perplexity, and Anthropic.

Remaining warnings:

- No crawl export, GSC export, server logs, CDN logs, WordPress admin, Search Console URL Inspection, Bing Webmaster Tools, or CrUX/PSI metrics were available in this read-only session.
- This audit did not validate every JSON-LD property against visible page text. Schema Generator should do that before apply.
