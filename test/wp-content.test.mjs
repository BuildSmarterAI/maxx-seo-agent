// test/wp-content.test.mjs — the shared WordPress draft-content pipeline (audit M1/M2).
// Pure tests for the frontmatter parser, internal-section stripping, and cap checks — the
// logic both packs/wordpress/publish-drafts.mjs and scripts/run_all_blog_changesets.mjs
// now share so they can't diverge (M2). renderMarkdown depends on `marked`, which isn't
// installed in the bare worktree, so its tests skip locally and run in CI.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseDraft,
  stripInternalSections,
  DEFAULT_INTERNAL_SECTIONS,
  capErrors,
  toCleanMarkdown,
  renderMarkdown,
  TITLE_MAX,
  DESC_MAX,
} from "../scripts/lib/wp-content.mjs";

let markedAvailable = true;
try { await import("marked"); } catch { markedAvailable = false; }

// Representative of the repo's real drafts: an H1, then a **Label:** block, then `---`.
const BOLD_LABEL_DRAFT = `# Mock-Up Rooms in Hotel Construction: Why They Matter

**Slug:** \`importance-of-mock-up-rooms\`
**Title (53 chars):** Mock-Up Rooms in Hotel Construction: Why They Matter
**Meta description (150 chars):** Learn how mock-up rooms reduce risk and cost in hotel construction.
**Canonical:** https://www.maxxbuilders.com/importance-of-mock-up-rooms-in-the-hospitality-industry/
**Focus keyphrase:** hotel mock-up room

---

## Answer-First Intro

A mock-up room is a single, fully built guest room.

## Internal Links

- [Hotel construction guide](/hotel-construction-guide/)

## Sources

- Some internal source note.

## Author and Date

Draft-internal byline notes.
`;

const YAML_DRAFT = `---
title: YAML Title
description: A yaml description
canonical: https://example.com/x/
---
## Body

Real content here.
`;

// ── parseDraft: bold-label convention (the shape that leaked in M2) ───────────

test("parseDraft extracts meta from the bold-label header and body after the ---", () => {
  const { meta, body } = parseDraft(BOLD_LABEL_DRAFT);
  assert.equal(meta.title, "Mock-Up Rooms in Hotel Construction: Why They Matter");
  assert.equal(meta.description, "Learn how mock-up rooms reduce risk and cost in hotel construction.");
  assert.equal(meta.canonical, "https://www.maxxbuilders.com/importance-of-mock-up-rooms-in-the-hospitality-industry/");
  assert.equal(meta.focus_keyphrase, "hotel mock-up room");
  // The header block (title/meta/canonical labels) MUST NOT leak into the body (M2 core bug).
  assert.ok(!body.includes("**Title"), "title label leaked into body");
  assert.ok(!body.includes("**Meta description"), "meta label leaked into body");
  assert.ok(body.includes("## Answer-First Intro"));
});

test("parseDraft falls back to the H1 heading when no Title label is present", () => {
  const { meta } = parseDraft("# Heading Only\n\nBody text.");
  assert.equal(meta.title, "Heading Only");
});

test("parseDraft handles real YAML frontmatter too", () => {
  const { meta, body } = parseDraft(YAML_DRAFT);
  assert.equal(meta.title, "YAML Title");
  assert.equal(meta.description, "A yaml description");
  assert.equal(meta.canonical, "https://example.com/x/");
  assert.ok(body.trim().startsWith("## Body"));
  assert.ok(!body.includes("title: YAML Title"));
});

// ── stripInternalSections: M1 — Internal Links is NO LONGER stripped ──────────

test("DEFAULT_INTERNAL_SECTIONS strips draft-internal sections but KEEPS Internal Links (M1)", () => {
  assert.ok(!DEFAULT_INTERNAL_SECTIONS.includes("Internal Links"));
  assert.deepEqual(DEFAULT_INTERNAL_SECTIONS, ["Human-Edit Checklist", "Sources", "Author and Date"]);
});

test("stripInternalSections removes the default sections and keeps Internal Links content", () => {
  const { body } = parseDraft(BOLD_LABEL_DRAFT);
  const cleaned = stripInternalSections(body);
  assert.ok(cleaned.includes("## Internal Links"), "Internal Links must survive (M1)");
  assert.ok(cleaned.includes("[Hotel construction guide]"), "internal link body must survive");
  assert.ok(!cleaned.includes("## Sources"), "Sources must be stripped");
  assert.ok(!cleaned.includes("## Author and Date"), "Author and Date must be stripped");
  assert.ok(cleaned.includes("## Answer-First Intro"), "real content preserved");
});

test("stripInternalSections strips the LAST section (no trailing ## after it)", () => {
  const md = "## Keep\n\ntext\n\n## Sources\n\n- s1\n- s2";
  const out = stripInternalSections(md, ["Sources"]);
  assert.ok(out.includes("## Keep"));
  assert.ok(!out.includes("## Sources"));
  assert.ok(!out.includes("s1"));
});

// ── capErrors: M1 — enforce title ≤ 60, description ≤ 155 ─────────────────────

test("caps: within-limit meta yields no errors", () => {
  assert.equal(TITLE_MAX, 60);
  assert.equal(DESC_MAX, 155);
  assert.deepEqual(capErrors({ title: "ok", description: "ok" }), []);
});

test("caps: over-length title and description each produce an error", () => {
  const errs = capErrors({ title: "x".repeat(61), description: "y".repeat(156) });
  assert.equal(errs.length, 2);
  assert.ok(errs.some((e) => /title/i.test(e) && /60/.test(e)));
  assert.ok(errs.some((e) => /description/i.test(e) && /155/.test(e)));
});

test("caps: exactly at the limit passes", () => {
  assert.deepEqual(capErrors({ title: "x".repeat(60), description: "y".repeat(155) }), []);
});

// ── toCleanMarkdown: the single composed entry both scripts call ─────────────

test("toCleanMarkdown returns parsed meta + cleaned markdown (header gone, Internal Links kept)", () => {
  const { meta, markdown } = toCleanMarkdown(BOLD_LABEL_DRAFT);
  assert.equal(meta.title, "Mock-Up Rooms in Hotel Construction: Why They Matter");
  assert.ok(!markdown.includes("**Meta description"), "no frontmatter leak");
  assert.ok(markdown.includes("## Internal Links"), "Internal Links kept");
  assert.ok(!markdown.includes("## Sources"), "Sources stripped");
});

test("toCleanMarkdown accepts a custom section list", () => {
  const { markdown } = toCleanMarkdown(BOLD_LABEL_DRAFT, { sections: [] });
  assert.ok(markdown.includes("## Sources"), "no stripping when sections is empty");
});

// ── renderMarkdown (CI only — needs `marked`) ────────────────────────────────

test("renderMarkdown emits GFM tables, headings, lists, links, and bold", { skip: markedAvailable ? false : "marked not installed (runs in CI)" }, async () => {
  const html = await renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n\n## H2 Head\n\n- item one\n- item two\n\n**bold** and [link](/x/)");
  assert.match(html, /<table>/);
  assert.match(html, /<th>A<\/th>/);
  assert.match(html, /<td>1<\/td>/);
  assert.match(html, /<h2[^>]*>H2 Head<\/h2>/);
  assert.match(html, /<li>item one<\/li>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="\/x\/">link<\/a>/);
});

test("renderMarkdown on a full cleaned draft keeps Internal Links as a rendered heading", { skip: markedAvailable ? false : "marked not installed (runs in CI)" }, async () => {
  const { markdown } = toCleanMarkdown(BOLD_LABEL_DRAFT);
  const html = await renderMarkdown(markdown);
  assert.match(html, /<h2[^>]*>Internal Links<\/h2>/);
  assert.doesNotMatch(html, /Meta description/);
});
