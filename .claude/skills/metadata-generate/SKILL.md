---
name: metadata-generate
description: Generate optimized titles, meta descriptions, and canonicals for any site and output a portable file the platform pack applies. Use to fix or write metadata when you do not have direct repo access.
---

# Metadata Generation (platform-neutral)

Load CLAUDE.md. This skill GENERATES; the platform pack APPLIES. Does not write to the site directly.

## Steps

1. From the crawl/GSC, find pages with missing, duplicate, or truncated titles (> 60 chars) or descriptions (missing/ > 155 chars). Group duplicates.
2. Write a unique, intent-matched replacement per page: lead with the primary entity, match the keyword map, reflect actual page content (no invented claims).
3. Output `metadata-changes.csv` with columns:
   `url,page_id,current_title,new_title,current_description,new_description,canonical`
   - Include `page_id` when known (WordPress post ID, Webflow page/item ID) so the apply step can target it directly.
4. Produce a short summary: count changed, duplicates resolved, average title-length change.

## Apply (handoff)

- **Repo (Next.js/static):** edit `generateMetadata` / head tags at the template level.
- **WordPress:** `/wp-apply` reads `metadata-changes.csv` → WP-CLI `wp post meta update` or REST.
- **Webflow:** `/webflow-apply` reads the CSV → Data API v2 page `seo` fields (bulk).

## Guardrails

- Never change URLs/slugs here (redirect-aware, separate task).
- If > 25 rows change, present the CSV head for review before handing off.
