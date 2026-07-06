// scripts/lib/wp-content.mjs — the ONE shared draft→content pipeline for the WordPress
// packs. Before this, packs/wordpress/publish-drafts.mjs (hand-rolled renderer + a proper
// bold-label parser) and scripts/run_all_blog_changesets.mjs (marked + a YAML-only strip
// that no-ops on our bold-label drafts, leaking the header into the body) diverged — audit
// M2. Both now call parseDraft → stripInternalSections → renderMarkdown, so their output
// cannot drift. Pure and dependency-free EXCEPT renderMarkdown, which dynamic-imports
// `marked` on demand (so importing this module needs no node_modules — tests stay hermetic).

// Metadata caps (root CLAUDE.md: titles ≤ 60, descriptions ≤ 155). Defined here rather than
// imported so this branch has no cross-PR dependency.
export const TITLE_MAX = 60;
export const DESC_MAX = 155;

// Draft-internal sections stripped before publish. "Internal Links" was previously in this
// list and is deliberately NOT here (audit M1): those links are real on-page content.
export const DEFAULT_INTERNAL_SECTIONS = ["Human-Edit Checklist", "Sources", "Author and Date"];

// Parse a draft's frontmatter + body. Two supported shapes:
//   1) real YAML frontmatter (--- … ---) — kept for any YAML drafts
//   2) the repo's markdown bold-label convention: "# Heading" + "**Key (note):** value"
//      lines, the block ending at the first "---".
export function parseDraft(raw) {
  const yaml = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (yaml) {
    const labels = {};
    for (const line of yaml[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (key) labels[key] = val;
    }
    return { meta: metaFromLabels(labels, ""), body: yaml[2] };
  }

  const sepIdx = raw.search(/^\s*---\s*$/m);
  const head = sepIdx === -1 ? raw : raw.slice(0, sepIdx);
  let body = sepIdx === -1 ? raw : raw.slice(sepIdx).replace(/^\s*---\s*$/m, "");
  body = body.replace(/^\s+/, "");

  const labels = {};
  for (const m of head.matchAll(/^\*\*\s*([^:*()]+?)\s*(?:\([^)]*\))?\s*:\*\*\s*(.+?)\s*$/gm)) {
    labels[m[1].trim().toLowerCase()] = m[2].trim().replace(/^`|`$/g, "").replace(/^"|"$/g, "");
  }
  const h = head.match(/^#\s+(.+?)\s*$/m);
  return { meta: metaFromLabels(labels, h ? h[1].trim() : ""), body };
}

function metaFromLabels(labels, headingTitle) {
  return {
    title:           labels["title"] || headingTitle || "",   // heading fallback — never the slug
    description:     labels["meta description"] || labels["description"] || "",
    canonical:       labels["canonical"] || "",
    focus_keyphrase: labels["focus keyphrase"] || labels["focus"] || "",
  };
}

// Remove whole "## <heading>" sections (heading through the next "## " or end of doc).
export function stripInternalSections(md, sections = DEFAULT_INTERNAL_SECTIONS) {
  let out = md;
  for (const heading of sections) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\n## ${escaped}[\\s\\S]*?(?=\\n## |$)`), "").trim();
  }
  return out;
}

// M1: enforce metadata caps. Returns human-readable errors ([] = within limits).
export function capErrors(meta) {
  const errors = [];
  const title = (meta.title || "").trim();
  const desc = (meta.description || "").trim();
  if (title.length > TITLE_MAX) errors.push(`title is ${title.length} chars — exceeds ${TITLE_MAX}`);
  if (desc.length > DESC_MAX) errors.push(`description is ${desc.length} chars — exceeds ${DESC_MAX}`);
  return errors;
}

// The single composed step both scripts call: parse frontmatter, drop internal sections,
// return the resolved meta + publish-ready markdown (still markdown — render separately).
export function toCleanMarkdown(raw, { sections = DEFAULT_INTERNAL_SECTIONS } = {}) {
  const { meta, body } = parseDraft(raw);
  return { meta, markdown: stripInternalSections(body, sections) };
}

// The single render call site (audit M2: one renderer, not two). `marked` is a runtime dep
// (package.json) dynamic-imported so this module loads without node_modules.
export async function renderMarkdown(md) {
  const { marked } = await import("marked");
  return marked.parse(md);
}
