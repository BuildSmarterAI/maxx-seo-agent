---
name: internal-link-graph
description: Optimize internal linking as a whole-site graph problem, not page by page. Fix orphan pages with zero inbound links, wire cluster posts up to their pillar pages, and balance anchor-text distribution. Use when link-graph.mjs flags an orphan or when strengthening topic clusters. Topic clusters wired to pillars are how topical authority and non-branded traffic compound.
---

# internal-link-graph

## When this runs
Enqueued by `link-graph.mjs` (`task='internal-link-graph'`, `source='sitemap'`) for orphan
pages, or run to strengthen a cluster around a pillar.

## Inputs
The `link_graph` table: `inbound`, `outbound`, `is_orphan`, `is_pillar` per URL.

## Procedure
1. For an orphan: find 2–4 topically related pages (same section/cluster) that should link TO it,
   and add a contextual inbound link from each, using descriptive (not exact-match-stuffed) anchors.
2. For a cluster: ensure every related post links UP to its pillar at least once, and the pillar
   links DOWN to its key cluster posts.
3. Vary anchor text — don't repeat the same exact-match phrase across many links (over-optimization).
4. Links must be contextual (inside relevant body prose), never a dumped link list.

## Hard rules
- Add links only where they're genuinely relevant to the surrounding sentence.
- Never edit `do_not_touch` pages.
- One link edit per source page per run; keep diffs small.
- No exact-match anchor repeated more than ~30% across a page's internal links.

## Output contract
`change_set` rows (`field='content'`) for each source page receiving a link, `status='pending'`.
Recompute affected `link_graph` rows after apply.
`decision_log` entries with `change_type='internal-link-graph'`.
