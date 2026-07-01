#!/usr/bin/env bash
# PostToolUse hook (matches Edit|Write). Logs an audit line and runs cheap validators.
# Non-zero exit surfaces a failure to the agent so it can self-correct.
set -uo pipefail
payload="$(cat)"
ts="$(date -u +%FT%TZ)"
file="$(printf '%s' "$payload" | grep -oE '"file_path"\s*:\s*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
echo "$ts edited ${file:-unknown}" >> .claude/seo-audit.log

# Validate JSON-LD if a schema file was touched
case "$file" in
  *.jsonld|*schema*.json)
    node scripts/validate-json.mjs "$file" \
      || { echo "Invalid JSON-LD in $file" >&2; exit 1; } ;;
esac

# Deterministic content guards on CONTENT artifacts only (drafts + html). Scoped tightly:
# the hook fires on every Edit/Write, so code/config files must pass through untouched.
case "$file" in
  drafts/*.md|*.html)
    node scripts/check-content-guards.mjs "$file" \
      || { echo "content-guards failed on $file" >&2; exit 1; } ;;
esac
exit 0
