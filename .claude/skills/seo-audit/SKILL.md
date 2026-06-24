---
name: seo-audit
description: Run a read-only technical SEO audit of ANY website from a crawl export plus GSC, producing a prioritized seo-audit.md. Use for an SEO audit or site health check when you do not have repo access.
---

# Universal SEO Audit (read-only, no repo required)

Load CLAUDE.md. Output only — change nothing.

## Inputs (any one or more)

- Crawl export at `./crawl/*.csv` (Screaming Frog / Sitebulb / Firecrawl). Split by path prefix if over context.
- The live `sitemap.xml` (fetch it) and `robots.txt`.
- GSC data (MCP or export) for performance context.
- `config/urls.txt` for the priority URL set.

## Steps

1. **Inventory** every URL from the crawl/sitemap: status code, title length, meta description presence/length, canonical + self-reference, H1 count, indexability (robots/meta), JSON-LD type if captured.
2. **Crawl/index hygiene:** broken links and redirect chains; soft-404s; URLs in sitemap that are noindexed/non-200/canonicalized away; indexable pages missing from sitemap.
3. **Internal links:** orphans (zero inbound), money pages with low inbound links, broken internal links — by joining crawl ∩ sitemap ∩ link export.
4. **Performance:** run the PSI API (`strategy=mobile`, see `scripts/check-vitals.sh`) on the top URLs in `config/urls.txt`; record LCP/CLS/TBT.
5. **Content:** flag thin/near-duplicate pages and missing/duplicate metadata; flag generic author bylines.

## Output

`seo-audit.md` grouped Critical / High / Medium / Low. Each finding: issue, affected URL(s), the fix, and which generate-skill produces it (`/metadata-generate`, `/schema-generate`, `/internal-linking`). End with a 0–100 score and top-5 actions by ROI ÷ effort. Note which fixes need the platform pack to apply.
