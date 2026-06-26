// content-guards.mjs — deterministic, judgement-free checks for the production-content
// defect classes the live audit (ACTION-PLAN.md) found shipped: leaked author/placeholder
// text, raw-slug H1s, and (opt-in) city copy-paste mismatches. These are regex/structural
// facts, not quality opinions, so they belong here — not in the probabilistic eval-judge.
//
// Pure functions only (no I/O): each returns an array of { rule, message, snippet }.
// Reused by scripts/check-content-guards.mjs (hook + CI) and orchestrator/lib/cms.mjs
// (live-write gate). Unit-tested in test/content-guards.test.mjs.

// Leaked editorial placeholders / default bylines. Each rule is a labelled regex so the
// violation message names exactly what tripped. Patterns are deliberately specific to
// avoid false positives on normal prose.
const PLACEHOLDER_RULES = [
  { rule: "human-edit-marker",  re: /\[?\s*HUMAN[ _-]?EDIT(?:[ _-]?REQUIRED)?/i,
    message: "leaked 'HUMAN EDIT' placeholder" },
  { rule: "insert-placeholder", re: /\[\s*insert\b[^\]]*\]/i,
    message: "leaked '[insert …]' placeholder" },
  { rule: "lorem-ipsum",        re: /\blorem ipsum\b/i,
    message: "Lorem ipsum filler text" },
  { rule: "editorial-team",     re: /\b(?:author\s*[:=]\s*["']?\s*|by\s+)editorial team\b/i,
    message: "generic 'Editorial Team' byline (named author required)" },
  { rule: "default-author",     re: /\bauthor\s*[:=]\s*["']?\s*master\b/i,
    message: "WordPress default 'master' author byline" },
  { rule: "todo-marker",        re: /\b(?:TODO|FIXME|TKTK)\b/,
    message: "unresolved TODO/FIXME/TKTK marker" },
];

// One short context window around a match, for a readable violation message.
function snippetOf(text, index, len) {
  const start = Math.max(0, index - 20);
  return text.slice(start, Math.min(text.length, index + len + 20)).replace(/\s+/g, " ").trim();
}

export function scanPlaceholders(text) {
  if (!text) return [];
  const out = [];
  for (const { rule, re, message } of PLACEHOLDER_RULES) {
    const m = re.exec(text);
    if (m) out.push({ rule, message, snippet: snippetOf(text, m.index, m[0].length) });
  }
  return out;
}

// Collect H1 texts from markdown (`# heading`) and HTML (`<h1>…</h1>`).
function h1Texts(text) {
  const out = [];
  const md = text.matchAll(/^#\s+(.+?)\s*#*\s*$/gm);
  for (const m of md) out.push(m[1].trim());
  const html = text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
  for (const m of html) out.push(m[1].replace(/<[^>]+>/g, "").trim());
  return out;
}

// A heading that is a raw URL slug — all-lowercase, hyphen-joined, 3+ segments, no spaces —
// is a production error (ACTION-PLAN C6: the hotel guide H1 was the literal slug).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+){2,}$/;

export function slugAsH1(text) {
  if (!text) return [];
  return h1Texts(text)
    .filter((h) => SLUG_RE.test(h))
    .map((h) => ({ rule: "slug-as-h1", message: "H1 is a raw URL slug, not a title", snippet: h }));
}

// Opt-in: a location page whose "in <City>" copy names a city other than the page's
// intended city is a copy-paste doorway error (ACTION-PLAN C2: San Antonio page read
// "…in Houston?"). Only runs when intendedCity is supplied — needs page context, so it is
// NOT part of the default aggregate below.
export function cityMismatch(text, intendedCity) {
  if (!text || !intendedCity) return [];
  const want = intendedCity.trim().toLowerCase();
  const out = [];
  for (const m of text.matchAll(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*\?/g)) {
    const named = m[1].trim();
    if (named.toLowerCase() !== want) {
      out.push({ rule: "city-mismatch",
        message: `heading names "${named}" but page targets "${intendedCity}"`,
        snippet: snippetOf(text, m.index, m[0].length) });
    }
  }
  return out;
}

// Default deterministic aggregate run by the hook + CI. cityMismatch is opt-in via opts.
export function runGuards(text, opts = {}) {
  const violations = [...scanPlaceholders(text), ...slugAsH1(text)];
  if (opts.intendedCity) violations.push(...cityMismatch(text, opts.intendedCity));
  return violations;
}
