# Security Rules — maxx-seo-agent

## Credential inventory and blast radius

Three credential classes are in active use. Know what each one can do.

| Credential | Blast radius if leaked | Rotation path |
|---|---|---|
| `ANTHROPIC_API_KEY` | Metered credit pool drained (separate from Max subscription) | Anthropic Console → API keys → Delete + create new |
| `SUPABASE_SERVICE_ROLE_KEY` | Full read/write on prod Supabase: queue, logs, snapshots, outcomes, do_not_touch | Supabase → Project settings → API → Rotate |
| `gcp.json` (GCP service-account) | GSC read-only for this property + any other scopes granted to the SA | GCP → IAM → Service accounts → Keys → Delete key → Create new key |

Additional credentials (lower blast radius but still sensitive):
- `SUPABASE_ACCESS_TOKEN` — personal access token for MCP; scoped to account, not project.
- `WP_APP_PASSWORD` — WordPress Application Password; scoped to a single WP user role.
- `WEBFLOW_API_TOKEN` — full Webflow site write access. Treat like service-role.

## Hard rules

- **Never log credentials.** No `console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)`,
  no debug dumps that include env objects.
- **Never echo them in Bash.** `echo $SUPABASE_SERVICE_ROLE_KEY` in a script or hook
  leaks the value to GitHub Actions logs (visible in repo settings, persisted).
- **Never commit `.env` or `gcp.json`.** Both are in `.gitignore`. Run `git status`
  before `git add -A` to verify they are not staged.
- **Never include credential values in PR bodies, commit messages, or issue comments.**
- **Never pass service-role credentials to a browser-facing context.** The Supabase
  client in `supabase.mjs` uses service-role; it runs server-side only (CI and local
  Node). It must never be imported from any client-side bundle.
- If any credential value appears in a diff or log output: **stop immediately**, remove
  from git history (`git filter-branch` or `git-filter-repo`), rotate the key, then
  continue.

## `ANTHROPIC_API_KEY` specifics

As of June 2026, headless SDK auth (`ANTHROPIC_API_KEY`) draws from a **separate metered
credit pool** — not the Max subscription. Charges accumulate on the API billing account.
If billing looks wrong in interactive Claude Code, check `$env:ANTHROPIC_API_KEY` in
PowerShell — a stale Windows environment variable can override the Max token.

The `MONTHLY_BUDGET_USD` guard in the orchestrator and the `control.paused` kill switch
are the primary runaway-spend defenses. Check them before enabling any unattended run.

## CMS credential scope

- **WordPress** `WP_APP_PASSWORD`: create it under an Editor-role user, not Admin.
  The apply pack only needs to write post meta and create/update posts — it does not
  need plugin management or user management.
- **Webflow** `WEBFLOW_API_TOKEN`: scope to the specific site if the Webflow API
  supports site-scoped tokens for your plan tier. Global tokens give access to all
  sites in the workspace.

## `WEBFLOW_ALLOW_SITE_PUBLISH=true` gate

This env var must be set explicitly and intentionally before `npm run webflow:publish`
will run. A global site publish flushes every pending change — including any staged by
other team members. Never set this as a default in `.env` or CI vars. Only pass it
inline when you have reviewed all staged changes in the Designer and are ready to go live.
