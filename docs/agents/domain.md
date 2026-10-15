# Domain docs

> Layout and consumer rules for the domain vocabulary the engineering skills read.
> Written by `/setup-matt-pocock-skills` 2026-10-14.

**Layout: single-context.** No monorepo signals (no `workspaces` field, no `packages/`).

## Before exploring, read these

| Kind | Location | Notes |
|---|---|---|
| **Glossary** | [`CONTEXT.md`](../../CONTEXT.md) (repo root) | Already exists. ⛔ This repo uses `CONTEXT.md`, **not** `GLOSSARY.md`; do not create a `GLOSSARY.md`. |
| **ADRs** | [`docs/adr/`](../adr/) | Two numbering series coexist: `0001-…` and `ADR-001-…`. Read both when checking an area. |
| **SEO rules, thresholds, entities** | root [`CLAUDE.md`](../../CLAUDE.md) | Authoritative for SEO policy |
| **Repo working rules** | [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md), [`.claude/rules/`](../../.claude/rules/), [`AGENTS.md`](../../AGENTS.md) | Stack, risk classes, landmines |

If any of these are missing, proceed silently. `/domain-modeling` creates glossary entries and
ADRs lazily when terms or decisions are actually resolved.

## Use the glossary's vocabulary

When output names a domain concept (issue title, proposal, test name), use the term as defined
in `CONTEXT.md` (e.g. *repo path* vs *CMS path*, `change_set`, `do_not_touch`). A missing term
is a signal: either the language is invented, or there is a real gap to note for
`/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, say so explicitly rather than silently overriding:

> _Contradicts ADR-005 (change_set as the CMS approval gate), but worth reopening because…_
