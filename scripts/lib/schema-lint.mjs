// schema-lint.mjs — pure validation for JSON/JSON-LD artifacts (schema/*.jsonld and
// *schema*.json). Closes audit H2: syntax-only validation let OPERATOR_INSERT_* author
// placeholders ship inside a live schema artifact with no gate catching them.
//
// Shared by scripts/validate-json.mjs (CLI: post-validate hook + eval-gate CI) and
// packs/wordpress/publish-drafts.mjs (refuses to inline a bad artifact into a post).
// Dependency-free; reuses the content-guards placeholder ruleset read-only.
import { scanPlaceholders } from "../validators/content-guards.mjs";

// Operator-handoff placeholders shipped in TWO syntaxes, neither matched by the
// content-guards prose ruleset: bare tokens ("OPERATOR_INSERT_AUTHOR_NAME") and
// bracketed labels ("[OPERATOR INSERT: Author full name]"). Match the OPERATOR…INSERT
// stem (uppercase only — lowercase prose like "the operator inserts" must not trip).
// No trailing \b: the bare-token form continues with an underscore ("…INSERT_AUTHOR…"),
// which is a word character, so a boundary there would never match.
const OPERATOR_TOKEN_RE = /\bOPERATOR[ _-]?INSERT/g;

// Third shipped syntax: REPLACE-suffix markers on identifiers ("#author-REPLACE") and
// the common REPLACE_ME form. All-caps only, and anchored to a -/_ joint, so prose like
// "replace your roof" or a standalone capitalized "Replace" can never trip it.
const REPLACE_TOKEN_RE = /\w+[-_]REPLACE\b|\bREPLACE[-_]?ME\b/g;

function snippetAt(raw, index) {
  return raw.slice(index, index + 60).split(/["\]\n]/)[0].trim();
}

function placeholderErrors(raw) {
  const errors = [];
  for (const m of raw.matchAll(OPERATOR_TOKEN_RE)) {
    errors.push(`operator placeholder left in artifact: "${snippetAt(raw, m.index)}"`);
  }
  for (const m of raw.matchAll(REPLACE_TOKEN_RE)) {
    errors.push(`REPLACE marker left in artifact: "${m[0]}"`);
  }
  for (const v of scanPlaceholders(raw)) {
    errors.push(`${v.message} — "${v.snippet}"`);
  }
  return errors;
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Two accepted shapes: an entity/array of entities (each needs @context + @type), or a
// single @graph wrapper ({ @context, @graph: [entities…] } — graph entities inherit the
// root @context, so they only need @type).
function jsonLdStructureErrors(parsed) {
  if (isPlainObject(parsed) && "@graph" in parsed) {
    const errors = [];
    if (!parsed["@context"]) errors.push('root entity: missing "@context"');
    const graph = parsed["@graph"];
    if (!Array.isArray(graph) || graph.length === 0) {
      errors.push('"@graph" must be a non-empty array of entities');
      return errors;
    }
    graph.forEach((entity, i) => {
      if (!isPlainObject(entity)) errors.push(`@graph entity ${i + 1}: not a JSON object`);
      else if (!entity["@type"]) errors.push(`@graph entity ${i + 1}: missing "@type"`);
    });
    return errors;
  }

  const entities = Array.isArray(parsed) ? parsed : [parsed];
  if (Array.isArray(parsed) && parsed.length === 0) {
    return ["JSON-LD artifact is an empty array — no entities to emit"];
  }
  const errors = [];
  entities.forEach((entity, i) => {
    const label = Array.isArray(parsed) ? `entity ${i + 1}` : "root entity";
    if (!isPlainObject(entity)) {
      errors.push(`${label}: not a JSON object — JSON-LD requires an object (or array of objects)`);
      return;
    }
    if (!entity["@context"]) errors.push(`${label}: missing "@context"`);
    if (!entity["@type"]) errors.push(`${label}: missing "@type"`);
  });
  return errors;
}

// Returns an array of human-readable errors; empty = artifact is publishable.
// opts.jsonLd: also enforce JSON-LD structure (every top-level entity needs
// @context + @type). Placeholder scanning always runs, on the raw text, so
// tokens in keys and values are both caught.
export function lintSchemaArtifact(raw, { jsonLd = true } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return [`invalid JSON: ${e.message}`];
  }
  const errors = placeholderErrors(raw);
  if (jsonLd) errors.push(...jsonLdStructureErrors(parsed));
  return errors;
}
