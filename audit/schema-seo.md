# Schema / Structured Data Audit — maxxbuilders.com
**Audited:** 2026-06-24  
**Platform:** WordPress + Yoast SEO Premium v27.5  
**Scope:** Homepage, Houston location page, General Contracting service page, Austin cost blog post; supplemented by 47-page Firecrawl crawl export.

---

## 1. Schema Inventory — What Was Found

Each page renders two JSON-LD script blocks: one from Yoast's automatic graph and one manually injected (custom blocks added post-Yoast).

| Page | Yoast Graph Types | Custom Block Types |
|------|-------------------|--------------------|
| Homepage | WebPage, ImageObject, BreadcrumbList, WebSite, Organization + Place + GeneralContractor, PostalAddress, ImageObject | — |
| `/houston-commercial-contractors/` | WebPage, ImageObject, BreadcrumbList, WebSite, Organization + Place + GeneralContractor, PostalAddress, ImageObject | GeneralContractor, BreadcrumbList, FAQPage |
| `/austin-tx/` | WebPage, ImageObject, BreadcrumbList, WebSite, Organization + Place + GeneralContractor, PostalAddress, ImageObject | GeneralContractor, BreadcrumbList |
| `/dallas-tx/` | Same Yoast graph | GeneralContractor, BreadcrumbList |
| `/fort-worth-tx/` | Same Yoast graph | GeneralContractor, BreadcrumbList |
| `/san-antonio-tx/` | Same Yoast graph | GeneralContractor, BreadcrumbList |
| `/services/general-contracting/` | WebPage, ImageObject, BreadcrumbList, WebSite, Organization + Place + GeneralContractor, PostalAddress, ImageObject | Service, BreadcrumbList |
| `/services/construction-management/` | Same Yoast graph | Service, BreadcrumbList, FAQPage |
| `/services/design-and-build/` | Same Yoast graph | Service, BreadcrumbList, FAQPage |
| `/services/tenant-improvement/` | Same Yoast graph | Service, BreadcrumbList, FAQPage |
| `/services/preconstruction/` | Same Yoast graph | Service, BreadcrumbList |
| `/austin-commercial-construction-cost-per-square-foot-2026/` (blog) | Article, WebPage, ImageObject, BreadcrumbList, WebSite, Organization + Place + GeneralContractor, Person, PostalAddress, ImageObject | FAQPage |

---

## 2. Validation Results

### 2.1 Homepage

**Block: Yoast Graph**

| Check | Result | Notes |
|-------|--------|-------|
| `@context` is `https://schema.org` | PASS | Correct |
| `@type` values are valid | PASS | WebPage, WebSite, BreadcrumbList, ImageObject all valid |
| Organization `@type` array `["Organization","Place","GeneralContractor"]` | WARN | `Place` is not a recognized standalone type for an Organization; Yoast emits this for LocalBusiness-style enrichment, but it is semantically unusual. Not a validation error, but ambiguous. |
| Required properties present on WebPage | PASS | name, url, datePublished, dateModified, breadcrumb, inLanguage present |
| Organization sameAs LinkedIn URL | FAIL | `http://www.linkedin.com/company/maxxbuilders` uses `http://` — all other sameAs URLs are `https://`. Must be consistent. |
| Organization sameAs GBP URL | WARN | `https://goo.gl/maps/CK4gqaWr1LaQtr1d6` is a shortened URL. Google recommends a canonical GBP URL (`https://maps.app.goo.gl/...` or the direct `https://www.google.com/maps/place/...`). Shortened URLs can break. |
| `openingHoursSpecification` — Sunday | FAIL | Schema says Sunday opens 09:00–17:00 (open). Visible page text says "Sunday: Closed." This is a direct NAP inconsistency. |
| `telephone` format | PASS | `+1-832-871-4166` is E.164-compatible |
| `email` — dual values | WARN | `contactPoint.email` and `email` both say `info@maxxbuilders.com`. The Houston/Austin/Dallas/FW/SA location pages' custom GeneralContractor blocks use `businessdevelopment@maxxbuilders.com`. Two different contact emails in schema across the site with no explanation creates ambiguity. |
| `priceRange` inconsistency | FAIL | Homepage Yoast Organization block says `"priceRange": "$$"`. All five location page custom GeneralContractor blocks say `"priceRange": "$$$"`. These must match. |
| `BreadcrumbList` on homepage | WARN | Only one ListItem (position 1, "Home", no `item` URL). This is technically valid for the homepage but provides no value. No action required but noted. |
| URLs absolute | PASS | All URLs are absolute |
| Dates ISO 8601 | PASS | All dates use ISO 8601 with timezone offset |
| No placeholder text | PASS | |

---

### 2.2 Houston Location Page (`/houston-commercial-contractors/`)

**Block 1: Yoast Graph**

| Check | Result | Notes |
|-------|--------|-------|
| Organization block repeated | FAIL | Full Organization node (with all sameAs, hasOfferCatalog, openingHours) re-emitted on every page. This is not a spec violation, but it inflates page weight and means every page change requires updating the same data in Yoast settings. See Section 4 for guidance. |
| `about` link to Organization on WebPage | FAIL | Homepage WebPage node has `"about": {"@id": ".../#organization"}`. Location page WebPage node is missing this link. All location pages should link `about` to the Organization. |
| Sunday hours inconsistency | FAIL | Same issue as homepage: schema says open, page text says Closed. |
| priceRange | FAIL | Yoast block: `$$`. Custom GeneralContractor block: `$$$`. Conflict on the same page. |

**Block 2: Custom GeneralContractor**

| Check | Result | Notes |
|-------|--------|-------|
| `@type: GeneralContractor` | PASS | Valid LocalBusiness subtype |
| Required LocalBusiness properties | PASS | name, url, telephone, address, description present |
| `areaServed` structure | PASS | `{"@type":"City","name":"Houston","containedInPlace":{"@type":"State","name":"Texas"}}` — well-formed |
| `sameAs` | FAIL | Missing. Location-level GeneralContractor entities should include at minimum the GBP listing URL for the specific market (if one exists) or the corporate sameAs. |
| `geo` coordinates | FAIL | Missing from the custom GeneralContractor block. The Yoast Organization block has Houston-area coords (`29.6249, -95.5570`) but they point to Stafford HQ, not the Houston market. For location pages, geo on the GeneralContractor should represent the city served, not the office. |
| `image` / `logo` | FAIL | Missing from the custom GeneralContractor block. |
| `openingHoursSpecification` | FAIL | Missing from the custom block, which is where Google reads it for a LocalBusiness rich result. Sunday closed mismatch not correctable without fixing it here. |
| Duplicate BreadcrumbList | WARN | Two BreadcrumbList blocks on this page: one from Yoast, one from the custom block. The Yoast breadcrumb has 2 items (Home → Houston Commercial General Contractors). The custom block has 3 items (Home → Locations → Houston Commercial Contractors) with a `/locations/` middle item that returns a redirect in the crawl. The breadcrumb with the broken intermediate `item` URL is the custom one — fix or remove. |
| FAQPage present | INFO | FAQPage is on a commercial site. No Google rich result eligibility (restricted to government/healthcare since August 2023). The schema still benefits AI/LLM citation surfaces. Not a bug, but set expectations accordingly. |
| FAQPage schema validity | PASS | All three Questions have `name` and `acceptedAnswer.text` |

---

### 2.3 General Contracting Service Page (`/services/general-contracting/`)

**Block 1: Yoast Graph**

| Check | Result | Notes |
|-------|--------|-------|
| WebPage type | PASS | Standard WebPage (not Article) — correct for a service page |
| `primaryImageOfPage` | WARN | Points to `monitor-1.png` (a 256×256 icon). This is the page's featured image in WordPress. It should be a meaningful, real content image of a construction project, not an icon. Google uses this for rich results previews. |
| Organization repeated | FAIL | Same full Organization block as all other pages |

**Block 2: Custom Service Block**

| Check | Result | Notes |
|-------|--------|-------|
| `@type: Service` | PASS | Valid |
| `name` | PASS | "Commercial General Contracting" |
| `provider` links to Organization | PASS | Uses `{"@id": ".../#organization"}` — correct |
| `areaServed` | PASS | `{"@type":"State","name":"Texas"}` |
| `url` | PASS | Absolute, self-referencing |
| Missing recommended properties | WARN | No `serviceType`, no `description` (on the Service node itself — there is one on the WebPage), no `offers`. Adding `serviceType` and `offers` improves entity clarity for AI engines. |
| No `@id` on Service node | WARN | The Service node has no `@id`. Without it, other nodes cannot reference it. Add `"@id": "https://www.maxxbuilders.com/services/general-contracting/#service"` |

---

### 2.4 Blog Post (`/austin-commercial-construction-cost-per-square-foot-2026/`)

**Block 1: Yoast Graph**

| Check | Result | Notes |
|-------|--------|-------|
| `@type: Article` | PASS | Valid; Yoast correctly detects post type |
| `author.name` | PASS | "Harris Khan" — real named author, good for E-E-A-T |
| `author.@id` | PASS | Links to Person entity in the same graph |
| `Person` entity completeness | FAIL | The Person node has only `@type`, `@id`, and `name`. Google's Article rich result recommends `url` (author profile page), `sameAs` (LinkedIn, etc.), and `jobTitle` on the Person entity. Without these, E-E-A-T signals are weakened. |
| `image` | PASS | Links to ImageObject with 1200×628 PNG — correct OG dimensions |
| `wordCount: 801` | WARN | 801 words is thin for a cost-guide post targeting competitive queries. Not a schema issue, but flags a content gap. |
| `articleSection` | PASS | `["Commercial Construction"]` present |
| `headline` vs page `name` | WARN | Article `headline` is "Austin Commercial Construction Cost Per Square Foot (2026)" (58 chars). WebPage `name` is "Austin Commercial Construction Cost Per SF (2026)" (48 chars — abbreviated). These should match exactly for consistency. |
| `dateModified` vs `datePublished` | PASS | Modified 2026-05-19, published 2026-05-18 — 1 day gap, plausible |
| Organization repeated | FAIL | Same issue as all other pages |

**Block 2: Custom FAQPage**

| Check | Result | Notes |
|-------|--------|-------|
| `@type: FAQPage` | INFO | Same commercial-site caveat as Houston page. Fine for AI surfaces. |
| Five questions with valid structure | PASS | All have `name` and `acceptedAnswer.text` |
| FAQPage has no `@id` | WARN | Add `@id` so it can be referenced if needed |
| FAQPage has no `url` or `mainEntityOfPage` | WARN | Add `"url": "https://www.maxxbuilders.com/austin-commercial-construction-cost-per-square-foot-2026/"` to anchor it to the page |

---

## 3. NAP Consistency Audit

**Schema NAP (from Organization / GeneralContractor nodes):**
- Phone: `+1-832-871-4166`
- Address: 4150 Bluebonnet Dr. Suite 102, Stafford, TX 77477
- Hours (schema): Mon–Sun 09:00–17:00
- Email (Org/ContactPoint): `info@maxxbuilders.com`
- Email (custom blocks): `businessdevelopment@maxxbuilders.com`

**Visible page text (from Firecrawl bodyText):**
- Phone: `832.871.4166` — matches schema (format variant, not a conflict)
- Email: `businessdevelopment@maxxbuilders.com` — visible on location pages; mismatches the `info@` in the Yoast Organization node
- Hours: `Mon–Fri: 8:30 AM – 6:00 PM | Saturday: 9:00 AM – 5:00 PM | Sunday: Closed`

**NAP Conflicts Found:**

| Field | Schema Value | Visible Text Value | Verdict |
|-------|-------------|-------------------|---------|
| Sunday hours | Open 09:00–17:00 | Closed | **CRITICAL mismatch** |
| Weekday open time | 09:00 | 8:30 AM | **CRITICAL mismatch** |
| Saturday close time | 17:00 | 5:00 PM | Match (same value, 12h vs 24h) |
| Contact email | `info@maxxbuilders.com` | `businessdevelopment@maxxbuilders.com` | **Inconsistency** |
| priceRange | `$$` (Org) vs `$$$` (location custom blocks) | — | **Inconsistency** |

The hours conflict is the highest-severity issue. Google's local algorithms cross-reference `openingHoursSpecification` against GBP data and visible page text. A Sunday mismatch can trigger a ranking trust penalty or suppress business hours in search results.

---

## 4. Organization Schema on Non-Homepage Pages

**Finding: FAIL.**

The full `["Organization","Place","GeneralContractor"]` node — including `sameAs`, `hasOfferCatalog`, `openingHoursSpecification`, `knowsAbout`, `geo`, `contactPoint` — is emitted by Yoast on every single page (47 pages in the crawl). This is not a spec violation, but it creates three practical problems:

1. **Duplication at scale.** Any change to Organization data (address, hours, etc.) must be made once in Yoast settings, but the schema is baked into cached page output. Cache purges are needed after each update.
2. **Authority dilution risk.** The `about` property on WebPage nodes (which Google uses to tie a page to its subject entity) only appears on the homepage. All other pages emit the full Org node without `about`, creating ambiguous entity-to-page relationships.
3. **CLAUDE.md rule violation.** The site SEO rules state "Organization on homepage only; LocalBusiness subtype per location page." The custom location page blocks correctly implement this pattern with `GeneralContractor` (a LocalBusiness subtype), but Yoast's automatic graph undermines it by repeating the full Org on every page.

**Recommended fix:** In Yoast SEO settings, use the `wpseo_schema_graph_pieces` filter to strip the full Organization node from non-homepage pages and replace with a lightweight `{"@id": "https://www.maxxbuilders.com/#organization"}` reference only. The existing custom per-page blocks already do this correctly with `"parentOrganization": {"@id": ".../#organization"}`.

---

## 5. Missing Schema Opportunities

| Opportunity | Pages | Priority | Rationale |
|-------------|-------|----------|-----------|
| `Person` entity enrichment (author bio) | All blog posts | HIGH | Article rich results require a credible author. Harris Khan's Person node has no `url`, `sameAs`, `jobTitle`, or `description`. Google uses these for E-E-A-T scoring on YMYL-adjacent content. |
| Fix `openingHoursSpecification` | All pages (Yoast Org + custom location blocks) | CRITICAL | Sunday must be removed or set to `"closes": "00:00"` and `"opens": "00:00"` to indicate closed. Weekday open time must change to 08:30. |
| `AggregateRating` | Homepage, location pages | HIGH | 340+ completed projects across 5 Texas markets — if reviews exist on GBP or another verifiable platform, aggregate ratings on LocalBusiness entities add a rich result opportunity. Only add if a real review source backs the data. |
| `VideoObject` | Homepage, project pages | MEDIUM | YouTube channel `@buildsmarttv` exists in sameAs. If project videos are embedded on the site, adding VideoObject schema for each unlocks video rich results. |
| `Service` `@id` and `serviceType` | All 6 service pages | MEDIUM | Current Service blocks lack `@id` and `serviceType`. Needed for proper entity referencing and AI-engine comprehension. |
| `Article` `headline` / `WebPage` `name` alignment | All blog posts | LOW | Headline and page name should match exactly. Current blog post has divergent values. |
| `FAQPage` anchor properties | Blog posts with FAQ | LOW | Add `url` and `@id` to standalone FAQPage blocks so they're properly anchored to their page. |
| Location pages `geo` | Austin, Dallas, FW, SA | MEDIUM | Custom GeneralContractor blocks have no `geo` coordinates. Each city-level entity should have its own GeoCoordinates pointing to the city center, not the Stafford HQ. |
| Location pages `image`/`logo` | All location pages | LOW | Custom GeneralContractor blocks have no `image` or `logo` property. Recommended for LocalBusiness rich results. |
| `WebPage` `about` on location/service pages | All non-homepage pages | MEDIUM | Only the homepage WebPage links `about` to the Organization. Location pages should link `about` to their GeneralContractor entity; service pages should link `about` to their Service entity. |

---

## 6. Recommended JSON-LD Fixes

### Fix 1: Corrected `openingHoursSpecification` (all pages via Yoast)

Replace the current single-block covering all 7 days with split blocks:

```json
"openingHoursSpecification": [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "08:30",
    "closes": "18:00"
  },
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Saturday"],
    "opens": "09:00",
    "closes": "17:00"
  }
]
```

Sunday is omitted entirely — Schema.org convention for closed days is to omit them from `openingHoursSpecification`.

---

### Fix 2: Enriched `Person` entity for blog author (add via Yoast user profile or custom filter)

```json
{
  "@type": "Person",
  "@id": "https://www.maxxbuilders.com/#/schema/person/1aec90c20d9af985eee9a724fa819c31",
  "name": "Harris Khan",
  "jobTitle": "CEO, Maxx Builders",
  "url": "https://www.maxxbuilders.com/about/",
  "sameAs": [
    "http://www.linkedin.com/company/maxxbuilders"
  ],
  "worksFor": {
    "@id": "https://www.maxxbuilders.com/#organization"
  }
}
```

---

### Fix 3: LinkedIn sameAs corrected to https

In the Yoast Organization block, change:
```
"http://www.linkedin.com/company/maxxbuilders"
```
to:
```
"https://www.linkedin.com/company/maxxbuilders"
```

---

### Fix 4: Service schema with `@id` and `serviceType` (template for all service pages)

Replace the current bare Service block on `/services/general-contracting/`:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": "https://www.maxxbuilders.com/services/general-contracting/#service",
      "name": "Commercial General Contracting",
      "serviceType": "Commercial General Contracting",
      "description": "Traditional bid-build commercial construction with transparent pricing, bonded performance, and experienced field supervision across Texas.",
      "provider": {
        "@id": "https://www.maxxbuilders.com/#organization"
      },
      "areaServed": {
        "@type": "State",
        "name": "Texas"
      },
      "url": "https://www.maxxbuilders.com/services/general-contracting/",
      "offers": {
        "@type": "Offer",
        "url": "https://www.maxxbuilders.com/get-a-quote/"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://www.maxxbuilders.com/services/general-contracting/#custom-breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.maxxbuilders.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Services",
          "item": "https://www.maxxbuilders.com/services/"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Commercial General Contracting",
          "item": "https://www.maxxbuilders.com/services/general-contracting/"
        }
      ]
    }
  ]
}
```

Apply the same `@id` and `serviceType` pattern to all 5 remaining service pages, substituting the correct name/description/url per page.

---

### Fix 5: Corrected GeneralContractor block for location pages (Houston template)

Replace the current custom block:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "GeneralContractor",
      "@id": "https://www.maxxbuilders.com/houston-commercial-contractors/#localbusiness",
      "name": "Maxx Builders - Houston",
      "url": "https://www.maxxbuilders.com/houston-commercial-contractors/",
      "description": "Commercial general contractor serving Houston, TX. Specializing in retail, industrial, hotel, healthcare, and office construction.",
      "telephone": "+1-832-871-4166",
      "email": "businessdevelopment@maxxbuilders.com",
      "image": "https://www.maxxbuilders.com/wp-content/uploads/2023/10/cropped-Maxx-Builders-Logo-1-scaled-1.jpg",
      "logo": "https://www.maxxbuilders.com/wp-content/uploads/2023/10/cropped-Maxx-Builders-Logo-1-scaled-1.jpg",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "4150 Bluebonnet Dr. Suite 102",
        "addressLocality": "Stafford",
        "addressRegion": "TX",
        "postalCode": "77477",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "29.7604",
        "longitude": "-95.3698"
      },
      "areaServed": {
        "@type": "City",
        "name": "Houston",
        "containedInPlace": {
          "@type": "State",
          "name": "Texas"
        }
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "opens": "08:30",
          "closes": "18:00"
        },
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Saturday"],
          "opens": "09:00",
          "closes": "17:00"
        }
      ],
      "priceRange": "$$$",
      "parentOrganization": {
        "@id": "https://www.maxxbuilders.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://www.maxxbuilders.com/houston-commercial-contractors/#custom-breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.maxxbuilders.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Houston Commercial Contractors",
          "item": "https://www.maxxbuilders.com/houston-commercial-contractors/"
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.maxxbuilders.com/houston-commercial-contractors/#faq",
      "url": "https://www.maxxbuilders.com/houston-commercial-contractors/",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Who is the best commercial general contractor in Houston?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Maxx Builders is a top-rated commercial general contractor in Houston with 340+ completed projects worth over $127 million. Recognized by Inc. 5000 and EY Entrepreneur of the Year, we specialize in commercial projects from $3M to $15M for clients including Amazon, Marriott, Hilton, and regional developers."
          }
        },
        {
          "@type": "Question",
          "name": "How much does commercial construction cost in Houston?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Commercial construction costs in Houston typically range from $150-$400 per square foot depending on the project type. Retail and office spaces average $150-$250/sf, while healthcare and hospitality projects can reach $300-$400/sf. Contact Maxx Builders at 832-871-4166 for a project-specific estimate."
          }
        },
        {
          "@type": "Question",
          "name": "What types of commercial construction does Maxx Builders do in Houston?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Maxx Builders handles all types of commercial construction in Houston including retail shopping centers, industrial warehouses, hotels and hospitality, healthcare facilities, restaurants, corporate offices, multi-family developments, and tenant improvements. We serve both ground-up construction and renovation projects."
          }
        }
      ]
    }
  ]
}
```

**Geo coordinates for each city** (replace in respective location page blocks):
- Houston: `29.7604, -95.3698`
- Austin: `30.2672, -97.7431`
- Dallas: `32.7767, -96.7970`
- Fort Worth: `32.7555, -97.3308`
- San Antonio: `29.4241, -98.4936`

Also update `priceRange` in the Yoast Organization block from `$$` to `$$$` (or vice versa) so it matches the location blocks. Pick one and apply everywhere.

---

### Fix 6: Remove the `/locations/` intermediate breadcrumb item

The custom BreadcrumbList on all five location pages includes `"item": "https://www.maxxbuilders.com/locations/"` at position 2. That URL redirects (not a clean 200). Either:
- Remove position 2 (Home → City Commercial Contractors is a valid 2-item breadcrumb), or
- Fix the `/locations/` page to return a proper 200 with its own canonical and schema.

---

## 7. Priority Action List

| Priority | Issue | Fix Location |
|----------|-------|-------------|
| CRITICAL | `openingHoursSpecification` — Sunday marked open, page says Closed; weekday open time wrong | Yoast SEO settings → Knowledge Graph hours |
| CRITICAL | `priceRange` conflict (`$$` vs `$$$`) across Yoast Org and all location custom blocks | Decide on one value; update Yoast and each custom block |
| HIGH | `Person` entity for Harris Khan missing `url`, `sameAs`, `jobTitle`, `worksFor` | Yoast user profile page for Harris Khan |
| HIGH | LinkedIn `sameAs` URL uses `http://` instead of `https://` | Yoast SEO → Social tab |
| MEDIUM | Location page `GeneralContractor` blocks missing `geo`, `image`, `logo`, `openingHoursSpecification` | Custom JSON-LD per location page |
| MEDIUM | Duplicate `BreadcrumbList` nodes on location/service pages (Yoast + custom) | Remove breadcrumb from custom blocks; let Yoast own it, or add `@id` to avoid collision |
| MEDIUM | `/locations/` intermediate breadcrumb item points to a redirect URL | Fix in all 5 location page custom blocks |
| MEDIUM | `Service` nodes lack `@id` and `serviceType` | Custom JSON-LD on all 6 service pages |
| LOW | `Article` `headline` and `WebPage` `name` diverge on blog post | Yoast title / custom block alignment |
| LOW | `FAQPage` blocks missing `@id` and `url` anchor properties | Custom JSON-LD on blog posts and location pages |
| LOW | `primaryImageOfPage` on General Contracting page is a 256px icon | Set a real content photo as WordPress featured image |
| INFO | `FAQPage` on commercial site pages — no Google rich result eligibility | No action needed; retain for AI citation value |
| INFO | Full `Organization` node on every page via Yoast | Consider Yoast filter to reference-only on non-homepage pages (architectural cleanup, not a ranking issue) |
