---
name: restructure-for-citation
description: Retrofit an existing live page to answer-first structure so the direct answer sits in the first 30% of the body, where the large majority of AI-engine citations are pulled from. Use when a monitored question is NOT earning an AI citation and the target page buries its answer below narrative or intro fluff. Produces a CMS-ready metadata + body-intro change, never a full rewrite.
---

# restructure-for-citation

## When this runs
The citation sensor (`sensor-ai-citations.mjs`) enqueues this task with `source='citation'`
when a high-priority monitored question is answered by Claude/Perplexity/OpenAI but our page
is NOT in the cited sources. The page ranks but doesn't get extracted.

## Goal
Move the single most-citable answer into the opening of the page without rewriting the whole
thing. AI engines extract self-contained answer blocks near the top. A 2,000-word guide that
opens with "In today's market..." gives them nothing to lift.

## Procedure
1. Read the live page body (via WP REST API `content.rendered` or the CMS adapter).
2. Identify the exact question the page should answer (from the `ai_queries.query` that missed).
3. Extract or compose a **direct answer block**: 2–4 sentences, self-contained, leads with the
   specific fact (number, range, yes/no, definition). No "it depends" opener.
4. Place it immediately under the H1, above any existing intro. Format as a short paragraph,
   optionally followed by a tight bulleted breakdown if the answer has parts.
5. Preserve everything below — this is additive restructuring, not a rewrite.
6. Emit a `change_set` row: `platform`, `page_id`, `field='content'`, `base_value` = current
   intro (drift baseline), `new_value` = answer block + original body.

## Hard rules
- Never change the H1 or URL.
- Never delete existing body content — only prepend the answer block.
- Answer block must be factually grounded in the page's own data. If the page lacks the fact,
  escalate instead of inventing it.
- Stay under `MAX_DIFF_LINES`; if the body is huge, change only the intro region.
- Lead the answer block with a **statistic** (specific number/range) — the KDD '24 GEO study found added statistics lift AI-citation rates the most, and `check-citation-density.mjs` gates for them. Where the page has a named-source quote or an authoritative outbound citation, keep it in or near the answer block.

## Output contract
A single `change_set` row per page, `status='pending'`, for human approval before `wp:apply`.
Log the decision to `decision_log` with `change_type='restructure-for-citation'` so
`attribute-citations.mjs` can measure whether it moved the citation rate.
