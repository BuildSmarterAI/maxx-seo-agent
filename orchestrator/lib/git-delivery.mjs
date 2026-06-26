// git-delivery.mjs — the repo-mode delivery seam: branch, commit, push, PR, rollback.
// Isolated from run.mjs so a git/PR failure is handled separately from an agent
// failure, and the git plumbing lives in one place.
import { execSync } from "node:child_process";

const sh = (c) => execSync(c, { stdio: "pipe" }).toString().trim();
const shq = (c) => { try { return sh(c); } catch { return ""; } };

// Create and check out a dated work branch; returns its name.
export function startBranch() {
  const branch = `seo/auto-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-5)}`;
  sh(`git checkout -b ${branch}`);
  return branch;
}

// Discard any work and delete the branch (used on failure or when nothing changed).
export function rollback(branch) {
  shq("git reset --hard");
  shq(`git checkout - && git branch -D ${branch}`);
}

// Commit staged work, push the branch, open a PR.
// Returns { empty:true } when the agent produced no changes (branch is cleaned up),
// otherwise { prUrl }. Throws on a git/gh failure so the caller can handle delivery
// errors distinctly from agent errors.
export function openPR(branch, message, label) {
  sh("git add -A");
  if (!shq("git status --porcelain")) {
    sh(`git checkout - && git branch -D ${branch}`);
    return { empty: true };
  }
  sh(`git commit -m "${message}"`);
  sh(`git push -u origin ${branch}`);
  const prUrl = shq(`gh pr create --fill --label ${label}`);
  return { prUrl };
}
