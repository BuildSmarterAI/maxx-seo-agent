# Cluster Consolidation Runbook — operator checklist (GATED)

**Companion to `manifest-2026-07-06.md`** (which holds the per-cluster GSC evidence, survivor rationale,
and content-to-preserve lists). This file is the linear **operator sequence** for applying the 8 merges +
2 differentiate edits **outside the agent** — the `guard-publish.sh` hook denies 301s (exit 2), so the
agent never executes these. Every step is human-gated.

> **Scope:** 8 pages 301 → 5 survivors, 2 pages retargeted (kept live). Applied lowest-risk first, one
> small batch at a time, verifying rendered output after each.

---

## Preflight (once, before ANY step)

- [ ] Confirm a **restorable production backup** exists (full site + DB). No staging environment — all live.
- [ ] Have a backlink tool ready (Ahrefs/Semrush/GSC Links). No backlink data is available in-agent.
- [ ] Decide the batch size (recommend 1–3 redirects per sitting, verify, then continue).

## Per-redirect gate (repeat for each of the 8)

For the dying URL in the step:
1. [ ] **Export** the dying page's full content + all SEO meta (title/desc/canonical/OG) to a dated file — this is the rollback source.
2. [ ] **Backlink check** (see table below). If external links exist, the 301 preserves equity (never delete) — proceed. Record findings.
3. [ ] **Repoint internal links** to the survivor FIRST (see repoint checklist) so no internal link resolves through the 301 (max one-hop rule).
4. [ ] **Port the "content to preserve"** blocks into the survivor per the manifest (dedupe; do not duplicate existing survivor sections).
5. [ ] **Apply the 301** dying → survivor (WP host/redirect plugin — NOT via the agent).
6. [ ] **Remove** the dying URL from the XML sitemap (only 200/canonical URLs remain); confirm the survivor is present + self-canonical.
7. [ ] **Arm rollback:** calendar the 6-week checkpoint; if the survivor loses >20% of the two pages' combined pre-merge clicks, remove the 301 + restore from export within 30 days.
8. [ ] **Re-crawl** to confirm zero internal links resolve through a redirect and no soft-404s were introduced.

---

## Execution order (lowest-risk first)

| # | Action | Dying URL (301 from) | Survivor (301 to) | Signal | Notes |
|---|---|---|---|---|---|
| 1 | merge | `/build-your-dream-dental-clinic-step-by-step-guide/` | `/dental-office-construction-guide/` | 0 clicks, 433 imp | lowest downside; **exclude** the "Savvy Marketing" section when porting |
| 2 | **differentiate** | `/8-key-considerations-for-building-a-restaurant/` | — (keep live) | 0 clicks, 361 imp | retarget to non-cost planning intent; add internal link to restaurant-cost survivor |
| 3 | merge | `/enhancing-commercial-spaces-tenant-improvements-guide/` | `/understanding-commercial-build-outs-guide/` | 0 clicks, 673 imp | |
| 4 | merge | `/tenant-improvement-contractors-guide/` | `/understanding-commercial-build-outs-guide/` | 0 clicks, 2,136 imp | port the "how to choose a TI contractor" framework |
| 5 | merge | `/building-the-perfect-smile-a-guide-to-dental-office-construction-and-design/` | `/dental-office-construction-guide/` | 2 clicks, 528 imp | |
| 6 | merge | `/cost-efficient-strategies-restaurant-construction/` | `/restaurant-construction-cost-per-square-foot-guide-2024/` | 5 clicks, 774 imp | |
| 7 | merge | `/commercial-property-construction-loans-in-texas-2026-how-to-qualify-fast/` | `/financing-options-for-commercial-construction-projects/` | 2 clicks, 2,912 imp | ranks for real financing queries — backlink check matters |
| 8 | merge | `/mastering-tenant-improvement-construction-a-comprehensive-guide/` | `/understanding-commercial-build-outs-guide/` | 1 click, 1,634 imp | port the per-metro TIA $/sq ft table into the survivor's TIA section |
| 9 | **differentiate** | `/the-complete-guide-to-tenant-improvement-allowance-for-commercial-leases/` | — (keep live) | 2 clicks, 1,843 imp | rewrite off-target H2s to the TIA lease-finance angle; do AFTER the 3 TI merges settle |
| 10 | merge | `/comprehensive-guide-to-commercial-construction-costs-per-square-foot-in-texas-2025/` | `/texas-commercial-construction-cost-2025-2026/` | 29 clicks, 18,748 imp | **highest equity + backlink risk — do last**; port per-building-type rows only as a linked snapshot |

---

## Internal-link repoint checklist (do BEFORE each corresponding 301)

- [ ] → `/dental-office-construction-guide/`: all links to `building-the-perfect-smile-…` and `build-your-dream-dental-clinic-…`.
- [ ] → `/understanding-commercial-build-outs-guide/`: all links to `mastering-tenant-improvement-construction-…`, `tenant-improvement-contractors-guide`, `enhancing-commercial-spaces-…`.
- [ ] → `/texas-commercial-construction-cost-2025-2026/`: all links to `comprehensive-guide-…-2025` — **including from the hotel / medical-office / warehouse / Houston / Dallas cost guides**.
- [ ] → `/financing-options-for-commercial-construction-projects/`: all links to `commercial-property-construction-loans-…`; convert "Texas loans / qualify fast" anchors; confirm the survivor doesn't self-link the merged URL.
- [ ] → `/restaurant-construction-cost-per-square-foot-guide-2024/`: all links to `cost-efficient-strategies-restaurant-construction`; audit the shared related-links blocks on the dying restaurant pages.
- [ ] **Reciprocal (enforce one-intent-per-page):** build-out survivor ↔ differentiated TIA page; restaurant-cost survivor ↔ differentiated 8-key planning page; Texas-cost survivor links **out** to hotel/medical/warehouse guides.

## Backlink checks required (clear before the matching 301)

| Dying URL | Signal | Priority |
|---|---|---|
| `comprehensive-guide-…-costs-per-square-foot-in-texas-2025` | Nov 2024, 18,748 imp | **highest** |
| `commercial-property-construction-loans-in-texas-2026-…` | 2,912 imp, ranks pos35–75 | high |
| `tenant-improvement-contractors-guide` | 2024, 2,136 imp | high |
| `mastering-tenant-improvement-construction-…` | 2024, 1,634 imp | medium |
| `cost-efficient-strategies-restaurant-construction` | 2023, climbed 0→5 clicks | medium |
| `enhancing-commercial-spaces-…` | 2024, 673 imp | low |
| `building-the-perfect-smile-…` | 2023, 528 imp | low |
| `build-your-dream-dental-clinic-…` | 2023, 433 imp | lowest |

## Closeout

- [ ] After each merge: 6-week / >20%-combined-clicks rollback armed; sitemap updated; re-crawl clean.
- [ ] Update `CLAUDE.md` keyword/intent map: record the TI survivors (build-out guide + differentiated TIA page)
  and the differentiated restaurant planning page as canonical.
- [ ] Re-audit the restaurant cluster's shared queries 6 weeks post-change before creating any new restaurant content
  (CLAUDE.md already flags this cluster).
