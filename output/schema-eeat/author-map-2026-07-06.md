# Workstream G2 — Author-to-page map (F-8) — GATED

Generated 2026-07-06. **Recommendation only — needs operator-supplied real names + credentials before any apply.** Author/schema identity is brand/E-E-A-T-critical; do NOT invent names.

## Problem
114 pages are authored as the generic **"Maxx Builders"** in Article JSON-LD; only ~4 name a real person (**Harris Khan**, currently on the design-build page). Google E-E-A-T + AI-citation surfaces reward named, credentialed authors with verifiable project history (root CLAUDE.md: "real, named construction experts… no 'Editorial Team' bylines").

## What the operator must supply per author
A real Maxx team member/principal with: full name, job title, years in commercial construction, verifiable project history, and a `sameAs` (LinkedIn). This becomes `Person` schema + a visible byline + an author bio box.

## Suggested topic → author-role mapping (fill the Name/Credentials column)
| Topic cluster | Representative pages | Suggested author expertise | Operator: name + credentials |
|---|---|---|---|
| Design-build / GC selection | `/design-build-construction-houston-2/`, services | **Harris Khan** (already assigned — verify title/bio) | Harris Khan — _confirm_ |
| Hospitality (hotel, mock-up) | hotel cost guide, mock-up rooms | Hospitality construction lead | _____ |
| Healthcare (medical, dental) | medical office cost, dental office guide | Healthcare/medical construction lead | _____ |
| Industrial (warehouse, build-outs) | warehouse cost, build-outs guide | Industrial/TI construction lead | _____ |
| Commercial cost (TX/Houston/Dallas) | TX-2025 cost, Houston, Dallas | Preconstruction/estimating lead | _____ |
| Retail / restaurant | retail rankings, restaurant cost guide | Retail & restaurant construction lead | _____ |
| Project delivery (timelines, planning, obstacles) | timelines, planning guide, obstacles | Operations / PM lead | _____ |

## Rollout order (after names confirmed)
1. Priority money pages first (highest impressions) — hotel, TX cost, warehouse, medical, Houston.
2. Then the rest of the 114 generic-byline pages in topical batches.
Each = visible byline + `Person` schema (`author` on the Article + a standalone Person node with `sameAs`) via `/schema-generate` + `/entity-authority`. Apply through the WordPress pack, small batches, backup first.
