#!/usr/bin/env node
// packs/wordpress/publish-drafts.mjs
// Reads drafts/*.md → creates WP draft posts with Yoast meta + JSON-LD schema.
// Posts land as status:draft — review and publish from WP dashboard.
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN=yoast|rankmath

import { readdir, readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lintSchemaArtifact } from "../../scripts/lib/schema-lint.mjs";

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

// ── Live-value drift gate (UPDATE path only) ────────────────────────────────

// Read live title + Yoast meta for an existing post.
async function liveValuesFor(id) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/posts/${id}?context=edit`, { headers: { Authorization: AUTH } });
  if (!r.ok) return null;
  const d = await r.json();
  return { title: d.title?.raw ?? "", meta: d.meta ?? {} };
}

// Mirrors apply.mjs's drift gate: drop any field whose LIVE value is populated and
// DIFFERS from what we're about to write, so an update can never clobber a human edit.
// Returns { refuse: true } if live can't be read (caller must not write — fail-safe).
async function dropClobbering(existingId, title, metaPayload) {
  const live = await liveValuesFor(existingId);
  if (!live) return { refuse: true };
  const safe = { refuse: false, title: null, meta: {} };
  if (title && (!live.title || live.title === title)) safe.title = title;
  else if (live.title && live.title !== title) console.log(`  ↳ keep live title (human-edited): ${JSON.stringify(live.title)}`);
  for (const [k, v] of Object.entries(metaPayload)) {
    const lv = live.meta?.[k] ?? "";
    if (lv && String(lv) !== String(v)) { console.log(`  ↳ keep live ${k} (human-edited)`); continue; }
    safe.meta[k] = v;
  }
  return safe;
}

// ── Frontmatter parser ──────────────────────────────────────────────────────

function parseFrontmatter(raw) {
  // 1) real YAML frontmatter — unchanged, kept for any YAML drafts
  const yaml = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (yaml) {
    const meta = {};
    for (const line of yaml[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (key) meta[key] = val;
    }
    return { meta, body: yaml[2] };
  }
  // 2) markdown bold-label convention our drafts use:
  //    "# Heading" + "**Key (optional note):** value" lines; block ends at the first "---".
  const sepIdx = raw.search(/^\s*---\s*$/m);
  const head = sepIdx === -1 ? raw : raw.slice(0, sepIdx);
  let body = sepIdx === -1 ? raw : raw.slice(sepIdx).replace(/^\s*---\s*$/m, "");
  body = body.replace(/^\s+/, "");

  const labels = {};
  for (const m of head.matchAll(/^\*\*\s*([^:*()]+?)\s*(?:\([^)]*\))?\s*:\*\*\s*(.+?)\s*$/gm)) {
    labels[m[1].trim().toLowerCase()] = m[2].trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "");
  }
  const h = head.match(/^#\s+(.+?)\s*$/m);
  const headingTitle = h ? h[1].trim() : "";

  const meta = {
    title:           labels["title"] || headingTitle || "",   // heading fallback — never the slug
    description:     labels["meta description"] || labels["description"] || "",
    canonical:       labels["canonical"] || "",
    focus_keyphrase: labels["focus keyphrase"] || labels["focus"] || "",
  };
  return { meta, body };
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

  let created = 0, updated = 0, skipped = 0, failed = 0;

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

    // JSON-LD schema block. A schema artifact that fails lint (leaked OPERATOR_INSERT_*
    // placeholders, broken structure — audit H2) refuses the whole draft: publishing the
    // post without its schema would silently drop the artifact, and publishing WITH it
    // would ship placeholder text into a live page.
    let schemaBlock = "";
    let jsonld = null;
    try {
      jsonld = await readFile(join(schemaDir, `${slug}.jsonld`), "utf8");
    } catch { /* no schema file — fine, post publishes without a schema block */ }
    if (jsonld !== null) {
      const schemaErrors = lintSchemaArtifact(jsonld, { jsonLd: true });
      if (schemaErrors.length) {
        console.error(`✗ refused  ${slug}: schema/${slug}.jsonld failed validation — fix the artifact first:`);
        schemaErrors.forEach((e) => console.error(`    • ${e}`));
        failed++;
        continue;
      }
      schemaBlock = `\n<!-- wp:html --><script type="application/ld+json">${jsonld}</script><!-- /wp:html -->`;
    }

    // ── GUARD (invariants 1 & 2): resolve fields. NEVER fall back to slug. NEVER emit "". ──
    const title = (meta.title || "").trim();
    const desc  = (meta.description || "").trim();
    const canon = (meta.canonical || "").trim();
    const focus = (meta.focus_keyphrase || "").trim();

    // Invariant 1: a post MUST have a real title — never the slug. A missing title refuses the publish.
    if (!title) {
      console.error(`✗ refused  ${slug}: no title parsed — refusing to publish (would have been a slug title). Fix the draft.`);
      failed++;
      continue;
    }

    // Invariant 2: build meta from ONLY non-empty values; empty fields are omitted, never sent as "".
    const metaPayload = {};
    if (title) metaPayload[META_KEYS.title]     = title;
    if (desc)  metaPayload[META_KEYS.desc]      = desc;
    if (canon) metaPayload[META_KEYS.canonical] = canon;
    if (focus) metaPayload[META_KEYS.focus]     = focus;

    const existingId = await slugExists(slug);

    // POLICY: this script creates only. Removing the next block enables the GUARDED update
    // path below — which (invariant 3) cannot clobber a populated, human-edited live value.
    // The guard lives in the write path and does NOT depend on this skip.
    if (existingId) {
      console.log(`~ skipped  ${slug}  (already exists — post ${existingId}; this script does not update existing posts)`);
      skipped++;
      continue;
    }

    try {
      if (existingId) {
        // GUARDED UPDATE PATH (invariant 3) — reachable only if the skip above is removed.
        const safe = await dropClobbering(existingId, title, metaPayload);
        if (safe.refuse) {
          console.error(`✗ refused  ${slug}: cannot read live values to verify — not updating (fail-safe).`);
          failed++;
          continue;
        }
        const body = {};
        if (safe.title) body.title = safe.title;
        if (Object.keys(safe.meta).length) body.meta = safe.meta;
        if (!Object.keys(body).length) {
          console.log(`= no-op    ${slug}  (live values preserved; nothing safe to write)`);
          skipped++;
          continue;
        }
        const post = await wp(`posts/${existingId}`, body);
        console.log(`✓ updated  id=${post.id}  /${slug}/  (guarded — no human edit overwritten)`);
        updated++;
      } else {
        // CREATE PATH — no live value to protect, so no live-compare read.
        const payload = { title, slug, content: html + schemaBlock, status: "draft" };
        if (Object.keys(metaPayload).length) payload.meta = metaPayload;
        const post = await wp("posts", payload);
        console.log(`✓ created  id=${post.id}  /${slug}/  → ${BASE}/?p=${post.id}&preview=true`);
        created++;
      }
    } catch (e) {
      console.error(`✗ failed   ${slug}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone — created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}`);
  if (created > 0) console.log(`Review drafts: ${BASE}/wp-admin/edit.php?post_status=draft&post_type=post`);
}

main().catch(e => { console.error(e); process.exit(1); });
