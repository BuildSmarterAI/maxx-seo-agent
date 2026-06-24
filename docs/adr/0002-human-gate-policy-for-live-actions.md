# ADR-0002: Human gate policy for live actions

**Date:** 2026-06-24
**Status:** Accepted
**Deciders:** Harris Khan (BuildSmarter Holdings)

---

## Context

The orchestrator can dispatch two classes of action: changes that go through a git PR (repo-based sites) and changes that write directly to a live CMS (WordPress, Webflow). In both paths, the question is: which actions may auto-execute within thresholds, and which require a human to explicitly approve before anything runs?

This policy is hard to reverse: loosening it after a client has come to rely on it for data safety is a trust and contractual issue. Tightening it after the orchestrator has been running autonomously disrupts expected behaviour.

---

## Decision

The policy is **bounded autonomy with permanent hard gates**. Safe-class actions auto-execute within per-client thresholds. A defined list of action types is permanently human-gated regardless of thresholds, scores, or track record.

### Safe class — auto-executes within thresholds

All of the following are safe-class provided the `eval_gate` passes and the diff-size limit is not exceeded:

- Meta title and description generation or update
- JSON-LD structured data generation and repair
- Internal link insertion
- Broken link fixes, image alt text, sitemap.xml, robots.txt
- CWV template-level fixes (with regression test)
- Decayed-post stat/data refreshes (within size + uniqueness thresholds)
- Programmatic page builds under the per-run doorway limit

### Permanently gated — always requires human approval

No threshold, eval score, or track record unlocks these for auto-execution:

| Action | Reason |
|---|---|
| Merges, redirects (301s), or deletions of URLs with backlinks or measured traffic | Destroys link equity and ranking history; irreversible |
| Net-new programmatic batches above the doorway threshold | Google Scaled Content Abuse policy; human must verify uniqueness manifest |
| Brand/positioning claims, pricing copy, company description | Cannot be auto-generated; requires stakeholder sign-off |
| YMYL content (legal, financial, health, safety) | Factual error liability |
| GBP / NAP changes (business name, address, phone) | Citation consistency across the web; errors spread before they can be corrected |
| Any URL in the `do_not_touch` table | Operator-declared human ownership |
| Any action on a site in a regulated vertical (healthcare, legal, financial services) | Compliance; treat the whole site as YMYL |

### The approval surfaces by loop type

**Repo-based loop (Loop A):** The `eval_gate` required check (eval-judge + diff-size) is the automated gate. A failing check blocks auto-merge; the PR stays open for human review. The human gate is PR merge.

**Live-CMS loop (Loop B):** The automated `eval_gate` does not run. The human gate is an explicit `change_set.status` flip from `pending` to `approved` — in SQL or a review UI. No automated eval-judge runs in this path. This is a known asymmetry accepted by design: live CMS changes are typically lower volume and higher stakes (writes are immediate or global-publish), making human review the appropriate gate rather than an automated judge.

---

## Rationale

Auto-publishing AI content without human approval is the highest-risk operation in this system. The policy above reflects the realistic constraint that fully autonomous publishing at scale violates platform policies (Google's Scaled Content Abuse), introduces factual liability (YMYL), and destroys trust when it goes wrong (merges/deletions with backlinks).

The asymmetry between Loop A and Loop B (automated eval_gate vs. manual approval flip) is intentional: Loop A changes go through git and are inherently reviewable in a PR diff; Loop B writes are direct CMS mutations that are harder to batch-review, so human sign-off at the row level is more appropriate.

---

## Consequences

- The doorway threshold (warn at 30 pages, hard-stop at 50 pending review) must be tuned per client. CLAUDE.md is the authoritative location for per-client thresholds.
- Clients cannot negotiate auto-publish on permanently-gated actions. This is a product constraint, not a configuration option.
- The live-CMS loop (Loop B) has no automated quality scoring before apply. A future improvement could add an eval-judge step to the `seo-apply-cms.yml` workflow before writing — but that is a separate decision and not required by this ADR.
