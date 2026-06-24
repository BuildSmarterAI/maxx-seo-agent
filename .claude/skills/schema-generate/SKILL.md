---
name: schema-generate
description: Generate valid JSON-LD structured data for any site as portable files the platform pack injects. Use for schema markup, rich results, or LocalBusiness markup without repo access.
---

# Schema (JSON-LD) Generation (platform-neutral)

Load CLAUDE.md. Generates JSON-LD files; the platform pack injects them.

## Steps

1. Decide the type per page/template:
   - Homepage: `Organization` (name, url, logo, sameAs).
   - Articles: `Article` + `BreadcrumbList`.
   - Service pages: `Service` (name, description, areaServed, provider).
   - FAQ blocks: `FAQPage`.
   - Location pages: `LocalBusiness` or specific subtype (`GeneralContractor`, `ProfessionalService`) with `PostalAddress`, `GeoCoordinates`, `openingHoursSpecification`, `sameAs`, `Service`. Add `AggregateRating` only if reviews are on the page.
2. Generate one JSON-LD block per page into `schema/{slug}.jsonld`, populated from the data source (never one block reused with the city swapped).
3. For location pages, verify address/phone/hours match the visible page text and GBP byte-for-byte.
4. Output `schema-manifest.csv`: `url,page_id,type,jsonld_path`.

## Apply (handoff)

- **Repo:** inject server-side in the metadata layer / a server component.
- **WordPress:** `/wp-apply` adds via a header snippet keyed to post ID, or a schema field.
- **Webflow:** `/webflow-apply` injects via per-page custom code (`<head>`), or the page custom-code field.

## Guardrails

- Server-render where possible; JS-injected JSON-LD is less reliable for crawlers.
- One canonical schema graph per page; no conflicting duplicate types. Validate against Rich Results Test expectations.
