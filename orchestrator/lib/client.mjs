// client.mjs — the private Supabase client (service-role; server/CI only — never ship
// this key to a browser). Internal to the persistence layer: only supabase.mjs and
// cms.mjs import it. Scripts and the orchestrator reach data through the named helpers
// in supabase.mjs, never the raw client.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

export const db = createClient(url, key, { auth: { persistSession: false } });
