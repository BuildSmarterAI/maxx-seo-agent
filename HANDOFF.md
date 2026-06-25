# HANDOFF — maxx-seo-agent — paste at start of home-machine session

**Written:** 2026-06-24 (handoff; committed as its own commit and pushed for home-machine access).
**Legend:** ✅ verified this session · ⓘ reported / parallel-or-earlier-session, not re-verified here · ⚠ verify before relying.

---

## 1. Branch state

- **Branch:** `seo/cut-llms-txt`
- **HEAD before this push:** `fac6ab7` (`fac6ab744b4190012b933cff0c2797f0f97382dd`); two new commits (checkpoint + this handoff) sit on top.
- **Origin:** `https://github.com/BuildSmarterAI/maxx-seo-agent.git`. Branch was NOT on origin before this push (created with `push -u`).

**Unpushed commits before this push (origin/main..HEAD), newest first:**

| Hash | One-line |
|---|---|
| `fac6ab7` | fix: keyword-research setFrontmatterKey function replacements (prevent $-corruption) ← **safety fix** |
| `c2e39b1` | fix: apply.mjs restore ?? null in drift gate (preserve escalate-on-unset) ← **safety fix** |
| `2f3b677` | fix: publish-drafts destructive-write guards (slug-title, blank-overwrite, dropClobbering) ← **safety fix** |
| `896c7ac` | fix(warehouse-draft): add focus keyphrase, internal/outbound links for Yoast |
| `962a47f` | chore: cut llms.txt generation (debunked for AI citations) ← **llms.txt cut** |
| `0c53824` | fix(warehouse-draft): set personal LinkedIn URL for Harris Khan author schema |
| `c7f5703` | feat(wp): add wp:update-drafts script to patch existing WP posts from markdown |
| `d457193` | fix(warehouse-draft): remove RSMeans/CBRE/Gordian/Ace Steel refs, fix JSON-LD author |
| `4ac53e9` | docs: domain model, ADRs, and Buzz SEO extension architecture |

Plus the two commits added by this push: a **provisional checkpoint** (AI-Search module + deps/engines + generic keyphrase) and **this handoff note**. `origin/main` is at `cca7ae3`.

---

## 2. Working tree (grouped, as of the checkpoint)

### (i) This session's intentional work — now in the checkpoint commit
- `package.json` — `google-auth-library ^10.7.0` + `engines.node ">=22"` (+ pre-existing `keyword-research` script entry).
- `drafts/warehouse-construction-cost-per-square-foot.md` — generic head-term `focus_keyphrase`.

### (ii) AI-Search module (was untracked, earlier build) — now in the checkpoint commit
- `lib/` (`db.mjs`, `engines.mjs`); `config/monitored-queries.json`; `sql/ai-search-schema.sql` (6 new tables, **no RLS statements**)
- `scripts/`: `sensor-ai-citations`, `sensor-ai-referrals`, `sensor-paa`, `link-graph`, `attribute-citations`, `check-entity-density`, `fix-base-values`, `import-metadata-csv`
- `.claude/skills/`: `entity-authority`, `faq-schema`, `internal-link-graph`, `restructure-for-citation`
- `.github/workflows/ai-search-sensors.yml`

### Clean (already committed)
- `drafts/cost-per-square-foot-build-warehouse-texas.md` — Texas geo keyphrase = clean revert to `896c7ac`.
- `packs/wordpress/publish-drafts.mjs` (`2f3b677`), `packs/wordpress/apply.mjs` (`c2e39b1`), `scripts/keyword-research.mjs` (`fac6ab7`), and 7 `schema/*.jsonld` files.

> The checkpoint is **provisional** — restructure into final commits from home with `git reset --soft cca7ae3` (or `origin/main`) and re-commit, if desired.

---

## 3. Durable vs working-tree-only

**Durably committed (verified real commit objects):** ✅ the 3 safety fixes (`fac6ab7`, `c2e39b1`, `2f3b677`), `962a47f` (llms.txt cut), the warehouse-draft commits — and now the checkpoint + this handoff.

After the push, **nothing intended is working-tree-only** except the gitignored local secrets in §6.

---

## 4. What was decided / done this session

- ✅ **llms.txt cut** — committed `962a47f` (gen-llms-txt.mjs deleted, CLAUDE.md AI-search rule reworded, ai-info-page skill severed).
- ✅ **Three safety fixes committed** as isolated commits (§1).
- ✅ **Keyphrase de-cannibalization on the `.md` source:** Texas → `cost per square foot to build a warehouse in Texas` (geo; clean revert to 896c7ac); generic → `warehouse construction cost per square foot` (head term). Cold-storage sets dropped from both.
- ✅ **package.json deps/engines fix** — `google-auth-library ^10.7.0` (was transitive-only — fragile), `engines.node >=22`.
- ✅ **update-drafts.mjs audited** (read-only) — 4 protections missing; see §5(a).
- ⓘ **Manifest reconciliation** — completed in an earlier session (plan `sleepy-imagining-falcon.md`).
- **481 "blueprints" corruption** — ✅ the `$`-class corruption *root cause* is fixed via `fac6ab7` (regex/function-replacement in `setFrontmatterKey`). ⚠ BUT 481's specific "blueprints" description was a **separate CSV-parse truncation in import-metadata** — a different vector — and **481's live value was NOT verified corrected this session.** → tracked as OPEN (g).
- **Post 3508** (`cost-per-square-foot-build-warehouse-texas`, published):
  - ✅ Live **title/desc restored** to geo-correct values (parallel session; this session confirmed live title/desc match the `.md`).
  - ⚠ Live **`focuskw` is STILL the cannibalizing head term** (`"warehouse construction cost per square foot"`, verified this session) — requires a follow-up `wp:update-drafts` run, **GATED on update-drafts guards**. The `.md` source is already correct. → OPEN (e).
- **Posts 5913 / 5975** — ⓘ restored via **parallel-session direct WP REST patches**, with `base_value` re-synced **per parallel-session report**. ⚠ **Not verified here — verify from home before relying (direct WP read recommended).**

---

## 5. OPEN — home-machine decisions

**(a) `update-drafts.mjs` guards — 4 protections MISSING (audited, NOT applied).** Unpatched twin of old publish-drafts.mjs:
- ❌ no skip-on-blank (`… || ""` blanks populated live fields)
- ❌ no slug-as-title guard (`title: meta.title || slug`, line 144)
- ❌ no dropClobbering live-compare (no live read before write)
- ❌ overwrites `content` unconditionally (line 145) — clobbers human body edits
- Also uses the OLD YAML-only parser → bold-convention drafts empty out.
- You wanted to **explore options before deciding.** Until guarded, unsafe vs any live post (§6).

**(b) RLS.** `sql/enable-rls.sql` does NOT exist; the 6 new tables ship RLS-off like the existing 9. Recommendation: **write `sql/enable-rls.sql` (RLS-on deny-by-default, 6 new + 9 existing), commit the file for review, but APPLY to Supabase as a separate explicitly-gated step** — and only after confirming no anon/`authenticated` reader (agent uses `service_role`, which bypasses RLS). "Enable RLS" ≠ "tenant policies" (the multi-client build); don't let the latter delay the former.

**(c) Module commit final structure.** Checkpoint is provisional — decide one vs several logical commits from home (`reset --soft` then re-commit), then keep/adjust before any PR.

**(d) Post 3324 cluster decision.** Published comprehensive guide owns `"warehouse construction cost"`, overlapping the head term — outside any `.md`'s control (slug mismatch) and near-duplicate of draft 7397; may need its own focuskw / consolidation decision.

**(e) Follow-up `wp:update-drafts` run on 3508** to ship the geo `focuskw` to live. **Blocked on (a)** — do NOT run until update-drafts is guarded, or 3508's curated content/canonical gets clobbered. (title/desc already correct live; only focuskw is wrong.)

**(f) Generic draft pre-publish placeholders** — `warehouse-construction-cost-per-square-foot.md` still has `author: "[HUMAN VERIFY …]"`, `last_updated: "2025-06-24"`, and a `canonical` (`…-a-comprehensive-guide/`) that doesn't match its own slug. Fix before publish.

**(g) Verify live 481 description, fix if still corrupted** — `/3-most-common-obstacles-in-commercial-construction-projects/` may carry the `"blueprints"` value from a CSV-parse truncation (import-metadata), **not** the `$`-class bug. Do a direct WP read; if still corrupted, restore from `base_value` / source.

---

## 6. NOT safe to run on this machine right now

- ❌ **`npm run wp:update-drafts`** / any call to `packs/wordpress/update-drafts.mjs` against live — **unguarded** (§5a), writes to live published posts (incl. 3508 with human edits). No staging exists; approving = publishing.
- ❌ **Applying RLS to Supabase** — `enable-rls.sql` doesn't exist yet, and applying without confirming consumers could break an anon/`authenticated` reader.
- General: **no staging** for WordPress — every apply/publish/update hits live maxxbuilders.com.

---

## 7. Local-only (NOT on origin — recreate from home)

- **`.env`** — exists here, gitignored. Holds WP app password, Supabase `service_role` key, AI API keys. **Nothing runs without it — copy/recreate on home machine.**
- **`gcp.json`** — exists here, gitignored. GCP service-account key (GA4/referrals). Recreate, or rely on CI `GCP_SA_JSON` secret.
- `node_modules/` — `npm ci` from home. `*.log` — disposable.

## 8. Guardrails
- Branch pushed for access; **decide the final commit structure before opening a PR.**
- Re-verify the ⚠ items (481, 3508 focuskw, 5913/5975) against live WP / Supabase before treating them as done.
