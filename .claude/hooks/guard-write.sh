#!/usr/bin/env bash
# PreToolUse hook (Write|Edit). Tool input JSON on stdin. Exit 2 = DENY, exit 0 = allow.
#
# Only enforced for the AUTONOMOUS agent (SEO_AGENT_GUARDED=1, set by orchestrator/run.mjs).
# Interactive Claude Code sessions are unaffected (the human is the trust anchor) so this
# never blocks normal development.
#
# REC-1 grants the CMS seo-fixer the Write tool so it can materialize the changeset payload
# off the shell. Without scoping, a prompt-injected agent could overwrite its own guards
# (this hook, guard-publish.sh, settings.json), credentials (.env), source (*.mjs), or CI
# (.github/). This confines the autonomous agent's writes to the artifact directories and
# FAILS CLOSED on a parse failure.
set -uo pipefail

# Interactive / non-autonomous → no restriction.
[ "${SEO_AGENT_GUARDED:-}" = "1" ] || exit 0

trap 'echo "guard-write: internal error -> deny" >&2; exit 2' ERR
deny() { echo "DENIED by guard-write: $1" >&2; exit 2; }

payload="$(cat)"
file="$(printf '%s' "$payload" \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"(\\.|[^"\\])*"' \
  | head -1 \
  | sed -E 's/^"file_path"[[:space:]]*:[[:space:]]*"//; s/"$//' || true)"
[ -n "$file" ] || deny "could not parse file_path from the tool input"

# Normalize Windows backslashes to forward slashes for matching.
norm="$(printf '%s' "$file" | sed 's#\\\\#/#g; s#\\#/#g')"

case "$norm" in *..*) deny "path traversal (..) in $file" ;; esac

# Deny writes to guarded locations (checked before the allow list).
case "$norm" in
  *.claude/*|.env|.env.*|*/.env|*/.env.*|*.github/*|*sql/*|*/package.json|*/package-lock.json|package.json|package-lock.json|*.sh|*.mjs|*.cjs|*.js|*.yml|*.yaml|*.php)
    deny "write to protected path: $file" ;;
esac

# Allow only the legitimate artifact directories / files.
case "$norm" in
  change_set/*|*/change_set/*|output/*|*/output/*|drafts/*|*/drafts/*|schema/*|*/schema/*|metadata-changes.csv|*/metadata-changes.csv)
    exit 0 ;;
esac

deny "write outside the allowed artifact dirs (change_set/ output/ drafts/ schema/, metadata-changes.csv): $file"
