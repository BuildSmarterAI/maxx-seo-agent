// scripts/lib/metadata.mjs — shared, dependency-free helpers for turning
// metadata-changes.csv rows into validated change_set rows. Pure functions only
// (no I/O, no DB) so both the CLI validator (validate-metadata-csv.mjs) and the
// importer (import-metadata-csv.mjs) source the SAME rules, and both are unit-testable.
//
// Consumes the trimmed row objects produced by parseCsv() in ./csv.mjs.

const TITLE_MAX = 60;   // root CLAUDE.md metadata rule: titles ≤ 60 chars
const DESC_MAX = 155;   // root CLAUDE.md metadata rule: descriptions ≤ 155 chars

// Columns the importer/validator read. Callers may check header presence against this.
export const REQUIRED_COLUMNS = [
  "current_title", "new_title", "current_description", "new_description",
];

// Parse to a URL only if it is an absolute http(s) URL; otherwise null.
function parseHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

// Normalize for self-reference comparison: ignore scheme, leading www, trailing
// slash(es), and query/hash. `https://www.x.com/a/` and `https://x.com/a` match.
function normalizeUrl(u) {
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  return `${host}${path}`;
}

// Validate agent-generated metadata rows. Returns an array of human-readable error
// strings (empty = valid). Rows where the agent wrote neither a new_title nor a
// new_description are pre-existing/unchanged and skipped — matching the prior
// validate-metadata-csv semantics. Row numbers in messages are 1-based CSV line
// numbers (data row 0 → line 2, after the header).
export function validateMetadataRecords(rows) {
  const errors = [];
  const seenTitles = new Map(); // lowercased new_title → first CSV line it appeared on

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const newTitle = (row.new_title || "").trim();
    const newDesc = (row.new_description || "").trim();
    const curTitle = (row.current_title || "").trim();
    const curDesc = (row.current_description || "").trim();
    const canonical = (row.canonical || "").trim();
    const url = (row.url || "").trim();

    // Pre-existing row the agent didn't touch → not our concern. A canonical counts
    // as a touch: the importer stages it with always:true, so it must be validated
    // even when title/description are unchanged. The title/description rules below
    // are self-guarding (they no-op on empty values).
    if (!newTitle && !newDesc && !canonical) return;

    if (newTitle && newTitle === curTitle) {
      errors.push(`row ${line}: new_title unchanged from current ("${newTitle}")`);
    }
    if (newDesc && newDesc === curDesc) {
      errors.push(`row ${line}: new_description unchanged from current ("${newDesc}")`);
    }
    if (newTitle.length > TITLE_MAX) {
      errors.push(`row ${line}: new_title too long (${newTitle.length} chars > ${TITLE_MAX})`);
    }
    if (newDesc.length > DESC_MAX) {
      errors.push(`row ${line}: new_description too long (${newDesc.length} chars > ${DESC_MAX})`);
    }

    // Cross-row uniqueness: one page per title. A repeated new_title cannibalizes.
    if (newTitle) {
      const key = newTitle.toLowerCase();
      if (seenTitles.has(key)) {
        errors.push(`row ${line}: duplicate new_title also on row ${seenTitles.get(key)} ("${newTitle}")`);
      } else {
        seenTitles.set(key, line);
      }
    }

    // Canonical safety: if supplied it must be an absolute http(s) URL that
    // self-references this row's page. A self-referencing canonical is the documented
    // default; a cross-page canonical silently deindexes the page.
    if (canonical) {
      const canon = parseHttpUrl(canonical);
      if (!canon) {
        errors.push(`row ${line}: canonical is not an absolute http(s) URL ("${canonical}")`);
      } else if (url) {
        const target = parseHttpUrl(url);
        if (target && normalizeUrl(canon) !== normalizeUrl(target)) {
          errors.push(`row ${line}: canonical does not self-reference (canonical "${canonical}" ≠ url "${url}")`);
        }
      }
    }
  });

  return errors;
}

// Build a WordPress change_set row for the importer. Staged as `pending` so the
// ADR-005 human approval gate (pending → approved) is never skipped by a bulk import.
export function buildChangeSetRow({ page_id, url, field, base_value, new_value, batch }) {
  return {
    platform: "wordpress",
    page_id,
    url,
    field,
    base_value,
    new_value,
    status: "pending",
    batch,
  };
}
