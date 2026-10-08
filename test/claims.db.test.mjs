// test/claims.db.test.mjs — real-Supabase checks for the claim race and the live-row
// uniqueness invariant. Skipped unless RUN_DB_TESTS=1 (needs .env creds AND the
// claimed_at / live-row migration applied). Uses a unique URL prefix and cleans up.
//
// Run: RUN_DB_TESTS=1 node --env-file=.env --test test/claims.db.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const skip = process.env.RUN_DB_TESTS !== "1";
const PREFIX = `https://claims-test.invalid/${Date.now()}`;

async function setup() {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { claimQueueRow } = await import("../orchestrator/lib/claims.mjs");
  return { db, claimQueueRow };
}

test("a second claim of the same pending row fails", { skip }, async () => {
  const { db, claimQueueRow } = await setup();
  const { data } = await db.from("work_queue")
    .insert({ url: `${PREFIX}/a`, task: "faq-schema", status: "pending" }).select("id").single();
  try {
    assert.equal(await claimQueueRow(data.id), true);
    assert.equal(await claimQueueRow(data.id), false);
    const { data: after } = await db.from("work_queue").select("status,claimed_at").eq("id", data.id).single();
    assert.equal(after.status, "in_progress");
    assert.ok(after.claimed_at);
  } finally {
    await db.from("work_queue").delete().like("url", `${PREFIX}%`);
  }
});
