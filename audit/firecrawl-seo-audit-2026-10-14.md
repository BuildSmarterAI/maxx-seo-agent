# SEO Audit: www.maxxbuilders.com

**Date:** 2026-10-14. **Mode:** read-only. Only GET requests were made, without credentials;
nothing was applied. **Workflow:** `firecrawl-seo-audit`. Three parallel investigators covered
structure/technical, on-page, and keyword/SERP, and their headline claims were re-checked
against the live site before publication. **Scope:** 242 mapped URLs, all 238 sitemap URLs, and 173
non-portfolio pages parsed. Firecrawl rendered 42 pages (the report also mentions 4 additional pages, which are not itemized in this report), 59 SERP/competitor pages were
scraped, and 30 searches were run. About 170 Firecrawl credits were used.

**Evidence labels:**
- **[M]** measured this run.
- **[V]** measured and independently re-verified by the coordinator.
- **[GSC]** the 2026-07-06 Search Console baseline (`audit/baselines/2026-07-06/gsc.json`). It is
  about 3 months old, and live GSC was unavailable because the Supabase/analytics MCP servers
  failed to connect.
- **[J]** strategy judgment.

**Risk class** follows `.claude/rules/workflow.md`. **safe** means the item can go through the
normal `change_set` / PR flow. **gated** means it needs an operator decision; per workflow.md that covers
brand/pricing/positioning, YMYL, new page batches above threshold, merges/deletes with backlinks,
301 redirects, and GBP/NAP changes. This audit additionally escalates noindexing the portfolio and
location batches. Other noindex items (taxonomy archives, utility pages, single thin or redirected
posts) are labelled safe as sitemap hygiene because they are not portfolio or location batches.

---

## Executive Summary

**What is working**
- [M] The informational cost guides rank. Firecrawl shows Maxx at #1 on 7 of 9 cost queries:
  hotel, medical, warehouse, TX statewide, Houston, car wash, and San Antonio. Dallas is #2.
  - [GSC] The July baseline averaged positions 6–10 for those same pages, so treat Firecrawl
    ranks as approximate.
- [M] The medical guide (about 6.5k words, 13 tables) and the warehouse guide (9 tables, real
  243k/100k/25k sq ft projects) beat the competitor pages on depth.

**Top risks, ranked**

1. **[V] Editorial scaffolding and placeholders are live on 8 URLs (corrected from 9: the listed cases sum to at most 8).** This is a quality and trust
   defect that anyone can see, and none of it is in any queue.
   - The mock-up rooms page prints `Slug:`, `Meta description (150 chars):`, `Canonical:`, and an
     "Answer-First Intro" H2.
   - The medical guide prints the same labels.
   - The loans post shows three `[Insert Table: …]` placeholders.
   - "AI Summary (150 words)" headings appear on 4 posts.
   - The restaurant cost-strategies post has a "Social Sharing Buttons:" H2.
2. **[M] Boilerplate injected at scale.**
   - 73 posts carry byte-identical appended H2 sections, averaging about 880 words per post.
   - 91 posts share `dateModified` 2026-05-18.
   - [J] This matches the pattern of Google's scaled-content policy, and it dilutes every post's
     uniqueness.
3. **[V] Broken and redirecting internal links.**
   - 8 links on 6 pages point to 404s. One example: the hotel cluster guide links to
     `/design-build-services/` and `/preconstruction-services/`, and both return 404.
   - 250 links point to 301s.
   - 381 date-archive links 301 to `/`.
4. **[M] 78 thin or soft-404 URLs are indexable and in the sitemaps.**
   - 19 taxonomy archives with 8–44 words each.
   - 38 portfolio singles with about 37 words each.
   - 11 `/projects/*` hubs whose project grid renders empty.
   - 10 empty utility pages.
5. **[M] Doorway risk on `/locations/*`.**
   - The 4 location pages are near-duplicates. Uniqueness scores 0.06–0.19, depending on the
     shingle method, against the CLAUDE.md gate of ≥0.5.
   - Each page has 1 inbound link.
   - San Antonio has two competing pages.
6. **[V] E-E-A-T bylines.**
   - 110 of 115 posts give the schema `author` as the organization "Maxx Builders".
   - 102 show "Reviewed by the Maxx Builders construction management team". That is
     functionally the team byline that CLAUDE.md forbids.
   - Three posts visibly credit Harris Khan while their schema says Maxx Builders: the medical,
     warehouse, and mock-up guides.
7. **[M] Contractor and local queries: Maxx is not in the top 10.** The queries are:
   - "commercial general contractor" + Houston / Dallas / Austin
   - "medical office contractor houston"
   - "hotel construction companies texas"
   - "industrial warehouse contractor houston"

   The money pages are thin, and they get almost no internal links:
   - The 7 service pages have 414–511 words each.
   - The 5 city pages have 390–539 words each.
   - All 12 have **0 contextual internal links**.
8. **[M] Metadata backlog: queued but unapplied.**
   - Current state: 75 titles over 60 characters, 23 descriptions missing, 41 over 155
     characters, and 8 duplicates.
   - 136 of 173 URLs have queued rows, but only the 5 rows of the July CTR batch are live.
   - Worst live defect: all 5 `/industries/*` pages share the wrong description, "Discover
     Maxx Builder's Corporate Interiors projects…" [V].

---

## Site Structure

**Sitemaps** [M]: there are 7 Yoast child sitemaps covering 238 URLs, and all return 200.

| Problem | URLs | Evidence | Fix | Risk |
|---|---|---|---|---|
| Sitemap posts that 301 | `/texas-commercial-building-costs-guide/`, `/dental-office-construction-cost-guide/`, `/the-cost-of-a-tenant-build-out-per-square-foot/`, `/choose-a-commercial-contractor/` | Single-hop 301s; unchanged since the July audit | Set each source post to noindex or Draft so it leaves `post-sitemap.xml`. The redirect rule keeps working. | safe (sitemap hygiene; single posts, not a portfolio/location batch) |
| Wrong redirect target | `/choose-a-commercial-contractor/` → `/services/architectural-design-and-engineering/` | Intent mismatch | Repoint to `/choosing-commercial-general-contractor-guide/` | gated (301) |
| Canonical loop | `/latest-news-updates/` | [V] canonical = `/blog__trashed/latest-news-updates/`, which 301s back. The page has 8 words. | Re-parent it off the trashed `blog` page and clear the Yoast canonical, or noindex it | safe (noindex) |
| `index, nofollow` | `/client-resources/project-planning-guide/` (15 words) | meta robots | Add content and set it to `index, follow`, or noindex it | safe |
| Future 2-hop chain | `/texas-commercial-building-costs-guide/` → TX-2025 guide, which is slated for merge | Merge plan | When merging, point the old URL straight at the final target | gated |

**Thin and soft-404 indexable URLs (78)** [M]:
- `/project-type/*` and `/project-attributes/*` (19). Fix in Yoast → Settings → Taxonomies →
  "Show in search results" = Off for both. That noindexes them and drops them from the
  sitemaps.
- `/portfolio/*` (38). Each has about 37 words. Either enrich the top projects into real case
  studies with scope, sq ft, schedule, and photos with alt text, or set the portfolio type to
  noindex.
- `/projects/*` (11). The project grid renders no tiles (Firecrawl-rendered `/projects/car-wash/`
  confirms it). Debug the Mikado portfolio-list widget. **Not yet confirmed in an interactive
  browser.**
- Utility pages (10), to noindex:
  - `/single-page/`
  - `/thank-you/`
  - `/opt-out-from-email-and-sms/`
  - `/contact/contact-information/` (14 words)
  - `/client-resources/` FAQ (13 words), clients-guide, and construction-terminology
- Gated: whether to noindex the portfolio/locations batch, and whether to unpublish
  `/single-page/`.

**Duplicate archives** [M]: `/expert-tips-insights/` and `/industry-trends/` are 98% identical,
both indexable, and have no inbound links. Noindex both.

**Orphans** [M]: 79 sitemap URLs have no inbound internal link (82 in July). The list is in the
scratchpad `structure/orphans.txt`.

**Redirects and hosts** [V]: `http://maxxbuilders.com/` → `https://maxxbuilders.com/` →
`https://www.` takes 2 hops. Make it a single nginx 301 to `https://www.maxxbuilders.com$request_uri`.

**Internal linking** [M]:
- All 7 `/services/*` pages and all 5 city pages have 0 contextual internal links.
- The 5 `/industries/*` and 4 `/locations/*` pages get exactly 1 inbound link each, from their
  hub.
- `/8-key-considerations-for-building-a-restaurant/` gets 1 inbound link, from blog
  pagination only.
- A theme blog-list widget emits 119 links to a 301 (`/best-practices-for-a-zero-punch-list/`).
- The homepage links to 7 redirecting URLs.

**Fixed since earlier audits** [M]: `/get-a-quote/` now redirects and is out of the sitemap, and
the page cache is active.

## On-Page SEO

**Cluster primaries** (12 pages from the CLAUDE.md keyword map) [M]:

| Page | Title / meta | H1 / headings | Answer-first | Tables | FAQPage | Named author |
|---|---|---|---|---|---|---|
| Hotel cost guide | OK | — | No | 1 | Yes | No ("Reviewed by… team") |
| Medical cost guide | OK | **Slug rendered as H1** (`mkdf-page-title`), plus scaffolding labels | Yes | 13 | Yes | Visible only; schema = org |
| Warehouse cost guide | OK | H1 rendered twice (queued) | Yes | 9 | Yes | Visible only; schema = org |
| TX statewide | OK | 5 content H2s over about 4.1k words | Yes | 9 | Yes | No |
| Houston cost | OK | 2 real H2s over about 1.1–1.4k words; 2025 data | Yes | 2 | Yes | No |
| Dallas cost | OK | 2 H2s over about 2.85k words | Yes | 3 | Yes | No |
| Design-build Houston | Title "…\| Maxx Builders \| Maxx Builders", **no description** (queued); H1 contains the brand | — | Yes | 3 | **No** | Yes |
| Restaurant: 8 key | Brand-first title | — | **No** | 0 | **No** | No |
| Restaurant: cost strategies | Brand-first title; "Social Sharing Buttons:" H2; share links point to a ChatGPT conversation URL | — | **No** | 0 | **No** | No |
| Car wash | Brand-first title | — | Partial | 2 | Yes | No |
| Retail rankings | Over-length (queued) | — | **No** | 0 | Yes | No; ranks Maxx #1 of 10 with no methodology |
| Mock-up rooms | **Title = slug, no description** (queued) | **Slug H1**, plus scaffolding labels | Yes | 1 | **No** | Visible only |

**Proposed new metadata.** These are not in any queue. Every proposed title is ≤60 characters
and every description ≤155.

| URL | Current | Proposed |
|---|---|---|
| `/8-key-considerations-for-building-a-restaurant/` | `Maxx Builders: 8 Restaurant Construction Considerations` | `Building a Restaurant: 8 Key Considerations \| Maxx Builders` |
| `/cost-to-build-a-car-wash-in-texas/` | `Maxx Builders \| Car Wash Construction Cost in Texas 2026` | `Car Wash Construction Cost in Texas (2026) \| Maxx Builders` |
| `/privacy-policy/` | `Maxx Builders Privacy Policy \| Maxx Builders` | `Privacy Policy \| Maxx Builders` |
| `/mastering-tenant-improvement-construction-a-comprehensive-guide/` | 63-char title; 234-char description | T: `Tenant Improvement Construction Guide \| Maxx Builders` |
| `/` (**do_not_touch**, needs an operator override) | `Maxx Builders \| Texas' Premier Commercial General Contractors` (61) | `Maxx Builders \| Texas Commercial General Contractors` |
| `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/` | Title says 2025 (64 chars), H1 says 2026 | After refreshing the 2025 content: `Texas Commercial Construction Loans (2026): How to Qualify` |

**Heading fixes, beyond the 9 queued in `h1-fixes-2026-07-06.md`:**
- City pages `/dallas-tx/`, `/fort-worth-tx/`, and `/san-antonio-tx/` use slogan H1s. Change
  them to "{City} Commercial General Contractors".
- Remove "| Maxx Builders" from the design-build H1.
- Promote H3s to H2s on the TX, Houston, and Dallas cost primaries.

**Alt text** [M]: in-content images are mostly fine. The real defects:
- An Elementor `placeholder.png` renders on the homepage [V], from an unfilled widget.
- The Austin cost post's featured image has `alt=""`.

**Content accuracy (pricing is gated)** [M]: warehouse cost ranges conflict across pages.
- Warehouse primary: $45–$150+/sf.
- TX statewide: $160–$250.
- Houston: $130–$220.
- Dallas: $140–$230.

Reconcile them against `output/pricing/texas-construction-cost-matrix-2026.md`. Separately,
`/office-build-out-cost-per-sf/` still cites 2018 figures.

**Unverified claim on a live page:** the car wash guide says Maxx "delivered a 9,000 sq ft
express tunnel car wash in Dallas on a $2.8M budget". This project is **not** in the CLAUDE.md
operator project list. The operator must confirm it or remove it.

## Keyword Opportunities

**Cannibalization.** Merges and 301s are gated, so these are recommendations only.
1. **Restaurant: an operator decision is needed.**
   - CLAUDE.md names `/8-key-considerations…/` and `/cost-efficient-strategies…/` as the primary
     pages.
   - These two pages share 19 identical paragraphs [M].
   - [GSC] The page actually earning impressions is
     `/restaurant-construction-cost-per-square-foot-guide-2024/` (7,074 impressions, position
     7.7). The July merge plan makes it the surviving cost page.
   - Recommendation: make the cost page primary, re-dated to 2026; consolidate cost-strategies
     into it; and differentiate 8-key as the planning guide. Then update CLAUDE.md.
2. **Warehouse.**
   - [GSC] `/what-does-it-cost-to-build-an-industrial-warehouse/` competes with the primary
     (4,013 impressions, position 13.2).
   - Its queued title ("…Cost Guide – Texas") would *increase* the overlap. Re-evaluate that row
     before applying it.
3. **TX statewide.**
   - [GSC] The 2025 guide (18,748 impressions) splits intent with the 2025–2026 primary.
   - [M] The statewide page outranks the dedicated Austin cost page for "commercial construction
     cost austin". Fix this with a metro summary table on the statewide page that links each
     city page.
4. **Overlap groups found this run.** Each needs consolidation or differentiation (gated):
   - 3 Houston "top contractors" posts
   - The San Antonio pair (`/locations/san-antonio-commercial-contractors/` and
     `/san-antonio-tx/`)
   - Choosing-a-contractor (2 posts)
   - Project-planning (4 posts)
   - Schedule and delays (3 posts)
   - Design-build streamlining. Its queued title would also overlap.

**New and refresh pages, validated by search** [M]:

| Opportunity | Evidence | Action |
|---|---|---|
| Gas station / c-store construction cost TX | No Maxx result. Arrant ranks #8 with a TX guide. Maxx has 6+ fuel/c-store portfolio items. | New cost guide (its own cluster) |
| Tilt-wall construction cost TX | Maxx ranks #6 with a 2020 tilt-up vs masonry post. TCG ranks #1 with a 2026 page. | Refresh and retarget the existing URL. Don't add one, to avoid overlapping the warehouse page. |
| Self-storage construction cost TX | Not in top 10. [GSC] 1,888 impressions, position 23.6. | Refresh: cost table, FAQ, and rewrite the 10 paragraphs it shares with the industrial post |
| Office build-out cost Houston | Not in top 10. The page cites 2018 eleven times and has no table. | Refresh with a 2026 Houston cost-tier table |
| Hotel cost per key | Maxx is absent. TCG and HVS rank. | Add "Per Key" to the hotel guide's title and H1, plus a per-key table by brand family |

Not recommended [J]:
- Metal-building cost: the SERP is suppliers and kit sellers.
- Cold storage: there are no operator-confirmed projects.
- New city pages: they would hit the doorway guardrail, and the existing city pages already rank.

## Competitor/SERP Comparison

Positions are approximate. Firecrawl search, run 2026-10-14 with a Texas city location, is not
geo-exact Google rank tracking, and it does not show AI Overviews, the local pack, or People
Also Ask.

| Query | Intent | Maxx | Top 3 |
|---|---|---|---|
| hotel construction cost texas | cost guide | 1 | maxx, hvs.com, terrapincg.com |
| medical office construction cost texas | cost guide | 1 | maxx, rsmeans, terrapincg |
| warehouse construction cost per square foot texas | cost guide + forums | 1 | maxx, reddit, brownintegratedlogistics |
| commercial construction cost texas | cost guide | 1 | maxx, terrapincg, ncsturgeon |
| commercial construction cost houston | cost guide | 1 | maxx, terrapincg, jdj-consulting |
| commercial construction cost dallas | cost guide | 2 | terrapincg, maxx, jdj-consulting |
| design build contractor houston | local service + directory | 5 | arcodb, greymark, houzz |
| restaurant construction cost | national guide + forums | — | reddit, timelessco, homeguide |
| car wash construction cost texas | cost guide | 1 | maxx, terrapincg, shinewashtec |
| retail construction contractors houston | local + list | 9 | greystone, garrison, lumicre |
| hotel mock up room | informational | 2 | profica, maxx, shutterstock |
| commercial general contractor houston | local + directory | — | garrison, agchouston, greystone |
| commercial general contractor dallas | local + directory | — | mccowngordon, evans, procore network |
| commercial general contractor austin | local + directory | — | austin-ind, greystone, novo |
| medical office contractor houston | sector service | — | anslowbryant, arch-con, kcs |

**Why the winners win:**
- **terrapincg.com** is the benchmark; it appeared on 16 of 30 SERPs. It has per-key and
  per-brand hotel tables, regional grids, "Data & References" source blocks, Person schema with
  credentials, monthly update dates, and an estimator.
- **Contractor/local queries.** The winners are *also* thin: Greystone runs about 390 words and
  Garrison about 206. [J] Authority, the Google Business Profile, directory listings (AGC
  Houston, Procore Network, ClearlyRated), and local project proof decide these queries, not
  page length.
- **ARCO** wins design-build Houston with an office page carrying GeneralContractor schema with
  address and geo, plus an FAQ.

**Per-cluster gaps** (the Maxx page against the winner):
- **Hotel:**
  - "Per Key" in the title and H1.
  - A Hilton/IHG/Choice table drawn only from operator-confirmed projects.
  - An FF&E/OS&E/soft-cost table.
  - Cite the HVS 2026 survey.
- **Medical:** a sources block (CBRE, JLL, or similar), and a TI vs ground-up table up top.
- **Warehouse:** a clear-height cost table; ESFR, fire-pump, and power adders; and a
  build-vs-lease box.
- **Houston cost:** a submarket table (Energy Corridor, Katy, I-45, Ship Channel), floodplain and
  detention costs, tilt-wall and PEMB rows, and the H1 changed to 2026.
- **Dallas:** a DFW submarket table (Frisco, Plano, Alliance). [GSC] Frisco and Plano queries
  already reach this page. Add DFW project proof: the 150-key hotel and the imaging addition.
- **Design-build:** Service schema with `areaServed` Houston and a Houston project grid. The
  operator must pick this page or `/services/design-and-build/` as the target.
- **Retail rankings:** disclose the methodology and the self-inclusion, or reshape it as a
  selection guide. Let `/industries/retail-construction-texas/` carry the hiring intent.
- **Mock-up:** the content already beats #1 (Profica, 1,672 words, 2022). Fix only the title,
  description, and H1.

## Prioritized Recommendations

### High impact
1. **Remove the live scaffolding** (safe, content).
   - Delete the `Slug:`, `Title (… chars):`, `Meta description (… chars):`, and `Canonical:`
     lines, and the "Answer-First Intro" heading text (keep the content under it), on the
     mock-up and medical guides.
   - Fill or remove the 3 `[Insert Table: …]` placeholders on the loans post.
   - Rename the "AI Summary (150 words)" H2s to "Summary" on 4 posts.
   - Delete the "Social Sharing Buttons:" H2 and the ChatGPT share links.
   - Check `/blog/` excerpts afterwards.
2. **Fix the broken internal links** (safe, broken links).
   - Hotel guide (and the other pages): `/design-build-services/` → `/services/design-and-build/`
     and `/preconstruction-services/` → `/services/preconstruction/`.
   - Remove the 4 `/tag/` links.
   - Repoint the homepage's 7 redirecting links to their final URLs (`/` is `do_not_touch`: operator override needed).
   - Fix the blog-list widget so it stops linking the redirected zero-punch-list post.
   - Hide the date-archive links.
3. **Take the thin taxonomy pages out of the index.** Set `project-type` and `project-attributes`
   to "Show in search results: Off" in Yoast (safe, sitemap hygiene; 19 URLs). Noindexing the
   utility pages is also safe (not a portfolio/location batch). Portfolio noindex vs enrichment is a **gated** decision.
4. **Put a real person behind the content.** Replace "Reviewed by the Maxx Builders
   construction management team" with a named reviewer, and set the schema `author` to a Person
   on the 3 Harris Khan posts first.
   - Additional names must come from the operator.
   - This touches brand and positioning, so it is **gated** for the byline policy and **safe**
     for the schema fix on the 3 already-attributed posts.
5. **Strip the injected boilerplate** from the 73 posts. Keep one canonical "Texas Commercial
   Construction Decision Framework" as its own page, and link to it instead (gated: a content
   batch).
6. **Decide what happens to `/locations/*`** (gated): rewrite the pages to ≥0.5 uniqueness with
   real local projects, or noindex all 4. Resolve the San Antonio pair.

### Medium impact
7. **Apply the queued metadata backlog in small batches,** per the production-only policy:
   backup/export → small approved batch → verify rendering.
   - Batch 2 and the E/E-tail rows were generated 2026-07-06, so re-run the drift check first.
     `wp:apply` escalates a title/description row whose live value differs from `base_value`;
     `post_content` rows (packs/wordpress/apply.mjs) and rows with a null `base_value` (for example
     canonicals) are not drift-checked. This matters because the scaffolding removal is a
     `post_content` edit.
   - Drop or rewrite the 2 queued titles that would deepen overlap: the warehouse and
     design-build streamlining rows.
8. **Internal linking for money pages** (safe):
   - ≥3 contextual links per service and city page: service → industry pages and case studies;
     city → its city cost guide.
   - Add `/industries/*` to the nav (the homepage is `do_not_touch`).
   - On the statewide guide, add a metro summary table linking each city cost page.
9. **Rebuild the city and industry pages around delivered projects:**
   - project tiles with sq ft
   - a named project lead
   - an FAQ
   - GeneralContractor `areaServed` schema
   - On the healthcare page, add the Energy Corridor medical office/imaging project, to target
     "medical office contractor houston".
   - Fix the "Our Industrial Construction Process" copy error on the hotel and healthcare
     industry pages.

   Do **not** add new location URLs.
10. **Make the restaurant decision, then consolidate** (gated): the cost page becomes primary,
    and CLAUDE.md gets updated.
11. **Cost-guide upgrades, per the gap list above.** Start with hotel "per key" and Houston
    submarkets. Any new price figures are **gated** (pricing).
12. **Fix the sitemap and canonicals:** take the 4 redirected posts out of the sitemap, fix the
    `/latest-news-updates/` canonical loop, and noindex the duplicate archives.

### Low impact
13. Collapse the http/apex redirect to 1 hop.
14. TTFB: [M] lab curl shows about 50–70 ms on cache hits but about 2.0 s on misses (home,
    general-contracting, hotel guide). Raise the WP Rocket cache lifetime and enable preload so
    crawlers rarely hit the origin. Field CWV was not measured here.
15. Schema: keep the full Organization node on `/` only, and reference it by `@id` elsewhere
    (currently it is on 241/241 pages; `/` is `do_not_touch`: operator override needed). Give the kept location pages a GeneralContractor node
    with NAP matching the visible text. Remove the duplicate FAQPage blocks there. Add
    FAQPage to design-build and mock-up.
16. Filler: fix the homepage placeholder image (`/` is `do_not_touch`: operator override needed) and the Austin featured-image alt.
17. Car wash Dallas project claim: confirm it or remove it.

## Unverified / limits
- **Current Google positions and AI Overviews or local pack presence.** Firecrawl ranks are
  approximate, and GSC is from July.
- **The `/projects/*` empty grid.** Seen in the Firecrawl render; not yet checked in an
  interactive browser.
- **The `do_not_touch` table.** Not checked, because Supabase was unavailable. Re-check before
  any `change_set` is created. `/` is known to be protected.
- **Methodology spread.** Location uniqueness came out at 0.06–0.09 with a 5-gram measure and
  0.16–0.19 with a 5-word shingle measure. Both fail the 0.5 gate.
- Word and link counts are approximate parses. Answer-first, TL;DR, and FAQ detection was
  regex-based, and hand-checked only on the 12 cluster pages.
- No search-volume data was available.

## Sources
- Firecrawl map of `https://www.maxxbuilders.com` (242 URLs); `/robots.txt`;
  `/sitemap_index.xml` plus 7 child sitemaps (238 URLs).
- Throttled curl GETs of every sitemap URL and 111 additional link targets: status, redirects,
  canonical, robots, and TTFB.
- 173 non-portfolio pages parsed from raw HTML, and 42 Firecrawl-rendered (the 4 additional pages are not itemized in this report; home, services,
  industries, locations, city pages, the 12 cluster primaries, and utility pages).
- 30 Firecrawl searches (15 target queries and 15 gap checks) and 59 scraped SERP pages,
  including terrapincg.com, jdj-consulting.com, hvs.com, arcodb.com, greystoneconstruction.com,
  garrisonco.com, anslowbryant.com, and kcsconstructioncompany.com.
- Repo context: root `CLAUDE.md` (rules and keyword map); `metadata-changes.csv` and
  `output/metadata/*` (queue state); `audit/*.md` and `audit/baselines/2026-07-06/gsc.json`
  (prior audits and GSC).
- Coordinator re-verification on the live site: scaffolding on mock-up rooms; placeholders on
  loans; the `/latest-news-updates/` canonical; the industry-page descriptions; the warehouse
  schema author; the homepage placeholder; the hotel-guide 404 links; and the apex redirect
  hops.
- Raw data (not committed) is in the session scratchpad `seo/{structure,onpage,serp}/`.

## Rerun Inputs
```
workflow: firecrawl-seo-audit
site: https://www.maxxbuilders.com
keywords: [hotel construction cost texas, medical office construction cost texas,
  warehouse construction cost per square foot texas, commercial construction cost texas,
  commercial construction cost houston, commercial construction cost dallas,
  design build contractor houston, restaurant construction cost,
  car wash construction cost texas, retail construction contractors houston,
  hotel mock up room, commercial general contractor houston,
  commercial general contractor dallas, commercial general contractor austin,
  medical office contractor houston]
output: markdown
```
