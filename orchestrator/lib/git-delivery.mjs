// git-delivery.mjs — the repo-mode delivery seam: branch, commit, push, PR, rollback.
// Isolated from run.mjs so a git/PR failure is handled separately from an agent
// failure, and the git plumbing lives in one place.
import { execSync } from "node:child_process";

// The command executor, wrapped so the delivery seam is testable without running git.
// `sh` throws on a non-zero exit; `shq` swallows it (returns "") — callers depend on that
// distinction (rollback must never throw; a failed push must). Injecting the single
// low-level `run` keeps that real swallow logic under test instead of a re-implemented fake.
export function makeExec(run = (c) => execSync(c, { stdio: "pipe" }).toString().trim()) {
  const shq = (c) => { try { return run(c); } catch { return ""; } };
  return { sh: run, shq };
}
const defaultExec = makeExec();

// Create and check out a dated work branch; returns its name.
export function startBranch(exec = defaultExec) {
  const branch = `seo/auto-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-5)}`;
  exec.sh(`git checkout -b ${branch}`);
  return branch;
}

// Discard any work and delete the branch (used on failure or when nothing changed).
export function rollback(branch, exec = defaultExec) {
  exec.shq("git reset --hard");
  exec.shq(`git checkout - && git branch -D ${branch}`);
}

// Commit staged work, push the branch, open a PR.
// Returns { empty:true } when the agent produced no changes (branch is cleaned up),
// otherwise { prUrl }. Throws on a git/gh failure so the caller can handle delivery
// errors distinctly from agent errors.
export function openPR(branch, message, label, exec = defaultExec) {
  exec.sh("git add -A");
  if (!exec.shq("git status --porcelain")) {
    exec.sh(`git checkout - && git branch -D ${branch}`);
    return { empty: true };
  }
  exec.sh(`git commit -m "${message}"`);
  exec.sh(`git push -u origin ${branch}`);
  const prUrl = exec.shq(`gh pr create --fill --label ${label}`);
  return { prUrl };
}
