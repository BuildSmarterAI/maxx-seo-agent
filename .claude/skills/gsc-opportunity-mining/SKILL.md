---
name: gsc-opportunity-mining
description: Mine Google Search Console for striking-distance pages, CTR gaps, cannibalization, and refresh candidates. Use for GSC analysis, quick wins, or "what should we optimize next".
---

# Search Console Opportunity Mining (read-only)

Pulls GSC data and produces `gsc-opportunities.md`; changes nothing.

Load CLAUDE.md. Requires the Google Search Console MCP (or a GSC export CSV).

## Steps

1. Pull the last 90 days of GSC performance data (queries, pages, impressions, clicks, CTR, position). Compare to the prior 90 days.
2. **Striking distance:** find pages in position 5–15 with high impressions and below-benchmark CTR. Calculate the click gap for each. Generate revised titles/descriptions targeting the gap (hand off to `/metadata-fix` to apply).
3. **Cannibalization:** find queries where multiple pages rank. Score severity. Recommend consolidation for HIGH-severity cases.
4. **Refresh candidates:** list pages with > 25% traffic decline vs. the prior period.
5. **AI-surface signal:** flag pages with rising impressions but flat/falling clicks — likely AI-Overview presence, not content failure.

## Output

`gsc-opportunities.md` with three ranked sections (quick-win title rewrites, cannibalization fixes, refresh queue), each with the page URL, the metric gap, and the recommended action.
