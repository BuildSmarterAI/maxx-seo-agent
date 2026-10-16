# Issue tracker: Linear (team Seo Agent)

> Configuration for the `mattpocock-skills` engineering flows (`triage`, `to-tickets`,
> `to-spec`, `wayfinder`, `implement`). Written by `/setup-matt-pocock-skills` 2026-10-14.
> Conventions adapted from `maxx-sales-genius/docs/agents/issue-tracker.md`.

**Tracker: Linear.** Workspace **`buildsmarterholdings`** · team **Seo Agent**, key **`SEO`**,
id `110d4c06-c734-491e-847b-1e22f41d1112`. Issue URLs are
`https://linear.app/buildsmarterholdings/issue/SEO-<n>/…`.

**File at team level, no project.** The team has no projects; do not create or attach one.

⛔ **Not GitHub Issues**, even though `origin` is `github.com/BuildSmarterAI/maxx-seo-agent`.
GitHub Issues is enabled and holds residue (one closed issue, `#21`, as of 2026-10-14). Never file
there and never treat a GitHub issue number as a work item.

**PRs as a request surface: OFF.** External PRs are not part of the triage queue.

---

## Access

- **MCP:** the `linear@claude-plugins-official` plugin (tools `mcp__plugin_linear_linear__*`,
  OAuth). Needs an interactive session; unavailable in headless runs.
- The `worker` agent profile cannot call `save_issue` / `save_issue_label`. Issue state and
  label changes belong to the coordinating session, not an implementation lane.

---

## Team configuration (verified 2026-10-14)

| Setting | Value | Consequence |
|---|---|---|
| Workflow states | `Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Canceled`, `Duplicate` | No `Triage` state, so `needs-triage` is a **label** here (see `triage-labels.md`) |
| Triage | not enabled | New issues land in the team default state, not a triage queue |
| GitHub↔Linear PR automation | **unverified** for this team | Treat branch names, PR titles and commit messages as linking surfaces until checked |

---

## Gotchas every skill inherits

1. ⛔ **Labels are TEAM-SCOPED and invisible without a team filter.** `wayfinder:*`, the five
   triage labels and nothing else live on team `SEO`; every other label (`Work Type`,
   `Priority Context`, `Status Context`, `Scope`, tech tags) is workspace-level. A listing
   **without** a team filter returns none of the SEO labels. That empty result is not evidence
   they are missing; re-creating them makes two ids per name. Always pass the team:
   `list_issue_labels(team: "110d4c06-c734-491e-847b-1e22f41d1112")`.
2. **`list_issue_labels(name: …)` is an exact match.** `name: "needs"` returns nothing even
   though `needs-research` exists. Never prove absence with a partial name.
3. ⛔ **Same-named labels on other teams are not ours.** `BUI` and `BUI2` also own
   `ready-for-agent`, `needs-info`, `wontfix` and `wayfinder:*`. Applying one of theirs to a
   SEO issue hides it from every label-filtered query here. Use the SEO ids recorded in
   [`triage-labels.md`](./triage-labels.md).
4. **Label groups are mutually exclusive.** One `Work Type` label per issue.
5. ⛔ **A discharged blocking edge is never retracted** (observed in `BUI2`). Compute
   "blocked" from `blockedBy` edges whose blocker is still **open**, never from edge existence.
   A blocker is **closed** (edge discharged) when its state type is `completed` (`Done`),
   `canceled` (`Canceled`) or `duplicate` (`Duplicate`); every other state keeps it open.
6. ⛔ **A description is not the issue; read `comments` too.** Decisions, corrections and
   shipped-PR evidence land in comments.

---

## Escalations live elsewhere (known split)

`scripts/push-escalations.mjs` (weekly `seo-learn` workflow) files orchestrator escalations to
team **BSM-AI** (`BUI`), project **Maxx Builders SEO Audit**, through the Linear GraphQL API with
`LINEAR_API_KEY`. That runtime integration is unchanged by this setup. Skill-driven planning and
implementation tickets live on `SEO`; runtime escalations live on `BUI` until a ticket decides
otherwise.

---

## Workflow object model

| Stage | Tracker object | Labels applied | Lands in | Handoff condition |
|---|---|---|---|---|
| `/wayfinder` (chart) | **Map issue** | `wayfinder:map` | `Todo` | Map created, tickets wired with blocking edges |
| `/wayfinder` (work) | **Sub-issue** of the map | one `wayfinder:<type>` | `Todo` | Resolution comment posted, issue closed, map's *Decisions so far* appended |
| `/to-spec` | **Spec issue** (no parent) | `ready-for-agent` | `Todo` | Spec published and read by the user |
| `/to-tickets` | **Implementation issues**, sub-issues of the spec | `ready-for-agent` + one `Work Type` | `Todo` | Every ticket's `blockedBy` edges wired |
| `/implement` | The implementation issue | — | `In Progress` → `In Review` | PR open, `npm test` green |
| merge to `main` | — | — | `Done` by hand, after the change is verified live where it touches production | |

⛔ **A Wayfinder ticket is not an implementation ticket.** A closed `wayfinder:*` ticket records
that a decision was made, never that code was written.

### Ready, Blocked, and the two claim protocols

There is no `Blocked` or `Ready` status. Both are derived.

| Concept | How it is expressed | ⛔ Not this |
|---|---|---|
| **Ready** | state `Todo` **and** label `ready-for-agent` **and** no `blockedBy` edge to an open blocker **and** unassigned | the label alone |
| **Blocked** | ≥1 `blockedBy` edge whose blocker is open (not closed; see gotcha 5) | the `blocked-internal` / `blocked-external` workspace labels (human planning only) |
| **Human input required** | label `ready-for-human` | a workflow state |

| Ticket class | Claim |
|---|---|
| **Implementation** | move to **`In Progress`** *and* assign, before cutting the branch |
| **Wayfinder** (`wayfinder:*`) | **assign only**; leave the state at `Todo` |

---

## Wayfinding operations

> The `wayfinder` skill defers to this section **by name**. ⛔ Without it the skill falls back
> to a local-markdown tracker under `.scratch/`, a competing source of truth this repo must
> not have.

| Operation | How it is expressed here |
|---|---|
| **The map** | One Linear issue on `SEO` labelled `wayfinder:map`. |
| **Tickets** | Native **sub-issues** of the map (`parentId`), each with exactly one `wayfinder:<type>` label. |
| **Ticket types** | `wayfinder:research` (AFK) · `wayfinder:grilling` (HITL, default) · `wayfinder:prototype` (HITL) · `wayfinder:task` (either). |
| **Blocking** | Linear's **native** `blocks` / `blockedBy` relation (`save_issue` `blockedBy`), never a body convention. |
| **Claim** | **Assign the ticket** before any work. Open + unassigned = unclaimed. Do not move it to `In Progress`. |
| **Frontier** | `list_issues(parentId: <map>)`, open, then drop any with an assignee or with a `blockedBy` edge to an open issue (gotcha 5; `get_issue(includeRelations: true)`). First in map order wins. |
| **Resolution** | Post the answer as a **resolution comment**, close the issue (`Done`), then append a one-line gist + link to the map's *Decisions so far*. |
| **Assets** | Linked from the issue, never pasted. Research findings go on a throwaway `research/<slug>` branch in its own worktree (`C:\dev\wt-maxx-seo-agent-<slug>`); prototypes on a pushed `prototype/seo-<n>-<slug>` branch; long-form map output under `docs/wayfinder/<map-id>/`. |
| **Out of scope** | Close the ticket (`Canceled` + the SEO `wontfix`, id `32b95665-3427-4a00-8cf9-3b809c528847`) and record one line in the map's *Out of scope*, never in *Decisions so far*. |

### ⛔ A map is never driven through the implementation lifecycle

A map has no PR and no deploy. It lives in `Todo` / `In Progress` while worked, and moves to
`Done` **by hand** once its last child closes and *Not yet specified* is empty. Never let a branch
name, PR title, PR description or commit message reference a `wayfinder:map` issue; if GitHub
automation is enabled for `SEO`, it would move the map on merge.

### When the map clears, it hands off

A finished map's exit is **`/to-spec`**, which collapses the linked decisions into one buildable
spec; `/to-tickets` and `/implement` follow. ⛔ Never loop a map straight into `/implement`.

### ⛔ `.scratch/<feature>/issues/` must not exist here

Seeing a skill reach for it means the skill did not find this file. Fix the config; do not
accept the fallback.
