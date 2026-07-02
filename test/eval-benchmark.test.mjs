// test/eval-benchmark.test.mjs — the RO-1 metric engine: aggregate score, classify,
// confusion (false_pass/false_block), AUC separation, and an end-to-end runBenchmark with
// an injected fake judge (no model call, no DB). Dummy Supabase env for the client import.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ||= "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "dummy_service_role_key_000000";

const { aggregateScore, classify, confusion, auc, variantId, runBenchmark } =
  await import("../scripts/eval-benchmark.mjs");

test("aggregateScore averages the four sub-scores; missing → 0", () => {
  assert.equal(aggregateScore({ scores: { quality: 4, brand_safety: 4, fact_checkability: 4, information_gain: 4 } }), 4);
  assert.equal(aggregateScore({}), 0);
  assert.equal(aggregateScore(null), 0);
});

test("classify: pass → good, anything else → bad", () => {
  assert.equal(classify({ pass: true }), "good");
  assert.equal(classify({ pass: false }), "bad");
  assert.equal(classify({}), "bad");        // fail-closed
});

test("confusion counts false_pass (bad→good) and false_block (good→bad)", () => {
  const c = confusion([
    { actual: "good", predicted: "good" },  // correct
    { actual: "bad",  predicted: "good" },  // false_pass (dangerous)
    { actual: "good", predicted: "bad"  },  // false_block
    { actual: "bad",  predicted: "bad"  },  // correct
  ]);
  assert.equal(c.n, 4);
  assert.equal(c.false_pass, 1);
  assert.equal(c.false_block, 1);
  assert.equal(c.accuracy, 0.5);
});

test("auc: perfect, reversed, tied, and degenerate separation", () => {
  assert.equal(auc([{ score: 5, label: "good" }, { score: 1, label: "bad" }]), 1);
  assert.equal(auc([{ score: 1, label: "good" }, { score: 5, label: "bad" }]), 0);
  assert.equal(auc([{ score: 3, label: "good" }, { score: 3, label: "bad" }]), 0.5);
  assert.equal(auc([{ score: 5, label: "good" }]), null, "one class → null");
});

test("variantId encodes model and threshold", () => {
  assert.equal(variantId({ model: "claude-haiku-4-5-20251001", minScore: 3 }), "claude-haiku-4-5-20251001@min3");
});

test("runBenchmark with a perfect injected judge scores 0 false_pass, auc 1", async () => {
  const examples = [
    { artifact: "good one", label: "good" },
    { artifact: "bad one",  label: "bad"  },
  ];
  // fake judge: passes 'good' artifacts with high scores, fails 'bad' with low scores
  const judge = async (text) => text.startsWith("good")
    ? { pass: true,  scores: { quality: 5, brand_safety: 5, fact_checkability: 5, information_gain: 5 } }
    : { pass: false, scores: { quality: 1, brand_safety: 1, fact_checkability: 1, information_gain: 1 } };

  const r = await runBenchmark({ model: "m", minScore: 3 }, { judge, examples });
  assert.equal(r.false_pass, 0);
  assert.equal(r.false_block, 0);
  assert.equal(r.accuracy, 1);
  assert.equal(r.auc, 1);
  assert.equal(r.n, 2);
  assert.equal(r.judge_variant, "m@min3");
});

test("runBenchmark flags a false_pass when the judge misses bad content", async () => {
  const examples = [{ artifact: "bad one", label: "bad" }];
  const blindJudge = async () => ({ pass: true, scores: { quality: 5, brand_safety: 5, fact_checkability: 5, information_gain: 5 } });
  const r = await runBenchmark({ model: "m", minScore: 3 }, { judge: blindJudge, examples });
  assert.equal(r.false_pass, 1);
});
