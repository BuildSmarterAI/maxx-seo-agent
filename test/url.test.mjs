// test/url.test.mjs — canonicalizeUrl / isProtected / canonicalizeSet.
// Pure module (no Supabase import) so these run with no env and no network.
//
// Closes Panel-A A1/A2: do_not_touch matching was normalization-blind exact-string
// Set.has(), so a stored `https://www.host.com/legal/` never matched a candidate
// `https://host.com/legal` (link-graph strips the trailing slash before comparing).
//
// Run: node --test test/url.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeUrl, isProtected, canonicalizeSet } from "../orchestrator/lib/url.mjs";

test("strips a single trailing slash (except root)", () => {
  assert.equal(canonicalizeUrl("https://x.com/legal/"), "x.com/legal");
  assert.equal(canonicalizeUrl("https://x.com/legal"), "x.com/legal");
});

test("drops the scheme so http and https collapse", () => {
  assert.equal(canonicalizeUrl("http://x.com/legal"), "x.com/legal");
  assert.equal(canonicalizeUrl("http://x.com/legal"), canonicalizeUrl("https://x.com/legal"));
});

test("drops a leading www. so apex and www collapse", () => {
  assert.equal(canonicalizeUrl("https://www.x.com/legal"), "x.com/legal");
  assert.equal(canonicalizeUrl("https://www.x.com/legal"), canonicalizeUrl("https://x.com/legal"));
});

test("lowercases both host AND path (WordPress slugs are lowercase; over-protect)", () => {
  assert.equal(canonicalizeUrl("https://X.COM/Legal"), "x.com/legal");
});

test("canonicalizes a scheme-less, host-bearing entry to its absolute form", () => {
  // do_not_touch.url is hand-maintained free text — a human may omit the scheme.
  assert.equal(
    canonicalizeUrl("www.maxxbuilders.com/legal/"),
    canonicalizeUrl("https://www.maxxbuilders.com/legal")
  );
  assert.equal(canonicalizeUrl("MaxxBuilders.com/Contact"), "maxxbuilders.com/contact");
});

test("drops query and hash", () => {
  assert.equal(canonicalizeUrl("https://x.com/legal?ref=a#b"), "x.com/legal");
});

test("root url is stable and slash-normalized", () => {
  assert.equal(canonicalizeUrl("https://x.com"), canonicalizeUrl("https://x.com/"));
});

test("is idempotent on already-canonical values", () => {
  const once = canonicalizeUrl("https://www.x.com/legal/");
  assert.equal(canonicalizeUrl(once), once);
});

test("path-only strings survive (matches raw injected sets)", () => {
  assert.equal(canonicalizeUrl("/protected"), "/protected");
  assert.equal(canonicalizeUrl("/legal/"), "/legal");
});

test("isProtected matches across path case (WordPress slugs are case-insensitive)", () => {
  const set = canonicalizeSet(["https://www.maxxbuilders.com/Legal/"]);
  assert.equal(isProtected(set, "https://www.maxxbuilders.com/legal"), true);
});

test("isProtected matches a scheme-less, host-bearing do_not_touch entry", () => {
  const set = canonicalizeSet(["www.maxxbuilders.com/legal/", "MaxxBuilders.com/Contact"]);
  assert.equal(isProtected(set, "https://www.maxxbuilders.com/legal"), true);
  assert.equal(isProtected(set, "https://maxxbuilders.com/contact"), true);
});

test("non-string / empty inputs canonicalize to empty", () => {
  assert.equal(canonicalizeUrl(null), "");
  assert.equal(canonicalizeUrl(undefined), "");
  assert.equal(canonicalizeUrl(""), "");
  assert.equal(canonicalizeUrl("   "), "");
});

test("isProtected matches across scheme/www/trailing-slash variance (the A2 scenario)", () => {
  // stored form from sql/schema.sql seed convention (trailing slash, www, https)
  const set = canonicalizeSet(["https://www.maxxbuilders.com/legal/"]);
  // candidate as link-graph normalize() produces it (no trailing slash)
  assert.equal(isProtected(set, "https://www.maxxbuilders.com/legal"), true);
  // and across scheme + www drop
  assert.equal(isProtected(set, "http://maxxbuilders.com/legal"), true);
});

test("isProtected returns false for a non-member and never over-matches", () => {
  const set = canonicalizeSet(["https://x.com/legal/"]);
  assert.equal(isProtected(set, "https://x.com/pricing"), false);
});

test("isProtected works against a raw path-only set (apply.test injection shape)", () => {
  assert.equal(isProtected(new Set(["/protected"]), "/protected"), true);
  assert.equal(isProtected(new Set(["/other"]), "/protected"), false);
});

test("isProtected is safe on empty set and null url", () => {
  assert.equal(isProtected(new Set(), "https://x.com/legal"), false);
  assert.equal(isProtected(canonicalizeSet(["https://x.com/legal/"]), null), false);
  assert.equal(isProtected(null, "https://x.com/legal"), false);
});

test("canonicalizeSet drops empties and dedupes variants", () => {
  const set = canonicalizeSet([
    "https://www.x.com/legal/",
    "http://x.com/legal",   // same page, different scheme+www
    "",
    null,
  ]);
  assert.equal(set.size, 1);
  assert.equal(set.has("x.com/legal"), true);
});
