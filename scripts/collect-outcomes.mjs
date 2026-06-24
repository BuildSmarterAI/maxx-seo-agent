#!/usr/bin/env node
// collect-outcomes.mjs — weekly snapshot of per-URL performance into `outcomes`.
// Primary source is GSC (clicks/impressions/position). Optional: a citations CSV
// (url,citations) via CITATIONS_CSV, and conversions via CONVERSIONS_CSV (url,conversions).
import { google } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { recordOutcomes } from "../orchestrator/lib/supabase.mjs";

const SITE = process.env.GSC_SITE_URL;
if (!SITE) throw new Error("Set GSC_SITE_URL");

const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function readCsv(path, metric) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").slice(1)
    .map((l) => l.split(","))
    .filter((c) => c[0] && c[1] !== undefined)
    .map(([url, v]) => ({ url: url.trim(), metric, value: Number(v) }));
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const sc = google.searchconsole({ version: "v1", auth });
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: { startDate: day(28), endDate: day(1), dimensions: ["page"], rowLimit: 5000 },
  });

  const rows = [];
  for (const r of data.rows ?? []) {
    const url = r.keys[0];
    rows.push({ url, metric: "clicks", value: r.clicks ?? 0 });
    rows.push({ url, metric: "impressions", value: r.impressions ?? 0 });
    rows.push({ url, metric: "position", value: r.position ?? null });
  }
  rows.push(...readCsv(process.env.CITATIONS_CSV, "citations"));
  rows.push(...readCsv(process.env.CONVERSIONS_CSV, "conversions"));

  await recordOutcomes(rows);
  console.log(`recorded ${rows.length} outcome rows (${(data.rows ?? []).length} URLs)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
