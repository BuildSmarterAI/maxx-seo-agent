// tasks.mjs — the canonical kit-task vocabulary. This is the SAME string space shared by
// work_queue.task, change_set.change_type, and the learned_patterns.change_type join key
// the learning loop reprioritizes on (see learning.mjs / CONTEXT.md). A change logged with
// a change_type outside this set — a CMS field name like "post_content", or a generic label
// like "metadata" — can never join back to a queue task, so it silently drops out of
// attribution. Keep this list in sync when adding a kit skill.
//
// Sources: the .claude/skills/ kit-skill dirs, plus the two live work_queue.task values
// (ai-info-page, restructure-for-citation) that are real tasks with no local skill dir.
export const KIT_TASKS = new Set([
  "ai-info-page",
  "blog-audit",
  "blog-ideas",
  "blog-write",
  "cwv-audit",
  "entity-authority",
  "faq-schema",
  "gsc-opportunity-mining",
  "internal-link-graph",
  "internal-linking",
  "local-page-plan",
  "metadata-generate",
  "programmatic-plan",
  "restructure-for-citation",
  "schema-generate",
  "seo-audit",
]);

// Write-boundary guard for change_type. null/undefined is allowed (an unattributed change:
// the not-null filter in appliedDecisions excludes it, so it never becomes an orphan
// pattern). Any other value MUST be a kit task. Returns the value so callers can inline it.
export function assertTaskType(changeType) {
  if (changeType == null) return changeType;
  if (!KIT_TASKS.has(changeType))
    throw new Error(
      `invalid change_type "${changeType}": must be a kit task (${[...KIT_TASKS].join(", ")}) or null`,
    );
  return changeType;
}
