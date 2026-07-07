# Session Handoff — maxx-seo-agent

> **Cross-machine continuity doc.** It travels with the repo (unlike your machine-local
> `~/HANDOFF.md` and the gitignored `.env`/`gcp.json`). Update the **Current handoff**
> section at the end of a work session, commit, push. On the next machine: pull, read
> this top-to-bottom, resume from **Next actions**.

## How to use this file

- **End of session:** rewrite *Current handoff* (below the divider), `git add SESSION_HANDOFF.md`, commit, push the branch.
- **Start of session (new machine):** `git pull`, read this, run `git status`, resume at *Next actions*.
- Keep it short. Link to artifacts, CSVs, and PRs — don't paste their contents here.
- This is a living single-file log: overwrite the *Current handoff* block each session (git history preserves old ones).

## New-machine setup (do this FIRST — these do not travel with git)

1. `git pull` and check out the working branch (see *Current handoff*).
2. **Recreate secrets — they are gitignored and never pushed:**
   - `.env` at repo root. Required keys (values from your password manager / Anthropic+Supabase+GCP consoles):
     `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`,
     `GOOGLE_APPLICATION_CREDENTIALS` (path to `gcp.json`), `GSC_SITE_URL`, `SITEMAP_URL`,
     plus CMS keys when applying: `WP_BASE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `SEO_PLUGIN`.
     Optional/infra: `PAGESPEED_API_KEY` (still unset — see F-20), `WEBFLOW_*`, `MONTHLY_BUDGET_USD`.
   - `gcp.json` (GCP service-account keyfile for GSC) at the path `GOOGLE_APPLICATION_CREDENTIALS` points to.
3. Node ≥ 22. Run scripts as `node --env-file=.env <script>`.
4. Smoke test: `node scripts/mem.mjs queue` (Supabase reachable), `npm run validate:metadata metadata-changes-e-2026-07-06.csv` (repo intact).

---

## Current handoff — 2026-07-07 (audit PR #74 merged to main)

### Branch & state
- **Merged to `main`:** PR #74 (`seo/audit-remediation-2026-07`) squash-merged 2026-07-07 as commit `29b3976`. `main` now carries the full 2026-07-06 audit + F-1→F-20 artifact set. At home: `git checkout main && git pull`.
- **Closed:** `seo/cut-llms-txt` + **PR #73** (superseded by #74). That branch still holds unrelated parallel infra work (AI-search module, sensor scripts) that diverged from `main`; the branch is **kept, not deleted**, so that work can be reconciled separately when convenient.
- **Working tree:** clean except pre-existing untracked `tdlr-projects-2026-06-29.csv` and tooling dirs `.agents/` `.codex/` (NOT ours — leave them).
- Zero WP/CMS writes, zero Supabase mutations beyond `decision_log` audit entries. Nothing applied to the live site.

### What shipped this session (all artifact-only, pending approval)
Full read-only audit → `seo-audit.md` (score 48/100), then an autonomous `/loop` produced remediation artifacts for every safe/artifact-class finding F-1→F-20:

| Area | Where | Notes |
|---|---|---|
| Repo config (F-4) | `config/urls.txt`, `CLAUDE.md`, `config/monitored-queries.json` | live slugs + TX-cost cluster; **applied** (repo edits) |
| Baselines | `audit/baselines/2026-07-06/` | frozen GSC/analysis/verify/PSI snapshot to measure against |
| Internal links (F-5/7/10/15) | `output/internal-linking/` | 21 verified changes |
| Answer-first (F-2/11/19) | `output/restructure-for-citation/` + `metadata-changes-ctr-2026-07-06.csv` | 7 money pages |
| Metadata (F-11/10/12) | `metadata-changes-e-2026-07-06.csv` (40) + `metadata-changes-e-tail-2026-07-06.csv` (142) + `output/metadata/h1-fixes-2026-07-06.md` | **189 pages total** metadata; F-11 essentially closed |
| Cannibalization (F-3) | `output/cannibalization/manifest-2026-07-06.*` | 4 survivors, **8 merge-redirects**, 2 differentiate — GATED |
| Schema/E-E-A-T (F-13/8) | `schema/localbusiness-*.jsonld` (4) + `output/schema-eeat/` | org-scope fix + author map (author names GATED) |
| Sitemap hygiene (F-9) | `output/sitemap-hygiene/2026-07-06.*` | 27 exclusions |
| IndexNow (F-18) | `output/indexnow/` | generated public key + deploy steps |

All metadata CSVs pass `npm run validate:metadata`. Every content claim was adversarially verified via Workflow fan-out (~810 subagent runs).

### Next actions (resume here) — everything below is GATED on Harris
1. **Decide the 8 cluster redirects** in `output/cannibalization/manifest-2026-07-06.md` — needs a backlink check per cluster (no backlink tool in-session) + sign-off. Highest ROI, highest risk.
2. **WP apply the merged artifacts** in ≤5-page batches (production only, no staging — **confirm a restorable backup first**). Source rows now live on `main`: metadata CSVs (`metadata-changes-*-2026-07-06.csv`), schema JSON-LD (`schema/localbusiness-*.jsonld`), internal-link + answer-first changesets (`output/`). Apply via `packs/wordpress`, verify rendered output before each next batch. *(#74 merged, #73 closed — 2026-07-07.)*
3. **Supply author names + credentials** for `output/schema-eeat/author-map-2026-07-06.md` (F-8).
4. **Mint `PAGESPEED_API_KEY`** (GCP → PageSpeed Insights API) + set locally and as a GH Actions secret — unblocks all CWV field verification (F-20; keyless PSI 429s).
5. **Homepage items stay prepare-only** (`do_not_touch`): money-page link block, 61→60 title trim, LCP work — require explicit override.

### Open decisions / watch-outs
- Obstacles page has a real 3-vs-4 inconsistency (H1 says "3", body has 4 sections) — title was de-numbered; recommend updating the H1 to 4.
- `metadata-changes.csv` (root, June rows) was NOT touched; this session's rows are in the dated `-ctr` / `-e` / `-e-tail` files. Merge at apply time.
- ~17 tail-metadata verifier rows ran without the opus-4.8 safety classifier (benign metadata, spot-checked) — glance before applying if you want belt-and-suspenders.
- `.env`/`gcp.json` recreation is the #1 gotcha when switching machines (see setup above).
