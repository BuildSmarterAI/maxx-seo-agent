---
name: blog-write
description: Write a full blog draft optimized for both classic SEO and AI/LLM citation from an approved idea or brief, with metadata and JSON-LD. Use to draft a new post or rewrite one flagged "refresh".
---

# Blog Writing (SEO + LLM-optimized)

Load CLAUDE.md. Produces a draft + metadata + schema as portable artifacts; the platform pack publishes. Follow the 80% rule: structure and draft here, but flag where a named human expert must supply operator truth (verifiable claims, real project data) — do not invent facts or fabricate statistics.

## Input

- An approved idea from `/blog-ideas` or a `templates/blog-brief.md` filled in. If only a topic is given, build the brief first.

## Structure to produce (this order matters for AI citation)

1. **Title** (≤60 chars, primary entity first) + **slug** + **meta description** (≤155).
2. **Answer-first intro:** a 40–60 word definition-first answer to the core query in the opening paragraph. Front-load the best information — ~44% of LLM citations come from the first 30% of the page.
3. **TL;DR / Key Takeaways** box (3–5 bullets) near the top.
4. **H2/H3 sections framed as questions**, each opening with a 1–2 sentence direct answer before expanding (so an LLM can extract a clean answer in ~30 seconds).
5. **At least one comparison or data table** where the topic supports it.
6. **Original data / operator insight** — the information-gain core. Cite specific numbers, named methodology, and first-hand experience, not "experts say".
7. **FAQ block** answering the fan-out / People-Also-Ask questions → maps to FAQPage schema.
8. **Internal links** (≥3) to the pillar, related posts, and the relevant service/location pages, with descriptive anchors.
9. **Author byline** (real, credentialed) + a visible **"Last Updated"** date.
10. **One clear CTA** aligned to the post's single conversion path.

## Artifacts to output

- `drafts/{slug}.md` — the full draft in the above structure.
- Metadata row appended to `metadata-changes.csv` (title, description, canonical).
- `schema/{slug}.jsonld` — `Article` + `BreadcrumbList` + `FAQPage` + `Person` (author `sameAs` to LinkedIn/credentials).
- A **human-edit checklist**: claims to verify, operator data to insert, brand-voice pass, fact-check, and a "would an LLM extract a clean answer?" self-test.

## Apply (handoff)

- **Repo:** add as an MDX/markdown post.
- **WordPress:** `/wp-apply pages` creates the post + sets Yoast/Rank Math meta + schema.
- **Webflow:** `/webflow-apply pages` creates the CMS item (draft) + sets SEO fields + head custom-code JSON-LD, then publish.

## Guardrails

- No fabricated stats, quotes, or sources. Mark every factual claim that needs human verification.
- Freshness: date the data; for time-sensitive topics, set a refresh reminder (~6 months).
- Do not rely on llms.txt or content chunking as citation hacks (debunked); rely on structure, depth, and schema.
