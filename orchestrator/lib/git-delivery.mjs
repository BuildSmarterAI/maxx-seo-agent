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
//
// Clean-tree precondition (A7): refuse to start if the working tree carries ANY uncommitted
// or untracked change. The orchestrator would otherwise sweep a dev's in-progress work into
// the auto-PR (openPR's `git add -A`) or destroy it on the failure path (rollback's
// `git reset --hard`). Failing loudly here — before the branch exists — is the only point
// that can distinguish the dev's work from the agent's (everything the agent produces comes
// AFTER this check), so it is also what makes rollback's unqualified reset safe by construction.
// `--untracked-files=all` is REQUIRED, not cosmetic: a plain `git status --porcelain` honors a
// dev's global `status.showUntrackedFiles=no` config and would report untracked WIP as clean,
// letting `git add -A` sweep it into the PR — the command-line flag overrides that config.
// gitignored files (node_modules, .env, gcp.json) stay invisible either way, exactly as wanted.
export function startBranch(exec = defaultExec) {
  const dirty = exec.sh("git status --porcelain --untracked-files=all");
  if (dirty) {
    throw new Error(
      "startBranch: refusing to run on a dirty working tree — commit or stash your changes first. " +
      "The orchestrator would otherwise sweep them into an auto-PR (git add -A) or discard them " +
      `on rollback (git reset --hard). Uncommitted/untracked paths:\n${dirty}`
    );
  }
  const branch = `seo/auto-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-5)}`;
  exec.sh(`git checkout -b ${branch}`);
  return branch;
}

// Discard any work and delete the branch (used on failure or when nothing changed).
// The `git reset --hard` is intentionally unqualified: startBranch's clean-tree precondition
// guarantees the tree was clean when the branch began, so any TRACKED modification present now
// is the agent's own uncommitted output — exactly what rollback throws away. It cannot reach a
// dev's pre-existing changes, because the orchestrator refuses to start when any are present.
// (reset --hard does not remove files the agent newly created as untracked; those linger and,
// on a local rerun, would trip the next startBranch's precondition — moot in CI, fresh checkout.)
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
