// scripts/check-entity-density.mjs
// Eval-gate guard: estimates named-entity density of candidate content and fails (exit 1)
// if it's below the topical-authority threshold. Deterministic + dependency-free so it can
// run on every PR without an API call.
//
// Top-3 ranking pages tend to carry several named entities per 1000 words; thin pages do not.
// Reads content from a file arg or stdin.
//
// Run: node --env-file=.env scripts/check-entity-density.mjs path/to/content.md
//   or: cat content.md | node scripts/check-entity-density.mjs
import { readFileSync } from "node:fs";

const MIN_DENSITY = Number(process.env.MIN_ENTITY_DENSITY || 4); // entities / 1000 words

function readInput() {
  const arg = process.argv[2];
  if (arg) return readFileSync(arg, "utf8");
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

// Heuristic entity extraction (no NLP dependency):
//  - multi-word Proper Noun sequences (e.g. "Maxx Builders", "Harris County")
//  - standalone capitalized tokens that aren't sentence-initial common words
//  - numbers with units / money / years (entities of measure: "$450", "2026", "120,000 sq ft")
function countEntities(text) {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")   // strip code blocks
    .replace(/[#>*_`]/g, " ")          // strip markdown
    .replace(/\[(.*?)\]\(.*?\)/g, "$1"); // keep link text, drop urls

  const entities = new Set();

  // proper-noun runs of 1-4 capitalized words
  for (const m of plain.matchAll(/\b([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){0,3})\b/g)) {
    const phrase = m[1].trim();
    // skip if it's just a single very common capitalized word at sentence start
    if (phrase.split(/\s+/).length === 1 && phrase.length < 4) continue;
    entities.add(phrase.toLowerCase());
  }
  // money, percentages, measured quantities, years
  for (const m of plain.matchAll(/\$[\d,]+(?:\.\d+)?|\b\d{4}\b|\b[\d,]+\s?(?:sq\s?ft|sf|square feet|%|psf)\b/gi)) {
    entities.add(m[0].toLowerCase());
  }

  const words = (plain.match(/\b[\w$%]+\b/g) || []).length;
  return { entities: entities.size, words };
}

const text = readInput();
if (!text.trim()) {
  console.error("[entity-density] no input content");
  process.exit(0); // nothing to gate
}

const { entities, words } = countEntities(text);
const density = words ? (entities / words) * 1000 : 0;

console.log(`[entity-density] words=${words} entities=${entities} density=${density.toFixed(1)}/1k (min ${MIN_DENSITY})`);

if (density < MIN_DENSITY) {
  console.error(`[entity-density] FAIL — below ${MIN_DENSITY}/1k. Enrich with named entities (places, products, partners, figures).`);
  process.exit(1);
}
console.log("[entity-density] PASS");
