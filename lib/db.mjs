// lib/db.mjs — Supabase service client for the AI-search module.
// Self-contained (own client) so it never collides with orchestrator/lib/supabase.mjs.
// Requires Node 22+ (native WebSocket) and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("[db] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

export const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Resolve the site's own domain (no scheme, no www) from env.
// Priority: TARGET_DOMAIN > WP_BASE_URL > GSC_SITE_URL.
export function targetDomain() {
  const raw =
    process.env.TARGET_DOMAIN ||
    process.env.WP_BASE_URL ||
    (process.env.GSC_SITE_URL || "").replace(/^sc-domain:/, "");
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
}

// Domain comparison that ignores scheme + www.
export function sameDomain(u, domain) {
  if (!u || !domain) return false;
  try {
    const host = new URL(u.startsWith("http") ? u : `https://${u}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return u.toLowerCase().includes(domain);
  }
}
