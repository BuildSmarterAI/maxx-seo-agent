# Making the SEO System Fully Agentic — Research & Roadmap

Version 1.0 · 2026-06-24 · companion to the BuildSmarter multi-platform SEO kit

## What this is

The kit today is **agent-assisted**: you invoke a skill (`/seo-audit`), review the output, approve, and apply. The agent executes one bounded task per command; you are the planner, the trigger, and the approver. "Fully agentic" means the system **perceives** state, **decides** what to do, **acts**, and **learns** from outcomes in a closed loop — with you supervising exceptions instead of driving every step. This document defines an autonomy ladder, the target architecture, what is safe to automate versus gate, a phased path from the current kit, and the cost/risk realities as of mid-2026.

## The autonomy ladder (SEO-specific)

| Level | Name | Who plans | Who triggers | Who approves | State today |
|---|---|---|---|---|---|
| L0 | Manual | Human | Human | Human | — |
| **L1** | **Assisted (kit today)** | Human | Human (slash command) | Human, per task | **You are here** |
| L2 | Orchestrated | Orchestrator plans + dispatches subagents in parallel; opens one PR | Human (one run) | Human, one merge gate | Phase 1 |
| L3 | Triggered | Orchestrator | Sensors (cron, GSC alert, deploy, citation drop) | Human-on-the-loop, reviews a queue | Phase 2 |
| L4 | Closed-loop | Orchestrator reprioritizes its own backlog from outcomes; self-heals | Sensors + self | Human reviews exceptions; safe classes auto-merge | Phase 3 |

Realistic target is **L4 for low-risk action classes with permanent human gates on risky ones** — not an L5 "no human anywhere" system. The Scaled Content Abuse policy, YMYL exposure, and brand risk make full hands-off publishing the wrong goal, not just an unreachable one.

## The gap: three missing pieces

Linear command-driven workflows lack **Memory, Context, and Guardrails** — the same three things every 2026 orchestration write-up names as the bottleneck. The shift is from a linear flowchart (you run skills in order) to an **intent graph**: you declare the goal and the guardrails, and a planner dispatches a swarm of specialized subagents that work in parallel and self-heal when one hits an error. The kit has the *actions* (skills) but not the *loop* (sense → plan → act → verify → learn) or the *persistent state* that makes the loop safe.

## Target architecture (four layers)

This mirrors production agentic systems (telemetry-driven diagnosis + closed-loop remediation + multi-agent decomposition + MCP tool use) with **progressive autonomy and bounded authority at every stage**.

### 1. Sensing layer (triggers)
Events that wake the system instead of you doing it:
- **Scheduled:** nightly/weekly cron (headless run).
- **GSC API poll:** clicks/impressions/position deltas, coverage errors, new striking-distance queries.
- **AI-citation trackers** (Profound, Peec AI, Otterly, Athena HQ): citation share drops in ChatGPT/Perplexity/AI Overviews. This matters because AI-referred visitors convert far higher than organic (one agency reports 14.2% vs 2.8%), so a citation drop is a revenue signal, not a vanity one.
- **Deploy webhooks** (Vercel/host): re-audit changed routes after each deploy.
- **Sitemap/crawl diffs:** new, removed, or changed URLs.
- **CWV/CrUX regressions** and **broken-link scans.**

Each sensor emits an event to a queue. No event, no spend.

### 2. Orchestration layer (planner + dispatcher)
A master agent runs headless (`claude -p --output-format json`, or the Agent SDK `query()` loop which handles the tool loop autonomously). It reads current state + the triggering event, plans against the goal, and dispatches **subagents in parallel** via the Task tool — each gets its own context window (audit, metadata, schema, internal-link, CWV, content-refresh). A `TaskRunner`-style multi-turn loop validates each iteration with tests/validators and feeds failures back as the next prompt, with **git checkpoint/rollback** so a broken iteration self-recovers.

### 3. Memory layer (Supabase)
Persistent state is what separates an agent from a chatbot. Tables:
- **decision_log** — what changed, when, why, which agent, which PR.
- **work_queue** — pending actions with priority and risk class.
- **do_not_touch** — URLs humans manage by hand; the agent never edits these.
- **outcomes** — ranking/citation/conversion history per URL for attribution.
- **learned_patterns** — which change types actually moved metrics (feeds reprioritization).

This is also where your operator-data moat lives as ground truth the content agents draw from.

### 4. Guardrail layer (deterministic + evaluative)
- **Hooks** (`.claude/settings.json`, honored in headless mode too): `PreToolUse` blocks a publish/commit that lacks a reviewed manifest or fails validation (**exit code 2 denies the tool call**); `PostToolUse` runs the schema validator, CWV check, and uniqueness check, and writes an audit line.
- **Eval gates / LLM-as-judge:** a separate cheap-model pass scores quality, brand voice, fact-checkability, and information gain before anything merges. This is a gate, not a rubber stamp.
- **CI validators:** Lighthouse CI + PSI thresholds, Schema Markup Validator, doorway/uniqueness guardrails — the spec-driven verification pattern: a verifier checks compliance *before* merge.
- **Permission scoping:** `--allowedTools` set to the minimum each subagent needs.
- **Cost governor + kill switch:** token budget, model routing, and a hard stop (covered below).

### The closed loop and self-healing
Spanning all four layers: **actions → outcomes (GSC/citations/conversions) → attribution → reprioritize the backlog.** When a sensor detects a regression, the planner diagnoses, dispatches a fix subagent, validates, and opens a PR — rather than crashing or waiting for you. That is the difference between L3 and L4.

### PR-based autonomy
Agents open **pull requests, not direct commits.** Auto-merge is allowed **only** within bounded authority — a safe action class that passed every eval and falls under change-size thresholds. Everything else waits for a human merge. You step in at PR time, which is the human-on-the-loop contract.

## Autonomy matrix — automate vs. gate

| Action class | Fully auto (within thresholds) | Always human-gated |
|---|---|---|
| Metadata (title/description) generation + fixes | ✅ | — |
| Schema generation, validation, repair | ✅ | — |
| Internal-link insertion (descriptive anchors) | ✅ | — |
| Broken-link fixes, image alt text, sitemap/robots hygiene | ✅ | — |
| CWV template-level fixes | ✅ (with regression test) | — |
| Decayed-post refresh (stat/data/freshness updates) | ✅ under size + uniqueness thresholds | Large structural rewrites |
| Net-new programmatic page batches | Below N pages, manifest auto-built | ❗ Above N → human manifest review |
| Merges / deletes / 301s | Pages with no backlinks + zero traffic | ❗ Anything with backlinks/authority |
| Brand/positioning, pricing, claims | — | ❗ Always |
| YMYL (legal/financial/health/safety) | — | ❗ Always |
| GBP / NAP changes | — | ❗ Always |
| Anything on `do_not_touch` | — | ❗ Always |

The guardrail thresholds (N, change-size, uniqueness ratio, backlink count) live in `core/CLAUDE.md` so they are versioned and auditable.

## Phased path from the current kit

**Phase 1 — reach L2 (mostly local, low metered cost).**
Wrap the existing skills in a Node orchestrator (`TaskRunner`) that plans, dispatches subagents in parallel, runs the validators, and opens a single PR. Add `PreToolUse`/`PostToolUse` hooks for deterministic guardrails. Stand up the Supabase `decision_log` + `do_not_touch`. One approval gate replaces dozens.

**Phase 2 — reach L3.**
Add sensors as scheduled GitHub Actions / headless cron: nightly GSC poll, sitemap diff, citation tracker. Auto-open PRs for the safe classes; escalate exceptions to a review queue. Add the eval gates (LLM-as-judge + CI validators) and the cost governor with model routing.

**Phase 3 — reach L4 (partial).**
Close the loop: outcome attribution in Supabase, backlog reprioritization, self-healing on regressions, and bounded auto-merge for the safe classes. Promote AI-citation tracking to a first-class sensor.

**Phase 4 — operate.**
Observability dashboard over the audit log, a human review cadence for the queue, monthly guardrail/threshold tuning, and periodic kill-switch drills.

## Cost reality (as of June 15, 2026)

Headless usage — `claude -p`, the Agent SDK, and Claude Code GitHub Actions — now draws from a **separate monthly credit pool that does not roll over**, billed at standard API rates on overage; hooks, subagents, and slash commands invoked programmatically count too. A CI-driven SEO loop can be **50–90% of that pool**, so an ungoverned autonomous loop is a real financial exposure. Mitigations, all built into the cost governor:
- **Route by difficulty:** audits, triage, refreshes, and subagent scouts on **Haiku 4.5 / Sonnet 4.6**; reserve **Opus 4.8** for planning and complex multi-file reasoning.
- **Gate sensor frequency:** nightly, not hourly; only re-audit changed routes on deploy.
- **Consider a direct API key** for the headless fleet to separate billing and get a rollover credit pool.
- **Hard budget cap + kill switch** in the orchestrator; the official GitHub Action also has built-in runaway-loop guardrails and write-access gating.

For a single portfolio site running nightly, the metered cost is modest (the official Action runs ~50 PRs/month for roughly $5 of tokens); the risk scales with site count and sensor frequency, which is why routing and caps come in Phase 2, before sensors go live.

## Limitations & risks

- **Scaled Content Abuse (SpamBrain) is actively enforced.** Autonomous publishing at scale is the highest-risk path; the human manifest gate on large/new content batches is non-negotiable and stays permanently.
- **Attribution is noisy.** Core updates, seasonality, and SERP volatility confound the outcome loop. Reprioritization needs guardbands and trailing windows, not knee-jerk reactions to a single week.
- **LLM-as-judge is a filter, not E-E-A-T.** The 80% rule persists: the system structures and drafts; a named human supplies operator truth and verifies claims. Evals catch format and obvious errors, not whether a claim is *true*.
- **Citation trackers are sampling estimates,** not ground truth; treat them as directional.
- **Self-healing can mask root causes.** Log every action and outcome so a silent auto-fix is still auditable.
- **Don't architect around debunked hacks.** Google's mid-2026 guidance holds that AI search needs no special files or schema beyond standard SEO; build the loop on structure, depth, real data, and valid schema — not llms.txt or content chunking.
- **Billing posture must be decided before sensors go live**, or the non-rolling credit pool turns a forgotten cron into an overage.

## Sources

Agentic patterns: Gleecus (agent loop / Thought-Action-Observation, 2026); A. Kalm / Medium (memory-context-guardrails, intent graphs, self-healing, 2026); arXiv 2606.09122 (four-layer autonomous remediation, progressive autonomy + bounded authority, 2026); Augment Code (human-on-the-loop, spec-driven verification, autonomous PR lifecycle, 2026); Vellum (LLM-as-judge, guardrails, refinement, 2025); Bayleaf Digital (agentic SEO definition / dual audience, 2026).
Claude Code runtime: code.claude.com Agent SDK docs (query loop, hooks, subagents, 2026); hidekazu-konishi.com (headless `claude -p`, `--bare`, settings/hooks reuse, CI guardrails, 2026); SitePoint (Node orchestrator / TaskRunner / checkpoint-rollback pattern, 2026); Groundy + OCDevel (official `anthropics/claude-code-action@v1`, cost, model routing, gating, 2026); Totalum + public billing analysis (June 15 2026 Agent SDK credit pool, model routing guidance, 2026).
SEO/AI-search facts: prior kit research (March 2026 core update — information gain / E-E-A-T; AirOps 15% citation rate; Growth Memo 44.2% first-30% citations; DerivateX 14.2% vs 2.8% conversion; Google mid-2026 "AEO is still SEO" guidance).
