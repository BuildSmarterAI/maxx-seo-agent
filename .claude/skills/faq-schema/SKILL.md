---
name: faq-schema
description: Turn mined People-Also-Ask / related questions into an on-page FAQ block plus valid FAQPage JSON-LD on the matching page. Use when paa_questions has new questions tied to a target_url. Questions are where AI Overviews appear least and citations land most, so this systematically captures them.
---

# faq-schema

## When this runs
Enqueued by `sensor-paa.mjs` (`task='faq-schema'`, `source='citation'`) after new related
questions are mined for a page's topic.

## Procedure
1. Read `paa_questions` rows for this `target_url` where `status='new'`.
2. Select 4–8 questions genuinely relevant to the page (skip off-topic PAA noise).
3. For each, write a concise self-contained answer (2–4 sentences) grounded in the page's data.
4. Append a visible FAQ section to the page body (real content, not schema-only — Google requires
   the answer to be present on the page).
5. Add/merge `FAQPage` JSON-LD covering exactly the visible Q/A pairs.
6. Mark the used `paa_questions` rows `status='answered'`.

## Hard rules
- Visible content must match the schema (no schema-only FAQs — that risks a manual action).
- Don't duplicate an existing FAQ block; merge into it if one exists.
- Answers grounded in real data; skip questions the page can't truthfully answer.
- Validate JSON-LD before emitting (post-validate hook enforces this).

## Output contract
`change_set` row (`field='content'`) with the FAQ block + schema, `status='pending'`.
`decision_log` entry with `change_type='faq-schema'`.
