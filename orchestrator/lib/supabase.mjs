// Memory-layer helpers (service-role; server/CI only — never ship this key to a browser).
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

export const db = createClient(url, key, { auth: { persistSession: false } });

export async function isPaused() {
  const { data } = await db.from("control").select("paused").eq("id", 1).single();
  return Boolean(data?.paused);
}

export async function monthSpend() {
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await db.from("control").select("month, spend_usd").eq("id", 1).single();
  if (data?.month !== month) {
    await db.from("control").update({ month, spend_usd: 0 }).eq("id", 1);
    return 0;
  }
  return Number(data?.spend_usd ?? 0);
}

export async function addSpend(usd) {
  const current = await monthSpend();
  const month = new Date().toISOString().slice(0, 7);
  await db.from("control").update({ month, spend_usd: current + Number(usd || 0) }).eq("id", 1);
}

export async function doNotTouch() {
  const { data } = await db.from("do_not_touch").select("url");
  return new Set((data ?? []).map((r) => r.url));
}

export async function enqueue(items) {
  if (!items?.length) return;
  // upsert ignores duplicates via the (url,task,status) unique constraint
  await db.from("work_queue").upsert(items, { onConflict: "url,task,status", ignoreDuplicates: true });
}

export async function pendingQueue(limit = 25) {
  const { data } = await db
    .from("work_queue").select("*")
    .eq("status", "pending").order("priority", { ascending: false }).limit(limit);
  return data ?? [];
}

export async function logDecision(row) {
  await db.from("decision_log").insert(row);
}

// ---- Phase 3: feedback loop helpers ----

export async function recordOutcomes(rows) {
  if (rows?.length) await db.from("outcomes").insert(rows);
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
  await db.from("change_set").insert(row);
}

export async function setPriority(id, priority) {
  await db.from("work_queue").update({ priority }).eq("id", id);
}
