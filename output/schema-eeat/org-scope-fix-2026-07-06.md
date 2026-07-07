# Workstream G1 — Organization/schema scope fix (F-13)

Generated 2026-07-06. **No WordPress applied.** Safe-class (schema/config).

## Current state
- `Organization` + `GeneralContractor` JSON-LD is emitted on **all 237 non-homepage URLs** (every blog post, guide, service, location) — injected site-wide by the theme/SEO plugin.
- Rule (root CLAUDE.md): *Organization on homepage only; LocalBusiness subtype per location page; schema NAP must match visible page text + GBP byte-for-byte.*

## Target state
| Page group | Keep | Remove |
|---|---|---|
| Homepage `/` | `Organization` (single canonical org node) | — |
| Location pages (4) | `GeneralContractor`/`LocalBusiness` with real NAP + city `areaServed` (see `schema/localbusiness-*.jsonld`) | site-wide `Organization` duplicate |
| Service / contact / about pages | `GeneralContractor` where the page represents the business | duplicate `Organization` |
| Blog posts / guides | `Article` + author (see author map) | `Organization` **and** `GeneralContractor` — these are editorial content, not the business entity |

## How to apply (Yoast/theme)
The org graph is emitted globally. Restrict it: keep the Yoast "Organization" knowledge-graph on the homepage/site representation only; stop injecting `GeneralContractor` into `Article` pages. On the 4 location pages, replace the generic 6-metro `areaServed` with the city-specific version in the generated files (adds the page's own city — currently Arlington/Irving/The Woodlands are omitted from their own `areaServed`).

## NAP verified (byte-match source)
Maxx Builders · 4150 Bluebonnet Dr. Suite 102, Stafford, TX 77477 · +1-832-871-4166 — matches the live PostalAddress node on all 4 location pages. **Confirm this equals the Google Business Profile NAP before applying** (GBP not accessible from this runtime).

## areaServed additions generated
- `schema/localbusiness-arlington.jsonld` — Arlington, TX (city ADDED to areaServed — was missing)
- `schema/localbusiness-irving.jsonld` — Irving, TX (city ADDED to areaServed — was missing)
- `schema/localbusiness-the-woodlands.jsonld` — The Woodlands, TX (city ADDED to areaServed — was missing)
- `schema/localbusiness-san-antonio.jsonld` — San Antonio, TX (already present)
