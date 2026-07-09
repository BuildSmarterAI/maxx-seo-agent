#!/usr/bin/env node
// sensor-cwv.mjs — Core Web Vitals FIELD sensor. Queries the Chrome UX Report (CrUX) API for
// the p75 of INP / LCP / CLS per tracked URL (config/urls.txt) and enqueues a `cwv-audit` when
// a field metric breaches the CrUX-p75 thresholds. Field data is the true ranking signal; the
// lab canary in check-vitals.sh is a per-change floor, this is the 28-day field truth.
//
// Guards:
//   - No CRUX_API_KEY (or PAGESPEED_API_KEY with the Chrome UX Report API enabled on its
//     project) → the sensor no-ops (optional, dark until the key is set).
//   - CrUX has no data for a low-traffic URL (404) → treated as NO SIGNAL, never a regression.
//   - Field p75 lags ~28 days, so a URL whose cwv-audit was enqueued within CWV_COOLDOWN_DAYS
//     is suppressed — otherwise a just-fixed page still reads regressed and re-fires.
//
// Run: node --env-file=.env scripts/sensor-cwv.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hasRecentTask } from "../orchestrator/lib/supabase.mjs";
import { runSensor } from "../orchestrator/lib/sensor.mjs";

const CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

// CrUX-p75 thresholds (mobile), env-overridable — mirror check-vitals.sh's LCP/INP/CLS gates.
// Keyed by the CrUX API metric names.
const LIMITS = {
  interaction_to_next_paint: Number(process.env.CWV_INP_MAX_MS ?? 200),
  largest_contentful_paint:  Number(process.env.CWV_LCP_MAX_MS ?? 2500),
  cumulative_layout_shift:   Number(process.env.CWV_CLS_MAX ?? 0.1),
};
const LABEL = {
  interaction_to_next_paint: "INP",
  largest_contentful_paint:  "LCP",
  cumulative_layout_shift:   "CLS",
};

// Read the tracked-URL list: one URL per line, `#` comments and blank lines skipped. Net-new
// parser — no in-repo helper reads this file (sensor-indexation uses activeUrls() instead).
export function readUrls(path) {
  return readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
}

// Pure: given a CrUX queryRecord `record`, return the breached metrics. p75 arrives as a JSON
// STRING (notably CLS "0.05") so coerce with Number() before comparing. A metric absent from
// the record = no field data for it = no signal (skipped, never a false regression).
export function breaches(record) {
  const metrics = record?.metrics ?? {};
  const out = [];
  for (const key of Object.keys(LIMITS)) {
    const p75 = metrics[key]?.percentiles?.p75;
    if (p75 == null) continue;
    if (Number(p75) > LIMITS[key]) out.push({ metric: LABEL[key], p75: Number(p75), limit: LIMITS[key] });
  }
  return out;
}

export const cwvSensor = {
  name: "cwv",
  thresholds: {
    "cwv-regression": { task: "cwv-audit", priority: 4 },
  },

  // deps are injectable for tests (the harness calls fetch(env, thresholds) with no deps, so
  // production uses the real fetch/hasRecentTask/readUrls).
  async fetch(env, thresholds, deps = {}) {
    const { fetch: doFetch = fetch, recentTask = hasRecentTask, urls: readList = readUrls } = deps;
    const key = env.CRUX_API_KEY || env.PAGESPEED_API_KEY;
    if (!key) throw new Error("Set CRUX_API_KEY (or PAGESPEED_API_KEY with the Chrome UX Report API enabled)");

    const urls = readList(env.CWV_URLS_FILE || "config/urls.txt");
    const cooldownDays = Number(env.CWV_COOLDOWN_DAYS ?? 30);
    const items = [];

    for (const url of urls) {
      // Field-lag cooldown: a URL with a recent cwv-audit is suppressed so a lagging p75 can't
      // re-fire an already-actioned page.
      if (await recentTask(url, "cwv-audit", cooldownDays)) continue;

      let record;
      try {
        const res = await doFetch(`${CRUX_ENDPOINT}?key=${key}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, formFactor: "PHONE" }),
        });
        if (res.status === 404) continue;                       // no field data → no signal
        if (!res.ok) { console.warn(`cwv: CrUX ${res.status} for ${url}`); continue; }
        ({ record } = await res.json());
      } catch (e) {
        console.warn(`cwv: fetch failed for ${url}: ${e.message}`);
        continue;
      }

      const bad = breaches(record);
      if (bad.length) {
        console.log(`cwv regression: ${url} — ${bad.map((b) => `${b.metric} ${b.p75}>${b.limit}`).join(", ")}`);
        items.push({ url, signalType: "cwv-regression", value: bad.length });
      }
    }
    return items;
  },
};

// Guarded auto-run so tests can import readUrls/breaches/cwvSensor without executing.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.CRUX_API_KEY && !process.env.PAGESPEED_API_KEY) {
    console.log("[cwv] no CRUX_API_KEY/PAGESPEED_API_KEY set — skipping (optional sensor).");
  } else {
    const { error } = await runSensor(cwvSensor, process.env);
    if (error) process.exit(1);
  }
}
