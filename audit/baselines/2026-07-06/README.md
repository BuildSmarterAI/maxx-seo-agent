# SEO baseline snapshot — 2026-07-06

Pre-remediation baseline for the F-1→F-20 execution plan. Frozen so post-fix batches can be measured against a fixed reference (see `seo-audit.md` at repo root).

## Files

| File | What it is |
|---|---|
| `gsc.json` | GSC Search Analytics, read-only via `orchestrator/lib/gsc.mjs`. Per-page 28d vs prior-28d clicks/impressions/CTR/position; top 60 queries; cannibalization pairs; striking-distance queries. |
| `analysis.json` | Derived hygiene + internal-link + content analysis over the live crawl (redirects, orphans, metadata gaps, H1 defects, author counts, thin pages). |
| `verify.json` | Follow-up verification: broken-internal-link statuses, homepage outbound set, template body word counts. |
| `psi.json` | PageSpeed Insights attempt — all 15 keyless calls returned HTTP 429 (F-20). Retained as evidence the field-data gap is unresolved until `PAGESPEED_API_KEY` exists. |

Raw `inventory.json` (~1 MB, all 239 fetched pages incl. every href) is intentionally NOT committed — it lives in the session scratchpad. Regenerate with the audit inventory script if needed.

## Measurement windows

- **Current period:** 2026-06-08 → 2026-07-05 (28 days, 1-day GSC lag)
- **Prior period:** 2026-05-11 → 2026-06-07 (28 days)
- **Headline:** clicks 668 (−26% vs prior 898); every priority money page declined.

## How to compare post-fix

After each remediation batch lands, re-run the audit inventory + GSC scripts and diff against these files. For attribution over time, `npm run learn` reads Supabase `outcomes`. Check for YoY seasonality in the GSC UI before crediting/blaming a batch — Texas commercial-construction search has summer softness.
