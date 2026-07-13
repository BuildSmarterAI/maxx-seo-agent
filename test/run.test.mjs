// test/run.test.mjs — covers the orchestrator's spend-accounting control flow (run.mjs
// runRepo/runCms). The invariant under test: tokens billed during a run are recorded via
// addSpend on EVERY terminal path — success, SDK shutdown, AND a crash — so a failing or
// crash-looping run can't spend past MONTHLY_BUDGET_USD unseen (audit finding A5).
//
// runRepo/runCms take injected deps (query/addSpend/git/exit), so the flow runs with no
// SDK call, no git, and no network — the same optional-injection pattern as preflight.mjs
// and git-delivery.mjs. main() is import-guarded, so importing run.mjs here does not run it.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

// supabase.mjs -> client.mjs throws at import without these; run.mjs imports it at module
// load even though we inject deps. Set before importing so the load-time check passes.
process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { runRepo, runCms, zeroSpendWarning } = await import("../orchestrator/run.mjs");

// Builds injectable deps + a calls record. `messages` are yielded by the fake query() in
// order; `throwAfter` (an Error) is thrown once the loop drains them, simulating a crash or
// the SDK's shutdown signal. `openPRResult`/`openPRThrows` drive the repo delivery step.
function makeDeps({
  messages = [],
  throwAfter = null,
  openPRResult = { empty: false, prUrl: "https://x/pr/1" },
  openPRThrows = null,
} = {}) {
  const calls = { addSpend: [], exit: [], rollback: [], startBranch: 0, openPR: 0, warn: [] };
  const deps = {
    query: () => (async function* () {
      for (const m of messages) yield m;
      if (throwAfter) throw throwAfter;
    })(),
    addSpend: async (usd) => { calls.addSpend.push(usd); },
    startBranch: () => { calls.startBranch++; return "seo/auto-test"; },
    rollback: (b) => { calls.rollback.push(b); },
    openPR: () => { calls.openPR++; if (openPRThrows) throw openPRThrows; return openPRResult; },
    warn: (m) => { calls.warn.push(m); },
    exit: (code) => { calls.exit.push(code); },
  };
  return { calls, deps };
}

// ---- runRepo --------------------------------------------------------------

// A5: the crash path must still bill the budget.
test("runRepo records spend via addSpend even when the agent loop throws (A5)", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ total_cost_usd: 1.23 }],
    throwAfter: new Error("agent boom"),
  });
  await runRepo([], deps);
  assert.deepEqual(calls.addSpend, [1.23], "spent cost must be recorded on the failure path");
  assert.deepEqual(calls.rollback, ["seo/auto-test"], "branch rolled back on agent failure");
  assert.deepEqual(calls.exit, [1], "exits non-zero after recording spend");
  assert.equal(calls.openPR, 0, "no delivery attempted on agent failure");
});

test("runRepo records spend once and opens a PR on success", async () => {
  const { calls, deps } = makeDeps({ messages: [{ total_cost_usd: 0.5 }, { result: "done" }] });
  await runRepo([], deps);
  assert.deepEqual(calls.addSpend, [0.5]);
  assert.equal(calls.openPR, 1);
  assert.deepEqual(calls.exit, []);       // clean success — no exit()
  assert.deepEqual(calls.rollback, []);
});

test("runRepo records spend exactly once even when delivery then fails", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ total_cost_usd: 0.7 }],
    openPRThrows: new Error("push rejected"),
  });
  await runRepo([], deps);
  assert.deepEqual(calls.addSpend, [0.7], "recorded once, not twice");
  assert.deepEqual(calls.exit, [1], "delivery failure exits non-zero");
});

// ---- runCms ---------------------------------------------------------------

// A5: a real CMS failure must still bill the budget.
test("runCms records spend even on a real (non-shutdown) failure (A5)", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ total_cost_usd: 2.0 }],
    throwAfter: new Error("real cms failure"),
  });
  await runCms([], deps);
  assert.deepEqual(calls.addSpend, [2.0], "spent cost must be recorded on the failure path");
  assert.deepEqual(calls.exit, [1], "exits non-zero after recording spend");
});

test("runCms records spend on the SDK exit-code-1 shutdown and completes normally", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ total_cost_usd: 1.1 }],
    throwAfter: new Error("Claude Code process exited with code 1"),
  });
  await runCms([], deps);
  assert.deepEqual(calls.addSpend, [1.1]);
  assert.deepEqual(calls.exit, []);       // shutdown is not a failure
});

test("runCms records spend and completes on normal success", async () => {
  const { calls, deps } = makeDeps({ messages: [{ total_cost_usd: 0.9 }, { result: "ok" }] });
  await runCms([], deps);
  assert.deepEqual(calls.addSpend, [0.9]);
  assert.deepEqual(calls.exit, []);
});

// ---- $0 / missing-cost accounting (the spend_usd = 0 blind-spot) -----------
// Root cause (verified against @anthropic-ai/claude-agent-sdk 0.1.77): total_cost_usd rides
// only on the terminal `result` message, so a run that ends without one — an early crash, the
// process-exit shutdown before it, or non-metered subscription/OAuth auth — leaves costUsd = 0.
// The OLD code recorded nothing SILENTLY there, so MONTHLY_BUDGET_USD never saw the run. These
// cases lock in the fix: keep the honest $0 (never fabricate a cost) but warn loudly and name
// the auth source. The prior suite couldn't catch this — its fakes always emit a cost message.

test("runRepo warns (does not record) when the run yields no cost message", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ type: "system", subtype: "init", apiKeySource: "project" }, { result: "done" }],
  });
  await runRepo([], deps);
  assert.deepEqual(calls.addSpend, [], "no cost captured → nothing recorded (never fabricate)");
  assert.equal(calls.warn.length, 1, "the blind $0 run must be surfaced, not silent");
  assert.match(calls.warn[0], /\$0 recorded/, "warning flags the $0 gate blind-spot");
  assert.match(calls.warn[0], /apiKeySource=project/, "warning surfaces the captured auth source");
});

test("runRepo $0 warning falls back to apiKeySource=unknown without an init message", async () => {
  const { calls, deps } = makeDeps({ messages: [{ result: "done" }] });
  await runRepo([], deps);
  assert.deepEqual(calls.addSpend, []);
  assert.equal(calls.warn[0], zeroSpendWarning(undefined));
});

test("runRepo stays quiet when a cost was recorded", async () => {
  const { calls, deps } = makeDeps({ messages: [{ total_cost_usd: 0.5 }, { result: "done" }] });
  await runRepo([], deps);
  assert.deepEqual(calls.addSpend, [0.5]);
  assert.deepEqual(calls.warn, [], "a normally-billed run must not warn");
});

test("runCms warns (does not record) even on the SDK shutdown when no cost arrived", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ type: "system", subtype: "init", apiKeySource: "user" }],
    throwAfter: new Error("Claude Code process exited with code 1"),
  });
  await runCms([], deps);
  assert.deepEqual(calls.addSpend, [], "no cost captured → nothing recorded");
  assert.equal(calls.warn.length, 1);
  assert.match(calls.warn[0], /apiKeySource=user/);
  assert.deepEqual(calls.exit, [], "the SDK shutdown is still not a failure");
});
