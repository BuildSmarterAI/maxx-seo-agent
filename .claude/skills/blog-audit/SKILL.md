---
name: blog-audit
description: Audit an existing blog for SEO health, AI-citation readiness, decay, and cannibalization, then classify every post keep/refresh/merge/delete. Use to audit current blog content before generating ideas or refreshing.
---

# Blog Content Audit (read-only)

Load CLAUDE.md. Output only — change nothing. If the site has no blog, say so and skip to `/blog-ideas`.

## Inputs

- Blog URLs from the crawl/sitemap (filter to the blog path).
- GSC data per post (clicks, impressions, CTR, position, 90-day trend).
- Optional: published/last-modified dates from the crawl.

## Score every post on two axes (1–5 each, then act)

**SEO score:** intent match, depth/information gain, internal-link equity, metadata quality, freshness, technical health (indexable, canonical, CWV).

**AI-citation score:** answer-first structure, extractability (could an LLM lift a clean answer in 30 seconds?), declarative/definition blocks, schema (Article/FAQ/Person), entity clarity, named data vs. vague "experts say" claims. Note: ~44% of LLM citations come from the first 30% of a page's text — weight front-loading heavily. Of pages an LLM retrieves, only ~15% get cited; structure is the filter.

## Decision rubric (assign one per post, with reasoning)

| Action | When |
|---|---|
| **Keep + monitor** | Ranks well, current intent, real depth. Re-check quarterly. |
| **Refresh** | Traffic decay (lost ≥20–25% YoY or vs prior 90 days), stale stats/entities, or strong SEO but weak AI score. Update data, front-load the answer, add schema, re-align intent. |
| **Merge** | Near-duplicate / cannibalizing posts. Consolidate into the strongest canonical, 301 the rest. |
| **Delete** | Zero traffic, zero backlinks, off-topic to revenue. Prune to lift crawl efficiency and domain quality. |

## Output `blog-audit.md`

1. A 2×2 matrix table (SEO × AI): Protect / Upgrade / Investigate / Merge-or-Delete, with each post placed.
2. Per-post row: URL, SEO score, AI score, action, one-line reason, and the highest-impact fix.
3. Cannibalization clusters (queries with multiple ranking posts) and the recommended canonical winner.
4. Cluster map: which topic clusters exist, which are thin, where the pillar is missing.
5. Top 10 actions ranked by ROI ÷ effort, each tagged refresh / merge / delete / new (→ `/blog-ideas`).
