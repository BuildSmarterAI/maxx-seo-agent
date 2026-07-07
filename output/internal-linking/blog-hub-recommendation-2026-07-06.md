# Workstream F-17 — blog index & category-hub internal linking

Generated 2026-07-06. **No WordPress applied.** Safe-class (internal linking).

## Problem
`/blog/` is a thin index (~58 words) and ~50 older posts are reachable only through pagination — they get little internal link equity and are effectively orphaned from topical parents (see the 82-orphan list in the audit). This starves the long-tail blog of both crawl priority and topical authority signals.

## Recommendation — category-hub modules on `/blog/` (and topic pillars)
Add curated topic sections to the blog index, each linking its **cluster-survivor pillar** (from the D manifest) plus its strongest supporting posts. This gives every orphaned post a topical parent and turns `/blog/` from a thin paginated feed into a real hub.

| Hub section | Pillar (survivor) | Supporting posts to link |
|---|---|---|
| Commercial construction cost | `/texas-commercial-construction-cost-2025-2026/` | Houston, Dallas, car wash, per-SF guides |
| Cost by building type | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/`, `/medical-office-construction-costs-texas-2026-comprehensive-guide/`, `/cost-per-square-foot-build-warehouse-texas/` | sector cost + design posts |
| Tenant improvement & build-outs | `/understanding-commercial-build-outs-guide/` | TI allowance, shell structures, office/retail build-out posts |
| Design-build & GC selection | `/design-build-construction-houston-2/`, `/services/general-contracting/` | choosing-a-contractor, AIA-contracts, bid-evaluation posts |
| Project delivery | `/complete-guide-commercial-building-planning-execution/`, `/commercial-construction-project-timelines/` | scheduling, closeout, obstacles, quality-control posts |
| Financing | `/financing-options-for-commercial-construction-projects/` | construction-loan, shopping-center-financing posts |
| Sector specialties | `/dental-office-construction-guide/`, `/best-retail-construction-contractors-in-houston-2026-rankings/` | dental, retail, restaurant, franchise posts |

## Guardrails
- Pairs with the D consolidation: link only to **survivor** pillars, not pages slated to merge.
- Each orphaned post should gain at least one inbound link from its hub section (closes the F-5 orphan gap for blog posts specifically).
- Keep the blog index itself above the thin-content threshold once hubs are added.

## Apply (gated)
Content/template edit on `/blog/` (and optionally a reusable "related in this cluster" block on pillar pages). Production WordPress, backup first. Best done together with the F-5/C internal-link batch so anchor text stays consistent.
