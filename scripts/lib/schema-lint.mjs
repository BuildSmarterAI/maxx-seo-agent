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

// Fourth shipped syntax, found live in schema/*.jsonld this session: double-underscore-
// wrapped ALL-CAPS tokens the schema-generate skill emits for deferred author identity
// ("__AUTHOR_NAME__", "__HUMAN_VERIFY_AUTHOR_LINKEDIN_OR_BIO_URL__"). The content-guards
// HUMAN-EDIT rule needs the literal "EDIT", so the "__HUMAN_VERIFY_…" form slipped past
// every existing gate. Require an uppercase letter immediately after the leading "__" so
// lowercase dunders ("__init__") and bare "__"/"____" in real content never trip.
const UNDERSCORE_TOKEN_RE = /__[A-Z][A-Z0-9_]*__/g;

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
  for (const m of raw.matchAll(UNDERSCORE_TOKEN_RE)) {
    errors.push(`operator placeholder left in artifact: "${m[0]}"`);
  }
  for (const v of scanPlaceholders(raw)) {
    errors.push(`${v.message} — "${v.snippet}"`);
  }
  return errors;
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// @type → the properties an entity of that type must carry to be useful beyond bare
// @context/@type structure. Scoped to the entity types this repo's schema-generate emits at
// top level / in @graph (Article/FAQPage/BreadcrumbList/GeneralContractor); an unknown @type
// is left to the structure check alone. A structurally-valid Article with no headline, or a
// FAQPage with no mainEntity, is inert for rich results — this catches that class.
const REQUIRED_PROPS = {
  Article: ["headline"],
  FAQPage: ["mainEntity"],
  BreadcrumbList: ["itemListElement"],
  GeneralContractor: ["name", "address"],
};

// @type may be a string or an array of types in JSON-LD; normalize to an array.
function typeList(entity) {
  const t = entity["@type"];
  return Array.isArray(t) ? t : [t];
}

function requiredPropErrors(entity, label) {
  const errors = [];
  for (const type of typeList(entity)) {
    for (const prop of REQUIRED_PROPS[type] ?? []) {
      const v = entity[prop];
      // Absent, blank, or an empty array all count as missing — a zero-item mainEntity /
      // itemListElement is as inert for a rich result as a missing property.
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) {
        errors.push(`${label}: ${type} missing required property "${prop}"`);
      }
    }
  }
  return errors;
}

// @context may legitimately be an object or array (advanced JSON-LD) — only the string form
// is value-checked. A string @context that doesn't reference schema.org is almost always a
// typo ("htps://schema.org") here, since this repo emits schema.org vocabulary exclusively.
function contextValueError(ctx, label) {
  if (typeof ctx === "string" && !ctx.includes("schema.org")) {
    return [`${label}: "@context" does not reference schema.org ("${ctx}")`];
  }
  return [];
}

// One entity's structure errors. needContext=false for @graph members, which inherit the
// root @context. Beyond presence, it enforces @context value sanity and @type-required props.
function entityErrors(entity, label, needContext) {
  if (!isPlainObject(entity)) {
    return [`${label}: not a JSON object — JSON-LD requires an object (or array of objects)`];
  }
  const errors = [];
  if (needContext) {
    if (!entity["@context"]) errors.push(`${label}: missing "@context"`);
    else errors.push(...contextValueError(entity["@context"], label));
  }
  if (!entity["@type"]) errors.push(`${label}: missing "@type"`);
  else errors.push(...requiredPropErrors(entity, label));
  return errors;
}

// Two accepted shapes: an entity/array of entities (each needs @context + @type), or a
// single @graph wrapper ({ @context, @graph: [entities…] } — graph entities inherit the
// root @context, so they only need @type).
function jsonLdStructureErrors(parsed) {
  if (isPlainObject(parsed) && "@graph" in parsed) {
    const errors = [];
    if (!parsed["@context"]) errors.push('root entity: missing "@context"');
    else errors.push(...contextValueError(parsed["@context"], "root entity"));
    const graph = parsed["@graph"];
    if (!Array.isArray(graph) || graph.length === 0) {
      errors.push('"@graph" must be a non-empty array of entities');
      return errors;
    }
    graph.forEach((entity, i) => {
      errors.push(...entityErrors(entity, `@graph entity ${i + 1}`, false));
    });
    return errors;
  }

  if (Array.isArray(parsed) && parsed.length === 0) {
    return ["JSON-LD artifact is an empty array — no entities to emit"];
  }
  const entities = Array.isArray(parsed) ? parsed : [parsed];
  const errors = [];
  entities.forEach((entity, i) => {
    const label = Array.isArray(parsed) ? `entity ${i + 1}` : "root entity";
    errors.push(...entityErrors(entity, label, true));
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
