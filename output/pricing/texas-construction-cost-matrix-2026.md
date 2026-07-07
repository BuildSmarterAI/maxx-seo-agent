# Canonical Texas Commercial Construction Cost Matrix — 2026

> **Status: GATED recommendation.** Pricing is a gated risk class (brand/pricing/positioning)
> and this content is YMYL-adjacent (owners use it for financing). These are **planning
> benchmarks reconciled from the ranges the cluster pages already publish and cite** (RSMeans
> Building Construction Cost Data 2025, Gordian Q1 2025 Construction Cost Report, Turner Cost
> Index), normalized to one explicit scope per table — **not** new primary cost research.
> Do not apply to live pages without operator sign-off. Every page in the cost cluster should
> cite THIS matrix so the same building type never shows two different ranges again.

## Why the pages currently conflict

The cross-page "conflicts" are ~80% **undefined scope**, not bad data. Example: hotels read
`$260–$450` on the statewide page and `$500–$930` on the timelines page. Both are right —
the first is *construction hard cost* (excl. FF&E), the second is *all-in delivered* (incl.
FF&E + site). The fix is to label scope explicitly and keep each page in one lane.

---

## Table A — Hard cost $/SF by city × project type

**Scope:** construction hard cost — shell + building-standard interior finish. **Excludes**
land, soft costs (A&E, permits, financing), FF&E, and premium/tenant-specific fit-out.
Cells = statewide by-type base × metro factor (Table B), rounded to the nearest \$5.

| Project type | Houston | Dallas | Fort Worth | Austin | San Antonio |
|---|---|---|---|---|---|
| Industrial / Warehouse | $125–$245 | $130–$255 | $130–$250 | $145–$280 | $115–$225 |
| Office / Corporate | $185–$320 | $190–$335 | $190–$325 | $215–$370 | $170–$295 |
| Retail / Restaurant | $205–$360 | $210–$375 | $210–$365 | $235–$415 | $190–$335 |
| Multifamily / Mixed-Use | $195–$340 | $200–$355 | $200–$345 | $225–$390 | $180–$315 |
| Medical / Healthcare | $260–$425 | $275–$445 | $265–$435 | $300–$495 | $245–$395 |
| Hospitality / Hotel | $250–$435 | $265–$455 | $255–$445 | $290–$505 | $235–$405 |

## Table B — Metro cost factors (vs. statewide base)

| Metro | Factor | Basis |
|---|---|---|
| Houston | 0.97 | Largest trade-labor base in TX; competitive baseline. |
| Dallas | 1.01 | DFW ≈ national index; +3–5% vs Houston on logistics-driven trade demand. |
| Fort Worth | 0.99 | Slightly under Dallas; same DFW labor market. |
| Austin | 1.12 | Most expensive TX metro; wages 12–18% above state median (+10–15% premium). |
| San Antonio | 0.90 | Most competitive Tier-1 metro; 12–18% under Austin. |

*Secondary markets (statewide × factor): El Paso ~0.85, RGV/McAllen ~0.83, Lubbock ~0.86,
Waco ~0.88, Tyler/Longview ~0.87, Corpus Christi ~0.90, College Station ~0.90, Midland/Odessa
~0.95 (energy-driven volatility).*

## Table C — All-in delivered $/SF by project type (statewide)

**Scope:** total project cost — shell + interior + FF&E + site work + typical soft costs.
This is the convention behind "total delivered" figures. As a rule of thumb, delivered ≈
hard cost × ~1.25 (simple industrial/office) to × ~2.0 (hotel/medical with heavy FF&E + site).

| Project type | All-in delivered $/SF |
|---|---|
| Tenant improvement / build-out | $50–$200 |
| Warehouse / industrial | $115–$335 |
| Retail / strip center | $250–$380 |
| Single-story office | $305–$445 |
| Medical / dental facility | $350–$800 |
| Hotel | $500–$930 |

---

## Reconciliation notes (how existing page numbers map)

- **Statewide headline (5838):** `$190–$340/SF` is a hard-cost typical band across common
  types — keep as the page's top-line; it is consistent with Table A.
- **Houston (5843):** page shows both `$185` and `$190` low-end and `$320`/`$330` high-end.
  **Canonical: `$190–$330`** (Table A Houston office/retail blend). Pick one and use it in the
  H1, intro, table, and FAQ so the page stops disagreeing with itself.
- **Hotel:** `$260–$450` = hard cost (Table A); `$500–$930` = all-in delivered (Table C).
  Label each on the page; never present them as competing.
- **Single-story office:** `$190–$330` (hard, Table A) vs `$305–$445` (delivered, Table C) —
  same scope split.
- **City-page metas** (Dallas `$140–$450`, San Antonio `$135–$430`) are wide all-type spans
  (warehouse low → medical/hotel high). Fine for a meta description, but the on-page tables
  should use the per-type Table A cells for that city.

## Apply plan (gated)

1. Operator approves this matrix (adjust any factor/base you disagree with — you own pricing).
2. Regenerate the per-page cost tables from this single source (one `change_set` per page,
   `post_content`, risk_class **gated** → your approval per page).
3. Add a one-line scope caption above every cost table ("hard construction cost, excl. FF&E
   & site" or "all-in delivered").
