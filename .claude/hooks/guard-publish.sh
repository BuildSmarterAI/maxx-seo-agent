#!/usr/bin/env bash
# PreToolUse hook (Bash). Tool input JSON on stdin. Exit 2 = DENY, exit 0 = allow.
#
# Two modes:
#  - INTERACTIVE (default): a lenient denylist — block only the human-gated destructive ops
#    (push to main, post delete, DELETE FROM, publish, force-push/hard-reset). Everything
#    else is allowed so a developer's own Claude Code session works normally.
#  - AUTONOMOUS (SEO_AGENT_GUARDED=1, set by orchestrator/run.mjs before query()): a strict
#    ALLOWLIST — reject any shell metacharacter/chaining, then permit ONLY a fixed set of
#    command shapes. This is the unattended agent's last Bash guard, so it FAILS CLOSED.
#
# The allowlist is tight because REC-1 moved every untrusted value off the command line
# (mem.mjs --file, cms-read.mjs): the agent only needs fixed-flag commands + file paths.
set -uo pipefail

deny() { echo "DENIED by guard-publish: $1" >&2; exit 2; }

payload="$(cat)"

# ---- INTERACTIVE: lenient denylist (preserves prior behavior; bare-301 over-block removed) ----
if [ "${SEO_AGENT_GUARDED:-}" != "1" ]; then
  echo "$payload" | grep -Eiq 'git[[:space:]]+push[^"]*\b(main|master)\b' && deny "push to main"
  echo "$payload" | grep -Eiq 'wp[[:space:]]+post[[:space:]]+delete|--publish[^a-z]|DELETE[[:space:]]+FROM' && deny "delete/publish is gated"
  echo "$payload" | grep -Eiq 'push[[:space:]]+--force|reset[[:space:]]+--hard[[:space:]]+origin' && deny "destructive git op"
  exit 0
fi

# ---- AUTONOMOUS: strict allowlist, fail-closed ----
trap 'echo "guard-publish: internal error -> deny" >&2; exit 2' ERR
command -v grep >/dev/null 2>&1 && command -v sed >/dev/null 2>&1 || deny "missing grep/sed"

# Extract the Bash command value. (\\.|[^"\\])* matches escaped chars OR non-quote chars, so
# an escaped quote inside the command does not end the match. `|| true` keeps a no-match from
# tripping the trap; the emptiness check is the fail-closed gate.
raw="$(printf '%s' "$payload" \
  | grep -oE '"command"[[:space:]]*:[[:space:]]*"(\\.|[^"\\])*"' \
  | head -1 \
  | sed -E 's/^"command"[[:space:]]*:[[:space:]]*"//; s/"$//' || true)"
[ -n "$raw" ] || deny "could not parse a command from the tool input"

# Hex/unicode escapes could hide metacharacters → deny outright (no legit command needs them).
case "$raw" in *'\u'*|*'\x'*) deny "escaped (\\u/\\x) sequence in command" ;; esac

# JSON-unescape so a hidden metacharacter is scanned as a literal.
cmd="$(printf '%s' "$raw" | sed -E 's/\\"/"/g; s/\\\//\//g; s/\\n/ /g; s/\\t/ /g; s/\\r/ /g; s/\\\\/\\/g')"

# 1) Reject shell metacharacters / chaining / substitution / redirection BEFORE allowlisting.
case "$cmd" in
  *';'*|*'|'*|*'&'*|*'$('*|*'`'*|*'>'*|*'<'*|*'('*|*')'*|*'{'*|*'}'*) deny "shell metacharacter/chaining" ;;
esac
printf '%s' "$cmd" | grep -q '[[:cntrl:]]' && deny "control character/newline in command"

# 2) Residual policy deny-net (redundant under the allowlist; belt-and-suspenders).
echo "$cmd" | grep -Eiq 'wp[[:space:]]+post[[:space:]]+delete'        && deny "wp post delete is gated"
echo "$cmd" | grep -Eiq 'DELETE[[:space:]]+FROM'                       && deny "DELETE FROM is gated"
echo "$cmd" | grep -Eiq 'git[[:space:]]+push[^"]*\b(main|master)\b'    && deny "push to main is gated"
echo "$cmd" | grep -Eiq 'push[[:space:]]+--force|reset[[:space:]]+--hard[[:space:]]+origin' && deny "destructive git op"

# 3) Allowlist of permitted command SHAPES (if/elif so a non-match never trips the ERR trap).
PATHRE='[A-Za-z0-9._/-]+'             # file path: no spaces/metachars (already rejected)
VAL='[A-Za-z0-9:._/?=%~@-]+'          # flag value (e.g. a URL): no spaces/metachars
if   printf '%s' "$cmd" | grep -Eq "^node scripts/mem\.mjs queue([[:space:]]+--limit[[:space:]]+[0-9]+)?$"; then :
elif printf '%s' "$cmd" | grep -Eq "^node scripts/mem\.mjs (apply|changeset|log)[[:space:]]+--file[[:space:]]+${PATHRE}$"; then :
elif printf '%s' "$cmd" | grep -Eq "^node scripts/mem\.mjs status[[:space:]]+--id[[:space:]]+[0-9]+[[:space:]]+--to[[:space:]]+(done|escalated|in_progress)$"; then :
elif printf '%s' "$cmd" | grep -Eq "^node scripts/cms-read\.mjs([[:space:]]+--[a-z-]+[[:space:]]+${VAL})+$"; then :
elif printf '%s' "$cmd" | grep -Eq "^node scripts/validate-json\.mjs[[:space:]]+${PATHRE}$"; then :
elif printf '%s' "$cmd" | grep -Eq "^npm run (validate:metadata|diff-size|build|judge)$"; then :
elif printf '%s' "$cmd" | grep -Eq "^git checkout -- ${PATHRE}$"; then :
else deny "command not in allowlist: ${cmd}"; fi

exit 0
