#!/usr/bin/env node
// packs/wordpress/publish-drafts.mjs
// Reads drafts/*.md → creates WP draft posts with Yoast/RankMath meta + JSON-LD schema.
// Posts land as status:draft — review and publish from WP dashboard. Create-only: existing
// slugs are skipped (never updated) so a re-run can't clobber a human-edited live post.
// Content parsing/rendering + the SEO meta-key map are shared (scripts/lib/wp-content.mjs,
// packs/wordpress/seo-keys.mjs) so this and run_all_blog_changesets.mjs can't diverge.
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SEO_PLUGIN=yoast|rankmath

import { readdir, readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lintSchemaArtifact } from "../../scripts/lib/schema-lint.mjs";
import { toCleanMarkdown, renderMarkdown, capErrors } from "../../scripts/lib/wp-content.mjs";
import { keysFor } from "./seo-keys.mjs";

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE    = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH    = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const KEYS    = keysFor();   // yoast/rankmath meta-key map for the active SEO_PLUGIN

if (!BASE) throw new Error("WP_BASE_URL not set");

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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const draftsDir = join(ROOT, "drafts");
  const schemaDir = join(ROOT, "schema");
  // Publish real drafts only. "*-review.md" files are verification companions (clean-drafts
  // convention), not posts — exclude them so they are never treated as publishable content.
  const files = (await readdir(draftsDir)).filter(f => f.endsWith(".md") && !f.endsWith("-review.md"));

  let created = 0, skipped = 0, failed = 0;

  for (const file of files) {
    const slug = basename(file, ".md");
    const raw  = await readFile(join(draftsDir, file), "utf8");

    // Shared pipeline: parse frontmatter, strip internal-only sections (keeps Internal
    // Links — M1), render markdown → HTML via the one shared renderer (M2).
    const { meta, markdown } = toCleanMarkdown(raw);
    const html = await renderMarkdown(markdown);

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

    // Resolve fields. NEVER fall back to the slug; NEVER emit "".
    const title = (meta.title || "").trim();
    const desc  = (meta.description || "").trim();
    const canon = (meta.canonical || "").trim();
    const focus = (meta.focus_keyphrase || "").trim();

    // Invariant: a post MUST have a real title — never the slug. A missing title refuses.
    if (!title) {
      console.error(`✗ refused  ${slug}: no title parsed — refusing to publish (would have been a slug title). Fix the draft.`);
      failed++;
      continue;
    }

    // M1: enforce metadata caps (title ≤ 60, description ≤ 155). Refuse rather than truncate.
    const capErrs = capErrors(meta);
    if (capErrs.length) {
      console.error(`✗ refused  ${slug}: metadata over cap — fix the draft:`);
      capErrs.forEach((e) => console.error(`    • ${e}`));
      failed++;
      continue;
    }

    // Build meta from ONLY non-empty values; empty fields are omitted, never sent as "".
    const metaPayload = {};
    if (title) metaPayload[KEYS.title]       = title;
    if (desc)  metaPayload[KEYS.description]  = desc;
    if (canon) metaPayload[KEYS.canonical]   = canon;
    if (focus) metaPayload[KEYS.focus]       = focus;

    // Create-only: skip any slug that already exists so a re-run can't overwrite a
    // human-edited live post.
    const existingId = await slugExists(slug);
    if (existingId) {
      console.log(`~ skipped  ${slug}  (already exists — post ${existingId}; this script does not update existing posts)`);
      skipped++;
      continue;
    }

    try {
      const payload = { title, slug, content: html + schemaBlock, status: "draft" };
      if (Object.keys(metaPayload).length) payload.meta = metaPayload;
      const post = await wp("posts", payload);
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
