// test/schema-lint.test.mjs — H2: JSON-LD artifacts with leaked operator placeholders
// (OPERATOR_INSERT_*) or broken structure must be rejected before they can ship inside
// a WP post. Pure tests against scripts/lib/schema-lint.mjs, plus two spawned-CLI tests
// pinning the validate-json.mjs contract the post-validate hook and eval-gate rely on
// (exit 0 valid / exit 1 invalid). No DB, network, or env required.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { lintSchemaArtifact } from "../scripts/lib/schema-lint.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const VALID_JSONLD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Mock-Up Rooms in Hotel Construction",
    author: { "@type": "Person", name: "Jane Builder", jobTitle: "Project Executive" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Home" }],
  },
]);

// ── placeholder gate ─────────────────────────────────────────────────────────

test("valid JSON-LD with real author passes", () => {
  assert.deepEqual(lintSchemaArtifact(VALID_JSONLD, { jsonLd: true }), []);
});

test("OPERATOR_INSERT_* token is rejected (the shipped defect class)", () => {
  const raw = VALID_JSONLD.replace("Jane Builder", "OPERATOR_INSERT_AUTHOR_NAME");
  const errors = lintSchemaArtifact(raw, { jsonLd: true });
  assert.ok(errors.some((e) => /OPERATOR_INSERT_AUTHOR_NAME/.test(e)), errors.join("; "));
});

test("bracketed operator form '[OPERATOR INSERT: …]' is rejected (2nd shipped syntax)", () => {
  const raw = VALID_JSONLD.replace("Jane Builder", "[OPERATOR INSERT: Author full name]");
  const errors = lintSchemaArtifact(raw, { jsonLd: true });
  assert.ok(errors.some((e) => /OPERATOR INSERT/.test(e)), errors.join("; "));
});

test("OPERATOR_INSERT token in a key position is rejected too", () => {
  const raw = JSON.stringify({
    "@context": "https://schema.org", "@type": "Article",
    OPERATOR_INSERT_FIELD: "x",
  });
  const errors = lintSchemaArtifact(raw, { jsonLd: true });
  assert.ok(errors.some((e) => /OPERATOR_INSERT_FIELD/.test(e)));
});

test("REPLACE-suffix marker in an @id is rejected (3rd shipped syntax: #author-REPLACE)", () => {
  const raw = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    author: { "@type": "Person", "@id": "https://www.maxxbuilders.com/#author-REPLACE", name: "Jane Builder" },
  });
  const errors = lintSchemaArtifact(raw, { jsonLd: true });
  assert.ok(errors.some((e) => /author-REPLACE/.test(e)), errors.join("; "));
  assert.ok(lintSchemaArtifact(VALID_JSONLD.replace("Jane Builder", "REPLACE_ME"), { jsonLd: true }).length > 0);
});

test("content-guard placeholder classes are rejected (TODO marker, [insert …])", () => {
  const todo = VALID_JSONLD.replace("Mock-Up Rooms in Hotel Construction", "TODO write headline");
  assert.ok(lintSchemaArtifact(todo, { jsonLd: true }).length > 0);
  const ins = VALID_JSONLD.replace("Jane Builder", "[insert author name]");
  assert.ok(lintSchemaArtifact(ins, { jsonLd: true }).length > 0);
});

// ── structure gate (jsonLd mode) ─────────────────────────────────────────────

test("invalid JSON reports a parse error and nothing else", () => {
  const errors = lintSchemaArtifact("{ not json", { jsonLd: true });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /invalid JSON/);
});

test("entity missing @type is rejected", () => {
  const raw = JSON.stringify([{ "@context": "https://schema.org", headline: "No type" }]);
  const errors = lintSchemaArtifact(raw, { jsonLd: true });
  assert.ok(errors.some((e) => /@type/.test(e)), errors.join("; "));
});

test("entity missing @context is rejected", () => {
  const raw = JSON.stringify([{ "@type": "Article", headline: "No context" }]);
  const errors = lintSchemaArtifact(raw, { jsonLd: true });
  assert.ok(errors.some((e) => /@context/.test(e)), errors.join("; "));
});

test("empty array / non-object top level are rejected", () => {
  assert.ok(lintSchemaArtifact("[]", { jsonLd: true }).length > 0);
  assert.ok(lintSchemaArtifact('"just a string"', { jsonLd: true }).length > 0);
});

test("@graph wrapper: valid graph passes; entities inherit @context from root", () => {
  const raw = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: "Costs guide", author: { "@type": "Person", name: "Jane Builder" } },
      { "@type": "FAQPage", mainEntity: [] },
    ],
  });
  assert.deepEqual(lintSchemaArtifact(raw, { jsonLd: true }), []);
});

test("@graph wrapper: graph entity missing @type, empty @graph, missing root @context all rejected", () => {
  const noType = JSON.stringify({ "@context": "https://schema.org", "@graph": [{ headline: "x" }] });
  assert.ok(lintSchemaArtifact(noType, { jsonLd: true }).some((e) => /@type/.test(e)));
  const empty = JSON.stringify({ "@context": "https://schema.org", "@graph": [] });
  assert.ok(lintSchemaArtifact(empty, { jsonLd: true }).length > 0);
  const noCtx = JSON.stringify({ "@graph": [{ "@type": "Article" }] });
  assert.ok(lintSchemaArtifact(noCtx, { jsonLd: true }).some((e) => /@context/.test(e)));
});

test("plain-JSON mode skips JSON-LD structure but still catches placeholders", () => {
  const plain = JSON.stringify({ config: "value" });
  assert.deepEqual(lintSchemaArtifact(plain, { jsonLd: false }), []);
  const leaked = JSON.stringify({ config: "OPERATOR_INSERT_VALUE" });
  assert.ok(lintSchemaArtifact(leaked, { jsonLd: false }).length > 0);
});

// ── spawned-CLI contract (hook + eval-gate call `node scripts/validate-json.mjs PATH…`) ──

test("CLI: placeholder .jsonld exits 1 and names the token", () => {
  const dir = mkdtempSync(join(tmpdir(), "schema-lint-"));
  const bad = join(dir, "bad.jsonld");
  writeFileSync(bad, VALID_JSONLD.replace("Jane Builder", "OPERATOR_INSERT_AUTHOR_NAME"));
  const r = spawnSync(process.execPath, [join(REPO_ROOT, "scripts/validate-json.mjs"), bad], { encoding: "utf8" });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /OPERATOR_INSERT_AUTHOR_NAME/);
});

test("CLI: valid .jsonld exits 0; multiple paths validate each", () => {
  const dir = mkdtempSync(join(tmpdir(), "schema-lint-"));
  const good = join(dir, "good.jsonld");
  const alsoGood = join(dir, "also-good.jsonld");
  writeFileSync(good, VALID_JSONLD);
  writeFileSync(alsoGood, VALID_JSONLD);
  const r = spawnSync(process.execPath, [join(REPO_ROOT, "scripts/validate-json.mjs"), good, alsoGood], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
