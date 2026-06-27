// Memory-layer helpers — the persistence seam. Callers (scripts, orchestrator) reach
// every table through these named helpers; the raw client stays private in client.mjs.
import { db } from "./client.mjs";

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

export async function addSpend(usd) {
  // getMonthSpend returns 0 on a stale month and the explicit month write below
  // rolls the counter over, so no separate reset is needed on the write path.
  const current = await getMonthSpend();
  await db.from("control").update({ month: currentMonth(), spend_usd: current + Number(usd || 0) }).eq("id", 1);
}

export async function doNotTouch() {
  const { data } = await db.from("do_not_touch").select("url");
  return new Set((data ?? []).map((r) => r.url));
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

export async function enqueue(items) {
  if (!items?.length) return;
  items.forEach(validateQueueItem);
  // upsert ignores duplicates via the (url,task,status) unique constraint
  await db.from("work_queue").upsert(items, { onConflict: "url,task,status", ignoreDuplicates: true });
}

export async function pendingQueue(limit = 25) {
  const { data } = await db
    .from("work_queue").select("*")
    .eq("status", "pending").order("priority", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function setQueueStatus(url, task, to) {
  await db.from("work_queue").update({ status: to }).eq("url", url).eq("task", task);
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

export async function appliedDecisions(sinceDays = 120) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  const { data } = await db.from("decision_log")
    .select("url, change_type, created_at")
    .eq("action", "applied").not("change_type", "is", null).gte("created_at", since);
  return data ?? [];
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

export async function insertChangeset(row) {
  const { error } = await db.from("change_set").insert(row);
  if (error) throw new Error(`insertChangeset failed: ${error.message}`);
}

export async function setPriority(id, priority) {
  await db.from("work_queue").update({ priority }).eq("id", id);
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
