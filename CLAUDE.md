# CLAUDE.md — Universal SEO Operating Context

Platform-neutral brain. The audit, generate, and monitor layers work on ANY website. The APPLY step depends on the platform — add a pack from `packs/` (WordPress, Webflow) or use the repo-native kit for code-accessible stacks.

## Site

- **Property / domain:** `https://www.maxxbuilders.com`
- **GSC site URL:** `sc-domain:maxxbuilders.com`
- **Platform:** WordPress
- **Apply method:** WP-CLI/REST via `packs/wordpress/` (`npm run wp:apply`). SEO meta written via REST + Application Password; `SEO_PLUGIN` env var selects Yoast or Rank Math.
- **Inputs available:** crawl export at `./crawl/*.csv` (Screaming Frog/Sitebulb/Firecrawl), GSC (MCP or export), URL list at `config/urls.txt`

## Primary entities (E-E-A-T + schema)

- **Organization:** Maxx Builders, brand: Maxx Builders, sameAs:
  - `https://www.linkedin.com/company/maxxbuilders`
  - `https://www.facebook.com/maxxbuildersco`
  - `https://www.google.com/maps/place/Maxx+Builders/@29.636208,-95.574546,17z/data=!3m1!4b1!4m6!3m5!1s0x8640e7cdfebb1fef:0x3de403dca549748f!8m2!3d29.636208!4d-95.574546!16s%2Fg%2F11zcjh2x4p`
- **Business type:** Commercial general contractor / construction management, Texas
- **Service area:** Texas (primary: Houston, Dallas, Austin metro). No virtual-office location pages.
- **Key projects (operator truth for content):** Home2Suites by Hilton Richmond TX (90,500 sq ft), Comfort Suites Pasadena TX, Holiday Inn Express Pflugerville TX (114,700 sq ft).
- **Authors:** real, named construction experts with verifiable project history. No "Editorial Team" bylines. Credit must trace to a named Maxx Builders team member or principal.

## Keyword / intent map

Top clusters (one page per cluster — do not cannibalize across clusters):

| Cluster | Primary page | Intent |
| --- | --- | --- |
| Hotel construction cost Texas | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | Commercial info |
| Medical office construction cost Texas | `/medical-office-construction-costs-texas-2026-comprehensive-guide/` | Commercial info |
| Warehouse construction cost TX | `/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/` | Commercial info |
| Commercial construction cost Houston | `/commercial-construction-cost-houston-tx/` | Local commercial |
| Commercial construction cost Dallas | `/dallas-commercial-construction-costs-2025-2026/` | Local commercial |
| Design-build Houston | `/design-build-construction-houston/` | Service/transactional |
| Restaurant construction tips/cost | `/8-key-considerations-for-building-a-restaurant/` + `/cost-efficient-strategies-restaurant-construction/` | Commercial info — watch cannibalization |
| Car wash construction cost TX | `/cost-to-build-a-car-wash-in-texas/` | Commercial info |
| Retail contractor rankings Houston | `/best-retail-construction-contractors-in-houston-2026-rankings/` | Commercial info |
| Mock-up rooms hospitality | `/importance-of-mock-up-rooms-in-the-hospitality-industry/` | Informational |

Known cannibalization risk: restaurant cluster has two pages targeting overlapping intent — audit before creating new restaurant content.

## SEO rules to enforce (platform-independent)

**Thresholds (mobile, field-aware):** LCP < 2.5s, INP < 200ms, CLS < 0.1 at CrUX p75. Fix CWV at the template level, order TTFB → LCP → INP → CLS. Never lazy-load the LCP element.

**Metadata:** unique per page; titles ≤ 60 chars (lead with primary entity); descriptions present, ≤ 155 chars; self-referencing canonical by default.

**Crawl/index:** only indexable, canonical, 200-status URLs in the sitemap; max one redirect hop; no soft-404s; noindex filter/faceted URLs.

**Structured data:** valid JSON-LD, server-rendered where possible. Organization on homepage only; LocalBusiness subtype per location page. Schema NAP must match visible page text and GBP byte-for-byte.

**Programmatic quality gates:** eligibility (skip rows that can't support a useful page), uniqueness ratio ≥ 0.5, unique intro + recommendation block per page, minimum content threshold, ≥ 3 internal links. One template = one intent = one conversion path.

**Doorway guardrail:** warn at 30 generated location pages, hard-stop at 50 pending human review.

**AI-search:** answer-first blocks, TL;DR, comparison tables; cover full query intent. Do NOT generate llms.txt for AI citations (engines crawl it but do not cite from it — Google "mythbusted" it May 2026), content chunking, or keyword-variation rewriting. Answer-first structure + valid schema are what earn citations.

## Workflow rules

- Audits are READ-ONLY → produce `seo-audit.md`.
- Generators OUTPUT portable artifacts (CSV/JSON/markdown). The matching pack APPLIES them to the platform.
- Operate at the template level wherever a pattern is shared.
- Split crawl exports over context by path prefix.
- Always confirm the platform + apply method before any write step.
- Run `/cost` to monitor spend.

## Never touch

- `.env`, secrets, API tokens, lockfiles, CI credentials
- Production data without explicit instruction
- Live publishing without showing a manifest first
