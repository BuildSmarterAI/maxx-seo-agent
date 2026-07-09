---
name: blog-write
description: Write a full blog draft optimized for both classic SEO and AI/LLM citation from an approved idea or brief, with metadata and JSON-LD. Use to draft a new post or rewrite one flagged "refresh".
---

# Blog Writing (SEO + LLM-optimized)

Load CLAUDE.md. Produces a draft + metadata + schema as portable artifacts; the platform pack publishes. Write real, complete content — the draft must be publishable without further editorial work.

## Input

- An approved idea from `/blog-ideas` or a `templates/blog-brief.md` filled in. If only a topic is given, build the brief first.

## Structure to produce (this order matters for AI citation)

1. **Title** (≤60 chars, primary entity first) + **slug** + **meta description** (≤155).
2. **Answer-first intro:** a 40–60 word definition-first answer to the core query in the opening paragraph. Front-load the best information — ~44% of LLM citations come from the first 30% of the page.
3. **Key Takeaways** box (3–5 bullets) near the top. Heading must be `## Key Takeaways` — never "TL;DR" or "TL;DR — Key Takeaways".
4. **H2/H3 sections framed as questions**, each opening with a 1–2 sentence direct answer before expanding (so an LLM can extract a clean answer in ~30 seconds).
5. **At least one comparison or data table** where the topic supports it.
6. **Original data / operator insight** — the information-gain core. Cite specific numbers, named methodology, and first-hand experience, not "experts say".
7. **FAQ block** answering the fan-out / People-Also-Ask questions → maps to FAQPage schema.
8. **Internal links** (≥3) embedded naturally in body prose as `[anchor text](/path/)` — do NOT create a standalone `## Internal Links` section; links belong inside relevant sentences throughout the article.
9. **Author byline** (real, credentialed) + a visible **"Last Updated"** date.
10. **One clear CTA** at the end. Heading: `## Request a Project Estimate` — never `## CTA` or `## Call to Action`. Link: `[Request a Project Estimate](https://www.maxxbuilders.com/commercial-construction-project-inquiry/)`.

## Artifacts to output

- `drafts/{slug}.md` — the full publishable draft. No bracket placeholders, no checklists, no verify notes.
- `drafts/{slug}-review.md` — editorial-only file (never read by the apply pack): human-edit checklist, claims to verify against real project records, operator data gaps, brand-voice pass, and "would an LLM extract a clean answer?" self-test. All checklist items go here, not in the main draft.
- Metadata row appended to `metadata-changes.csv` (title, description, canonical).
- `schema/{slug}.jsonld` — `Article` + `BreadcrumbList` + `FAQPage` + `Person` (author `sameAs` to LinkedIn/credentials).

## Apply (handoff)

- **Repo:** add as an MDX/markdown post.
- **WordPress:** `/wp-apply pages` creates the post + sets Yoast/Rank Math meta + schema.
- **Webflow:** `/webflow-apply pages` creates the CMS item (draft) + sets SEO fields + head custom-code JSON-LD, then publish.

## Guardrails

- **No placeholders in the main draft.** Write real, specific content in `drafts/{slug}.md`. Never use `[OPERATOR INSERT]`, `[HUMAN VERIFY]`, `[VERIFY]`, `[HUMAN EDIT]`, `<!-- VERIFY -->`, or any bracket/comment placeholder. If operator truth is uncertain, write your best informed estimate from Maxx Builders project data and Texas market conditions, then flag the specific item in `drafts/{slug}-review.md`.
- **Cost attribution:** all cost data is attributed to "Maxx Builders project experience and current market conditions". Never cite RSMeans, Gordian, CBRE, JLL, HVS, STR, or any third-party research firm.
- **Author byline** (structure item 9) is always: `Harris Khan, Founder — Maxx Builders ([LinkedIn](https://www.linkedin.com/in/maxxbuildersharris/))` — never "Editorial Team" or a placeholder.
- **Freshness:** date the data; for time-sensitive topics, set a refresh reminder (~6 months) in `drafts/{slug}-review.md`.
- Do not rely on llms.txt or content chunking as citation hacks (debunked); rely on structure, depth, and schema.
- **Citation-worthiness (KDD '24 GEO markers, enforced by `check-citation-density.mjs`):** each draft must carry the evidence AI engines extract — **≥3 statistics per 1,000 words** (specific figures: costs, %, sq ft, ratios; cost figures still attributed to Maxx project experience, never a research firm), **≥1 sourced quotation** (a named Maxx principal or a block quote), and **≥1 outbound citation** to a non-cost authoritative source where relevant (building codes/standards, government data, the org's own `sameAs` profiles). Thin, generic prose fails the gate.
