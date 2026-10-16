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

const { runRepo, runCms } = await import("../orchestrator/run.mjs");

// Builds injectable deps + a calls record. `messages` are yielded by the fake query() in
// order; `throwAfter` (an Error) is thrown once the loop drains them, simulating a crash or
// the SDK's shutdown signal. `openPRResult`/`openPRThrows` drive the repo delivery step.
function makeDeps({
  messages = [],
  throwAfter = null,
  openPRResult = { empty: false, prUrl: "https://x/pr/1" },
  openPRThrows = null,
} = {}) {
  const calls = { addSpend: [], exit: [], rollback: [], startBranch: 0, openPR: 0, queryArgs: [] };
  const deps = {
    query: (args) => {
      calls.queryArgs.push(args);
      return (async function* () {
        for (const m of messages) yield m;
        if (throwAfter) throw throwAfter;
      })();
    },
    addSpend: async (usd) => { calls.addSpend.push(usd); },
    startBranch: () => { calls.startBranch++; return "seo/auto-test"; },
    rollback: (b) => { calls.rollback.push(b); },
    openPR: () => { calls.openPR++; if (openPRThrows) throw openPRThrows; return openPRResult; },
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

// ---- A8: SDK spend/turn caps + dispatch allowlist ---------------------------
// The budget must bound the run WHILE it happens, not only gate the next one: preflight's
// headroom rides into the SDK as maxBudgetUsd (native mid-run stop), maxTurns backstops a
// crash-looping agent, and a cap-stop result is a failure (rollback), never a PR of
// half-processed work.

test("runRepo passes budget headroom to the SDK as maxBudgetUsd and always sets maxTurns", async () => {
  const { calls, deps } = makeDeps({ messages: [{ result: "ok" }] });
  await runRepo([], deps, 12.5);
  const opts = calls.queryArgs[0].options;
  assert.equal(opts.maxBudgetUsd, 12.5);
  assert.ok(Number.isFinite(opts.maxTurns) && opts.maxTurns > 0, "maxTurns must always bound the run");
});

test("runRepo omits maxBudgetUsd when no finite headroom is given (never sends Infinity)", async () => {
  const { calls, deps } = makeDeps({ messages: [{ result: "ok" }] });
  await runRepo([], deps);
  const opts = calls.queryArgs[0].options;
  assert.ok(!("maxBudgetUsd" in opts), "Infinity must not leak into the SDK options");
  assert.ok(Number.isFinite(opts.maxTurns) && opts.maxTurns > 0);
});

test("runRepo embeds the preflight-vetted rows in the prompt as a dispatch allowlist", async () => {
  const { calls, deps } = makeDeps({ messages: [{ result: "ok" }] });
  const queue = [{ id: 3, url: "https://x/a/", task: "metadata-generate", risk_class: "safe", reason: "internal" }];
  await runRepo(queue, deps);
  const prompt = calls.queryArgs[0].prompt;
  assert.match(prompt, /DISPATCH ALLOWLIST/);
  assert.match(prompt, /"id":3/);
  assert.match(prompt, /"url":"https:\/\/x\/a\/"/);
  assert.ok(!prompt.includes("internal"), "only vetted fields are embedded, not free-text columns");
  assert.match(prompt, /work_queue/i, "the base goal prompt is still present");
});

test("runRepo treats an SDK budget-cap stop as agent failure: rollback, exit 1, spend recorded", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ subtype: "error_max_budget_usd", total_cost_usd: 3.3 }],
  });
  await runRepo([], deps, 3.0);
  assert.deepEqual(calls.rollback, ["seo/auto-test"], "half-processed work must not become a PR");
  assert.deepEqual(calls.exit, [1]);
  assert.deepEqual(calls.addSpend, [3.3], "the capped run's spend still bills the budget");
  assert.equal(calls.openPR, 0);
});

test("runRepo treats an SDK turn-cap stop as agent failure too", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ subtype: "error_max_turns", total_cost_usd: 1.0 }],
  });
  await runRepo([], deps);
  assert.deepEqual(calls.rollback, ["seo/auto-test"]);
  assert.deepEqual(calls.exit, [1]);
  assert.deepEqual(calls.addSpend, [1.0]);
});

test("runCms passes the caps to the SDK and treats a budget-cap stop as failure", async () => {
  const { calls, deps } = makeDeps({
    messages: [{ subtype: "error_max_budget_usd", total_cost_usd: 2.2 }],
  });
  await runCms([], deps, 8.75);
  const opts = calls.queryArgs[0].options;
  assert.equal(opts.maxBudgetUsd, 8.75);
  assert.ok(Number.isFinite(opts.maxTurns) && opts.maxTurns > 0);
  assert.deepEqual(calls.exit, [1], "cap stop exits non-zero (change_set rows already written stay human-gated)");
  assert.deepEqual(calls.addSpend, [2.2]);
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
