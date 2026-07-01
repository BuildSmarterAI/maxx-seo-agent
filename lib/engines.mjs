// lib/engines.mjs — adapters that query real answer engines and normalize the result.
// Each adapter returns:
//   { engine, answered, text, sources:[url], available }
// "available" is false when the relevant API key is absent (engine is skipped, not failed).
import { sameDomain } from "./db.mjs";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SERPAPI = "https://serpapi.com/search.json";

const CITATION_MODEL_CLAUDE = process.env.CITATION_MODEL_CLAUDE || "claude-haiku-4-5-20251001";
const CITATION_MODEL_OPENAI = process.env.CITATION_MODEL_OPENAI || "gpt-4o";
const CITATION_MODEL_PPLX = process.env.CITATION_MODEL_PPLX || "sonar";

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

// ---- Claude with the web_search tool ----
export async function askClaude(query) {
  if (!ANTHROPIC_KEY) return { engine: "claude", available: false };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CITATION_MODEL_CLAUDE,
        max_tokens: 1024,
        messages: [{ role: "user", content: query }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      }),
    });
    if (!res.ok) {
      return { engine: "claude", available: true, answered: false, error: `${res.status}` };
    }
    const data = await res.json();
    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const sources = [];
    for (const b of blocks) {
      // citations attached to text blocks
      if (Array.isArray(b.citations)) {
        for (const c of b.citations) if (c.url) sources.push(c.url);
      }
      // web_search_tool_result blocks carry the retrieved pages
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r.url) sources.push(r.url);
      }
    }
    return { engine: "claude", available: true, answered: true, text, sources: uniq(sources) };
  } catch (e) {
    return { engine: "claude", available: true, answered: false, error: String(e) };
  }
}

// ---- Perplexity sonar (returns a citations array natively) ----
export async function askPerplexity(query) {
  if (!PERPLEXITY_KEY) return { engine: "perplexity", available: false };
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${PERPLEXITY_KEY}`,
      },
      body: JSON.stringify({
        model: CITATION_MODEL_PPLX,
        messages: [{ role: "user", content: query }],
      }),
    });
    if (!res.ok) {
      return { engine: "perplexity", available: true, answered: false, error: `${res.status}` };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    // perplexity returns citations at top level (and/or search_results)
    const sources = uniq([
      ...(Array.isArray(data.citations) ? data.citations : []),
      ...((Array.isArray(data.search_results) ? data.search_results : []).map((s) => s.url)),
    ]);
    return { engine: "perplexity", available: true, answered: true, text, sources };
  } catch (e) {
    return { engine: "perplexity", available: true, answered: false, error: String(e) };
  }
}

// ---- OpenAI with web search (Responses API) ----
export async function askOpenAI(query) {
  if (!OPENAI_KEY) return { engine: "openai", available: false };
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: CITATION_MODEL_OPENAI,
        tools: [{ type: "web_search_preview" }],
        input: query,
      }),
    });
    if (!res.ok) {
      return { engine: "openai", available: true, answered: false, error: `${res.status}` };
    }
    const data = await res.json();
    let text = data.output_text || "";
    const sources = [];
    const out = Array.isArray(data.output) ? data.output : [];
    for (const item of out) {
      const content = Array.isArray(item.content) ? item.content : [];
      for (const c of content) {
        if (!text && typeof c.text === "string") text = c.text;
        if (Array.isArray(c.annotations)) {
          for (const a of c.annotations) if (a.url) sources.push(a.url);
        }
      }
    }
    return { engine: "openai", available: true, answered: true, text, sources: uniq(sources) };
  } catch (e) {
    return { engine: "openai", available: true, answered: false, error: String(e) };
  }
}

export const ALL_ENGINES = [askClaude, askPerplexity, askOpenAI];

// Pull cited source links out of a SerpApi `ai_overview` object.
function aioSources(ao) {
  const refs = Array.isArray(ao?.references) ? ao.references : [];
  return uniq(refs.map((r) => r && r.link).filter(Boolean));
}

// Flatten the AIO prose so scoreResult can detect a brand mention without a linked source.
function aioText(ao) {
  const blocks = Array.isArray(ao?.text_blocks) ? ao.text_blocks : [];
  return blocks.map((b) => b && b.snippet).filter(Boolean).join("\n");
}

// ---- Google AI Overview via SerpApi ----
// Captured through SerpApi's Google Search engine: the `ai_overview` block either rides on
// the same response (inline `references`), OR returns only a short-lived `page_token` that
// must be redeemed at the dedicated `google_ai_overview` engine, OR is absent/`error` when
// Google renders no AIO for the query. `present` distinguishes "AIO shown" from "call ok but
// no AIO" — the flicker signal the 3-sample majority vote (lib/citation-events.mjs) collapses.
// Deliberately NOT in ALL_ENGINES: it needs a multi-sample capture path, not one shot.
export async function askGoogleAIO(query) {
  if (!SERPAPI_KEY) return { engine: "google_aio", available: false };
  const absent = { engine: "google_aio", available: true, answered: true, present: false, text: "", sources: [] };
  try {
    const res = await fetch(`${SERPAPI}?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}`);
    if (!res.ok) return { engine: "google_aio", available: true, answered: false, error: `${res.status}` };
    const data = await res.json();
    let ao = data.ai_overview;

    if (!ao || ao.error) return absent; // no AIO block rendered for this query

    // Deferred AIO: redeem the page_token at the dedicated engine (token expires within ~1 min).
    if (ao.page_token && !Array.isArray(ao.references)) {
      const r2 = await fetch(`${SERPAPI}?engine=google_ai_overview&page_token=${encodeURIComponent(ao.page_token)}&api_key=${SERPAPI_KEY}`);
      if (!r2.ok) return { engine: "google_aio", available: true, answered: false, error: `token ${r2.status}` };
      ao = (await r2.json()).ai_overview || ao;
      if (!ao || ao.error) return absent;
    }

    return { engine: "google_aio", available: true, answered: true, present: true, text: aioText(ao), sources: aioSources(ao) };
  } catch (e) {
    return { engine: "google_aio", available: true, answered: false, error: String(e) };
  }
}

// Score one engine result against our domain + a competitor list.
export function scoreResult(result, domain, competitors = []) {
  const sources = result.sources || [];
  const text = (result.text || "").toLowerCase();

  const citedIndex = sources.findIndex((u) => sameDomain(u, domain));
  const cited = citedIndex !== -1;
  const position = cited ? citedIndex + 1 : null;

  // brand mention = the bare domain label appears in prose even without a linked source
  const brandLabel = domain.split(".")[0];
  const brandMentioned = brandLabel ? text.includes(brandLabel.toLowerCase()) : false;

  const competitorsCited = uniq(
    competitors.filter((c) => sources.some((u) => sameDomain(u, c)))
  );

  return { cited, position, brandMentioned, competitorsCited, sources };
}
