---
name: entity-authority
description: Build topical authority and E-E-A-T by upgrading schema from per-page tags to an entity graph — Organization with sameAs links, credentialed author entities, and Service/Place entities — and enrich pages the entity-density gate flagged as thin. Use when a page fails check-entity-density or when establishing the site's entity baseline. This is what makes Google and LLMs treat the site as an authority on its topic, not just a site that mentions it.
---

# entity-authority

## When this runs
Triggered when `check-entity-density.mjs` fails a page (density below `MIN_ENTITY_DENSITY`),
or run once to establish the `Organization` + author entity baseline.

## Two layers

### 1. Site entity graph (run once, maintain rarely)
- `Organization` schema with complete `sameAs` (every social + directory profile).
- Author entities: `Person` schema with real credentials, linked from posts via `author`.
- `Service` / `Place` entities for each service line and physical location.
- These interlink so engines resolve the site as a coherent entity, not loose pages.

### 2. Page enrichment (per flagged page)
- Read the page; identify where named entities are missing (vague nouns where a specific
  place, partner, product, standard, or figure belongs).
- Add real, verifiable entities inline: named locations, named partners/integrations, named
  codes/standards, concrete figures. Do not pad with fluff.
- Re-run the density check mentally before emitting; aim comfortably above the threshold.

## Hard rules
- Only real, verifiable entities — never invent a partner, certification, or statistic.
- Schema must validate.
- Enrichment is additive and must not change the page's meaning or claims.
- Before staging enrichment, check whether `schema-generate` has already produced `schema/{slug}.jsonld` with Organization/Person/Service/Place schema for this page — reconcile with it rather than adding entities that conflict.

## Output contract
`change_set` row(s) for body/schema, `status='pending'`.
Update `entity_coverage` for the page.
`decision_log` entry with `change_type='entity-authority'`.
