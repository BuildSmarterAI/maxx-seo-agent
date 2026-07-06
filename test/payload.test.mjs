// test/payload.test.mjs — covers orchestrator/lib/payload.mjs, the pure validation seam
// that lets mem.mjs read changeset/log payloads from a JSON FILE instead of shell flags.
// The headline tests (RCE regression + file-channel round-trip) prove that shell
// metacharacters in base_value/new_value travel as inert data and never reach a shell.
//
// payload.mjs imports only ./tasks.mjs (no env, no db) → no env shim needed.
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const { parseChangesetPayload, parseLogPayload } = await import("../orchestrator/lib/payload.mjs");

const SCRATCH = process.env.TEMP || process.env.TMPDIR || ".";

const baseChangeset = (over = {}) => ({
  platform: "wordpress", page_id: "123", url: "https://www.maxxbuilders.com/x/",
  field: "title", new_value: "New SEO Title", change_type: "metadata-generate", ...over,
});

test("parseChangesetPayload returns the exact insertChangeset row shape", () => {
  const row = parseChangesetPayload(baseChangeset({ base_value: "Old Title", risk_class: "safe" }));
  assert.deepEqual(row, {
    platform: "wordpress", page_id: "123", url: "https://www.maxxbuilders.com/x/",
    field: "title", base_value: "Old Title", new_value: "New SEO Title",
    change_type: "metadata-generate", risk_class: "safe", status: "pending",
  });
});

test("parseChangesetPayload applies assertTaskType (orphan-leak guard)", () => {
  assert.throws(() => parseChangesetPayload(baseChangeset({ change_type: "metadata" })), /invalid change_type/);
  assert.throws(() => parseChangesetPayload(baseChangeset({ change_type: "$(evil)" })), /invalid change_type/);
  // null is allowed (an unattributed change), and a real kit task passes
  assert.equal(parseChangesetPayload(baseChangeset({ change_type: null })).change_type, null);
  assert.equal(parseChangesetPayload(baseChangeset({ change_type: "schema-generate" })).change_type, "schema-generate");
});

test("parseChangesetPayload rejects an unsupported field", () => {
  assert.throws(() => parseChangesetPayload(baseChangeset({ field: "yoast_meta" })), /unsupported field/);
});

test("parseChangesetPayload requires url and new_value", () => {
  assert.throws(() => parseChangesetPayload(baseChangeset({ url: "" })), /missing\/invalid "url"/);
  assert.throws(() => parseChangesetPayload(baseChangeset({ new_value: "  " })), /missing\/invalid "new_value"/);
  assert.throws(() => parseChangesetPayload("not an object"), /must be a JSON object/);
});

test("parseChangesetPayload defaults page_id/base_value to null and platform from env", () => {
  const row = parseChangesetPayload({ url: "https://x/", field: "canonical", new_value: "https://x/", change_type: null });
  assert.equal(row.page_id, null);
  assert.equal(row.base_value, null);
  assert.equal(row.status, "pending");
});

test("parseChangesetPayload carries a valid risk_class through", () => {
  const row = parseChangesetPayload(baseChangeset({ risk_class: "gated" }));
  assert.equal(row.risk_class, "gated");
});

test("parseChangesetPayload defaults risk_class to gated (fail-closed) when absent", () => {
  const row = parseChangesetPayload(baseChangeset());
  assert.equal(row.risk_class, "gated");
});

test("parseChangesetPayload rejects an invalid risk_class", () => {
  assert.throws(
    () => parseChangesetPayload(baseChangeset({ risk_class: "yolo" })),
    /invalid risk_class "yolo"/,
  );
});

test("parseLogPayload returns the logDecision row shape with defaults", () => {
  const row = parseLogPayload({ url: "https://x/", action: "applied", change_type: "blog-write", reason: "did a thing" });
  assert.deepEqual(row, {
    url: "https://x/", action: "applied", risk_class: "safe", reason: "did a thing",
    agent: "orchestrator", pr_url: null, change_type: "blog-write",
  });
});

test("parseLogPayload requires action and guards change_type", () => {
  assert.throws(() => parseLogPayload({ url: "https://x/" }), /missing\/invalid "action"/);
  assert.throws(() => parseLogPayload({ action: "applied", change_type: "metadata" }), /invalid change_type/);
});

// ---- The headline: shell metacharacters are inert data, never executed/escaped ----
const MALICIOUS = ['"; touch PWNED; "', "$(rm -rf /)", "`id`", 'a";cat /etc/passwd #', "x'; DROP TABLE change_set;--"];

test("RCE regression: malicious base_value/new_value pass through byte-identical", () => {
  for (const evil of MALICIOUS) {
    const row = parseChangesetPayload(baseChangeset({ field: "post_content", base_value: evil, new_value: evil, change_type: "restructure-for-citation" }));
    assert.equal(row.base_value, evil, `base_value must be verbatim for ${JSON.stringify(evil)}`);
    assert.equal(row.new_value, evil, `new_value must be verbatim for ${JSON.stringify(evil)}`);
  }
});

test("file-channel round-trip: a JSON payload file carries metacharacters as inert data", () => {
  const path = join(SCRATCH, `payload-test-${process.pid}.json`);
  try {
    for (const evil of MALICIOUS) {
      const payload = baseChangeset({ field: "post_content", base_value: evil, new_value: evil, change_type: "restructure-for-citation" });
      writeFileSync(path, JSON.stringify(payload), "utf8");
      const row = parseChangesetPayload(JSON.parse(readFileSync(path, "utf8")));
      assert.equal(row.new_value, evil);
      assert.equal(row.base_value, evil);
    }
  } finally {
    rmSync(path, { force: true });
  }
});
