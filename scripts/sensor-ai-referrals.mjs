// scripts/sensor-ai-referrals.mjs
// Segments GA4 traffic by AI-engine referrers (chatgpt.com, perplexity.ai, gemini, copilot, ...)
// and logs sessions + conversions. AI-referred traffic converts far higher than generic organic,
// so this tells the learning loop the REAL value of a citation, not just that it happened.
//
// Requires: GA4_PROPERTY_ID and a service account (GOOGLE_APPLICATION_CREDENTIALS / gcp.json)
// added to the GA4 property with Viewer access + Analytics Data API enabled.
// Gracefully no-ops if GA4_PROPERTY_ID is absent.
//
// Run: node --env-file=.env scripts/sensor-ai-referrals.mjs
import { GoogleAuth } from "google-auth-library";
import { db } from "../lib/db.mjs";

const PROPERTY = process.env.GA4_PROPERTY_ID;
if (!PROPERTY) {
  console.log("[ai-referrals] GA4_PROPERTY_ID not set — skipping (optional sensor).");
  process.exit(0);
}

const AI_SOURCES = (process.env.AI_REFERRER_DOMAINS ||
  "chatgpt.com,chat.openai.com,perplexity.ai,gemini.google.com,copilot.microsoft.com,claude.ai,bing.com/chat")
  .split(",").map((s) => s.trim()).filter(Boolean);

const DAYS = Number(process.env.AI_REFERRAL_WINDOW_DAYS || 30);

async function token() {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

async function run() {
  const accessToken = await token();
  const body = {
    dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "sessionSource" }, { name: "landingPagePlusQueryString" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    dimensionFilter: {
      filter: {
        fieldName: "sessionSource",
        inListFilter: { values: AI_SOURCES, caseSensitive: false },
      },
    },
    limit: 1000,
  };

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error(`[ai-referrals] GA4 API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  const rows = data.rows || [];
  const period = `${DAYS}d`;
  let totalSessions = 0, totalConv = 0;

  const referralRows = [];
  const outcomeRows = [];
  for (const r of rows) {
    const source = r.dimensionValues?.[0]?.value || "(unknown)";
    const url = r.dimensionValues?.[1]?.value || "/";
    const sessions = Number(r.metricValues?.[0]?.value || 0);
    const conversions = Number(r.metricValues?.[1]?.value || 0);
    totalSessions += sessions;
    totalConv += conversions;

    referralRows.push({ source, url, sessions, conversions, period });
    // Namespaced `ai_conversions` (not bare `conversions`) so it never collides with the
    // organic GA4 collector's `organic_conversions` on the shared free-text outcomes.metric.
    // NOTE: `url` here is landingPagePlusQueryString (a path), not a full URL — it is NOT yet
    // joinable to decision_log; kept for the ai_referrals value story until URLs are canonicalized.
    if (conversions > 0) outcomeRows.push({ url, metric: "ai_conversions", value: conversions });
  }

  // Never-swallow (A12): matches the guard already established for the outcomes insert in
  // the sibling sensor-ai-citations.mjs — a failed insert must be visible, not silent.
  if (referralRows.length) {
    const { error } = await db.from("ai_referrals").insert(referralRows);
    if (error) console.error(`[ai-referrals] ai_referrals insert FAILED — 0 of ${referralRows.length} rows logged: ${error.message}`);
  }
  if (outcomeRows.length) {
    const { error } = await db.from("outcomes").insert(outcomeRows);
    if (error) console.error(`[ai-referrals] outcomes insert FAILED — 0 of ${outcomeRows.length} outcomes logged: ${error.message}`);
  }

  console.log(`[ai-referrals] rows=${referralRows.length} sessions=${totalSessions} conversions=${totalConv} window=${DAYS}d`);
}

run().catch((e) => { console.error(e); process.exit(1); });
