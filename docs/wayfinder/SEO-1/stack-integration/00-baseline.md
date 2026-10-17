# SEO stack integration: current-state baseline (map SEO-1)

**Question.** What does the maxx-seo-agent runtime on `main` actually own, stage by stage,
and what is configured, verified operational, broken, or planned only? This doc is the
baseline that later stack-integration docs build on. It does not repeat the five prior
SEO-1 research docs; §6 summarises them.

**Date:** 2026-10-16. **Method:** read-only. Repo code read at `origin/main` **7a3d333**
in worktree `C:\dev\wt-maxx-seo-agent-seo-stack-research`. Operational evidence comes
from read-only `gh` calls: `gh pr list/view`, `gh run list/view --log`, and
`gh variable list` / `gh secret list` (names only for secrets; for variables, only the
non-credential values quoted below). I did not run npm install, the orchestrator,
sensors, Supabase, WordPress or provider APIs. **`npm test` was not run** because
`node_modules` is absent from this worktree.

Legend: **[R]** read from repo code at 7a3d333 · **[L]** read from a GitHub Actions run
log or repo settings via `gh` today · **[P]** read from an open PR body or diff list ·
**UNVERIFIED** = not checked against the live system.

---

## 0. TL;DR (decision-relevant)

1. **The nightly autonomous loop does nothing, and it reports green.** On
   2026-10-07/11/15/16 `seo-sensors` → `orchestrator/run.mjs` ran in CMS mode
   (`SITE_PLATFORM=wordpress`). It failed authentication: "API key is invalid" (10-07)
   and "Invalid API key · Fix external API key" (10-16). It then logged
   `CMS run complete … (cost ≈ $0.00)` and the job exited 0 [L]. The cause is
   `runCms` swallowing any error that matches `/process exited with code 1/`
   (`orchestrator/run.mjs:160-163`). This is the root of the "$0 spend" symptom PR #97
   addresses. #97 adds a warning only, so the job still exits 0 [P].
2. **`ANTHROPIC_API_KEY` in CI is invalid** [L]. Everything that calls Anthropic headless
   fails:
   - orchestrator
   - `classify-competitors` (401 on every chunk)
   - the citation analyst (25/25 events skipped)
   - the `claude` answer engine (401)
   - the eval-judge (would fail closed on any `seo-auto` PR)
   - judge calibration (reported `auc=0.5`, a degenerate result; UNVERIFIED cause)

   Perplexity also returns 401 and OpenAI 429. **SerpApi works** (AIO rows and
   `[paa] … source=serpapi`) [L].
3. **`ai-search-sensors` has failed for at least the last 3 weekly runs** (09-28, 10-05,
   10-12) [L]. `sensor-ai-referrals` dies on `JSON.parse` inside google-auth-library. The
   cause is that `ai-search-sensors.yml:17` writes `gcp.json` with
   `printf '%s' "${{ secrets.GCP_SA_JSON }}"` (double quotes). The other workflows use
   single quotes (`seo-sensors.yml:28`, `seo-learn.yml:24`). That inference fits the log
   but is UNVERIFIED. Because the failed step comes first, `attribute-citations` is
   skipped every week [L].
4. **What does run and produce data:** GSC sensor (~67–70 items/night), sitemap sensor
   (239 URLs, 0 new), indexation sensor, weekly `collect-outcomes`/`attribute`/
   `prioritize` (213 GSC URLs, 83 GA4 organic landing pages, 740 outcome rows on 10-12),
   SerpApi AIO + PAA, and nightly `seo-apply-cms` (`applied 0, escalated 0, failed 0`, i.e.
   no approved rows) [L]. The queue grows with no consumer: 315 pending rows on 10-12 [L].
5. **CrUX/CWV field data is dark.** There is no `CRUX_API_KEY` or `PAGESPEED_API_KEY`
   secret, and the log shows `[cwv] … skipping` [L].
6. **Production writes are wired to run unattended.** `seo-apply-cms` runs nightly at
   07:30 UTC on any `approved` row (`seo-apply-cms.yml:10-11,29-38`). `WP_BASE_URL` is
   `https://www.maxxbuilders.com` (production) [L], although the workflow comment says
   "staging URL" (`:34`). The human gate is only the `pending→approved` flip.
7. **No code handles crawling, rendered verification, Elementor, DataForSEO,
   Firecrawl or CRM leads** [R]. Grep of `.mjs`/`.yml`/`.sh` on main, and the lockfile
   has no crawler/renderer/provider SDK [R]. The Elementor `post_content` no-op hazard
   (prior research) is unguarded on main.
8. **Schema drift: `change_set` has no `change_type` column in `sql/schema.sql`**
   (`:93-106`; only `risk_class` is added at `:186`). Yet `insertChangeset` writes
   `change_type` (`orchestrator/lib/supabase.mjs:231-238`,
   `orchestrator/lib/payload.mjs:42`). Either the live table was altered by hand, or every
   CMS-mode `mem.mjs apply` would fail. UNVERIFIED.
9. **Active lanes** (§2 and §3 owners): #104 → #105 (SEO-14) → #109 (stacked apply
   hardening, drift), #107 (Wave 1 payloads, staged not inserted), #97 (spend), #93 (A8
   risk gate + SDK spend/turn caps), #98 (Linear close path), #106 (Supabase MCP flag),
   #101 (WordPress MCP spike), #102 (Firecrawl audit), #92 (citation-density fixes),
   #94 (ADR-010).

---

## 1. Repo identity

| Item | Value | Evidence |
|---|---|---|
| Remote | `https://github.com/BuildSmarterAI/maxx-seo-agent.git` (fetch + push) | `git remote -v` [R] |
| HEAD | `7a3d3330134eca68895a9ff5500a5453e2af508b` ("docs: parallel session operating model (interactive sessions) (#108)", 2026-10-16) | `git rev-parse HEAD`, `git log -1` [R] |
| Branch / worktree | `research/seo-stack-integration` at `C:\dev\wt-maxx-seo-agent-seo-stack-research` | `git branch --show-current`, `git worktree list` [R] |
| Package | `buildsmarter-seo-orchestrator@1.0.0`, ESM, `node >=22` | `package.json` [R] |
| Repo visibility | public (from prior research, GitHub API 2026-10-15) | crawl-render doc §1 |
| Tests on main | 32 files in `test/` (~394 `test(`/`it(` call sites by grep); runner `node --test` | `ls test`, `package.json:5` [R]. **Not run** this session. |

---

## 2. Pipeline stage ownership

Status vocabulary:
- **Implemented**: code exists.
- **Configured-but-unverified**: wired in a workflow or env, with no run evidence read.
- **Verified-operational**: a run log read today shows it working.
- **Broken**: a run log shows failure, or code reading shows it cannot work as wired.
- **Planned-only**: docs or PR only.

| # | Stage | Owning modules | Status | Evidence | Gap | Owner / PR |
|---|---|---|---|---|---|---|
| 1 | Data collection (search) | `scripts/sensor-gsc.mjs`, `scripts/sensor-indexation.mjs`, `orchestrator/lib/gsc.mjs` (Search Analytics paging + URL Inspection), `scripts/collect-outcomes.mjs` (GSC + GA4), `scripts/sensor-ai-referrals.mjs` (GA4) | GSC: **Verified-operational**. GA4 outcomes: **Verified-operational**. GA4 AI-referrals: **Broken** | 10-16 log: `[gsc] enqueued 67 items (2 skipped by do_not_touch)`; `[indexation] enqueued 0 items`. 10-12 learn log: `GSC: 213 URLs`, `GA4: 83 organic landing pages`, `recorded 740 total outcome rows` [L]. ai-referrals: JSON.parse crash (§0.3) [L] | GA4 uses the deprecated `conversions` metric (`collect-outcomes.mjs:101`, `sensor-ai-referrals.mjs:38`). GSC unused dims and Sitemaps API (first-party doc). URL Inspection reads `verdict` only (`sensor-indexation.mjs:28-32`). Indexation inspects an `http://` URL variant (`not indexed: http://www.maxxbuilders.com/ (Page with redirect)`) [L] | none open |
| 1b | Data collection (AI search / SERP) | `scripts/sensor-ai-citations.mjs`, `lib/engines.mjs` (Claude/Perplexity/OpenAI + `askGoogleAIO` via SerpApi), `scripts/sensor-paa.mjs`, `scripts/classify-competitors.mjs` | SerpApi AIO/PAA: **Verified-operational**. LLM engines: **Broken** (401/401/429). Classify: **Broken** (401) | 10-12 log: `google_aio … CITED #1/#2/#4/miss`; `[paa] questions_captured=32 faq_tasks_queued=8 source=serpapi`; `claude err 401`, `perplexity err 401`, `openai err 429`; `[classify] … classified=0` [L] | AIO samples carry no `no_cache`/`location` (`lib/engines.mjs:156`), so the 3-sample vote is probably inert (data-providers doc §1.1). The queries/analyst use a second Supabase client, `lib/db.mjs`, which sidesteps the `supabase.mjs` seam (`.claude/rules/technical-defaults.md`) | none open |
| 1c | Data collection (CWV) | `scripts/sensor-cwv.mjs` (CrUX field), `scripts/check-vitals.sh` (PSI lab), `.github/workflows/vitals-pr.yml` | **Configured but dark** (no key) | `[cwv] no CRUX_API_KEY/PAGESPEED_API_KEY set — skipping` [L]. Neither secret exists in `gh secret list` [L]. `vitals-pr.yml` fires only on `deployment_status`, which a WordPress target never emits [R] | Key not provisioned. Lab check not wired for WordPress | none |
| 2 | Crawl / render | `scripts/link-graph.mjs` (plain `fetch` + regex, 150-page cap); `seo-audit` skill expects `./crawl/*.csv` | **Implemented, not scheduled**; no renderer | `link-graph.mjs` is referenced by no workflow and no npm script (grep) [R]. No `crawl/` dir [R]. Lockfile has no Playwright/Crawlee/Lighthouse/cheerio [R] | No scheduled crawl. No JS render. Unchecked `link_graph` upsert (`link-graph.mjs:89`) | Firecrawl audit #102 (docs, one-off). Crawl decision is in the crawl-render doc (§6) |
| 3 | Normalized evidence | Supabase `outcomes`, `ai_citations`, `citation_events`, `paa_questions`, `ai_referrals`, `link_graph`, `competitor_domains` (`sql/schema.sql`, `sql/ai-search-schema.sql`); `orchestrator/lib/url.mjs` canonicalization | **Implemented**; partial | Outcome rows land weekly [L]. `outcomes.metric` is free text (`schema.sql:33-39`) [R] | No crawl/page-state table. No per-URL evidence bundle handed to `seo-fixer` (it re-reads the live CMS via `cms-read.mjs`). `ai_referrals` keys are uncanonicalised paths (`sensor-ai-referrals.mjs:80-82`) | none |
| 4 | Opportunity detection | Sensor thresholds: `sensor-gsc.mjs:18-27` (decay → `blog-write`, striking-distance → `metadata-generate`); sitemap new-url → `seo-audit`; indexation → `seo-audit`; CWV → `cwv-audit`; AI miss → `restructure-for-citation`/`ai-info-page`; PAA → `faq-schema`; `orchestrator/lib/sensor.mjs` harness + `supabase.mjs:enqueue` chokepoint (do_not_touch) | **Verified-operational** (GSC/sitemap/PAA) | Enqueue counts above [L]. 315 pending on 10-12 [L] | Every sensor tags `risk_class:"safe"` (`sensor.mjs:48`, `sensor-paa.mjs:70`, `sensor-ai-citations.mjs:101`). The safe/gated split is never computed from content. Striking-distance enqueues per (page, query) row, de-duplicated only by the `(url,task,status)` constraint | #93 (A8 dispatch gate) |
| 5 | Prioritization | `scripts/prioritize.mjs` + `orchestrator/lib/learning.mjs:reprioritize` (GSC anchor + GEO + CONV blends); `scripts/attribute*.mjs` | **Verified-operational** (runs). Signal is weak | 10-12: `reprioritized 2/315 pending items (69 GSC, 0 GEO, 72 CONV patterns matched)` [L] | GEO table never refreshes because `attribute-citations` is skipped (§0.3). There is no volume/difficulty/business-value input | #92 (NaN guards) |
| 6 | Brief / content generation | `orchestrator/run.mjs` (Agent SDK `query()`, `claude-sonnet-4-6`), `orchestrator/goal.mjs`, inline `seo-fixer` subagent, 16 kit skills in `.claude/skills/` | **Broken** in CI (auth) | §0.1 logs [L] | There is no brief stage. The skill output goes straight to a `change_set` payload | #97 (warning only), #93 (caps) |
| 7 | Validation | Deterministic: `scripts/validators/content-guards.mjs`, `scripts/validators/citation-density.mjs`, `scripts/lib/schema-lint.mjs` (`validate-json.mjs`), `scripts/lib/metadata.mjs` (`validate-metadata-csv.mjs`), `check-diff-size.mjs`. LLM: `scripts/eval-judge.mjs` (Haiku). Hooks: `.claude/hooks/guard-publish.sh`, `guard-write.sh`, `post-validate.sh` | Deterministic CI steps: **Verified-operational** (eval-gate green on PRs 10-16/17) but they **skip** unless the PR carries `seo-auto` or touches the matching files. LLM judge: **Broken** (invalid key; fail-closed) | `seo-eval-gate.yml:26-106` [R]. eval-gate runs `success` [L]. The judge would hit the same 401 [L, inferred] | **The CMS path runs no eval-judge, citation-density or schema-lint.** Only `scanPlaceholders` runs at apply (`cms.mjs:118-127`). CONTEXT.md says this ("Loop B's quality gate is the human") | #104 (new guard rules), #92 |
| 8 | Human approval | Manual `UPDATE change_set SET status='approved'` (ADR-005); Linear mirror of escalations (`scripts/push-escalations.mjs`) | **Implemented**; no UI | 10-12: `push-escalations: 0 mirrored, 0 failed, 0 total` [L] | No review UI and no diff view. The approver sees raw `new_value`. Linear mirror targets `TEAM_ID` "BSM-AI" + project "Maxx Builders SEO Audit" (`push-escalations.mjs:14-15`), whereas `docs/agents/issue-tracker.md` says the team is "Seo Agent" (key `SEO`) **with no projects**. Mismatch, UNVERIFIED which is current | #98 (close path), #94 (ADR-010) |
| 9 | change_set | `scripts/mem.mjs apply/changeset`, `orchestrator/lib/payload.mjs` (fields: `post_content,title,description,canonical,focus`; risk_class default `gated`), `orchestrator/lib/tasks.mjs:assertTaskType`, `scripts/cms-read.mjs` (`base_value`) | **Implemented**. Live behaviour **UNVERIFIED** | No CI run has reached it (§0.1) | `change_type` column missing from DDL (§0.8). `cms-read.mjs` resolves only `posts`/`pages` by last slug segment (`:30-44`). The CI orchestrate step does not pass `WP_BASE_URL/WP_USER/WP_APP_PASSWORD` (`seo-sensors.yml:50-58`), so `cms-read.mjs` would throw at `packs/wordpress/http.mjs:6-7` even with a valid Anthropic key [R, inferred] | #107 (staged payloads, not inserted) |
| 10 | CMS apply | `packs/wordpress/apply.mjs` (REST meta + `content.raw`), `orchestrator/lib/cms.mjs:applyRow` (do_not_touch → risk_class → supports → read → snapshot → drift → content-guard → write → verify), `packs/wordpress/seo-keys.mjs`, `seo-rest-bridge.php`, `packs/wordpress/publish-drafts.mjs` (create-only drafts, bypasses change_set) | **Verified-operational as a no-op** (0 approved rows nightly) | `WordPress apply — applied 0, escalated 0, failed 0` on 10-16 [L] | On main: `snapshot()`/`setStatus()` ignore Supabase errors (`cms.mjs:22-27,34-36`). `post_content` is not drift-checked (`apply.mjs:57-60`). No Elementor check. No capability preflight. A 401 is misreported as "neither a post nor a page" (`apply.mjs:24-29`) | #104 → #105 (SEO-14) → #109 |
| 11 | Read-back / render verification | `apply.mjs:39-51 verifyYoastHead` (soft `yoast_head.includes`, logs `skip` on mismatch, never throws) | **Implemented, soft** | [R] | No hard `context=edit` re-read equality check. No public-HTML check after purge. No front-cache awareness (`X-Cache: HIT`, ~9 h age per the apply-surfaces doc). `includes` on HTML-escaped head is fragile | #109 (drift only, not read-back) |
| 12 | Search / conversion measurement | `collect-outcomes.mjs` (GSC 28-day page metrics, GA4 organic `conversions`), `sensor-ai-citations.mjs` (citations outcome rows), `sensor-ai-referrals.mjs` | GSC/GA4 weekly: **Verified-operational**. AI referrals: **Broken** | §0.3–0.4 [L] | GA4 `conversions` ≠ leads (lead-attribution doc). There is no CRM/lead table. GSC uses a single 28-day window with no control group | none |
| 13 | Learning | `scripts/attribute.mjs` → `learned_patterns`; `attribute-conversions.mjs` → `learned_patterns_conv`; `attribute-citations.mjs` → `learned_patterns_geo`; `build-eval-set.mjs`, `judge-calibrate.mjs`; `experiments`/`eval_set`/`judge_calibration` tables | attribute: **Verified-operational**. conv: runs, "not enough pairs". geo: **Broken** (skipped). Calibration: runs, degenerate | 10-12: `blog-write: avg_effect -8.1% over 11 changes`, `metadata-generate: -21.5% over 5`, `restructure-for-citation: -10.3% over 4`; `judge-calibrate … auc=0.5` [L] | Every learned pattern is **negative**. There is no seasonality or control. `attribute-conversions.mjs:34-38` selects `decision_log` rows **without** `action='applied'`, so escalations and skips count as "changes" [R]. `logDecision` ignores errors (`supabase.mjs:141-143`) | none |
| — | Spend / safety controls | `control` table (`paused`, `spend_usd`, `month`), `increment_spend()` (`schema.sql:76-89`), `addSpend` (`supabase.mjs:36-50`), `preflight.check` (`orchestrator/lib/preflight.mjs`), `MONTHLY_BUDGET_USD=50` [L] | **Implemented**; blind in CI | Cost always `$0.00` [L] | No per-run cap on main. `apiKeySource` is not captured. Failures read as success | #97, #93 |

---

## 3. Baseline matrix

| Capability | Current implementation | Operational evidence | Gap | Existing owner / ticket / PR | Candidate improvement |
|---|---|---|---|---|---|
| **GSC** | `orchestrator/lib/gsc.mjs` (webmasters.readonly, retry, paging). Sensors decay + striking distance. URL Inspection (`verdict` only). Weekly outcomes | **Operational**: nightly enqueue 67–70; weekly 213 URLs [L] | `searchAppearance/device/date`, `dataState`, Sitemaps API unused. Canonical/lastCrawl fields discarded. `http://` variants inspected | First-party doc rank #1 | Widen the existing calls (no new credential) |
| **GA4** | `collect-outcomes.mjs:collectGa4` (organic `conversions`/`sessions`); `sensor-ai-referrals.mjs` | Outcomes **operational** (83 pages); referrals **broken** (gcp.json quoting) [L] | Deprecated `conversions`, all key events. Property of record unknown (4 measurement IDs live) | Lead-attribution doc path A | Switch to `keyEvents:Lead` after operator confirms property and key event. Fix `ai-search-sensors.yml:17` quoting |
| **CrUX / CWV** | `sensor-cwv.mjs` (field p75, 30-day cooldown); `check-vitals.sh` (PSI lab); `vitals-pr.yml` | **Dark**: no key secret [L] | No key. Lab gate never fires for WordPress | First-party doc rank #2/#5 | One Cloud API key (CrUX + PSI); schedule lab checks over `config/urls.txt` |
| **SERP / AIO (SerpApi)** | `lib/engines.mjs:askGoogleAIO`, `sensor-paa.mjs`, `SERPAPI_KEY` secret present | **Operational** (AIO cited/miss rows, 32 PAA questions) [L] | No `no_cache`/`location`, so the majority vote is probably inert. Downstream `attribute-citations` is skipped | ADR-007 (Proposed); data-providers doc §1.1 | Add `no_cache=true` + a Texas `location` on AIO samples |
| **DataForSEO** | None (grep: zero code refs; only `docs/buzz-seo-extension-architecture.md`, ADR-007 text) [R] | n/a | No volume, rank, Maps or backlink data | Data-providers doc: recommended; SEO-11 spike needs a $50 top-up above the $25 cap. Caller reports the top-up as **deferred**; no repo record found (UNVERIFIED, likely Linear) | Keep deferred until sign-off; spike design is in that doc §6 |
| **Crawling (Firecrawl etc.)** | None in runtime. `link-graph.mjs` unscheduled regex crawler. `.firecrawl/` gitignored; interactive Firecrawl skills only | One-off Firecrawl audit 2026-10-14 (~170 credits) [P #102] | No scheduled crawl. No `crawl/*.csv` for `seo-audit` | Crawl-render doc (build Crawlee+Playwright; SEO-12 spike) | See crawl-render doc |
| **Rendered verification** | `verifyYoastHead` soft check only | n/a | No public-HTML re-read. Front cache not modelled | Apply-surfaces doc conclusion 7 | Hard `context=edit` equality plus a delayed public GET |
| **Schema lint** | `scripts/lib/schema-lint.mjs` (placeholders, required props, @context), CLI `validate-json.mjs`, eval-gate step, post-validate hook, `publish-drafts.mjs` refusal | CI step runs on every PR touching `schema/*.jsonld` [R]; recent PRs green [L] | Not applied to CMS-path payloads. No rendered-page JSON-LD count check (Elementor posts never render body JSON-LD) | #87 (merged) | Run lint on `post_content` payloads containing `ld+json` at apply |
| **Metadata validation** | `scripts/lib/metadata.mjs` (≤60/≤155, duplicates, canonical), `validate-metadata-csv.mjs`, `wp-content.mjs:capErrors` | CI step diff-scoped [R] | CMS-path `title`/`description` payloads are **not** length-checked at `applyRow` | none | Reuse `metadata.mjs` rules in `applyRow` |
| **Citation-density gate** | `scripts/validators/citation-density.mjs` + `check-citation-density.mjs`, eval-gate step (seo-auto only) | Only on `seo-auto` PRs; none recently [L] | `TARGET_DOMAIN` var unset, so it falls back to the `WP_BASE_URL` full URL. The self-domain normalisation bug is fixed only in #92 (open) | #92 | Merge #92. Consider running on CMS `post_content` |
| **Eval-judge** | `scripts/eval-judge.mjs` (Agent SDK, Haiku 4.5, fail-closed `decide`) + weekly `judge-calibrate` | Would fail on 401 [L, inferred]. Calibration `auc=0.5` [L] | Invalid key. Repo path only | ADR-003 | Rotate key (operator). Calibration is meaningless until then |
| **Spend accounting** | `control.spend_usd` via `increment_spend` RPC, fallback RMW; `finally` billing (`run.mjs:71,169`) | Every run records `$0.00` [L] | Auth failure is swallowed as success. No `apiKeySource`. No per-run cap | #97 (`fix/spend-usd-accounting`, warning), #93 (`maxBudgetUsd`, `maxTurns`) | Exit non-zero on a `$0`-with-error run, not just warn |
| **Rollback / snapshots** | `snapshots` table, `cms.snapshot`, `rollbackRow` + `packs/wordpress/rollback.mjs` | Never exercised in CI (0 applies) [L] | Snapshot ignores errors on main. Meta writes create no WP revision, so snapshots are the only rollback record. `null` old_value is ambiguous | #104 (snapshot throws), #105 (latestSnapshot/setStatus throw) | Merge the #104→#105 stack before any approved row |
| **Content drift** | `cms.drifted` for meta fields only; `post_content` exempt (`apply.mjs:57-60`) | n/a | Full-body rewrites overwrite human edits | #109 (raw-to-raw, fail closed; race window still open) | Server-side `modified_gmt` precondition (mu-plugin), follow-up in #109 |
| **Elementor handling** | **None** in code. Only prose in `push-escalations.mjs:35` | n/a | REST `post_content` on builder pages is a no-op that gets overwritten (apply-surfaces doc). Mixed site (2641/5975 Elementor; 5843/7429 not) | Apply-surfaces doc conclusion 3. #107 checked targets by hand | Read `_elementor_edit_mode` in `applyRow`; escalate `elementor-built` |
| **Yoast field support** | `seo-keys.mjs`: title/metadesc/canonical/focuskw (+ Rank Math keys); `seo-rest-bridge.php` registers 8 keys on post+page | Live REST exposes the 4 Yoast keys but not the Rank Math keys, so the live registration ≠ the committed bridge (apply-surfaces doc). `SEO_PLUGIN=yoast` [L] | No robots/schema-type surface. Canonical bypasses `wpseo_edit_advanced_metadata`. CPTs (`locations`, `project`) unsupported. Yoast 27.5 has no write ability | ADR-008; #101 (MCP spike: adapter live on prod) | Key-in-schema preflight; self-canonical-only rule |
| **Linear escalation** | `scripts/push-escalations.mjs` (GraphQL, `LINEAR_API_KEY` secret present), weekly in `seo-learn` | **Operational**, 0 rows to mirror [L] | One-directional. Team/project IDs disagree with `docs/agents/issue-tracker.md` | #98 (operator-run close), #94 (ADR-010) | Reconcile the target team (BSM-AI vs SEO) |
| **Lead / CRM attribution** | None beyond GA4 `conversions`. No leads/UTM/gclid table | n/a | GHL form iframe loses the landing page. Salesforce has no attribution fields | Lead-attribution doc (A now, B destination) | Path A (GA4 `Lead` key event) once the property is confirmed |
| **Internal links** | Skills `internal-linking` (repo-native) and `internal-link-graph` (change_set); `link-graph.mjs` (unscheduled); `link_graph` table | Wave 1 has 5 staged link payloads, not inserted [P #107] | No rendered link graph. 150-page cap vs 239 sitemap URLs. Elementor links unreachable via `post_content` | #107; crawl-render doc | Feed `link-graph` from the crawler's link export |
| **Sitemap sensor** | `scripts/sensor-sitemap.mjs` (index recursion, SSRF guard, `sitemap_seen` after enqueue) | **Operational**: `239 page urls, 0 new` [L] | Sees only XML, not Google's view (Sitemaps API). New-URL detection is one-shot | First-party doc §2.1 | Add GSC `sitemaps.list` errors/warnings |

---

## 4. MCP: interactive vs headless

**Configured for interactive use** (`.mcp.json` at 7a3d333) [R]:

| Server | Command | Notes |
|---|---|---|
| `supabase` | `npx -y @supabase/mcp-server-supabase@0.8.2 --read-only=false`, env `SUPABASE_ACCESS_TOKEN` | Per #106, `--read-only=false` throws `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`, so the server never starts. It is also unscoped (account tools across 13 projects) [P]. This session also saw `supabase` fail (connect timeout). |
| `analytics-mcp` | `uvx analytics-mcp`, env `GOOGLE_APPLICATION_CREDENTIALS` (default `gcp.json`) | Google Analytics MCP. It needs a local `gcp.json` and `uv`. It failed to connect this session (CONNECTION_CLOSED); cause UNVERIFIED. |

Other MCP servers visible in interactive sessions are **user-level plugins, not repo
config**: Linear (OAuth, `docs/agents/issue-tracker.md` says "unavailable in headless
runs"), GitHub, Context7, claude-in-chrome, knip, vercel. Several failed to connect this
session (DNS). The `firecrawl*`, `tavily*` and `build-with-exa` skills are user-level CLI
skills.

**What the headless orchestrator can call** [R]:
- `run.mjs:45` (repo mode) allows `Read, Write, Edit, Glob, Grep, Bash, Agent`.
- `run.mjs:110` (CMS mode) allows `Read, Write, Bash, Agent`.
- Both use `permissionMode: "acceptEdits"` and `settingSources: ["project"]`.
- Under `SEO_AGENT_GUARDED=1` (`run.mjs:23`), Bash is reduced to an allowlist
  (`guard-publish.sh:55-66`): `mem.mjs queue|apply|changeset|log|status`, `cms-read.mjs`,
  `validate-json.mjs`, `npm run validate:metadata|diff-size|build|judge`, and
  `git checkout -- <path>`.
- Writes are confined by `guard-write.sh`.
- **No MCP tool is in `allowedTools`, and CI provides no `SUPABASE_ACCESS_TOKEN` to that
  step and no `uvx`. Headless MCP availability is effectively none.** Whether SDK 0.1.77
  would even load `.mcp.json` under `settingSources:["project"]` is UNVERIFIED and moot.
- Headless data access goes through `scripts/mem.mjs` (service role) and
  `scripts/cms-read.mjs` (WP REST), and the latter lacks WP env in CI (§2 row 9).
- Linear is reached only by `push-escalations.mjs` over GraphQL with `LINEAR_API_KEY`.

Repo variables present: `COMPETITOR_MIN_CONFIDENCE, GA4_PROPERTY_ID, GSC_SITE_URL,
INDEXATION_LIMIT=50, JUDGE_MIN_SCORE=3, MAX_DIFF_LINES=400, MONTHLY_BUDGET_USD=50,
SEO_PLUGIN=yoast, SITEMAP_URL, SITE_PLATFORM=wordpress, SITE_URL, WP_BASE_URL=https://www.maxxbuilders.com`.

Repo secrets present (names only): `ANTHROPIC_API_KEY, GCP_SA_JSON, LINEAR_API_KEY,
OPENAI_API_KEY, PERPLEXITY_API_KEY, SERPAPI_KEY, SUPABASE_ACCESS_TOKEN,
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, WP_APP_PASSWORD, WP_USER`.

Absent: `CRUX_API_KEY`, `PAGESPEED_API_KEY`, `TARGET_DOMAIN`, `AIO_SAMPLES`,
`COMPETITOR_DOMAINS`, `WEBFLOW_*` [L].

---

## 5. Dependencies (package-lock.json v3, 88 packages)

| Package | Locked version | SEO-tooling role |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | 0.1.77 (pinned exact) | orchestrator `query()`, eval-judge, citation analyst |
| `@supabase/supabase-js` | 2.108.2 (`^2.45.0`) | memory layer (`orchestrator/lib/client.mjs`, `lib/db.mjs`) |
| `googleapis` | 144.0.0 | GSC Search Analytics + URL Inspection, GA4 Data API (`collect-outcomes`) |
| `google-auth-library` | 10.9.0 (`^10.7.0`) | GA4 auth in `sensor-ai-referrals.mjs` |
| `gaxios` | 6.7.1 (transitive) | googleapis HTTP |
| `marked` | 18.0.5 | draft markdown → HTML (`scripts/lib/wp-content.mjs`) |
| `zod` | 4.4.3 (pinned) | SDK peer / schemas |

There are no crawler, renderer, HTML-parser, Lighthouse or provider SDKs. SerpApi,
CrUX, PSI, Linear, Perplexity, OpenAI, Anthropic Messages, WordPress REST and Webflow are
all called with raw `fetch`/`curl` [R].

---

## 6. Prior SEO-1 research (do not duplicate)

**Crawl and render approach** (`research/crawl-render-approach`, 0692f7a):
- Recommendation is to **build**: Crawlee + Playwright weekly in GitHub Actions, writing a
  Screaming-Frog-shaped `crawl/*.csv`, plus Unlighthouse for lab CWV and a11y. About
  $0/mo on a public repo. Medium confidence.
- **Screaming Frog paid** is the best off-the-shelf fit ($279/yr), but its EULA is not
  cleared for GitHub-hosted runners. It is provisionally disqualified pending written
  confirmation.
- **Firecrawl** stays ad-hoc. It does not document canonical or redirect capture, and it
  costs credits each run. Sitebulb doesn't fit GitHub Actions.
- **Rendering is the crux.** WP Rocket delay-JS runs only on interaction, and Googlebot
  doesn't interact. The **SEO-12 spike** compares raw / passive / interacting / Chrome /
  GSC-live captures on 20 URLs.
- Run crawl output as a separate weekly workflow and keep it out of committed files
  (public repo). Server-log access and Wordfence rate limits are open.

**First-party search APIs** (`research/first-party-search-apis`, 686665f):
- Rank #1 is to widen the **existing GSC** calls (`searchAppearance`, `dataState`,
  Sitemaps `list`, the discarded URL-Inspection fields). No new credential is needed.
- Correction: GA4 `conversions` → `keyEvents` (defers to the lead-attribution doc).
- Set one Cloud API key with **CrUX + PSI** (PSI quota not documented). Add CrUX History
  for before/after trends.
- **Bing Webmaster API** is the only $0 partial backlink source. Its key is write-capable
  and needs a method allowlist. Bing AI Performance has no API.
- **IndexNow** has no Google effect and comes only after apply-path fixes. GBP APIs are
  gated by an application. Keyword Planner is parked. The Indexing API is
  **disqualified**.

**Lead attribution path** (`research/lead-attribution-path`, a913b48):
- The only lead form is a **GoHighLevel iframe** (`link.buzzdigital.app`). Leads flow
  GHL → Salesforce (system of record). The GHL→SF map was never inspected.
- **Salesforce has no UTM, gclid, landing-page or referrer fields.** Opportunity source
  defaults to "Google Search", so organic cannot be read from the CRM.
- The organic landing page is lost at the iframe hop. GA4 sees `Lead` via a GTM bridge in
  **G-93353ZE9HH**, one of four GA4 IDs.
- The repo's `organic_conversions` is probably mis-specified (deprecated metric, all key
  events).
- Decision: **path A now** (GA4 `Lead` key event), **B as the destination** (hidden fields
  → GHL → SF), and **C** (call tracking) only if calls are material.

**SEO data providers** (`research/seo-data-providers`, ce95620):
- **DataForSEO PAYG** is the balanced choice (score 89): about $10–15/mo expected and
  ≤ ~$70 high. It is the only provider covering volume, SERP, rank, Maps, backlinks and
  competitor data.
- **Keep SerpApi for AIO** (ADR-007). The duplicate PAA/AIO spend is about $0 due to the
  1 h cache, but that same cache likely makes the 3-sample AIO vote inert. Add
  `no_cache` + `location`.
- Ahrefs Lite ($129) is the advanced add-on. The Semrush direct API is disqualified for
  budget. Keyword Planner is a poor fit.
- The **SEO-11** 50-keyword spike is needed, but DataForSEO's **$50 minimum top-up
  exceeds the $25 spike cap**, so it needs explicit sign-off. The caller reports the
  top-up as **deferred**; I found no record of that decision in the repo or PRs, so it is
  UNVERIFIED here and probably lives in Linear.

**WordPress apply surfaces** (`research/wp-apply-surfaces`, 69159c0):
- Live free **Yoast is 27.5**, which has no write ability. The live REST-meta
  registration exposes the 4 Yoast keys on posts and pages but differs from the committed
  bridge (no Rank Math keys).
- **Metadata via REST meta is the right surface now.** Every REST write triggers a
  per-post WP Rocket purge. Meta writes **create no revision**, so `snapshots` is the only
  rollback record and fail-open snapshot must be fixed first.
- **Elementor `post_content` writes are no-ops that get overwritten.** Read
  `_elementor_edit_mode` and escalate on `builder`. Raw `_elementor_data` writes are
  unsafe (24 h element cache, no revision).
- Robots, schema-type and CPT writes have no REST surface: they return 200 and silently
  drop the write. Check the key is in the route schema before writing.
- A front HTTP cache (`X-Cache: HIT`, ~9 h) means "applied" is not "live". The Wordfence
  default would disable app passwords if settings are reset, so add a `users/me`
  capability preflight.

Explicit deferrals and decisions across the docs: DataForSEO top-up (needs sign-off;
reported deferred). Screaming Frog CI use (pending a licence answer). IndexNow (after the
apply-path fixes). GBP APIs (application). Call tracking (pending call share). Yoast
≥28.6 abilities (only after hardening ships, and no MCP writes to prod per #101).

---

## 7. Current-state architecture

```mermaid
flowchart LR
  subgraph Interactive["Interactive (Claude Code session, operator)"]
    CC[Claude Code + .claude/skills x16]
    MCPS["Supabase MCP (.mcp.json)\nbroken flag, unscoped (#106)"]
    MCPA["analytics-mcp (uvx)"]
    PLUG["User plugins: Linear OAuth, GitHub,\nFirecrawl/Tavily CLI skills"]
    CC --- MCPS & MCPA & PLUG
  end

  subgraph GHA["GitHub Actions (scheduled)"]
    SENS["seo-sensors 07:00 nightly\nGSC / sitemap / indexation / CWV(dark)"]
    ORCH["orchestrator/run.mjs (CMS mode)\nAgent SDK sonnet-4-6\nBROKEN: invalid API key, exits 0"]
    APPLY["seo-apply-cms 07:30 nightly\npacks/wordpress/apply.mjs\n(0 approved rows)"]
    AIS["ai-search-sensors Mon 06:30\nclassify(401) / AIO+PAA(SerpApi OK)\nanalyst(401) / ai-referrals FAIL"]
    LEARN["seo-learn Mon 08:00\noutcomes / attribute / prioritize\npush-escalations / judge-calibrate"]
    GATE["eval-gate (PR)\ndiff-size, content-guards, citation-density,\nschema+metadata lint, Haiku judge(401)"]
    MERGE["seo-auto-merge (PR, seo-auto label)"]
    SENS --> ORCH
  end

  subgraph SB["Supabase (prod, service role)"]
    WQ[(work_queue\n315 pending)]
    CS[(change_set)]
    SN[(snapshots)]
    DL[(decision_log)]
    OUT[(outcomes / learned_patterns*)]
    CTRL[(control: paused, spend_usd=$0)]
    AIT[(ai_citations / citation_events / paa_questions)]
  end

  subgraph Providers["External providers"]
    GSC[GSC API]
    GA4[GA4 Data API]
    CRUX["CrUX / PSI (no key)"]
    SERP[SerpApi]
    LLM["Anthropic / Perplexity / OpenAI\n(401 / 401 / 429)"]
    LIN[Linear GraphQL]
  end

  subgraph Site["maxxbuilders.com (production only)"]
    WP["WordPress 7.1.3 REST\nYoast 27.5 + bridge, Elementor 4.0.7"]
    CACHE["WP Rocket + front HTTP cache"]
    WP --> CACHE
  end

  HUMAN{{"Human gate:\nchange_set pending→approved (SQL)\nPR merge"}}

  SENS -->|enqueue| WQ
  SENS --> GSC
  ORCH -.->|mem.mjs queue/apply| WQ
  ORCH -.->|cms-read.mjs (no WP env in CI)| WP
  ORCH -.->|change_set rows| CS
  ORCH -.-> CTRL
  CS --> HUMAN --> APPLY
  APPLY -->|snapshot| SN
  APPLY -->|REST meta / content.raw| WP
  APPLY --> DL
  AIS --> SERP & LLM
  AIS --> AIT
  AIS -->|enqueue faq/citation tasks| WQ
  LEARN --> GSC & GA4
  LEARN --> OUT
  LEARN -->|reprioritize| WQ
  LEARN -->|escalations| LIN
  GATE --> MERGE
  CC -->|interactive SQL / approvals| SB
```

Dashed edges are wired but have not run successfully in any CI log read today.

---

## 8. Open questions (UNVERIFIED)

1. **Live `change_set` columns.** Does the production table have `change_type` (and
   `risk_class`)? `sql/schema.sql` lacks `change_type`. Read `information_schema.columns`
   read-only.
2. **Why is CI `ANTHROPIC_API_KEY` invalid** (rotated, revoked, or out of credit), and is
   the API-key path intended at all for headless? Operator check in the Anthropic Console.
   Do not inspect the value.
3. **Is `ai-search-sensors.yml:17` double-quoting the real cause** of the
   `GCP_SA_JSON` parse failure? It fits the log. Confirm by comparing it with the
   single-quoted workflows that succeed.
4. **Historical applied decisions.** 11 `blog-write`, 5 `metadata-generate` and 4
   `restructure-for-citation` "changes" were attributed [L]. Which of them were real live
   applies (interactive runs) and which are logs? Is the uniformly negative effect real?
5. **Linear target.** Is `push-escalations.mjs` team `c8b2fc25…` ("BSM-AI") /
   project `4732c6e5…` still correct, given `docs/agents/issue-tracker.md` names team
   "Seo Agent" (key SEO) with no projects?
6. **The `WP_USER` role and capabilities** behind `WP_APP_PASSWORD`. Editor per
   `security.md`, not verified. Includes `unfiltered_html`.
7. **Restorable production backup** (root `CLAUDE.md` precondition) and its restore
   cadence.
8. **What happens on a `seo-auto` PR today.** No recent one exists. Expected: the judge
   fails closed on 401, so auto-merge never fires.
9. **SerpApi plan, cached vs billed counts, and live `ai_queries` count.** Carried over
   from the data-providers doc.
10. **DataForSEO top-up deferral.** Where it is recorded (Linear?) and what unblocks it.
11. **`judge-calibrate` `auc=0.5`.** Degenerate because every judge call 401'd, or a real
    result?
12. **Whether the merged state of #104/#105/#109 reaches main** before any row is
    approved. Today nightly apply would write live with fail-open snapshots.
