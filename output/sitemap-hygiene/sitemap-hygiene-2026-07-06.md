# Workstream F — sitemap & index hygiene (F-9)

Generated 2026-07-06. **No WordPress applied.** Safe-class (Yoast settings + noindex). 27 URLs to remove from the sitemap.

## Summary
The sitemap carries 4 redirecting URLs, 4 utility/orphan pages, and 19 thin custom-taxonomy archives — all diluting crawl budget and (for the indexable ones) risking thin-content indexation. Remove them; noindex the utility + taxonomy pages so they drop from the index too.

## Exclude from sitemap — redirecting (4)
These 301, so they must not appear in the sitemap. Exclude (no noindex — they already redirect).
- `/texas-commercial-building-costs-guide/` → 301 → `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/`
- `/dental-office-construction-cost-guide/` → 301 → `/dental-office-construction-guide/`
- `/choose-a-commercial-contractor/` → 301 → `/services/architectural-design-and-engineering/`
- `/the-cost-of-a-tenant-build-out-per-square-foot/` → 301 → `/understanding-commercial-build-outs-guide/`

## Noindex + exclude — utility/orphan (4)
- `/opt-out-from-email-and-sms/`
- `/single-page/`
- `/thank-you/`
- `/locations.kml/`

## Noindex + exclude — thin taxonomy archives (19)
Custom-taxonomy term archives (~280–307w of mostly template chrome, orphaned, self-canonical, currently indexable). Standard hygiene: noindex + drop from sitemap.
- project-type (10): `/project-type/fuel-stations/`, `/project-type/fitness/`, `/project-type/corporate-interiors/`, `/project-type/multi-family-mixed-use/`, `/project-type/industrial-warehouse/`, `/project-type/hospitality-entertainment/`, `/project-type/tenant-improvements/`, `/project-type/retail-shopping-centers/`, `/project-type/healthcare-facilities/`, `/project-type/restaurants/`
- project-attributes (9): `/project-attributes/houston/`, `/project-attributes/pflugerville/`, `/project-attributes/sugarland/`, `/project-attributes/pearland/`, `/project-attributes/rosenberg/`, `/project-attributes/pasadena/`, `/project-attributes/richmond/`, `/project-attributes/league-city/`, `/project-attributes/rd-katy/`

## DO NOT exclude (Elementor false-positives)
- /locations/* (San Antonio = 2,133 words)
- /industries/* (hotel-hospitality = 1,176 words)
- /projects/* section landing pages (~305 words, legitimate)
- /blog/ (thin index — fix via F-17 category hubs, not exclusion)
These read thin only because entry-content extraction under-reads Elementor pages; body-text spot-checks confirm real content. Excluding them would drop legitimate service-area/section pages.

## Apply (gated)
Yoast → Search Appearance: set the project-type/project-attributes taxonomies to noindex + "not in sitemap"; noindex the 4 utility pages; exclude the 4 redirecting URLs. One settings change-set. Screenshot current Yoast settings first (rollback). After apply, re-submit `sitemap_index.xml` in GSC and watch Coverage for 2 weeks — no valid page should deindex.
