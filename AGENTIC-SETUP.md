# Agentic SEO — Step-by-Step Implementation Guide

Version 1.0 · 2026-06-24 · build runbook for `AGENTIC-ROADMAP.md`

Stands up the system in order: **Phase 1 (L2 orchestration, mostly local)** → **Phase 2 (L3 sensors)** → **Phase 3 (L4 closed loop)**. Each step is verifiable before you move on. Targets a Node/TypeScript + Next.js + Vercel + Supabase + GitHub stack on Windows (Git Bash/WSL2) or macOS/Linux. Code blocks are scaffolds to adapt, not turnkey.

---

## Prerequisites

| # | Requirement | Why | Check |
|---|---|---|---|
| 1 | **Node.js 20+** and **git** | Orchestrator + tooling runtime | `node -v`, `git --version` |
| 2 | **Claude Code** installed | Interactive dev + skills | `claude --version` |
| 3 | **Anthropic API key** (Console) | Headless/SDK auth + separate billing pool | key in hand |
| 4 | **GitHub repo** + **GitHub CLI** (`gh`) | Versioned changes, PR-based autonomy, Actions runtime | `gh auth status` |
| 5 | **Supabase project** | Persistent memory layer | project URL + service role key |
| 6 | **Google Search Console** property (verified) + **GCP project** | Primary sensor (rankings/queries) | property shows data |
| 7 | The **multi-platform SEO kit** (this repo) | Provides the skills the agents run | `core/.claude/skills/` present |
| 8 | *(Optional)* **AI-citation tracker** (Profound / Peec / Otterly / Athena HQ) | Citation-drop sensor | API key |
| 9 | *(Optional)* **Vercel** deploy webhook | Re-audit changed routes on deploy | webhook URL |

> **Auth note (important):** the Agent SDK and headless `claude -p` must authenticate with `ANTHROPIC_API_KEY` — subscription login is not permitted for SDK-driven agents. As of June 15, 2026 headless usage draws from a separate metered credit pool (no rollover, API rates). Using your own API key for the fleet is the recommended posture: it separates billing and gives a prepaid pool with rollover.

---

## Tool stack (by architecture layer)

| Layer | Tool | Purpose |
|---|---|---|
| Sensing | GitHub Actions (cron), GSC API, citation tracker API, Vercel webhook | Emit events into the work queue |
| Orchestration | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) or `claude -p` | Plan + dispatch subagents + validate loop |
| Action | The kit's `.claude/skills/*` | The actual SEO edits (audit, metadata, schema, links, CWV, blog) |
| Memory | **Supabase** (Postgres) via Supabase MCP | decision log, queue, do-not-touch, outcomes |
| Guardrails | Claude Code **hooks** + **CI validators** (Lighthouse CI, PSI, Schema Validator) | Deterministic + evaluative gates |
| Delivery | **GitHub** (branches/PRs) via `gh` CLI or GitHub MCP | PR-based autonomy, human merge gate |
| Cost control | model routing + budget cap + kill switch | Keep the metered pool bounded |

---

## MCP servers to connect

The orchestrator (and interactive Claude Code) reach external systems through MCP. Connect these:

| Server | Used for | Connect |
|---|---|---|
| **Supabase** | Agent reads/writes the memory tables | `claude mcp add` (hosted) or project `.mcp.json` |
| **GitHub** *(optional)* | PR creation/comments from the agent | `claude mcp add`; or skip and use `gh` CLI in Bash |
| **Filesystem** | Built into Claude Code tools (Read/Write/Edit) | none |

Project-scoped `.mcp.json` at repo root (commits with the repo so CI and teammates share it):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only=false"],
      "env": { "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}" }
    }
  }
}
```

In an Agent SDK run, pass servers via the `mcpServers` option instead. Verify with `claude mcp list`.

---

## APIs & secrets to gather

Put local values in `.env` (git-ignored); put CI values in **GitHub → Settings → Secrets and variables → Actions**.

| Secret | Where to get it | Lives in |
|---|---|---|
| `ANTHROPIC_API_KEY` | platform.claude.com → Console | `.env` + GH secret |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API | `.env` + GH secret |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens (for MCP) | `.env` + GH secret |
| `GOOGLE_APPLICATION_CREDENTIALS` (service-account JSON) | GCP → IAM → Service accounts → Keys | file path + GH secret (as JSON) |
| `GSC_SITE_URL` | Your GSC property (e.g. `sc-domain:example.com`) | `.env` + GH var |
| `CITATION_API_KEY` *(optional)* | Tracker dashboard | GH secret |

---

# Sequential build

## Step 1 — Prepare the repo + kit
```bash
git clone <your-repo> && cd <your-repo>
mkdir -p .claude/skills
cp -r core/.claude/skills/* .claude/skills/           # audit/metadata/schema/links/cwv/gsc/...
cp -r modules/blog-engine/.claude/skills/* .claude/skills/
cp core/CLAUDE.md ./CLAUDE.md                          # the project brain + thresholds
printf "\n.env\nnode_modules/\n" >> .gitignore
git add -A && git commit -m "chore: install SEO kit skills + brain"
```
Open `CLAUDE.md` and set the guardrail thresholds the matrix depends on: max new pages per run, min uniqueness ratio, max change size for auto-merge, backlink floor for merge/delete. These are now versioned.

**Verify:** `claude` then `/seo-audit` runs interactively against a sample crawl.

## Step 2 — API key + cost routing
```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
```
Decide the model-routing map up front (this is your main cost lever). Record it in `CLAUDE.md`:

| Job | Model | ID |
|---|---|---|
| Audits, triage, refresh, subagent scouts, eval-judge | Haiku 4.5 | `claude-haiku-4-5-20251001` |
| Most generation + apply | Sonnet 4.6 | `claude-sonnet-4-6` |
| Planning + complex multi-file reasoning only | Opus 4.8 | `claude-opus-4-8` |

## Step 3 — Stand up Supabase memory
Run in the Supabase SQL editor:
```sql
create table decision_log (
  id bigint generated always as identity primary key,
  url text, action text, risk_class text, reason text,
  agent text, pr_url text, created_at timestamptz default now()
);
create table work_queue (
  id bigint generated always as identity primary key,
  url text, task text, risk_class text, priority int default 0,
  status text default 'pending', source text, created_at timestamptz default now()
);
create table do_not_touch (url text primary key, note text, added_by text);
create table outcomes (
  id bigint generated always as identity primary key,
  url text, metric text, value numeric, captured_at timestamptz default now()
);
create table learned_patterns (
  id bigint generated always as identity primary key,
  change_type text, avg_effect numeric, n int, updated_at timestamptz default now()
);
```
Seed `do_not_touch` with any URLs humans own by hand.

**Verify:** `select * from work_queue;` returns empty without error.

## Step 4 — Connect MCP servers
```bash
echo 'SUPABASE_ACCESS_TOKEN=sbp_...' >> .env
# create .mcp.json as shown above, then:
claude mcp list          # confirm "supabase" is connected
```
PR creation will use `gh` CLI (Step 6); add the GitHub MCP only if you prefer tool-based PRs.

## Step 5 — Wire the Google Search Console sensor
1. GCP → enable **Search Console API**.
2. Create a **service account**, download the JSON key.
3. In Search Console → property → **Settings → Users and permissions**, add the service-account email as a **Restricted** user.
4. Test query (Node):
```ts
// scripts/gsc-test.mjs
import { google } from "googleapis";
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
});
const sc = google.searchconsole({ version: "v1", auth });
const { data } = await sc.searchanalytics.query({
  siteUrl: process.env.GSC_SITE_URL,
  requestBody: { startDate: "2026-05-01", endDate: "2026-06-01",
    dimensions: ["page", "query"], rowLimit: 25 },
});
console.log(data.rows?.slice(0, 5));
```
```bash
npm i googleapis && node scripts/gsc-test.mjs   # should print rows
```

## Step 6 — Scaffold the orchestrator (reaches L2)
```bash
npm i @anthropic-ai/claude-agent-sdk
```
```ts
// orchestrator/run.mjs  — plan → dispatch subagents → validate → branch → PR
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";

const branch = `seo/auto-${Date.now()}`;
execSync(`git checkout -b ${branch}`);

const goal = `Read the pending items in the Supabase work_queue (via the supabase MCP).
For each SAFE-class item, run the matching kit skill to produce the fix.
Only act on classes allowed for auto-merge in CLAUDE.md. For anything risky,
write it to decision_log with action='escalate' and skip. Validate every change.`;

for await (const msg of query({
  prompt: goal,
  options: {
    model: "claude-sonnet-4-6",
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent", "mcp__supabase"],
    permissionMode: "acceptEdits",
    agents: {
      "seo-fixer": { description: "Applies one kit skill to one URL and validates.",
        prompt: "Run the named skill, then run the validators. Stop if any fail.",
        tools: ["Read", "Write", "Edit", "Bash"] },
    },
    settingSources: ["project"],   // load .claude/ skills + hooks + CLAUDE.md
  },
})) {
  if ("result" in msg) console.log(msg.result);
}

execSync(`git add -A && git commit -m "seo: automated fixes [skip ci]" || true`);
execSync(`git push -u origin ${branch}`);
execSync(`gh pr create --fill --label seo-auto`);
```
This is the **single approval gate**: the agent opens one PR; you review and merge.

**Verify:** `node orchestrator/run.mjs` produces a branch + PR with changes you can read.

## Step 7 — Add deterministic guardrail hooks
`.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": ".claude/hooks/guard-publish.sh" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": ".claude/hooks/post-validate.sh" }] }
    ]
  }
}
```
`.claude/hooks/guard-publish.sh` — **exit code 2 denies the tool call**:
```bash
#!/usr/bin/env bash
payload="$(cat)"                                  # tool input arrives on stdin
# Block direct publishes/deletes and main-branch pushes from the agent
if echo "$payload" | grep -Eiq 'wp post delete|301|git push .*\bmain\b|--publish'; then
  echo "Denied: risky op must be human-gated." >&2
  exit 2
fi
exit 0
```
`.claude/hooks/post-validate.sh` runs the schema validator + a uniqueness check and appends to an audit log (exit non-zero to surface a failure). `chmod +x .claude/hooks/*.sh`.

**Verify:** make the agent attempt a delete → the run is denied and logged.

## Step 8 — First supervised L2 run
Run Step 6, open the PR, read the diff against the autonomy matrix, merge. Confirm a row landed in `decision_log` and any risky items show `action='escalate'`.

## Step 9 — Add sensors on a schedule (reaches L3)
`.github/workflows/seo-sensors.yml`:
```yaml
name: seo-sensors
on:
  schedule: [{ cron: "0 7 * * *" }]      # 07:00 UTC nightly
  workflow_dispatch:
permissions: { contents: write, pull-requests: write }
jobs:
  sense-and-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - name: GSC poll → work_queue
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ${{ github.workspace }}/gcp.json
          GSC_SITE_URL: ${{ vars.GSC_SITE_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          echo '${{ secrets.GCP_SA_JSON }}' > gcp.json
          node scripts/sensor-gsc.mjs          # writes decayed/striking-distance items to work_queue
      - name: Orchestrate fixes → PR
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node orchestrator/run.mjs
```
`scripts/sensor-gsc.mjs` reuses the Step 5 query, flags pages with a ≥20–25% drop or position 5–20 with impressions, and inserts them into `work_queue`. Add a `sitemap-diff` sensor the same way.

**Verify:** trigger via **Actions → Run workflow**; new queue rows appear and a PR opens.

## Step 10 — Eval gate + CI validators
- Add an **LLM-as-judge** subagent (Haiku) that scores each change for quality/brand-voice/fact-checkability/information-gain and writes a pass/fail to the PR before merge.
- Add the kit's CI checks as required PR status checks: Lighthouse CI (`lighthouserc.js`), PSI thresholds, Schema Markup Validator, doorway/uniqueness guardrail. This is spec-driven verification — **a verifier blocks merge on failure.**

## Step 11 — Bounded auto-merge (reaches L4 partial)
Enable auto-merge **only** for the safe classes (metadata, schema, internal links, broken-link/alt-text, CWV template fixes, decayed-post refresh under thresholds) when **every** eval + CI check passes and the change is under the size threshold. Gate everything else (new content batches, merges/deletes with backlinks, brand/pricing/YMYL, `do_not_touch`) behind human merge. Implement with a branch-protection rule + an auto-merge step that checks the PR label and check status.

## Step 12 — Close the loop + operate
- **Attribution:** a weekly job writes rankings/citations/conversions to `outcomes`, joins to `decision_log` by URL/date, and updates `learned_patterns` (which change types actually moved metrics) → the planner reprioritizes from this.
- **Self-healing:** a regression sensor (rank/CWV/citation drop) files a high-priority queue item that the next run diagnoses and fixes.
- **Observability:** a dashboard over `decision_log` + audit log; review the escalation queue on a set cadence.
- **Kill switch:** a `paused` flag the orchestrator checks first; a hard monthly token-budget cap that disables the scheduled workflow when exceeded.

---

## Verification checklist

- [ ] `/seo-audit` runs interactively (Step 1)
- [ ] `gsc-test.mjs` returns rows (Step 5)
- [ ] `claude mcp list` shows supabase connected (Step 4)
- [ ] Orchestrator opens a readable PR (Step 6/8)
- [ ] A risky op is denied by the hook (Step 7)
- [ ] Scheduled workflow fills `work_queue` and opens a PR (Step 9)
- [ ] CI checks block a bad PR from merging (Step 10)
- [ ] Auto-merge fires only for safe classes (Step 11)
- [ ] `outcomes` + `learned_patterns` populate weekly (Step 12)

## Cost controls (do before Step 9)

- Route by difficulty (Step 2); reserve Opus 4.8 for planning only.
- Nightly, not hourly; only re-audit changed routes on deploy.
- Hard budget cap + `paused` kill switch in the orchestrator.
- A direct API key isolates the metered pool and gives rollover; the official `anthropics/claude-code-action@v1` (if you also add comment-triggered fixes) has built-in runaway-loop guardrails and runs ~50 PRs/month for ≈$5 of tokens.

## Limitations

- The orchestrator code is a **scaffold**; harden error handling, retries, and rollback before unattended runs.
- Auto-merge at scale meets the **Scaled Content Abuse** policy — keep the human manifest gate on new/large content permanently.
- Attribution is noisy (core updates, seasonality); use trailing windows, not single-week reactions.
- LLM-as-judge filters format, not truth — the 80% rule (human supplies operator truth) stays.
- Citation-tracker numbers are sampling estimates, directional only.
- Decide billing posture before sensors go live, or a forgotten cron becomes an overage on a non-rolling pool.

## Sources

Claude Agent SDK overview (install `@anthropic-ai/claude-agent-sdk` / `claude-agent-sdk`, `query()` autonomous loop, hooks, subagents, MCP, permissions, `settingSources`, API-key auth) — code.claude.com/docs, 2026. Headless `claude -p --output-format json --bare` and CI guardrails — hidekazu-konishi.com, 2026. Official `anthropics/claude-code-action@v1` cost/model routing — Groundy/OCDevel, 2026. June 15 2026 metered credit-pool split — Totalum + public billing analysis, 2026. SEO thresholds and sensor logic — prior kit research (GSC decay ≥20–25%, striking distance, March 2026 core update).
