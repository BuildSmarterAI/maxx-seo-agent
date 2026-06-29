#!/usr/bin/env node
// scripts/keyword-research.mjs
// Calls Yoast's Semrush proxy to get related keyphrases for a seed keyword.
// Selects the best focus keyphrase + up to 4 related keyphrases by opportunity score.
// Optionally patches the matching draft frontmatter and WP post meta.
//
// Usage:
//   npm run keyword-research -- "warehouse construction cost Texas"
//   npm run keyword-research -- "warehouse construction cost Texas" --write  (patches draft + WP)
//
// env: YOAST_API_KEY, WP_BASE_URL, WP_USER, WP_APP_PASSWORD (only needed with --write)

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const SEED  = process.argv.slice(2).filter(a => !a.startsWith("--")).join(" ");

if (!SEED) throw new Error("Usage: keyword-research -- \"seed keyword\"");

// ── Yoast / Semrush API ────────────────────────────────────────────────────

// Yoast proxies Semrush through the WordPress REST API — no external credential needed.
// Endpoint: /wp-json/yoast/v1/semrush/related_keyphrases

const BASE = process.env.WP_BASE_URL?.replace(/\/$/, "");
const AUTH = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");

async function fetchRelated(keyword, locale = "en_US") {
  const url = new URL(`${BASE}/wp-json/yoast/v1/semrush/related_keyphrases`);
  url.searchParams.set("keyphrase",    keyword);
  url.searchParams.set("country_code", locale.split("_")[1]?.toLowerCase() ?? "us");

  const r = await fetch(url.toString(), {
    headers: { Authorization: AUTH },
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Yoast WP API ${r.status}: ${body}`);
  }
  return r.json();
}

// Alias — same endpoint covers keyword data for the seed term
async function fetchKeywordData(keyword, locale = "en_US") {
  return fetchRelated(keyword, locale).catch(() => null);
}

// ── Scoring ────────────────────────────────────────────────────────────────

function opportunityScore(volume, difficulty) {
  // Higher volume + lower difficulty = better opportunity
  return Math.round(volume * (1 - (difficulty ?? 50) / 100));
}

function parseKeywords(data) {
  // Yoast proxies Semrush tabular format:
  // { results: { columnNames: ["Ph","Nq","Cp","Co","Nr","Td","Kd"], rows: [[...], ...] }, status: 200 }
  // Ph=keyword, Nq=volume, Kd=difficulty, Td=trend (comma-separated monthly), Co=competition
  const { columnNames = [], rows = [] } = data?.results ?? {};
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const idx = name => columnNames.indexOf(name);
  const iKw    = idx("Keyword");
  const iVol   = idx("Search Volume");
  const iDiff  = idx("Keyword Difficulty Index");
  const iTrend = idx("Trends");

  return rows.map(row => {
    const keyword    = iKw   >= 0 ? String(row[iKw])            : "";
    const volume     = iVol  >= 0 ? Number(row[iVol])           : 0;
    const difficulty = iDiff >= 0 ? Number(row[iDiff])          : 50;
    const trend      = iTrend >= 0 ? String(row[iTrend]).split(",").map(Number) : [];
    return { keyword, volume, difficulty, trend, score: opportunityScore(volume, difficulty) };
  }).filter(k => k.keyword && k.volume > 0);
}

// ── Draft frontmatter patch ────────────────────────────────────────────────

function setFrontmatterKey(raw, key, value) {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) return raw;
  const block = fm[1];
  const escaped = value.replace(/"/g, '\\"');
  const newLine  = `${key}: "${escaped}"`;
  if (new RegExp(`^${key}:`, "m").test(block)) {
    // Use a function replacement so $-chars in `escaped` are never treated as backreferences
    return raw.replace(
      new RegExp(`^(${key}:\\s*).*$`, "m"),
      () => newLine
    );
  }
  // Append key before closing --- using a function replacement for the same reason
  const newBlock = `---\n${block}\n${newLine}\n---\n`;
  return raw.replace(/^---\n([\s\S]*?)\n---\n/, () => newBlock);
}

// ── WP REST patch ─────────────────────────────────────────────────────────

async function patchWpMeta(slug, focusKw, relatedKws) {
  const BASE = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const AUTH = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");

  if (!BASE) { console.warn("  WP_BASE_URL not set — skipping WP meta patch"); return; }

  const r = await fetch(`${BASE}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=any`, {
    headers: { Authorization: AUTH },
  });
  const posts = await r.json();
  if (!Array.isArray(posts) || !posts.length) { console.warn(`  No WP post found for slug: ${slug}`); return; }

  const id = posts[0].id;
  const patch = await fetch(`${BASE}/wp-json/wp/v2/posts/${id}`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_focuskw:          focusKw,
        _yoast_wpseo_related_focuskws: relatedKws.map(k => ({ keyword: k, score: "" })),
      },
    }),
  });
  if (!patch.ok) throw new Error(`WP meta patch ${patch.status}: ${await patch.text()}`);
  console.log(`  ✓ WP post ${id} meta updated`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nResearching: "${SEED}"\n`);

  // 1. Fetch related keyphrases from Yoast/Semrush
  const [relatedData, seedData] = await Promise.all([
    fetchRelated(SEED).catch(e => { console.warn("Related fetch failed:", e.message); return null; }),
    fetchKeywordData(SEED).catch(e => { console.warn("Keyword data fetch failed:", e.message); return null; }),
  ]);

  // 2. Parse + score
  const related = relatedData ? parseKeywords(relatedData) : [];
  const seedKws  = seedData   ? parseKeywords(seedData)    : [];

  // Combine seed keyword data + related
  const allKws = [
    ...seedKws.map(k => ({ ...k, isSeed: true })),
    ...related,
  ].filter(k => k.keyword && k.volume > 0);

  // Deduplicate by keyword
  const seen = new Set();
  const unique = allKws.filter(k => {
    if (seen.has(k.keyword.toLowerCase())) return false;
    seen.add(k.keyword.toLowerCase());
    return true;
  });

  // Sort by opportunity score
  unique.sort((a, b) => b.score - a.score);

  // 3. Display results
  console.log("Rank  Score  Vol    Diff  Intent  Keyword");
  console.log("─────────────────────────────────────────────────────────────");
  unique.slice(0, 15).forEach((k, i) => {
    const diff = k.difficulty != null ? String(k.difficulty).padStart(3) : " ??";
    console.log(
      `${String(i + 1).padStart(4)}  ${String(k.score).padStart(5)}  ${String(k.volume).padStart(5)}  ${diff}%  ${(k.intent ?? "?").padEnd(6)}  ${k.keyword}`
    );
  });

  if (!unique.length) {
    console.log("  No keyword data returned. Check YOAST_API_KEY and try again.");
    return;
  }

  // 4. Focus keyphrase = the SEED itself (user's intent); related = everything else by score.
  // Never auto-select a different keyword as focus — the seed is what the article is targeting.
  const focus    = SEED;
  const related4 = unique
    .filter(k => k.keyword.toLowerCase() !== SEED.toLowerCase())
    .slice(0, 4)
    .map(k => k.keyword);

  console.log(`\n✓ Focus keyphrase:    "${focus}"`);
  console.log(`  Related keyphrases: ${related4.map(k => `"${k}"`).join(", ")}`);

  if (!WRITE) {
    console.log("\nRun with --write to patch matching draft + WP post.");
    return;
  }

  // 5. Match drafts whose slug contains ALL meaningful seed words (3+ chars).
  //    Stops contamination of unrelated posts that share generic words like "cost".
  const files    = (await readdir(join(ROOT, "drafts"))).filter(f => f.endsWith(".md"));
  const seedWords = SEED.toLowerCase().split(/\s+/).filter(w => w.length >= 4);

  for (const file of files) {
    const slug      = basename(file, ".md").replace(/-/g, " ");
    const matches   = seedWords.filter(w => slug.includes(w));
    const matchRatio = matches.length / seedWords.length;

    // Require ≥70% of the meaningful seed words to appear in the slug
    if (matchRatio < 0.7) continue;

    const raw = await readFile(join(ROOT, "drafts", file), "utf8");
    console.log(`\nMatched draft: ${file}  (${matches.length}/${seedWords.length} words)`);

    let updated = raw;
    updated = setFrontmatterKey(updated, "focus_keyphrase", focus);
    updated = setFrontmatterKey(updated, "related_keyphrases", related4.join(", "));
    await writeFile(join(ROOT, "drafts", file), updated, "utf8");
    console.log(`  ✓ Draft frontmatter updated`);

    await patchWpMeta(basename(file, ".md"), focus, related4);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
