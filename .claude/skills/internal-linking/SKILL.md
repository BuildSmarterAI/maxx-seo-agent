---
name: internal-linking
description: Find orphan pages and low-equity money pages, then insert contextual internal links. Use for internal linking audits, orphan detection, or link-equity distribution.
---

# Internal Linking Engine

Load CLAUDE.md. Edits files; run a test build when done.

## Inputs (need all three; split by path prefix if over context)

- All pages on the site (crawl export or sitemap).
- All internal links found on those pages (crawl export).
- The page list, to compute which pages receive zero internal links.

## Steps

1. Identify (a) orphan pages with zero internal links, (b) money pages (service + location) receiving disproportionately low links, and (c) broken internal links.
2. Using the keyword/cluster map in CLAUDE.md, propose contextual links between topically related pages (hub→spoke, spoke→spoke, service↔location).
3. Insert links in body content and shared templates (nav/footer where appropriate). Use descriptive anchor text, not "click here".
4. Re-check that every money page is now reachable ≤ 3 clicks from home and has ≥ 3 inbound internal links.
5. Run `npm run build`.

## Guardrails

- Do not over-link: cap added links per page at a sensible density; prioritize relevance over volume.
- Never link to noindexed or redirected URLs.
