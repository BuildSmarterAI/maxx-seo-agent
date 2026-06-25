#!/usr/bin/env node
// scripts/import-metadata-csv.mjs
// Reads metadata-changes.csv, looks up WP post IDs via REST, and upserts
// rows into the change_set Supabase table as status=approved so wp:apply picks them up.
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db as sb } from "../lib/db.mjs";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE  = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH  = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");
const BATCH = `metadata-csv-${new Date().toISOString().slice(0, 10)}`;

if (!BASE) throw new Error("WP_BASE_URL not set");

// ── WP helpers ───────────────────────────────────────────────────────────────

async function wpGet(path) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/${path}`, { headers: { Authorization: AUTH } });
  if (!r.ok) return [];
  return r.json();
}

async function resolvePageId(url) {
  // Extract slug from URL path
  const slug = url.replace(/^https?:\/\/[^/]+\/?/, "").replace(/\/$/, "") || "__home__";

  if (slug === "__home__") {
    // Homepage — find by page set as front page
    const settings = await fetch(`${BASE}/wp-json/wp/v2/settings`, { headers: { Authorization: AUTH } }).then(r => r.json()).catch(() => ({}));
    if (settings.page_on_front) return String(settings.page_on_front);
    // fallback: look for page with slug '' or id 2
    return "2";
  }

  // Try posts first, then pages
  for (const type of ["posts", "pages"]) {
    const results = await wpGet(`${type}?slug=${encodeURIComponent(slug)}&status=any&per_page=1`);
    if (Array.isArray(results) && results.length > 0) return String(results[0].id);
  }
  return null;
}

// ── CSV parser (no deps) ─────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const fields = [];
    let cur = "", inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { fields.push(cur); cur = ""; continue; }
      cur += ch;
    }
    fields.push(cur);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (fields[idx] || "").trim(); });
    rows.push(row);
  }
  return rows;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csv  = await readFile(join(ROOT, "metadata-changes.csv"), "utf8");
  const rows = parseCsv(csv);

  let inserted = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const { url, page_id: csvPageId, current_title, new_title, current_description, new_description, canonical } = row;
    if (!url) continue;

    // Resolve WP page_id
    const page_id = csvPageId || await resolvePageId(url);
    if (!page_id) {
      console.warn(`  ? no page_id found for ${url} — skipping`);
      skipped++;
      continue;
    }

    // canonical's base_value stays empty (Yoast auto-generates if unset) and is queued
    // whenever a non-empty value is supplied; title/description only when they actually change.
    const FIELDS = [
      { field: "title",       current: current_title,       next: new_title },
      { field: "description", current: current_description, next: new_description },
      { field: "canonical",   current: "",                  next: canonical, always: true },
    ];
    const changes = FIELDS
      .filter((f) => f.next && (f.always || f.next !== f.current))
      .map((f) => ({ field: f.field, base_value: f.current || "", new_value: f.next }));

    if (changes.length === 0) {
      console.log(`  = no changes  ${url}`);
      skipped++;
      continue;
    }

    for (const change of changes) {
      const { error } = await sb.from("change_set").insert({
        platform:   "wordpress",
        page_id,
        url,
        field:      change.field,
        base_value: change.base_value,
        new_value:  change.new_value,
        status:     "approved",
        batch:      BATCH,
      });
      if (error) {
        console.error(`  ✗ failed  ${url} [${change.field}]: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ queued  ${url} [${change.field}]  page_id=${page_id}`);
        inserted++;
      }
    }
  }

  console.log(`\nDone — ${inserted} rows inserted, ${skipped} skipped, ${failed} failed`);
  console.log(`Batch: ${BATCH}`);
  if (inserted > 0) console.log("Run `npm run wp:apply` to push to WordPress.");
}

main().catch(e => { console.error(e); process.exit(1); });
