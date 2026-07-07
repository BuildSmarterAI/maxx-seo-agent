---
name: internal-linking
description: Find orphan pages and low-equity money pages, then insert contextual internal links. Use for internal linking audits, orphan detection, or link-equity distribution.
---

# Internal Linking Engine

Load CLAUDE.md. **Execution model depends on the target site.** This skill's default steps assume a code-accessible stack with a local template repo and build step (root CLAUDE.md's "repo-native kit" case). That is NOT the current Maxx Builders configuration — `.claude/CLAUDE.md` states this repo "IS the agent runtime, not the site it optimizes" and all site changes go over an API (`packs/wordpress/`), with no local site files to edit. **For the current site, use `internal-link-graph` instead** — it stages the same orphan/link-equity fixes as `change_set` rows for the WordPress apply pack. Only run the file-edit steps below if the target site genuinely has a local, buildable template repo.

## Inputs (need all three; split by path prefix if over context)

- All pages on the site (crawl export or sitemap).
- All internal links found on those pages (crawl export).
- The page list, to compute which pages receive zero internal links.

## Steps

1. Identify (a) orphan pages with zero internal links, (b) money pages (service + location) receiving disproportionately low links, and (c) broken internal links.
2. Using the keyword/cluster map in CLAUDE.md, propose contextual links between topically related pages (hub→spoke, spoke→spoke, service↔location).
3. Insert links in body content and shared templates (nav/footer where appropriate). Use descriptive anchor text, not "click here".
4. Re-check that every money page is now reachable ≤ 3 clicks from home and has ≥ 3 inbound internal links.
5. Run the project's build command — verify it exists first (this repo's own `package.json` has no `build` script; this step only applies when targeting a code-accessible stack, not Maxx Builders' current WordPress config).

## Guardrails

- Do not over-link: cap added links per page at a sensible density; prioritize relevance over volume.
- Never link to noindexed or redirected URLs.
