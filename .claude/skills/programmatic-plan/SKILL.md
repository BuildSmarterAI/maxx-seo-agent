---
name: programmatic-plan
description: Plan and stage a programmatic SEO page system for any platform — dataset, template, gated content — output as portable artifacts. Use for city+service, cost guides, feasibility/permit, or comparison pages at scale.
---

# Programmatic Page Plan (CMS-neutral)

Load CLAUDE.md. Produces the dataset + content, gated, ready for the platform to render. Does not publish.

## Quality gates — enforce before staging any page; record skip reasons

1. **Eligibility:** skip rows that can't support a useful page.
2. **Uniqueness ratio ≥ 0.5** across meaningful data fields.
3. **Unique blocks:** unique intro + recommendation/insight per page (real local/contextual data, not variable substitution).
4. **Minimum content threshold** per page.
5. **≥ 3 internal links** per page.

## Steps

1. Take the data source (pass as `$ARGUMENTS`) and the template intent (one template = one intent = one conversion path).
2. Generate per-page content + metadata + JSON-LD into `programmatic/` (one record per page: slug, title, description, body blocks, internal links, jsonld).
3. Output `programmatic-manifest.md`: pages staged vs. skipped (with reasons) and uniqueness ratios.
4. Run the doorway test on a 10-URL sample: genuinely different main content, or just swapped headings? If "just swapped," consolidate.

## Apply (handoff)

- **Repo:** generate dynamic routes (`generateStaticParams` + ISR/SSG).
- **WordPress:** `/wp-apply` bulk-creates posts/pages via WP-CLI or REST from the staged records.
- **Webflow:** `/webflow-apply` bulk-creates CMS collection items (≤100/request) → publish.

## Guardrails

- Doorway guardrail: warn at 30, hard-stop at 50 pending human review.
- Submit new URLs via IndexNow after publish. Human-review the manifest before publishing.
- For multi-location or service-area landing pages with NAP + LocalBusiness schema, use `/local-page-plan` instead.
