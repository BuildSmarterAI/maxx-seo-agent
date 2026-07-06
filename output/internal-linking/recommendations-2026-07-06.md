# Internal-Linking Recommendations — maxxbuilders.com (2026-07-06)

## Summary

This artifact recommends **21 verified link changes plus one prepare-only homepage block**, all validated against the 2026-07-06 live crawl (`c-inputs.json`). It covers three fix types and two add campaigns: repointing/removing **7 broken 404 links (F-7)**, collapsing **6 redirect hops (F-15)** — four of which also correct a contractor-selection intent mismatch — de-orphaning `/3-most-common-obstacles-in-commercial-construction-projects/` with **4 contextual inbounds (F-5)**, and routing **4 topical inbounds into the flagship hotel cost guide (F-10)**. Every target is a live 200 in `allLivePages`; no self-links; no inbound links into the held `/8-key-considerations-for-building-a-restaurant/`. Nothing here is applied — this is a recommendation for operator review. The homepage "Guides & Services" block (F-6) is **prepare-only** because the homepage is `do_not_touch` and needs an explicit override.

## Broken 404 link fixes (F-7)

Dead targets that must be repointed to a live equivalent or removed. The two `/preconstruction-services/` links and one `/design-build-services/` link map cleanly to live service pages; the four `/tag/*` taxonomy archives have no live equivalent and are removed.

| Source | Target | Anchor | Why |
| --- | --- | --- | --- |
| `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` | `/services/preconstruction/` (was `/preconstruction-services/` 404) | preconstruction planning services | Dead page maps 1:1 to live preconstruction service page (inbound 49). Two identical links on this source deduped to one fix. |
| `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | `/services/preconstruction/` (was `/preconstruction-services/` 404) | preconstruction services | Same 1:1 repoint; preconstruction is directly relevant to a hotel-budget reader. |
| `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | `/services/design-and-build/` (was `/design-build-services/` 404) | design-build delivery | Chose the statewide service page (inbound 15) over the Houston money page (inbound 3). Anchor is generic delivery-method intent; a Houston-geo page would be a geo mismatch on a Texas-wide guide. |
| `/following-franchise-design-guidelines/` | *(remove — was `/tag/franchise-design/` 404)* | — | Dead `/tag/` archive, no live equivalent. Remove the broken link. |
| `/financing-options-for-shopping-center-projects-ultimate-guide/` | *(remove — was `/tag/shopping-center-financing/` 404)* | — | Dead `/tag/` archive, no live equivalent. Remove. |
| `/selecting-prime-spots-for-shopping-centers/` | *(remove — was `/tag/shopping-center-construction/` 404)* | — | Dead `/tag/` archive, no live equivalent. Remove. |
| `/picking-profitable-locations-warehouse-development/` | *(remove — was `/tag/warehouse-development/` 404)* | — | Dead `/tag/` archive, no live equivalent. Remove. |

## Redirect repoints (F-15)

Content links that currently 301 through a redirect. Repoint each directly to the resolved live 200 to eliminate the hop.

**⚠️ Four contractor-selection intent-mismatch fixes (rows 1–4 below).** These links currently 301 through `/choose-a-commercial-contractor/`, which resolves to `/services/architectural-design-and-engineering/` — the **wrong intent** for anchors about selecting/hiring a general contractor. All four are repointed to the live `/services/general-contracting/` money page (inbound 48, the strongest contractor-selection target), which fixes the intent **and** removes the redirect hop.

| Source | Target | Anchor | Why |
| --- | --- | --- | --- |
| `/navigating-aia-construction-contracts/` | `/services/general-contracting/` | choosing a commercial general contractor | **Intent-mismatch fix.** 301 currently lands on architectural-design; anchor is about hiring a GC. Repoint to live GC service page (inbound 48). |
| `/choosing-commercial-general-contractor-guide/` | `/services/general-contracting/` | our commercial general contracting services | **Intent-mismatch fix.** GC-selection guide (inbound 8) mis-routed to architectural-design. Repoint to matching GC intent, single hop. |
| `/how-to-choose-the-right-commercial-general-contractor-for-your-project/` | `/services/general-contracting/` | hiring the right general contractor for your project | **Intent-mismatch fix.** Source inbound 7; current 301 mismatches the hiring-a-GC anchor. Repoint to correct intent, collapse hop. |
| `/comprehensive-guide-to-houstons-premier-commercial-contractors/` | `/services/general-contracting/` | commercial general contracting services | **Intent-mismatch fix.** Source inbound 7; 301 lands on architectural-design. Repoint to GC service page, aligns intent, removes hop. |
| `/build-your-dream-dental-clinic-step-by-step-guide/` | `/dental-office-construction-guide/` (was `/dental-office-construction-cost-guide/`) | dental office construction cost and build-out guide | Intent already matches (dental cost/build-out); repoint straight to the resolved live URL to remove the hop. |
| `/building-the-perfect-smile-a-guide-to-dental-office-construction-and-design/` | `/dental-office-construction-guide/` (was `/dental-office-construction-cost-guide/`) | guide to dental office construction costs | Same dental redirect; repoint directly to the live final destination. Intent matches. |

## New contextual inbound links (F-5 de-orphan + F-10 hotel)

**F-5** de-orphans `/3-most-common-obstacles-in-commercial-construction-projects/` (currently inbound 0) with 4 topical inbounds from higher-authority planning/schedule pages — meeting the 3+ goal with one buffer link. **F-10** routes 4 topical inbounds into the flagship hotel cost guide (inbound 2, goal +3) from the site's top cost/demand pages.

| Source | Target | Anchor | Why |
| --- | --- | --- | --- |
| `/complete-guide-commercial-building-planning-execution/` | `/3-most-common-obstacles-in-commercial-construction-projects/` | common obstacles that derail commercial construction projects | F-5. Highest-authority planning hub in the cluster (inbound 21). Natural parent for an obstacles explainer; passes real equity to the orphan. Place in the risk/challenges section. |
| `/10-key-steps-to-a-successful-commercial-construction-project/` | `/3-most-common-obstacles-in-commercial-construction-projects/` | the most common obstacles in commercial construction | F-5. Strong link magnet (inbound 22). Step-by-step success guide is a coherent host. Place near the risk-anticipation step. |
| `/commercial-construction-project-timelines/` | `/3-most-common-obstacles-in-commercial-construction-projects/` | obstacles that commonly delay commercial projects | F-5. Schedule slippage is a subset of project obstacles — tight topical fit; page pulls real traffic (clicks 10). Place in the schedule-slippage section. |
| `/5-methods-to-accelerate-your-project-schedule/` | `/3-most-common-obstacles-in-commercial-construction-projects/` | obstacles that stall project schedules | F-5. Delay/overrun theme is a precise match (clicks 8). Provides the 4th (buffer) inbound. Place in the problem-framing intro. |
| `/texas-commercial-construction-cost-2025-2026/` | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | hotel construction costs in Texas | F-10. Highest-traffic cost guide on the site (inbound 9, clicks 52). Routes significant equity from its hospitality cost mention to the hotel money page. |
| `/top-commercial-building-types-in-demand-across-texas-2025-2027/` | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | what it costs to build a hotel in Texas | F-10. Highest inbound in the dataset (inbound 31). Hospitality building-type entry is an exact topical hand-off. |
| `/importance-of-mock-up-rooms-in-the-hospitality-industry/` | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | budgeting a Texas hotel build | F-10. Hospitality-specific (clicks 8); mock-up rooms are a hotel cost driver — natural contextual fit. Place in the intro/planning section. |
| `/how-to-keep-your-hotel-rooms-quiet-part-1-stc-rating/` | `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | the overall hotel construction budget | F-10. Hotel-specific (clicks 3); acoustic upgrades tie to total hotel build cost. 4th (buffer) inbound. Place in the intro. |

## Homepage block — PREPARE ONLY, needs `do_not_touch` override

**Do not apply.** The homepage is `do_not_touch` and requires explicit operator sign-off before any edit. This artifact applies nothing — it prepares the recommendation only.

**Rationale (F-6):** The homepage is the highest-authority node on the site (inbound 11, clicks 141) yet currently routes internal equity to only one priority money page (`/design-build-construction-houston-2/`). That strands the six cost-guide money pages — several of them top organic earners (warehouse 42 clicks, Dallas 23, car wash 22, Houston 21, medical 16, hotel 13) sitting on thin inbound counts (hotel 2, car wash 2, medical 6). A single "Guides & Services" navigational block would pass first-hop equity from the strongest source page directly into all six money guides plus the design-build service page, giving crawlers a canonical hub path to the highest-intent commercial pages.

**URL notes:** The live warehouse guide is `/cost-per-square-foot-build-warehouse-texas/` (the CLAUDE.md keyword-map slug `/warehouse-construction-cost-per-square-foot-a-comprehensive-guide/` is **not** in `allLivePages`). The live design-build page is `/design-build-construction-houston-2/` (already homepage-linked; retained to keep one consolidated hub).

Proposed block (all seven verified live 200; no self-link; none into the held restaurant page):

| Target | Anchor |
| --- | --- |
| `/the-ultimate-2026-hotel-construction-cost-guide-texas-edition/` | 2026 Texas hotel construction cost guide |
| `/medical-office-construction-costs-texas-2026-comprehensive-guide/` | Texas medical office construction costs (2026) |
| `/cost-per-square-foot-build-warehouse-texas/` | Texas warehouse cost per square foot |
| `/commercial-construction-cost-houston-tx/` | Houston commercial construction costs |
| `/dallas-commercial-construction-costs-2025-2026/` | Dallas commercial construction costs |
| `/cost-to-build-a-car-wash-in-texas/` | cost to build a car wash in Texas |
| `/design-build-construction-houston-2/` | design-build construction in Houston |

**Before applying (if overridden):** escalate for operator sign-off → confirm a restorable production backup → export the homepage content + SEO meta → apply as one small batch → verify rendered output before proceeding.

## Screened out

No proposals were rejected during verification — the rejected-proposals list is empty. One item is **held, not screened**: `/8-key-considerations-for-building-a-restaurant/` receives **no** inbound link proposals in this pass, pending the separate restaurant-cluster decision.

## How to apply

- **Production WordPress, no staging.** Every apply is production-only. Confirm a restorable backup and export affected post content + SEO meta before touching anything.
- **Small approved batches.** Apply in small batches and verify rendered output after each batch. Suggested grouping: (1) the 7 F-7 broken-link fixes, (2) the 6 F-15 redirect repoints, (3) the 8 F-5/F-10 adds. Do not bundle all 21 into one write.
- **Homepage needs override.** The F-6 homepage block is prepare-only — do not apply without an explicit `do_not_touch` override and operator sign-off.
- **Restaurant orphan held.** Do not add any inbound link into `/8-key-considerations-for-building-a-restaurant/` until the cluster decision lands.
- This is a recommendation artifact only — nothing here has been applied and no files were written.
