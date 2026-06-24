---
name: blog-ideas
description: Generate prioritized, research-backed SEO + LLM-optimized blog ideas from the audit, keyword gaps, competitor teardown, and query fan-out. Use to plan a content calendar or decide what to write next.
---

# Blog Idea Generation (research-driven)

Load CLAUDE.md. Produces a ranked idea list + briefs, not drafts. Pair with `/blog-audit` and `/gsc-opportunity-mining` first when possible.

## Research inputs to synthesize

1. **Audit gaps** (`blog-audit.md`): thin clusters, missing pillars, "new" items.
2. **GSC striking distance:** queries at position 5–20 with impressions but no dedicated page.
3. **Query fan-out:** expand each head topic into the conversational sub-questions buyers actually ask AI tools (People-Also-Ask, related questions). One head topic → many long-tail prompts.
4. **Competitor teardown:** topics/questions competitors answer that this site does not; find the information-gain angle they can't match.
5. **Pillar–cluster model:** each pillar anchored by 8–12 supporting posts; map every idea to a pillar or cluster.

## The information-gain filter (reject ideas that fail it)

Every idea must clear: "If this post disappeared, would anyone lose information they can't get elsewhere?" Prioritize ideas powered by proprietary/operator data (project history, cost data, parcel/permit data, first-hand experience) — this is what earns both rankings (March 2026 core update) and AI citations. Reject commodity angles ("7 tips for…") with no unique data.

## Output `blog-ideas.md` (ranked) — each idea includes

- Working title + target slug, and the pillar/cluster it belongs to.
- Primary query + 3–6 secondary/fan-out queries it should answer.
- Search intent and the single conversion path.
- The information-gain angle (what unique data/insight makes it non-commodity).
- AI-citation potential (is there a clean extractable answer + comparison/data table?).
- Recommended format (guide / comparison / cost breakdown / FAQ hub / case study).
- Internal-link targets (pillar, related posts, service/location pages).
- Priority score (search demand × commercial value × ability to win) and effort.

End with a 90-day calendar: which to write new, which the audit said to refresh/merge instead. Hand approved ideas to `/blog-write`.
