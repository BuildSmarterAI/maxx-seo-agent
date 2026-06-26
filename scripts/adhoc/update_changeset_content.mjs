import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const newVal = readFileSync("C:/dev/maxx-seo-agent/scripts/wh_new_content.html", "utf8");
const { error, data } = await db.from("change_set")
  .update({ new_value: newVal })
  .eq("url", "https://www.maxxbuilders.com/cost-per-square-foot-build-warehouse-texas/")
  .eq("field", "post_content")
  .eq("new_value", "PLACEHOLDER_PENDING_FULL_CONTENT");
if (error) { console.error("Error:", error.message); process.exit(1); }
console.log("Updated changeset with full HTML content, length:", newVal.length);