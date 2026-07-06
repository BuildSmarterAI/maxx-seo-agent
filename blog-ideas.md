# Blog Ideas — Maxx Builders (maxxbuilders.com)

**Generated:** 2026-06-25
**Synthesized from:** `audit/content-seo.md`, `audit/cluster-seo.md`, `audit/sxo-seo.md`, `ACTION-PLAN.md`, root `CLAUDE.md` keyword/entity map, and the existing draft/published content set.
**Filter applied:** Every idea below clears the information-gain test — *"if this post vanished, would a buyer lose data they can't get elsewhere?"* Commodity "7 tips" angles with no proprietary data were rejected. Priority ideas are powered by Maxx operator data: real completed projects (Home2Suites Richmond 90,500 sq ft, Comfort Suites Pasadena, Holiday Inn Express Pflugerville 114,700 sq ft; named clients Heartland Dental, Anytime Fitness, King Spa, Shoe Palace) and first-hand metro permitting/cost experience.

---

## Data caveat (read before prioritizing)

**No live GSC export exists in this repo** (only `scripts/sensor-gsc.mjs`, the sensor, not its output). Striking-distance scoring below is *inferred*, not measured. The one strong signal we do have: the SXO audit found Maxx Builders **already surfaces multiple times** in the `commercial construction cost per square foot Texas` SERP — meaning the cost-cluster strategy is working and the fastest wins are *completing that cluster* and *building the contextual links into it*. **Run `npm run sensors` (GSC) and re-run `/gsc-opportunity-mining` before final commissioning** to confirm position 5–20 queries and to validate the demand assumptions on Tier 2–4.

**Cannibalization guardrails carried from CLAUDE.md / cluster audit:**
- Restaurant cluster already has **two** competing pages (`/8-key-considerations-for-building-a-restaurant/` + `/cost-efficient-strategies-restaurant-construction/`). **Do not write a third.** → merge/refresh, see calendar.
- City *cost* posts already exist for Austin, Houston, Dallas; *do not* duplicate. Fort Worth + San Antonio are the only city-cost gaps.
- Warehouse/medical-office/car-wash/tenant-buildout *cost* posts already exist — new ideas below target *different intent* (industry pillar, process, comparison), not a second cost page.

**Scoring:** Priority = Demand × Commercial value × Win-ability (each 1–5; max 125). Effort: S (≤1 day), M (2–3 days), L (4+ days / needs operator interview).

---

## TIER 1 — Highest priority (completes a working cluster + supports a weak page)

### 1. Fort Worth Commercial Construction Cost Per Square Foot (2026)
- **Slug:** `/fort-worth-commercial-construction-cost-per-square-foot-2026/` · **Cluster:** City Cost (spoke) → pillar: Texas Commercial Construction Cost
- **Primary query:** `fort worth commercial construction cost per square foot`
- **Fan-out:** how much to build a warehouse in Fort Worth · DFW vs Dallas construction cost difference · Fort Worth permitting timeline · cost to build an office in Fort Worth · Alliance/north Fort Worth industrial build cost
- **Intent / conversion path:** Informational → `/fort-worth-tx/` → inquiry form.
- **Information-gain angle:** Real DFW-metro cost deltas Maxx has seen vs the Dallas baseline, plus Fort Worth–specific permitting reality (not generic national RSMeans numbers). Directly closes the last hole in a cluster Google already rewards Maxx for.
- **AI-citation potential:** High — clean cost-by-building-type table + "How much…" FAQ block = extractable answer.
- **Internal links:** pillar cost guide, `/fort-worth-tx/`, `/services/general-contracting/`, warehouse cost post.
- **Format:** Cost breakdown + data table + FAQ.
- **Priority:** 5×5×5 = **125** · **Effort: M**

### 2. San Antonio Commercial Construction Cost Per Square Foot (2026)
- **Slug:** `/san-antonio-commercial-construction-cost-per-square-foot-2026/` · **Cluster:** City Cost (spoke)
- **Primary query:** `san antonio commercial construction cost per square foot`
- **Fan-out:** San Antonio commercial building cost · is it cheaper to build in San Antonio than Austin · San Antonio Development Services permit timeline · cost to build retail in San Antonio
- **Intent / conversion path:** Informational → `/san-antonio-tx/` → inquiry. (Also gives the broken San Antonio location page a real reason to link out once its copy-paste H3 is fixed per ACTION-PLAN C2.)
- **Information-gain angle:** The hotel guide already cites San Antonio at **−5% vs DFW baseline** — extend that proprietary differential across building types. City-of-San-Antonio Development Services permitting context Maxx has lived through.
- **AI-citation potential:** High — same table+FAQ pattern.
- **Internal links:** pillar cost guide, `/san-antonio-tx/`, `/services/general-contracting/`.
- **Format:** Cost breakdown + data table + FAQ.
- **Priority:** 5×5×5 = **125** · **Effort: M**

### 3. Design-Build vs. General Contracting vs. CMAR: Which Delivery Model Fits Your Texas Project?
- **Slug:** `/design-build-vs-general-contracting-vs-cmar-texas/` · **Cluster:** Delivery-Model / Buyer Decision (pillar feeding the Services hub)
- **Primary query:** `design build vs general contractor`
- **Fan-out:** what is CMAR construction · design-build vs design-bid-build · which delivery method is cheapest · GMP vs lump sum which is better · when to use a construction manager
- **Intent / conversion path:** Informational → split CTA to `/services/design-and-build/` **and** `/services/general-contracting/` (the two highest-value service pages, both currently link nowhere).
- **Information-gain angle:** Most competitor versions are generic. Maxx's edge: *show which model it actually used on named jobs and why* — e.g., the delivery method on Home2Suites Richmond vs. Holiday Inn Express Pflugerville — turning a definitional post into an experience-backed decision guide. This is exactly the "CM vs GC" gap the SXO audit flagged as high-value PAA traffic Maxx currently captures with zero content.
- **AI-citation potential:** Very high — a comparison table (model × who-owns-risk × best-for × typical cost impact) is prime AI-Overview citation material.
- **Internal links:** `/services/design-and-build/`, `/services/general-contracting/`, `/services/construction-management/`, `/services/preconstruction/`.
- **Format:** Comparison guide + decision table.
- **Priority:** 5×5×4 = **100** · **Effort: M**

### 4. Commercial Construction Timeline in Texas: How Long Each Project Type Really Takes
- **Slug:** `/commercial-construction-timeline-texas/` · **Cluster:** Buyer Process (pillar)
- **Primary query:** `commercial construction timeline`
- **Fan-out:** how long to build a hotel · how long does a warehouse take to build · construction schedule phases explained · how long does commercial permitting take in Texas · why do construction projects get delayed
- **Intent / conversion path:** Informational → `/services/construction-management/` / `/services/preconstruction/` → inquiry.
- **Information-gain angle:** Real start-to-CO durations from completed Maxx projects by type (90,500 sq ft hotel, 114,700 sq ft hotel, TI vs ground-up), broken into preconstruction → permitting → vertical → closeout. Pairs naturally with the existing `/best-practices-for-a-zero-punch-list/` and `/6-tips-to-avoid-common-construction-delays/` posts (interlink, don't overlap). Almost no competitor publishes *actual* phase durations.
- **AI-citation potential:** High — "How long does it take to build a [type] in Texas?" with a duration table.
- **Internal links:** `/services/construction-management/`, `/services/preconstruction/`, zero-punch-list post, delays post, hotel cost guide.
- **Format:** Guide + timeline/Gantt-style table + FAQ.
- **Priority:** 5×4×5 = **100** · **Effort: L** (needs an operator interview for real durations)

---

## TIER 2 — Service-page + process support (service pages have near-zero inbound links)

### 5. Construction Management Services in Texas: What CMAR Is, When to Use It, and What It Costs
- **Slug:** `/construction-management-services-texas/` · **Cluster:** Services support → `/services/construction-management/`
- **Primary query:** `construction management services texas`
- **Fan-out:** what does a construction manager do · CM fee percentage · agency CM vs CMAR · construction manager vs general contractor · Procore project reporting for owners
- **Intent / conversion path:** Informational → `/services/construction-management/` → inquiry.
- **Information-gain angle:** SXO audit shows the live CM page is 254 words and *never explains CM vs GC* — the exact PAA question driving the SERP. Add Maxx's owner-facing deliverables, reporting cadence, and a real CM project's budget/schedule outcome. CM-fee transparency is rare and citable.
- **AI-citation potential:** High (definitional + fee FAQ).
- **Internal links:** `/services/construction-management/`, delivery-model post (#3), `/services/preconstruction/`.
- **Format:** Educational service guide.
- **Priority:** 4×5×4 = **80** · **Effort: M**

### 6. Preconstruction Services: Why the Phase Before Groundbreaking Decides Whether You Hit Budget
- **Slug:** `/preconstruction-services-texas/` · **Cluster:** Services support → `/services/preconstruction/`
- **Primary query:** `preconstruction services commercial construction`
- **Fan-out:** what is preconstruction · preconstruction checklist · value engineering construction · how to budget before design is finished · preconstruction vs estimating
- **Intent / conversion path:** Informational → `/services/preconstruction/` (currently 0–2 inbound links) → inquiry.
- **Information-gain angle:** Tie to real outcomes — where preconstruction value-engineering saved cost on a named Maxx build. The "what value engineering actually changed on a project" angle is proprietary and trust-building.
- **AI-citation potential:** Medium-high.
- **Internal links:** `/services/preconstruction/`, timeline post (#4), delivery-model post (#3).
- **Format:** Educational service guide.
- **Priority:** 4×4×4 = **64** · **Effort: M**

### 7. Commercial Construction Permitting in Texas: Houston vs. Austin vs. Dallas vs. San Antonio Timelines
- **Slug:** `/commercial-construction-permitting-texas-by-city/` · **Cluster:** Buyer Process / Local (cross-links every city page)
- **Primary query:** `commercial construction permit timeline texas`
- **Fan-out:** how long does a Houston commercial permit take · City of Austin permitting timeline · Dallas building permit process · San Antonio Development Services · how to speed up commercial permitting
- **Intent / conversion path:** Informational → relevant city page (`/houston-commercial-contractors/`, `/austin-tx/`, etc.) → inquiry.
- **Information-gain angle:** **Strongest pure-operator-data idea here.** The blog already quotes Austin's 6–12 week window first-hand. A side-by-side of *real* permit timelines across the four metros, from a GC who has actually pulled them, is something no national source and few competitors can produce. Becomes the contextual link hub the location pages desperately need (per cluster audit, every city page links only to the inquiry form).
- **AI-citation potential:** Very high — a city × permit-timeline table is exactly what AI assistants pull for "how long does a permit take in [city]."
- **Internal links:** all 5 city pages, `/services/preconstruction/`, timeline post (#4).
- **Format:** Comparison guide + city table + FAQ.
- **Priority:** 4×4×5 = **80** · **Effort: L** (needs operator confirmation of per-city timelines)

### 8. Commercial Construction Contract Types Explained: GMP vs. Lump Sum vs. Cost-Plus (Texas 2026)
- **Slug:** `/commercial-construction-contract-types-explained/` · **Cluster:** Buyer Decision
- **Primary query:** `commercial construction contract types`
- **Fan-out:** what is a GMP contract · cost plus vs fixed price construction · which construction contract protects the owner · GMP vs lump sum · construction contract risk
- **Intent / conversion path:** Informational → `/services/general-contracting/` / `/services/construction-management/`.
- **Information-gain angle:** Frame each contract type around *who carries which risk* with a Maxx perspective on when it recommends each — decision guidance, not a glossary. Pairs with the delivery-model post (#3) without overlapping (delivery model ≠ contract structure).
- **AI-citation potential:** Very high (definitional comparison table).
- **Internal links:** delivery-model post (#3), `/services/general-contracting/`, financing/loan posts.
- **Format:** Comparison guide + risk-matrix table.
- **Priority:** 4×4×4 = **64** · **Effort: M**

---

## TIER 3 — Industry pillars (build out the orphaned `/industries/` hub)

### 9. Industrial & Warehouse Construction in Texas: Tilt-Up vs. PEMB, Costs, and Specs
- **Slug:** `/industries/industrial-warehouse-construction-texas/` (expand existing thin page, don't create a duplicate) · **Cluster:** Industry pillar
- **Primary query:** `industrial warehouse construction texas`
- **Fan-out:** tilt-up vs pre-engineered metal building · clear height for distribution centers · dock door count planning · DFW industrial submarkets · how much per sq ft for a warehouse (link to existing cost post, don't re-answer)
- **Intent / conversion path:** Commercial → `/services/general-contracting/`, `/projects/industrial-and-warehouse/`.
- **Information-gain angle:** Structural-system tradeoffs (tilt-up vs PEMB) with the cost/schedule implications Maxx has seen — the SXO audit specifically flagged that industrial buyers bounce because no page proves industrial expertise. This is the *pillar*; the existing warehouse **cost** post is the spoke. Watch cannibalization: this page answers "how to build / what to choose," the cost post answers "how much."
- **AI-citation potential:** High (system comparison table).
- **Internal links:** warehouse cost post, `/projects/industrial-and-warehouse/`, `/industries/` hub, permitting post (#7).
- **Format:** Industry pillar guide.
- **Priority:** 4×4×3 = **48** · **Effort: L**

### 10. Multi-Family & Mixed-Use Construction Cost in Texas (2026)
- **Slug:** `/multi-family-construction-cost-texas/` · **Cluster:** Industry Cost (confirmed gap)
- **Primary query:** `multifamily construction cost per unit texas`
- **Fan-out:** cost per door to build apartments Texas · podium vs wrap construction cost · mixed-use development cost · garden apartment construction cost
- **Intent / conversion path:** Informational → `/projects/multi-family-and-mixed-use/`, `/services/general-contracting/`.
- **Information-gain angle:** Cost-per-door (not just per-SF) and the podium/wrap/garden cost spread, framed with Maxx's mixed-use experience. The mock-up-rooms draft already touches multi-family — interlink, don't overlap (that post is process; this is cost).
- **AI-citation potential:** High (cost-per-door table).
- **Internal links:** mock-up rooms post, `/projects/multi-family-and-mixed-use/`, pillar cost guide.
- **Format:** Cost breakdown + table + FAQ.
- **Priority:** 3×4×3 = **36** · **Effort: M** (confirm not already in the 80+ uncrawled post archive first)

---

## TIER 4 — Financing adjacency + proprietary case study

### 11. SBA 504 vs. Conventional Financing for Commercial Construction in Texas
- **Slug:** `/sba-504-vs-conventional-commercial-construction-financing-texas/` · **Cluster:** Financing (spoke off existing loan post)
- **Primary query:** `sba 504 loan commercial construction`
- **Fan-out:** SBA 504 vs 7a · construction-to-permanent loan · how much down payment for commercial construction loan · owner-occupied vs investment financing
- **Intent / conversion path:** Informational → `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/` → inquiry. **Risk class note: YMYL-adjacent (financial). Keep claims sourced and conservative; this is `gated` territory per workflow rules — escalate/human-review before publishing.**
- **Information-gain angle:** Tie financing structures to *construction draw schedules* — how loan type affects the build cash-flow — the GC angle a generic finance blog can't write.
- **AI-citation potential:** Medium-high (comparison table).
- **Internal links:** existing construction-loans post, financing-options post, contract-types post (#8).
- **Format:** Comparison guide.
- **Priority:** 3×4×3 = **36** · **Effort: M** · **⚠ Gated (financial) — route through escalation**

### 12. Case Study: What a 90,500 sq ft Hilton Hotel Actually Cost and Took to Build in Texas
- **Slug:** `/case-study-home2suites-hilton-richmond-tx-hotel-construction/` · **Cluster:** Proof / Case Study (E-E-A-T anchor)
- **Primary query:** `hotel construction case study texas` (long-tail; demand is low but trust/citation value is exceptional)
- **Fan-out:** real hotel build cost per key · how long to build a Hilton · hotel construction challenges · Home2Suites construction
- **Intent / conversion path:** Trust/Experience → hotel cost guide → inquiry.
- **Information-gain angle:** **Pure proprietary data** — a real completed project (Home2Suites Richmond, 90,500 sq ft) with cost-per-key, schedule, and one challenge solved. This is the single best E-E-A-T and AI-citation asset Maxx can create; the content audit notes its project-experience block is *the only first-hand Experience signal in the entire 47-page crawl*. Case studies are uncopyable by definition.
- **AI-citation potential:** Very high — specific named project + numbers.
- **Internal links:** hotel cost guide, `/projects/hospitality-entertainment/`, `/industries/hotel-hospitality-construction-texas/`.
- **Format:** Case study. (Repeatable template → Holiday Inn Express Pflugerville, Comfort Suites Pasadena as a series.)
- **Priority:** 3×5×4 = **60** · **Effort: L** (needs operator interview + client permission to publish numbers)

> Note: #12 scores 60 on the formula but its *strategic* value (E-E-A-T lift across the whole domain, reusable series template) argues for promoting it into the Month-1/2 window despite low raw search demand. Flagged for human call.

---

## 90-Day Content Calendar

| Month | Write NEW (priority order) | Refresh / Merge (don't write new) |
|---|---|---|
| **Month 1 (Jul)** | #1 Fort Worth cost · #2 San Antonio cost · #3 Delivery-model decision guide | **Hotel cost guide:** fix H1 + author placeholder (ACTION-PLAN C6/C7) before adding the case-study link. **Austin/Houston/Dallas cost posts:** add the bidirectional city-page ↔ cost-post links (M5). |
| **Month 2 (Aug)** | #7 Permitting-by-city (operator-data flagship) · #5 Construction Management guide · #12 Hotel case study *(promote for E-E-A-T)* | **Restaurant cluster:** MERGE `/8-key-considerations-for-building-a-restaurant/` + `/cost-efficient-strategies-restaurant-construction/` into one canonical guide, 301 the loser (cannibalization flagged in CLAUDE.md). Verify no third restaurant page is commissioned. |
| **Month 3 (Sep)** | #4 Timeline guide · #6 Preconstruction guide · #8 Contract types | **`/industries/` hub:** expand 95→400+ words (M8) and wire #9 industrial pillar into it. **Tenant-improvement:** confirm `/the-cost-of-a-tenant-build-out-per-square-foot/` vs `/mastering-tenant-improvement-construction-...` aren't cannibalizing before adding anything. |
| **Backlog / Q4** | #9 Industrial pillar (L) · #10 Multi-family cost · #11 SBA 504 *(gated — escalate)* | Build out the Holiday Inn Express + Comfort Suites case studies as a series once #12 proves the template. |

**Gate before commissioning any of the above:** run `npm run sensors` + `/gsc-opportunity-mining` to validate demand, and **re-crawl** to confirm none of the 80+ uncrawled live posts already cover these (the cluster audit warns the live content set is far larger than the 47-page crawl).

**Hand-off:** approved ideas → `/blog-write` (one slug at a time). Every draft must ship with: named credentialed author (Harris Khan, per `user-linkedin` memory), a TL;DR/Quick-Answer block, at least one comparison/data table, FAQ H2, and ≥3 internal links from the targets listed above.
