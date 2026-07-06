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

test("isProtected matches a path-only entry against an absolute candidate (cross-review 56-1)", () => {
  // The verified bypass: a hand-typed path-only do_not_touch row protected NOTHING because
  // every real candidate in the system (sensor URLs, work_queue rows, change_set.url) is absolute.
  const set = canonicalizeSet(["/terms-and-conditions/"]);
  assert.equal(isProtected(set, "https://www.maxxbuilders.com/terms-and-conditions/"), true);
  assert.equal(isProtected(set, "http://maxxbuilders.com/terms-and-conditions"), true);
});

test("isProtected matches an absolute entry against a path-only candidate (cross-review 56-1)", () => {
  const set = canonicalizeSet(["https://www.maxxbuilders.com/terms-and-conditions/"]);
  assert.equal(isProtected(set, "/terms-and-conditions"), true);
  assert.equal(isProtected(set, "/Terms-And-Conditions/"), true);
});

test("hand-typed entry shapes without a leading slash still protect their page (verify round 2)", () => {
  // Bare slug (copied straight from the WP admin slug field), slashless nested path,
  // trailing-slash slug — all realistic free-text shapes for a hand-maintained table.
  assert.equal(isProtected(canonicalizeSet(["terms-and-conditions"]), "https://www.maxxbuilders.com/terms-and-conditions/"), true);
  assert.equal(isProtected(canonicalizeSet(["legal/"]), "https://maxxbuilders.com/legal"), true);
  assert.equal(isProtected(canonicalizeSet(["legal/privacy"]), "https://maxxbuilders.com/legal/privacy"), true);
});

test("query/hash on a path-only entry are dropped like their absolute counterparts (verify round 2)", () => {
  assert.equal(isProtected(canonicalizeSet(["/legal?x=1"]), "https://maxxbuilders.com/legal"), true);
  assert.equal(isProtected(canonicalizeSet(["/legal#top"]), "https://maxxbuilders.com/legal"), true);
});

test("a slashless nested entry never misparses as host/path and over-protects the tail (verify round 2)", () => {
  const set = canonicalizeSet(["blog/my-post"]);
  assert.equal(isProtected(set, "/my-post"), false); // the probe-confirmed false-protect
  assert.equal(isProtected(set, "/blog/my-post"), true); // the page the entry meant
  assert.equal(isProtected(set, "https://maxxbuilders.com/blog/my-post"), true);
});

test("cross-shape matching still refuses non-members in both directions", () => {
  assert.equal(isProtected(canonicalizeSet(["/legal"]), "https://x.com/pricing"), false);
  assert.equal(isProtected(canonicalizeSet(["https://x.com/legal"]), "/pricing"), false);
});

test("absolute entries still never match across hosts (path matching is path-only-shape only)", () => {
  const set = canonicalizeSet(["https://a.com/legal"]);
  assert.equal(isProtected(set, "https://b.com/legal"), false);
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
