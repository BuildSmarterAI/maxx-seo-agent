// payload.mjs — the validation seam for FILE-based memory writes. mem.mjs reads a JSON
// payload from a file the agent wrote with the Write tool and validates it here, so no
// untrusted value (base_value, new_value, reason) is ever interpolated into a Bash
// command. These functions are PURE (only assertTaskType from tasks.mjs) → unit-testable
// without env or a DB. base_value/new_value pass through VERBATIM — never escaped or
// touched; the security guarantee is that they reach the parameterized supabase insert
// without ever transiting a shell.
import { assertTaskType } from "./tasks.mjs";

// The same supported-field set the CMS prompt and the WP/Webflow adapters accept.
const CHANGESET_FIELDS = new Set(["post_content", "title", "description", "canonical", "focus"]);
const RISK_CLASSES = new Set(["safe", "gated"]);

function reqStr(obj, key) {
  const v = obj?.[key];
  if (typeof v !== "string" || !v.trim())
    throw new Error(`payload: missing/invalid "${key}" (non-empty string required)`);
  return v;
}

// Pure. Returns the exact row insertChangeset(row) expects (orchestrator/lib/supabase.mjs).
export function parseChangesetPayload(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj))
    throw new Error("payload: changeset must be a JSON object");
  const field = reqStr(obj, "field");
  if (!CHANGESET_FIELDS.has(field))
    throw new Error(`payload: unsupported field "${field}" (allowed: ${[...CHANGESET_FIELDS].join(", ")})`);
  const change_type = assertTaskType(obj.change_type ?? null); // a kit task or null, else throws
  // Fail-closed default: an omitted risk_class must NOT silently become the permissive
  // "safe" value — that would let a future caller bypass classification just by leaving
  // the field out. Absence escalates (gated) instead of applying.
  const risk_class = obj.risk_class || "gated";
  if (!RISK_CLASSES.has(risk_class))
    throw new Error(`payload: invalid risk_class "${risk_class}" (must be safe or gated)`);
  return {
    platform:    obj.platform || process.env.SITE_PLATFORM || "wordpress",
    page_id:     obj.page_id ?? null,
    url:         reqStr(obj, "url"),
    field,
    base_value:  obj.base_value ?? null,
    new_value:   reqStr(obj, "new_value"),
    change_type,
    risk_class,
    status:      "pending",
  };
}

// Pure. Returns the row logDecision(row) expects (orchestrator/lib/supabase.mjs).
export function parseLogPayload(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj))
    throw new Error("payload: log must be a JSON object");
  const change_type = assertTaskType(obj.change_type ?? null);
  return {
    url:        obj.url ?? null,
    action:     reqStr(obj, "action"),
    risk_class: obj.risk_class || "safe",
    reason:     obj.reason ?? null,
    agent:      obj.agent || "orchestrator",
    pr_url:     obj.pr_url ?? null,
    change_type,
  };
}
