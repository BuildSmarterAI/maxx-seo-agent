#!/usr/bin/env node
// scripts/draft-f16-edits.mjs — DRAFTS (never applies) the F-16 front-matter / double-H1 fixes
// for WP posts 300 and 5913 from the read-only backup export. Pure file I/O: no WordPress,
// no Supabase. Output: change_set/f16-<id>-<field>.json with status "pending".
//
// usage: node scripts/draft-f16-edits.mjs [backup-dir]
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseChangesetPayload } from "../orchestrator/lib/payload.mjs";

const BACKUP_DIR = process.argv[2] || "change_set/backup-2026-10-08-batch-1";
const FRONT_MATTER = /Slug:|Meta description|Canonical:|Last Updated|Title \(\d+ chars\)/;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const count = (s, re) => (s.match(re) ?? []).length;
const hrefs = (s) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort();

const LEADING = /^\s*<h1>(?<h1>.*?)<\/h1>\s*<p>(?<fm>.*?)<\/p>\s*<hr>\s*/s;
const TRAILING_LAST_UPDATED = /<p><strong>Last Updated:<\/strong>[^<]*<\/p>\s*/g;

const POSTS = [
  { id: 300, postTitle: "Mock-Up Rooms in Hotel Construction: Why They Matter", keepAuthor: false },
  { id: 5913, postTitle: "Medical Office Construction Costs Texas 2026", keepAuthor: true },
];

// Drop the leading <h1> and front-matter paragraph (the theme renders post_title as the one H1).
// If the block carries a named author, keep that line as a clean byline paragraph.
function cleanLeading(raw, keepAuthor) {
  const m = raw.match(LEADING);
  if (!m) throw new Error("leading front-matter block not found");
  const author = m.groups.fm.match(/<strong>Author:<\/strong>\s*(.*)$/s)?.[1]?.trim();
  if (keepAuthor && !author) throw new Error("expected an Author line in the front-matter block");
  const byline = keepAuthor ? `<p><strong>Author:</strong> ${author}</p>\n<hr>\n` : "";
  return { body: byline + raw.slice(m[0].length), removedH1: m.groups.h1, removedBlock: m[0] };
}

function assertInvariants(id, before, after) {
  const fail = (msg) => { throw new Error(`post ${id}: ${msg}`); };
  if (count(after, /<h1[\s>]/g) !== 0) fail("body still contains an <h1>; theme H1 + body H1 would be two");
  if (FRONT_MATTER.test(after)) fail("front-matter text still present");
  for (const tag of ["h2", "h3", "table", "li", "ul"]) {
    const re = new RegExp(`<${tag}[\\s>]`, "g");
    if (count(before, re) !== count(after, re)) fail(`<${tag}> count changed`);
  }
  const lost = hrefs(before).filter((h) => !hrefs(after).includes(h));
  const canonical = `https://www.maxxbuilders.com/`;
  if (lost.length !== 1 || !lost[0].startsWith(canonical)) fail(`unexpected link changes: ${lost.join(", ")}`);
  if (hrefs(after).length !== hrefs(before).length - 1) fail("link count changed by more than the canonical link");
}

function artifact(post, field, url, baseValue, newValue, extra) {
  return {
    skill: "f16-front-matter-cleanup",
    generated_at: new Date().toISOString(),
    platform: "wordpress",
    page_id: String(post.id),
    url,
    status: "pending",
    risk_class: "gated",
    change_type: null,
    field,
    base_value: baseValue,
    new_value: newValue,
    rollback_source: `${BACKUP_DIR}/posts-${post.id}.json`,
    ...extra,
  };
}

async function draft(post) {
  const file = join(BACKUP_DIR, `posts-${post.id}.json`);
  const raw = await readFile(file, "utf8");
  const wp = JSON.parse(raw);
  const before = wp.content.raw;
  const lead = cleanLeading(before, post.keepAuthor);
  const body = lead.body.replace(TRAILING_LAST_UPDATED, "");
  assertInvariants(post.id, before, body);

  const review = {
    h1_after: "exactly 1 (theme renders post_title; body H1 removed)",
    removed_h1: lead.removedH1,
    removed_front_matter: lead.removedBlock.trim(),
    removed_trailing_last_updated: count(before, TRAILING_LAST_UPDATED),
    kept_author_byline: post.keepAuthor,
    bytes_before: Buffer.byteLength(before),
    bytes_after: Buffer.byteLength(body),
    links_removed: ["canonical <a> inside the front-matter block"],
    backup_content_sha256: sha256(before),
  };
  const common = { rollback_sha256: sha256(raw), review };
  const out = [
    artifact(post, "post_title", wp.link, wp.title.raw, post.postTitle, common),
    artifact(post, "post_content", wp.link, lead.removedBlock, body, common),
  ];
  for (const a of out) {
    const path = join("change_set", `f16-${post.id}-${a.field}.json`);
    await writeFile(path, JSON.stringify(a, null, 2) + "\n");
    let importable = "yes";
    try { parseChangesetPayload(a); } catch (e) { importable = `NO (${e.message.split("(")[0].trim()})`; }
    console.log(`${path}  importable by current payload schema: ${importable}`);
  }
  console.log(`  post ${post.id}: ${review.bytes_before} -> ${review.bytes_after} bytes, body H1s ${count(body, /<h1[\s>]/g)}`);
}

for (const post of POSTS) await draft(post);
