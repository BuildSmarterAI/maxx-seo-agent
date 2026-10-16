# Triage labels

> Maps the five canonical `/triage` roles onto this tracker. Written by
> `/setup-matt-pocock-skills` 2026-10-14. Tracker config: [`issue-tracker.md`](./issue-tracker.md).

All five roles are **labels** on team `SEO` (`110d4c06-c734-491e-847b-1e22f41d1112`). The team has
no `Triage` workflow state, so `needs-triage` cannot map to one.

| Label in mattpocock/skills | Label in our tracker | Id (verified 2026-10-14) | Meaning |
|---|---|---|---|
| `needs-triage` | `needs-triage` | `1cc060bf-58d8-4082-a5ba-0918d14dbf6b` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | `cd04d47e-5db0-47ec-bd1f-6c7b1c8ac340` | Waiting on reporter; state the missing input in a comment |
| `ready-for-agent` | `ready-for-agent` | `80b282f5-fd42-4068-88cb-373dd6848a48` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | `444d3846-2155-4b06-bd8a-7e99ecf74632` | Requires human implementation or input |
| `wontfix` | `wontfix` | `32b95665-3427-4a00-8cf9-3b809c528847` | Will not be actioned; apply with closing into `Canceled` and a reasoning comment |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the label string and
id from this table.

⛔ **Same names exist on other teams** (`BUI`, `BUI2`). A name lookup without the SEO team filter
can return their ids. Use the ids above.

**If Linear's `Triage` state is later enabled for `SEO`:** map `needs-triage` to that state,
stop applying the label, and in the same change update this file, the team-configuration
table in [`issue-tracker.md`](./issue-tracker.md), and the *Agent skills* block in root
`CLAUDE.md`, all of which state that `SEO` has no Triage state.

## Wayfinder labels (not triage roles)

| Label | Id |
|---|---|
| `wayfinder:map` | `998054f5-e5c7-4ded-9d2c-474271d81ad0` |
| `wayfinder:research` | `fdf35220-cb0c-41bc-9586-73dacc4b0aea` |
| `wayfinder:grilling` | `38288f45-9fda-4780-9262-0b878ca0ccf6` |
| `wayfinder:prototype` | `81e626fc-4f32-4259-b405-3251e16b1844` |
| `wayfinder:task` | `f421ebc5-5994-4e61-bde0-4dbc24992c2f` |
