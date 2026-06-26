# Session Handoff — Architecture Deepening Work

> Cross-machine continuation note. Last updated **2026-06-26**.
> Purpose: pick this work up cold from a different local machine. Delete before merging to `main`.

## How to resume on the office machine

```bash
git fetch origin
git checkout feat/finish-cms-apply-seam   # the shipped candidate #1 (PR #13)
git pull
node --test                                # expect 34/34 pass
```

For a fresh follow-on candidate, branch off `origin/main` (NOT off this branch):
```bash
git fetch origin && git checkout -b feat/<name> origin/main
```

## Context (what this work is)

Running the `/improve-codebase-architecture` skill on this repo produced an HTML report
with 5 "deepening opportunities" (turning shallow modules into deep ones). Vocabulary is
from `/codebase-design` (module, interface, depth, seam, adapter, leverage, locality) and
domain terms from `CONTEXT.md`. The report is regenerable; it was written to the OS temp
dir, not committed.

The 5 candidates, by strength:
1. **Finish the CMS apply seam** — Strong — ✅ SHIPPED (PR #13).
2. **Extract a deep GSC client** — Strong — ⬜ TODO (next).
3. **Deepen the learning-loop formulas** — Worth exploring — ⬜ TODO.
4. Collapse the change_set write contract — Worth exploring — not started.
5. Concentrate the never-safe guardrail — Speculative (defense-in-depth is intentional) — likely leave.

---

## DONE — Candidate #1: Finish the CMS apply seam (PR #13)

Branch `feat/finish-cms-apply-seam`, commit `feb3a47`. 34/34 tests pass.

- `orchestrator/lib/cms.mjs`: added `applyRows(adapter, {rows, store})`,
  `rollbackRow(adapter, {page_id, field, collection_id}, store)`, `latestAppliedRow()`;
  `defaultStore` grown 3→5 fns (`+latestSnapshot, +latestAppliedRow`).
- New `packs/{wordpress,webflow}/http.mjs` (shared REST clients, env read at import).
- Both `apply.mjs` → `applyRows`; both `rollback.mjs` → `rollbackRow` (dropped duplicate
  `KEYS`/`wf()`); `publish.mjs` → shared `wf()`.
- Fixed latent bugs: WP rollback now handles pages + `post_content` (was `/posts/{id}` +
  hardcoded `meta:{}`); `rolledback` change_set status is finally written.

Code review applied: `id` tie-break in `latestAppliedRow` ordering; WP_USER/WP_APP_PASSWORD
guard in `wordpress/http.mjs`. Pushed back on the "re-apply over rollback" finding —
`applyRows` only processes `status=approved` rows, so an `applied` row is never re-processed.

---

## NEXT — Candidate #2: Extract a deep GSC client (Strong)

**Files:** `scripts/sensor-gsc.mjs`, `scripts/collect-outcomes.mjs` → new `orchestrator/lib/gsc.mjs`

**Friction:** Both scripts independently build `google.auth.GoogleAuth`, call
`searchanalytics.query({siteUrl, requestBody:{...dates, dimensions:["page"], rowLimit:5000}})`,
and reinvent the same `new Date(Date.now()-n*864e5).toISOString().slice(0,10)` date math.
The Google API shape leaks into the sensing layer and the learning loop alike.

- `sensor-gsc.mjs:13-24` — `range()` date helper + `pageClicks()` query.
- `sensor-gsc.mjs:45-49` — GoogleAuth (webmasters.readonly) + searchconsole client.
- `collect-outcomes.mjs:15` — `day()` date helper (duplicate).
- `collect-outcomes.mjs:25-40` — `collectGsc()` inline query (duplicate shape).
- `collect-outcomes.mjs:72-78` — GoogleAuth (adds analytics.readonly scope for GA4).

**Deepening:** one `gsc.mjs` module with a small interface — e.g.
`queryByPage({startDaysAgo, endDaysAgo, dimensions})` returning rows — hiding auth, scopes,
client version, and date math. The two callers keep only their policy: thresholds in the
sensor, metric mapping in the collector. Two callers = real seam.

**Wins:** locality (GSC quirks in one module), leverage (one query shape, N signal types),
auth/scope drift fixed once, both callers become unit-testable by faking the client.

**Watch:** `collect-outcomes.mjs` also needs GA4 (`analytics.readonly`) — decide whether the
GSC client owns just Search Console or a shared Google auth. Recommend: `gsc.mjs` owns GSC
only; GA4 stays in the collector (different API surface). Grill this before building.

---

## NEXT — Candidate #3: Deepen the learning-loop formulas (Worth exploring)

**Files:** `scripts/attribute.mjs`, `scripts/prioritize.mjs`
(precedent to copy: `scripts/push-escalations.mjs` — injectable core, already tested)

**Friction:** The directional-attribution math and the priority formula are inlined in
`main()` with ZERO exports and ZERO tests. A weight typo ships silently.

- `attribute.mjs:25-34` — `clickLift`, `posLift`, `blended = clickLift*CLICK_W + posLift*POS_W`,
  and the `byType` reducer, all buried in the loop. Env weights `ATTR_CLICK_WEIGHT=0.7`,
  `ATTR_POSITION_WEIGHT=0.3`, `ATTR_MIN_N=3` unvalidated.
- `prioritize.mjs:16-18` — `base + round(effect*WEIGHT)` clamped 0..10; `BASE` source map.

**Deepening:** extract the formulas into pure functions returning results (no side effects):
e.g. `effectOf({clicksBefore, clicksAfter, posBefore, posAfter}, weights)` and
`score(base, effect, weight)`. The scripts keep only the Supabase read/write. Mirror the
injectable-core pattern `push-escalations.mjs` already uses in the same directory.

**Wins:** locality (one place owns effect math), interface = test surface, weights/clamp
covered without Supabase, same core feeds future GA4 revenue signals.

**Deletion test note:** these scripts are the ONLY writers of `learned_patterns` / queue
priority — deleting loses the loop, not moves it. They earn their keep; today they just
can't be verified through any interface.

---

## Working conventions for this repo (reminders)

- `node --test` is the runner. Tests live in `test/*.test.mjs`. Set required env via `||=`
  before dynamic `import()` (see `test/apply.test.mjs` top).
- TDD: write the failing test first, watch it fail, then implement.
- All Supabase access goes through `orchestrator/lib/supabase.mjs` (or `cms.mjs` for
  change_set). Don't inline new clients.
- Never push to `main`; branch → PR. Code review after writing (code-reviewer agent).
- Run `/improve-codebase-architecture` to regenerate the full HTML report if needed, then
  `/grilling` on a chosen candidate before implementing.

## Loose end
- A local **untracked** `AGENTS.md` that differed from `origin/main` was backed up to
  `/tmp/AGENTS.md.local.bak` on the home machine during branch setup. It does NOT exist on
  the office machine. If your home `AGENTS.md` was the intended version, reconcile it.
