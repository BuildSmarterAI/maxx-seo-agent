---
name: local-page-plan
description: Plan multi-location or service-area landing pages for any platform with correct NAP and LocalBusiness schema, output as portable artifacts. Use for location pages or multi-location local SEO.
---

# Local / Multi-Location Page Plan (CMS-neutral)

Load CLAUDE.md. Stages location pages; the platform pack renders/publishes them.

## Inputs

- A locations dataset (pass as `$ARGUMENTS`): name, address, local phone, hours, geo coordinates, services, local reviews, GBP URL.

## Steps (per location)

1. Stage a page record with a unique H1 `[Service] in [City, State] | Brand`, slug `/locations/[state]/[city]`.
2. NAP designed for three placements: above-the-fold click-to-call, footer, and schema (HTML text, never image-only or client-only JS).
3. Location-specific content: nearby landmarks, neighborhoods, local projects, location reviews/staff. Target ≥ 30–50% unique content.
4. Generate `LocalBusiness` (or subtype) JSON-LD populated from the record: `PostalAddress`, `GeoCoordinates`, `openingHoursSpecification`, `sameAs` (GBP, Yelp, Apple Maps), `Service`. `AggregateRating` only if reviews are on the page.
5. Verify page-text ↔ schema ↔ GBP triangle matches byte-for-byte.
6. Output `local-manifest.md` and per-location records in `local/`.

## Apply (handoff)

- **Repo / WordPress / Webflow:** same as `/programmatic-plan` handoff, using the location records.

## Guardrails

- Service-area businesses without a storefront: target GBP service areas — do NOT fabricate location pages or use virtual-office addresses.
- Unique local phone per location, not a national 800 number.
- Warn at 30 pages, hard-stop at 50 pending doorway review.
