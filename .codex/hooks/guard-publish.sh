#!/usr/bin/env bash
# PreToolUse hook. Tool input arrives on stdin. Exit 2 = DENY the tool call.
# Blocks the agent from doing anything that must stay human-gated.
set -euo pipefail
payload="$(cat)"

deny() { echo "DENIED by guard-publish: $1" >&2; exit 2; }

# never push to main / master
echo "$payload" | grep -Eiq 'git[[:space:]]+push[^"]*\b(main|master)\b' && deny "push to main"
# never delete posts/pages or create redirects autonomously
echo "$payload" | grep -Eiq '(wp[[:space:]]+post[[:space:]]+delete|301|--publish[^a-z]|DELETE[[:space:]]+FROM)' && deny "delete/301/publish is gated"
# never force-push or hard-reset shared history
echo "$payload" | grep -Eiq 'push[[:space:]]+--force|reset[[:space:]]+--hard[[:space:]]+origin' && deny "destructive git op"

exit 0
