# CLAUDE.md — Universal SEO Operating Context

Platform-neutral brain. The audit, generate, and monitor layers work on ANY website. The APPLY step depends on the platform — add a pack from `packs/` (WordPress, Webflow) or use the repo-native kit for code-accessible stacks. Edit bracketed values before first run.

## Site

- **Property / domain:** [domain]
- **Platform:** [Next.js repo | WordPress | Webflow | Shopify | static | other]
- **Apply method:** [direct repo edits | WP-CLI/REST | Webflow Data API v2 | CMS UI paste]
- **Inputs available:** crawl export at `./crawl/*.csv` (Screaming Frog/Sitebulb/Firecrawl), GSC (MCP or export), URL list at `config/urls.txt`

## Primary entities (E-E-A-T + schema)

- Organization: [legal name], [brand], sameAs: [LinkedIn, GBP, etc.]
- Authors: real, named experts with verifiable credentials. No "Editorial Team" bylines.

## Keyword / intent map

[Paste or link the cluster→page map. One topic owned deeply per cluster. Note known cannibalization.]

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
