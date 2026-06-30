// lib/classify.mjs — classify cited domains as competitor / reference / noise.
// Pure cores (buildClassifyPrompt, parseClassification, selectCompetitorDomains,
// normalizeDomain) are unit-tested; classifyDomains wraps one Haiku call around them.
// This is what lets the AI-search loop maintain its own competitor list — no hand-curated
// COMPETITOR_DOMAINS required. Each domain is classified ONCE (callers persist the result
// and never re-ask), so cost is bounded to newly-discovered domains.

const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL || "claude-haiku-4-5-20251001";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const LABELS = new Set(["competitor", "reference", "noise"]);

// Lowercase, strip scheme/www/path. Returns "" for falsy/garbage input.
export function normalizeDomain(d) {
  if (!d || typeof d !== "string") return "";
  const s = d.trim();
  if (!s) return "";
  try {
    const host = new URL(s.startsWith("http") ? s : `https://${s}`).hostname;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return s
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "")
      .toLowerCase();
  }
}

// Build the classification prompt. `items` = [{ domain, queries:[string] }].
export function buildClassifyPrompt(items, ownDomain) {
  const lines = (items || []).map((it) => {
    const q = (it.queries || []).slice(0, 3).join("; ");
    return `- ${it.domain}${q ? `  (cited answering: ${q})` : ""}`;
  });
  return [
    `Our website is ${ownDomain}, a business competing in this space.`,
    `AI answer engines cited the domains below when answering buyer questions.`,
    `Classify EACH domain as exactly one of:`,
    `- "competitor": a rival business a buyer could hire or choose instead of us`,
    `- "reference": data, media, directory, tooling, or info source — not a rival`,
    `- "noise": social network, forum, or search aggregator (reddit, facebook, google, etc.)`,
    ``,
    `Domains:`,
    ...lines,
    ``,
    `Return ONLY a JSON array, one object per domain, no prose:`,
    `[{"domain":"...","classification":"competitor|reference|noise","confidence":0.0-1.0,"rationale":"<=12 words"}]`,
  ].join("\n");
}

// Parse a model response into normalized rows. Tolerant of code fences / surrounding prose.
// Drops entries with no usable domain or an invalid label; clamps confidence to 0..1.
export function parseClassification(text) {
  if (!text || typeof text !== "string") return [];

  // Try candidates most-specific first, so a stray "[1]" in prose can't hijack the slice:
  //   1) the array-of-objects block  2) first '[' … last ']'  3) the whole string.
  const candidates = [];
  const m = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (m) candidates.push(m[0]);
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  candidates.push(text);

  let arr = null;
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) {
        arr = parsed;
        break;
      }
    } catch {
      // try the next candidate
    }
  }
  if (!arr) return [];

  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const domain = normalizeDomain(e.domain);
    if (!domain) continue;
    const classification = String(e.classification || "").trim().toLowerCase();
    if (!LABELS.has(classification)) continue;
    let confidence = Number(e.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.min(1, Math.max(0, confidence));
    const rationale = typeof e.rationale === "string" ? e.rationale : "";
    out.push({ domain, classification, confidence, rationale });
  }
  return out;
}

// Decide which domains count as rivals for citation-gap scoring:
//   classified 'competitor' AND (human-pinned OR confidence >= floor), plus the env override
//   list (always counted, treated as a manual pin). Returns a deduped, normalized domain array.
export function selectCompetitorDomains(tableRows, envList = [], minConfidence = 0.7) {
  const set = new Set();
  for (const r of tableRows || []) {
    if (!r || String(r.classification).toLowerCase() !== "competitor") continue;
    const isManual = String(r.source || "").toLowerCase() === "manual";
    const conf = Number(r.confidence);
    if (isManual || (Number.isFinite(conf) && conf >= minConfidence)) {
      const d = normalizeDomain(r.domain);
      if (d) set.add(d);
    }
  }
  for (const e of envList || []) {
    const d = normalizeDomain(e);
    if (d) set.add(d);
  }
  return [...set];
}

// Classify a batch of domains via one Haiku call. `items` = [{ domain, queries }].
// fetchImpl/apiKey/model are injectable for testing; the network path itself is not unit-tested.
export async function classifyDomains(
  items,
  { ownDomain, model = CLASSIFY_MODEL, apiKey = ANTHROPIC_KEY, fetchImpl = fetch } = {}
) {
  if (!items || !items.length) return [];
  if (!apiKey) throw new Error("classify: ANTHROPIC_API_KEY required");
  const prompt = buildClassifyPrompt(items, ownDomain);
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  // Status only — never echo the response body, it can carry request metadata (security rule).
  if (!res.ok) {
    throw new Error(`classify: anthropic ${res.status}`);
  }
  const data = await res.json();
  // A truncated response yields invalid JSON that parseClassification silently drops — surface it.
  if (data.stop_reason === "max_tokens") {
    console.error("[classify] response hit max_tokens — lower CLASSIFY_BATCH to avoid dropped domains");
  }
  const text = (Array.isArray(data.content) ? data.content : [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseClassification(text);
}
