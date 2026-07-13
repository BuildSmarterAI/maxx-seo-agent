// Memory-layer helpers — the persistence seam. Callers (scripts, orchestrator) reach
// every table through these named helpers; the raw client stays private in client.mjs.
import { db } from "./client.mjs";
import { assertTaskType, KIT_TASKS } from "./tasks.mjs";
import { canonicalizeSet, isProtected } from "./url.mjs";

export async function isPaused() {
  const { data } = await db.from("control").select("paused").eq("id", 1).single();
  return Boolean(data?.paused);
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

// Read-only: spend recorded for the current month. Returns 0 if the stored month
// is stale (the reset is a separate, explicit call — see resetMonthIfNew).
export async function getMonthSpend() {
  const { data } = await db.from("control").select("month, spend_usd").eq("id", 1).single();
  if (data?.month !== currentMonth()) return 0;
  return Number(data?.spend_usd ?? 0);
}

// Write: if the stored month rolled over, zero the counter. Returns true if it reset.
export async function resetMonthIfNew() {
  const month = currentMonth();
  const { data } = await db.from("control").select("month").eq("id", 1).single();
  if (data?.month === month) return false;
  await db.from("control").update({ month, spend_usd: 0 }).eq("id", 1);
  return true;
}

// Atomic monthly spend increment via the increment_spend() Postgres function (defined in
// sql/schema.sql): it does the month-aware add in a single UPDATE, removing the
// read-modify-write lost-update race when a local `npm run orchestrate` overlaps the
// nightly CI run (which would silently undercount spend and overrun MONTHLY_BUDGET_USD).
// `client` is injectable for tests and defaults to the shared service-role client.
export async function addSpend(usd, client = db) {
  const amount = Number(usd || 0);
  const month = currentMonth();
  const { error } = await client.rpc("increment_spend", { p_amount: amount, p_month: month });
  if (!error) return;
  // Fallback for a database where increment_spend() isn't deployed yet (pre-migration):
  // the prior non-atomic read-modify-write, preserving exact legacy behavior. A stale
  // stored month reads as a zero base, so the new month's counter starts from this cost.
  const { data } = await client.from("control").select("month, spend_usd").eq("id", 1).single();
  const current = data?.month === month ? Number(data?.spend_usd ?? 0) : 0;
  const { error: writeError } = await client.from("control").update({ month, spend_usd: current + amount }).eq("id", 1);
  // Best-effort path — don't throw and abort an otherwise-fine run, but never swallow: an
  // unrecorded spend flies the budget gate blind, so surface it in the CI log.
  if (writeError) console.warn(`addSpend: fallback failed to record $${amount} — ${writeError.message}`);
}

// Returns a Set of CANONICAL do_not_touch forms (scheme/www/slash-agnostic — see url.mjs).
// Compare with isProtected(), never raw Set.has(): a stored `https://www.host.com/legal/`
// must match a candidate `https://host.com/legal` (Panel-A A1/A2).
// Fails CLOSED on a read error (cross-review 56-3): an empty set would silently disable
// every enforcement layer that consumes this (sensor ingest, enqueue chokepoint, dispatch
// re-check, cms apply gate) — throw and abort the run instead, like escalatedQueue.
export async function doNotTouch(client = db) {
  const { data, error } = await client.from("do_not_touch").select("url");
  if (error) throw new Error(`doNotTouch failed: ${error.message}`);
  return canonicalizeSet((data ?? []).map((r) => r.url));
}

// Fail fast on malformed rows with a domain error instead of letting them die
// silently at the Supabase (url,task,status) constraint layer.
function validateQueueItem(item) {
  if (!item || typeof item !== "object")
    throw new Error(`enqueue: queue item must be an object, got ${typeof item}`);
  for (const field of ["url", "task", "status"]) {
    if (typeof item[field] !== "string" || !item[field].trim())
      throw new Error(`enqueue: queue item missing/invalid "${field}": ${JSON.stringify(item)}`);
  }
}

// Chokepoint do_not_touch filter: the single waist every queue item flows through. Even if a
// caller's own ingest filter is missing or normalization-blind, a protected URL cannot be
// queued here. `protectedSet`/`client` are injectable (tests); by default the protected set is
// fetched fresh and canonicalized. Dropped rows are logged — never silently swallowed.
export async function enqueue(items, { protectedSet = null, client = db, dnt = doNotTouch } = {}) {
  if (!items?.length) return;
  items.forEach(validateQueueItem);
  const skip = protectedSet ?? (await dnt());
  const safe = items.filter((it) => !isProtected(skip, it.url));
  const dropped = items.length - safe.length;
  if (dropped) console.warn(`enqueue: dropped ${dropped} do_not_touch item(s) at the chokepoint`);
  if (!safe.length) return;
  // upsert ignores duplicates via the (url,task,status) unique constraint
  await client.from("work_queue").upsert(safe, { onConflict: "url,task,status", ignoreDuplicates: true });
}

export async function pendingQueue(limit = 25) {
  const { data } = await db
    .from("work_queue").select("*")
    .eq("status", "pending").order("priority", { ascending: false }).limit(limit);
  return data ?? [];
}

// True if a (url, task) work_queue row was created within `sinceDays` (ANY status). Read-only.
// Used by sensor-cwv to suppress re-enqueuing a recently-actioned URL while CrUX field p75
// (~28-day window) still lags behind an already-applied fix.
export async function hasRecentTask(url, task, sinceDays) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  const { data } = await db.from("work_queue").select("id")
    .eq("url", url).eq("task", task).gte("created_at", since).limit(1);
  return Boolean(data?.length);
}

export async function setQueueStatus(url, task, to) {
  await db.from("work_queue").update({ status: to }).eq("url", url).eq("task", task);
}

// Status update keyed on the queue row id (an integer the agent reads from `mem.mjs queue`).
// Preferred over setQueueStatus on the autonomous path so the attacker-influenced URL is
// never placed on a shell command line.
// Throws on error (verify round 2): a silently swallowed failure — e.g. the
// work_queue unique(url,task,status) constraint when a same-status twin exists — let
// callers believe a status change landed when the row never moved.
export async function setQueueStatusById(id, to, client = db) {
  const { error } = await client.from("work_queue").update({ status: to }).eq("id", Number(id));
  if (error) throw new Error(`setQueueStatusById failed: ${error.message}`);
}

// Escalated items not yet mirrored to Linear. The linear_issue_id pointer stays
// null until push-escalations records the created issue, which makes the mirror
// idempotent across runs.
export async function escalatedQueue(limit = 50) {
  const { data, error } = await db
    .from("work_queue").select("*")
    .eq("status", "escalated").is("linear_issue_id", null)
    .order("priority", { ascending: false }).limit(limit);
  // Surface the error instead of returning [] — a missing linear_issue_id column
  // (migration not run) must fail loudly, not silently mirror nothing.
  if (error) throw new Error(`escalatedQueue failed: ${error.message}`);
  return data ?? [];
}

export async function setLinearIssueId(id, linearIssueId) {
  await db.from("work_queue").update({ linear_issue_id: linearIssueId }).eq("id", id);
}

// The inverse of escalatedQueue: terminal-status rows (done = resolved, cancelled = withdrawn)
// that were mirrored to Linear (linear_issue_id set) but whose ticket isn't closed yet
// (linear_closed_at null). close-escalations.mjs closes each in Linear and stamps markClosed,
// so a stale escalation ticket doesn't outlive the queue row that spawned it.
export async function closableQueue(limit = 50) {
  const { data, error } = await db
    .from("work_queue").select("*")
    .in("status", ["done", "cancelled"])
    .not("linear_issue_id", "is", null)
    .is("linear_closed_at", null)
    .order("priority", { ascending: false }).limit(limit);
  // Fail loud like escalatedQueue: a missing linear_closed_at column (migration not run) must
  // surface, not silently close nothing.
  if (error) throw new Error(`closableQueue failed: ${error.message}`);
  return data ?? [];
}

export async function markClosed(id) {
  // Throw on error like closableQueue/setQueueStatusById (house "fail loud" rule): a swallowed
  // stamp failure would leave linear_closed_at null, re-selecting and re-closing the row every
  // run while the DB error never surfaces. closeEscalations catches this as a per-row failure.
  const { error } = await db.from("work_queue").update({ linear_closed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`markClosed failed: ${error.message}`);
}

export async function logDecision(row) {
  await db.from("decision_log").insert(row);
}

// ---- Phase 3: feedback loop helpers ----

export async function recordOutcomes(rows) {
  if (rows?.length) await db.from("outcomes").insert(rows);
}

// URLs with recent click activity, most-trafficked first, deduplicated.
export async function activeUrls(limit, sinceDays = 28) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  const { data } = await db.from("outcomes")
    .select("url").eq("metric", "clicks").gte("captured_at", since)
    .order("value", { ascending: false }).limit(limit);
  return [...new Set((data ?? []).map((r) => r.url))];
}

// Pure, exported for direct testing — orphan-leak backstop (A11): logDecision has no
// assertTaskType gate at write time (unlike insertChangeset), so a stray non-task
// change_type (a CMS field name, a legacy generic label) can land in decision_log. This
// keeps every appliedDecisions() consumer (the learning loop, eval-set mining) clean
// without trusting the writer, mirroring the precedent already established in
// scripts/attribute-citations.mjs's own KIT_TASKS filter for the GEO learning path.
export function filterKitTaskDecisions(rows) {
  return rows.filter((r) => KIT_TASKS.has(r.change_type));
}

export async function appliedDecisions(sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  const { data } = await db.from("decision_log")
    .select("url, change_type, created_at")
    .eq("action", "applied").not("change_type", "is", null).gte("created_at", since);
  return filterKitTaskDecisions(data ?? []);
}

async function metricAround(url, metric, isoDate, lagDays) {
  const after = new Date(new Date(isoDate).getTime() + lagDays * 864e5).toISOString();
  const before = await db.from("outcomes").select("value")
    .eq("url", url).eq("metric", metric).lte("captured_at", isoDate)
    .order("captured_at", { ascending: false }).limit(1).maybeSingle();
  const post = await db.from("outcomes").select("value")
    .eq("url", url).eq("metric", metric).gte("captured_at", after)
    .order("captured_at", { ascending: true }).limit(1).maybeSingle();
  return { before: before.data?.value ?? null, after: post.data?.value ?? null };
}

// latest clicks snapshot at/just-before a date, and earliest at/after date+lagDays
export async function clicksAround(url, isoDate, lagDays = 28) {
  return metricAround(url, "clicks", isoDate, lagDays);
}

// latest position snapshot at/just-before a date, and earliest at/after date+lagDays
export async function positionAround(url, isoDate, lagDays = 28) {
  return metricAround(url, "position", isoDate, lagDays);
}

// latest impressions snapshot at/just-before a date, and earliest at/after date+lagDays
export async function impressionsAround(url, isoDate, lagDays = 28) {
  return metricAround(url, "impressions", isoDate, lagDays);
}

export async function upsertPattern(change_type, avg_effect, n) {
  await db.from("learned_patterns")
    .upsert({ change_type, avg_effect, n, updated_at: new Date().toISOString() },
            { onConflict: "change_type" });
}

export async function learnedPatterns() {
  const { data } = await db.from("learned_patterns").select("change_type, avg_effect");
  return new Map((data ?? []).map((r) => [r.change_type, Number(r.avg_effect)]));
}

// GEO learned patterns (citation-delta per change_type, #40). Keeps `n` — the priority
// blend shrinks each type's bonus by its sample size — so this returns a richer value
// than learnedPatterns(). Empty until attribute-citations.mjs has run.
export async function learnedPatternsGeo() {
  const { data } = await db.from("learned_patterns_geo").select("change_type, avg_effect, n");
  return new Map((data ?? []).map((r) => [r.change_type, { avg_effect: Number(r.avg_effect), n: Number(r.n) }]));
}

// Conversion learned patterns (organic-conversion delta per change_type, PR 1C). Same
// richer {avg_effect, n} shape as learnedPatternsGeo — the priority blend shrinks each
// type's bonus by its sample size. Empty until attribute-conversions.mjs has run.
export async function learnedPatternsConv() {
  const { data } = await db.from("learned_patterns_conv").select("change_type, avg_effect, n");
  return new Map((data ?? []).map((r) => [r.change_type, { avg_effect: Number(r.avg_effect), n: Number(r.n) }]));
}

export async function insertChangeset(row) {
  // Write-boundary guard: keep a non-task change_type (a CMS field name, or a generic label
  // like "metadata") out of change_set so it never reaches decision_log as an orphan the
  // learning loop can't join. Throws before any db write.
  assertTaskType(row.change_type);
  const { error } = await db.from("change_set").insert(row);
  if (error) throw new Error(`insertChangeset failed: ${error.message}`);
}

export async function setPriority(id, priority) {
  await db.from("work_queue").update({ priority }).eq("id", id);
}

// ---- AutoResearch Phase A: experiment + eval registry (write paths) ----
// The optimizer loops that consume these come later (need accrued provenance data);
// these are the write paths so the tables don't sit dead. Throw loudly on error, like
// insertChangeset/escalatedQueue — a missing table (migration not run) must fail, not
// silently no-op.

export async function recordExperiment(row) {
  const { error } = await db.from("experiments").insert(row);
  if (error) throw new Error(`recordExperiment failed: ${error.message}`);
}

export async function updateExperimentValue(id, value, n) {
  const { error } = await db.from("experiments")
    .update({ value, n, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`updateExperimentValue failed: ${error.message}`);
}

export async function insertEvalExample(row) {
  const { error } = await db.from("eval_set").insert(row);
  if (error) throw new Error(`insertEvalExample failed: ${error.message}`);
}

export async function evalSet(change_type) {
  const q = db.from("eval_set").select("*");
  const { data, error } = change_type ? await q.eq("change_type", change_type) : await q;
  if (error) throw new Error(`evalSet failed: ${error.message}`);
  return data ?? [];
}

export async function recordJudgeCalibration(row) {
  const { error } = await db.from("judge_calibration").insert(row);
  if (error) throw new Error(`recordJudgeCalibration failed: ${error.message}`);
}

// ---- sitemap diff state ----

export async function sitemapSeen() {
  const { data } = await db.from("sitemap_seen").select("url");
  return new Set((data ?? []).map((r) => r.url));
}

export async function markSitemapSeen(urls) {
  if (!urls?.length) return;
  await db.from("sitemap_seen")
    .upsert(urls.map((url) => ({ url })), { onConflict: "url", ignoreDuplicates: true });
}
