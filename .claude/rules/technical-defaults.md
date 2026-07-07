# Technical Defaults — maxx-seo-agent

## Node.js

- ES Modules everywhere. Use `import`/`export`, not `require`. File extension `.mjs`
  for all scripts.
- `node >=22` required (engines field in `package.json`). Use `node --env-file=.env
  <script>` for local runs — no `dotenv` package needed.
- All async entry points use `async function main() { ... } main().catch((e) => {
  console.error(e); process.exit(1); })`. Top-level `await` is fine inside that pattern.
- Error handling: never swallow errors silently. Every `.catch()` must either log and
  exit or re-throw. The orchestrator rolls back (`git reset --hard`) on error — expect
  this and don't fight it.

## Environment variables

Local: `.env` file at repo root (gitignored). CI: GitHub Actions secrets and vars.
Never hardcode values in source. Always check for a required variable at startup and
throw a descriptive error if missing (see `supabase.mjs` as the pattern).

| Variable | Source | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Console (API key, not subscription) | orchestrator, eval-judge |
| `SUPABASE_URL` | Supabase → Project settings → API | all supabase.mjs callers |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API | orchestrator/lib/supabase.mjs |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens | MCP server (interactive) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to `gcp.json` service-account file | sensor-gsc.mjs, collect-outcomes.mjs |
| `GSC_SITE_URL` | Your GSC property (e.g. `sc-domain:example.com`) | sensor-gsc.mjs, collect-outcomes.mjs |
| `MONTHLY_BUDGET_USD` | GitHub Actions variable | orchestrator preflight |
| `ORCHESTRATOR_MODEL` | Optional override; default `claude-sonnet-4-6` | orchestrator/run.mjs |
| `WP_BASE_URL`, `WP_APP_PASSWORD`, `SEO_PLUGIN` | WordPress host credentials (production — no staging environment; see root CLAUDE.md) | packs/wordpress/ |
| `WEBFLOW_API_TOKEN`, `WEBFLOW_SITE_ID` | Webflow account dashboard | packs/webflow/ |
| `CITATIONS_CSV`, `CONVERSIONS_CSV` | Optional file paths for attribution data | scripts/collect-outcomes.mjs |
| `SERPAPI_KEY`, `AIO_SAMPLES` | SerpApi key + per-run AIO sample count (default 3) | sensor-ai-citations.mjs (AIO capture) |
| `CITATION_EVENT_WINDOW_DAYS` | Lookback for the AIO snapshot diff (default 60) | scripts/diff-citation-events.mjs |
| `CITATION_ANALYST_MODEL` | Optional override; default `claude-sonnet-4-6` | scripts/analyze-citation-events.mjs |
| `SELF_INFLICTED_LEAD_DAYS`, `ANALYST_BATCH_LIMIT`, `ALGO_UPDATES_FILE` | Analyst window (14), batch cap (50), algo-calendar path | scripts/analyze-citation-events.mjs |

## Model routing

Match model tier to the task. Never hard-code version strings outside of env vars or
`run.mjs`; use the env var `ORCHESTRATOR_MODEL` to override at the job level.

| Task type | Model tier | Current ID |
|---|---|---|
| Eval-judge, sensors, cheap triage scouts | Fast / Haiku | `claude-haiku-4-5-20251001` |
| Orchestrator, skill execution, most content generation | Coding / Sonnet | `claude-sonnet-4-6` |
| Complex planning, multi-file architectural reasoning | Deep-reasoning / Opus | `claude-opus-4-8` |

Default in `run.mjs` is `claude-sonnet-4-6`. The eval-judge is explicitly set to Haiku
in `scripts/eval-judge.mjs` to keep gate costs low. Override via env var, not by
changing the source file.

## Supabase access patterns

- **CI / headless:** service-role key (`SUPABASE_SERVICE_ROLE_KEY`). Full read/write.
  All calls go through `orchestrator/lib/supabase.mjs`. Do not write inline Supabase
  client calls elsewhere — extend that file.
- **Interactive (Claude Code session):** personal access token (`SUPABASE_ACCESS_TOKEN`)
  via the MCP server defined in `.mcp.json`. This is a different credential from the
  service-role key.
- **Schema changes:** run `sql/schema.sql` in the Supabase SQL editor. It is idempotent
  (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Never run raw DDL against production
  from the orchestrator.

## npm scripts reference

| Script | What it does |
|---|---|
| `npm run orchestrate` | Full orchestration loop locally (sensors skipped; reads existing queue) |
| `npm run sensors` | GSC + sitemap sensors only (writes to queue, no orchestration) |
| `npm run validate:metadata` | Validates `metadata-changes.csv` against char limits + no-change rule |
| `npm run judge` | LLM-as-judge over current git diff (informative, not a gate locally) |
| `npm run diff-size` | Checks diff against `MAX_DIFF_LINES` (mirrors CI gate locally) |
| `npm run learn` | outcomes → attribution → prioritize loop (weekly; safe to run manually) |
| `npm run mem` | Calls `scripts/mem.mjs` — queue/log/status CLI for the orchestrator |
| `npm run wp:apply` | Apply approved change_set rows to WordPress (production — no staging environment) |
| `npm run webflow:apply` | Stage approved rows to Webflow (does not publish) |
| `WEBFLOW_ALLOW_SITE_PUBLISH=true npm run webflow:publish` | Global Webflow publish + PSI canary |

## File output conventions

Skills output to specific locations — do not change these without updating the skill
and any apply-layer pack that reads from it:

| Output | Location | Consumer |
|---|---|---|
| Blog drafts | `drafts/{slug}.md` | packs/wordpress apply, packs/webflow apply |
| Metadata changes | `metadata-changes.csv` | packs/wordpress apply, packs/webflow apply |
| JSON-LD schemas | `schema/{slug}.jsonld` | packs/wordpress apply, packs/webflow apply |
| Pending CMS changesets | `change_set/*.json` | packs apply layer |
| Sitemap state | Supabase `sitemap_seen` table | sensor-sitemap.mjs |
| Audit log | `.claude/seo-audit.log` | post-validate.sh hook (append-only) |
