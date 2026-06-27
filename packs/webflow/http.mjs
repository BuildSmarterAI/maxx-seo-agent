// packs/webflow/http.mjs — shared Webflow Data API v2 client. Throws on non-2xx.
// env: WEBFLOW_TOKEN
const TOKEN = process.env.WEBFLOW_TOKEN;
const API = "https://api.webflow.com/v2";
if (!TOKEN) throw new Error("Set WEBFLOW_TOKEN");

export async function wf(path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "accept-version": "2.0.0", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Webflow ${r.status}: ${await r.text()}`);
  return r.json();
}
