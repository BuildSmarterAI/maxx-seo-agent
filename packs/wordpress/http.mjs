// packs/wordpress/http.mjs — shared WordPress REST client. Throws on non-2xx.
// BASE/AUTH are also exported for the post-vs-page resolve() probe, which needs
// non-throwing 404 behaviour and so calls fetch directly.
// env: WP_BASE_URL, WP_USER, WP_APP_PASSWORD
export const BASE = process.env.WP_BASE_URL?.replace(/\/$/, "");
if (!BASE) throw new Error("Set WP_BASE_URL (use a staging URL)");
if (!process.env.WP_USER || !process.env.WP_APP_PASSWORD) throw new Error("Set WP_USER and WP_APP_PASSWORD");
export const AUTH = "Basic " + Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64");

export async function wp(path, init = {}) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/${path}`, {
    ...init, headers: { Authorization: AUTH, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`WP ${r.status}: ${await r.text()}`);
  return r.json();
}
