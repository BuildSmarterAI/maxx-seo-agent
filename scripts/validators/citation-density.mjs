// citation-density.mjs — deterministic, judgement-free measurement of the on-page
// "citation-worthiness" markers that the peer-reviewed GEO study (Aggarwal et al.,
// "GEO: Generative Engine Optimization", KDD '24) found move AI-citation rates the most:
// adding statistics (+41%), quotations (+28%), and citing external sources (+30%). See
// AGENTIC-AI-SEO-RESEARCH.md for the evidence tiering.
//
// This is the citation-worthiness sibling of scripts/check-entity-density.mjs (which
// measures named-entity density only). Pure functions, no I/O, dependency-free so it can
// run on every PR without an API call — reused by scripts/check-citation-density.mjs
// (hook + CI). Unit-tested in test/citation-density.test.mjs.

export const DEFAULT_THRESHOLDS = {
  minStatsPer1k: Number(process.env.MIN_STATS_PER_1K || 3), // statistics / 1000 words
  minQuotes: Number(process.env.MIN_QUOTES || 1), // sourced quotations / document
  minCitations: Number(process.env.MIN_CITATIONS || 1), // outbound citations / document
  minWords: Number(process.env.MIN_CITATION_WORDS || 200), // below this, too short to gate
};

// Strip code fences + markdown decoration but KEEP $ and % (they are statistic markers),
// and keep link *text* while dropping the URL — same approach as check-entity-density.mjs.
function toPlain(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^[#>*_\-]+/gm, " ")
    .replace(/\[([^\]]*?)\]\([^)]*?\)/g, "$1");
}

// One combined, ordered alternation. Global scan is left-to-right and non-overlapping, so a
// span like "$120,000" is counted once (the money branch consumes it before the bare
// comma-number branch can). Money/percent/units precede the generic comma-number branch.
const STAT_RE = new RegExp(
  [
    /\$[\d,]+(?:\.\d+)?/, // money: $450, $1,200,000
    /\b\d+(?:\.\d+)?\s?%/, // percentages: 41%, 3.2 %
    /\b\d+(?:\.\d+)?x\b/, // multipliers: 3.2x, 5x
    /\b\d+\s+(?:in|out of)\s+\d+\b/, // "1 in 4", "3 out of 5"
    /\b[\d,]+\s?(?:sq\s?ft|sf|square feet|psf|acres?|units?|keys?|beds?|rooms?|stories|storeys|months?|weeks?|days?|years?|miles?|kwh|percent)\b/,
    /\b\d{1,3}(?:,\d{3})+\b/, // grouped thousands: 120,000
  ]
    .map((r) => r.source)
    .join("|"),
  "gi"
);

function countStatistics(plain) {
  return (plain.match(STAT_RE) || []).length;
}

// Sourced quotations: markdown block quotes (a `>` line) OR an inline "…" span of >=6 words
// (a quoted sentence, not a stray quoted term). Curly and straight quotes both handled.
function countQuotations(text) {
  let count = 0;
  // Block quotes — count contiguous blocks, not every wrapped line.
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  for (const line of lines) {
    const isQuote = /^\s{0,3}>\s?/.test(line);
    if (isQuote && !inBlock) count++;
    inBlock = isQuote;
  }
  // Inline quoted sentences (>= 6 words inside the quotes).
  for (const m of text.matchAll(/[“"]([^“”"]{0,600}?)[”"]/g)) {
    const words = (m[1].trim().match(/\b[\w']+\b/g) || []).length;
    if (words >= 6) count++;
  }
  return count;
}

function hostOf(url) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url);
  return m ? m[1].replace(/^www\./i, "").toLowerCase() : "";
}

// Outbound citations to an external source: markdown links, HTML anchors, and bare
// autolinks. Links to selfDomain (if supplied) are excluded so internal linking is not
// counted as sourcing — that is measured separately by link-graph.mjs.
function countCitations(text, selfDomain) {
  const self = (selfDomain || "").replace(/^www\./i, "").toLowerCase();
  const urls = new Set();
  for (const m of text.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi)) urls.add(m[1]);
  for (const m of text.matchAll(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["']/gi)) urls.add(m[1]);
  for (const m of text.matchAll(/<(https?:\/\/[^>\s]+)>/gi)) urls.add(m[1]);
  let count = 0;
  for (const url of urls) {
    const host = hostOf(url);
    if (!host) continue;
    if (self && (host === self || host.endsWith("." + self))) continue;
    count++;
  }
  return count;
}

// Full deterministic score for a document. selfDomain is optional (excludes self-links from
// the citation count). Returns raw counts + per-1000-word densities.
export function scoreCitationDensity(text, { selfDomain } = {}) {
  if (!text || !text.trim()) {
    return { words: 0, statistics: 0, quotations: 0, citations: 0, statsPer1k: 0, quotesPer1k: 0, citationsPer1k: 0 };
  }
  const plain = toPlain(text);
  const words = (plain.match(/\b[\w$%]+\b/g) || []).length;
  const statistics = countStatistics(plain);
  const quotations = countQuotations(text);
  const citations = countCitations(text, selfDomain);
  const per1k = (n) => (words ? (n / words) * 1000 : 0);
  return {
    words,
    statistics,
    quotations,
    citations,
    statsPer1k: per1k(statistics),
    quotesPer1k: per1k(quotations),
    citationsPer1k: per1k(citations),
  };
}

// Violations for the gate. Documents shorter than minWords are not gated (a stub or a
// metadata snippet, not an article) — returns [] just like check-entity-density.mjs skips
// empty input. Each violation is { rule, message, snippet } to match content-guards.mjs.
export function citationDensityViolations(text, thresholds = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const s = scoreCitationDensity(text, { selfDomain: thresholds.selfDomain });
  if (s.words < t.minWords) return [];
  const out = [];
  if (s.statsPer1k < t.minStatsPer1k) {
    out.push({
      rule: "statistic-density",
      message: `only ${s.statistics} statistic(s) (${s.statsPer1k.toFixed(1)}/1k, min ${t.minStatsPer1k}/1k) — add verifiable figures (costs, %, sq ft, ratios)`,
      snippet: `words=${s.words} statistics=${s.statistics}`,
    });
  }
  if (s.quotations < t.minQuotes) {
    out.push({
      rule: "quotation-count",
      message: `${s.quotations} sourced quotation(s) (min ${t.minQuotes}) — add a named-source quote or block quote`,
      snippet: `quotations=${s.quotations}`,
    });
  }
  if (s.citations < t.minCitations) {
    out.push({
      rule: "citation-count",
      message: `${s.citations} outbound source citation(s) (min ${t.minCitations}) — cite an external authoritative source`,
      snippet: `citations=${s.citations}`,
    });
  }
  return out;
}
