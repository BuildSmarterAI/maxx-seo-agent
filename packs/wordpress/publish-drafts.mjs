#!/usr/bin/env node
// packs/wordpress/publish-drafts.mjs
// Reads drafts/*.md → creates WP draft posts with Yoast meta + JSON-LD schema.
// Posts land as status:draft — review and publish from WP dashboard.
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN=yoast|rankmath

import { readdir, readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE    = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH    = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const PLUGIN  = (process.env.SEO_PLUGIN || "yoast").toLowerCase();

if (!BASE) throw new Error("WP_BASE_URL not set");

const META_KEYS = {
  yoast:    { title: "_yoast_wpseo_title", desc: "_yoast_wpseo_metadesc", canonical: "_yoast_wpseo_canonical", focus: "_yoast_wpseo_focuskw" },
  rankmath: { title: "rank_math_title",    desc: "rank_math_description", canonical: "rank_math_canonical_url", focus: "rank_math_focus_keyword" },
}[PLUGIN];

// ── WordPress REST helpers ──────────────────────────────────────────────────

async function wp(path, body, method = "POST") {
  const r = await fetch(`${BASE}/wp-json/wp/v2/${path}`, {
    method,
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`WP ${r.status} /${path}: ${await r.text()}`);
  return r.json();
}

async function slugExists(slug) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=any`, {
    headers: { Authorization: AUTH },
  });
  const posts = await r.json();
  return Array.isArray(posts) && posts.length > 0 ? posts[0].id : null;
}

// ── Frontmatter parser ──────────────────────────────────────────────────────

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (key) meta[key] = val;
  }
  return { meta, body: m[2] };
}

// ── Strip internal-only sections ────────────────────────────────────────────

function stripSection(md, heading) {
  return md.replace(new RegExp(`\\n## ${heading}[\\s\\S]*?(?=\\n## |$)`), "").trim();
}

// ── Minimal but table-aware Markdown → HTML ─────────────────────────────────

function mdTable(block) {
  const lines = block.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return block;

  const parseRow = (line, tag) =>
    "<tr>" +
    line.split("|").slice(1, -1).map(c => `<${tag}>${c.trim()}</${tag}>`).join("") +
    "</tr>";

  const [header, , ...body] = lines; // skip separator row
  return (
    "<table>" +
    "<thead>" + parseRow(header, "th") + "</thead>" +
    "<tbody>" + body.map(r => parseRow(r, "td")).join("") + "</tbody>" +
    "</table>"
  );
}

function markdownToHtml(md) {
  // Tables first (multi-line blocks)
  md = md.replace(/(\|.+\|\n)+/g, block => mdTable(block));

  // Block-level
  md = md
    .replace(/^---+$/gm, "<hr>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> in <ul>
  md = md.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Inline
  md = md
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs — wrap bare text blocks
  const blocks = md.split(/\n{2,}/);
  return blocks
    .map(b => {
      b = b.trim();
      if (!b) return "";
      if (/^<(h[1-6]|ul|ol|table|blockquote|hr|div|p)/.test(b)) return b;
      return `<p>${b.replace(/\n/g, " ")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const draftsDir = join(ROOT, "drafts");
  const schemaDir = join(ROOT, "schema");
  const files = (await readdir(draftsDir)).filter(f => f.endsWith(".md"));

  let created = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const slug = basename(file, ".md");
    const raw  = await readFile(join(draftsDir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);

    // Strip internal sections
    let md = body;
    for (const s of ["Human-Edit Checklist", "Sources", "Internal Links", "Author and Date"]) {
      md = stripSection(md, s);
    }

    const html = markdownToHtml(md);

    // JSON-LD schema block
    let schemaBlock = "";
    try {
      const jsonld = await readFile(join(schemaDir, `${slug}.jsonld`), "utf8");
      schemaBlock = `\n<!-- wp:html --><script type="application/ld+json">${jsonld}</script><!-- /wp:html -->`;
    } catch { /* no schema file */ }

    // Skip if slug already exists
    const existingId = await slugExists(slug);
    if (existingId) {
      console.log(`~ skipped  ${slug}  (already exists — post ${existingId})`);
      skipped++;
      continue;
    }

    try {
      const post = await wp("posts", {
        title:   meta.title  || slug,
        slug,
        content: html + schemaBlock,
        status:  "draft",
        meta: {
          [META_KEYS.title]:     meta.title           || "",
          [META_KEYS.desc]:      meta.description     || "",
          [META_KEYS.canonical]: meta.canonical       || "",
          [META_KEYS.focus]:     meta.focus_keyphrase || "",
        },
      });
      console.log(`✓ created  id=${post.id}  /${slug}/  → ${BASE}/?p=${post.id}&preview=true`);
      created++;
    } catch (e) {
      console.error(`✗ failed   ${slug}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone — created ${created}, skipped ${skipped}, failed ${failed}`);
  if (created > 0) console.log(`Review drafts: ${BASE}/wp-admin/edit.php?post_status=draft&post_type=post`);
}

main().catch(e => { console.error(e); process.exit(1); });
