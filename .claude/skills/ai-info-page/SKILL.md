---
name: ai-info-page
description: Build and maintain a deep AI information page (e.g. /information-for-ai), structured around the real questions buyers ask an AI tool, with a direct answer up front and depth behind each, FAQPage schema, a named author, and a last-updated date. Use when commercial-intent monitored questions miss AI citations, or to establish an AI-citable hub. This is the depth-done-right version of a thin competitor fact sheet.
---

# ai-info-page

## When this runs
Enqueued by the citation sensor for commercial-intent misses, or run manually to stand up the
hub.

## Why depth beats a fact sheet
A plain-text page that tells AI models what to say gets crawled but rarely cited. Engines cite
pages that contain self-contained, specific, structured answers. The win is information gain:
named entities, real figures, state/region specifics, and question-shaped headings.

## Procedure
1. Pull the monitored question set (`ai_queries`) plus mined PAA (`paa_questions`) for the site.
2. Group into 8–15 real questions a buyer asks (cost, process, timeline, compliance, comparisons).
3. For each: an H2 phrased AS the question, then a 2–4 sentence direct answer leading with the
   specific fact, then 1–2 sentences of supporting depth. Name entities (places, partners,
   figures) — that is what gets extracted.
4. Add `FAQPage` schema covering every Q/A, `Article` + `Person` (credentialed author) schema,
   and a visible "Last updated" date.
5. Keep prose answer-first throughout; no marketing intro paragraph.
6. Emit the page as a `change_set` row (`field='content'` for the page body).

## Hard rules
- Every claim must be grounded in the site's real data; if a figure isn't known, omit the Q
  rather than fabricate.
- One canonical AI info page — do not spawn duplicates.
- Schema must validate — enforced automatically by `.claude/hooks/post-validate.sh` before the
  `change_set` row is accepted.

## Output contract
`change_set` row(s) for the page body + schema, `status='pending'`.
`decision_log` entry with `change_type='ai-info-page'`.
