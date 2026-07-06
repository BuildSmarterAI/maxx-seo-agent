// test/git-delivery.test.mjs — covers the repo-mode delivery seam (git-delivery.mjs):
//   1. startBranch names + checks out a dated seo/auto branch
//   2. rollback runs `git reset --hard` then deletes the branch, and NEVER throws even
//      when git fails (it uses the swallowing shq — the "reset --hard on failure" path)
//   3. openPR short-circuits to { empty:true } and cleans up when nothing changed
//   4. openPR commits → pushes → opens a PR on the happy path
//   5. openPR propagates a push failure (delivery error, distinct from an agent error)
//
// The command executor is injected via makeExec(run), so no real git/gh runs and the
// real sh-throws / shq-swallows distinction stays under test.
//
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeExec, startBranch, rollback, openPR } from "../orchestrator/lib/git-delivery.mjs";

// Records every command; a `responses` map keys a command substring to a canned stdout
// string, or an Error to throw (simulating a non-zero git/gh exit). Unmatched → "".
function recorder(responses = {}) {
  const calls = [];
  const run = (cmd) => {
    calls.push(cmd);
    for (const [key, val] of Object.entries(responses)) {
      if (cmd.includes(key)) {
        if (val instanceof Error) throw val;
        return val;
      }
    }
    return "";
  };
  return { calls, exec: makeExec(run) };
}

test("startBranch checks the tree is clean, then creates and checks out a dated seo/auto branch", () => {
  const { calls, exec } = recorder(); // no responses → status returns "" (clean)
  const branch = startBranch(exec);
  assert.match(branch, /^seo\/auto-\d{4}-\d{2}-\d{2}-\d{1,5}$/);
  // `--untracked-files=all` is pinned deliberately (overrides a dev's status.showUntrackedFiles=no,
  // which would otherwise hide untracked WIP from the precondition — cross-review bypass finding).
  assert.deepEqual(calls, ["git status --porcelain --untracked-files=all", `git checkout -b ${branch}`]);
});

// A7: the orchestrator must NEVER run on top of a dev's uncommitted/untracked work — it would
// otherwise be swept into the auto-PR (openPR's `git add -A`) or wiped by rollback's
// `git reset --hard`. startBranch refuses (throws) on a dirty tree and never creates the branch.
test("startBranch refuses a dirty working tree and creates no branch (clean-tree precondition)", () => {
  const { calls, exec } = recorder({ "git status --porcelain": " M dev-wip.txt\n?? dev-notes.md" });
  assert.throws(() => startBranch(exec), /working tree|clean|commit or stash/i);
  assert.deepEqual(calls, ["git status --porcelain --untracked-files=all"]); // stopped BEFORE any checkout -b
  assert.ok(!calls.some((c) => c.includes("checkout -b")), "must not create a branch on a dirty tree");
});

// Untracked-only dirt (e.g. a dev's scratch files) is just as dangerous: `git add -A` would
// stage it into the auto-PR commit. porcelain reports it, so the precondition must catch it too.
test("startBranch refuses an untracked-only dirty tree", () => {
  const { exec } = recorder({ "git status --porcelain": "?? scratch.txt" });
  assert.throws(() => startBranch(exec), /working tree|clean|commit or stash/i);
});

test("rollback discards work with git reset --hard, then deletes the branch", () => {
  const { calls, exec } = recorder();
  rollback("seo/auto-x", exec);
  assert.deepEqual(calls, [
    "git reset --hard",
    "git checkout - && git branch -D seo/auto-x",
  ]);
});

test("rollback never throws even if git reset/checkout fail (swallowing shq)", () => {
  // Every command throws; rollback must still complete both steps and not propagate —
  // it runs on the failure path, so it can't itself blow up.
  const { calls, exec } = recorder({ git: new Error("fatal: not a git repository") });
  assert.doesNotThrow(() => rollback("seo/auto-x", exec));
  assert.equal(calls.length, 2); // both attempted despite the first failing
});

test("openPR returns { empty:true } and cleans up when there are no changes", () => {
  const { calls, exec } = recorder({ "git status --porcelain": "" });
  const res = openPR("seo/auto-x", "seo: msg", "seo-auto", exec);
  assert.deepEqual(res, { empty: true });
  assert.deepEqual(calls, [
    "git add -A",
    "git status --porcelain",
    "git checkout - && git branch -D seo/auto-x",
  ]);
  assert.ok(!calls.some((c) => c.includes("git commit")));
  assert.ok(!calls.some((c) => c.includes("git push")));
  assert.ok(!calls.some((c) => c.includes("gh pr create")));
});

test("openPR commits, pushes, and opens a PR when there are changes", () => {
  const { calls, exec } = recorder({
    "git status --porcelain": " M file.txt",
    "gh pr create": "https://github.com/o/r/pull/1",
  });
  const res = openPR("seo/auto-x", "seo: fixes", "seo-auto", exec);
  assert.deepEqual(res, { prUrl: "https://github.com/o/r/pull/1" });
  assert.deepEqual(calls, [
    "git add -A",
    "git status --porcelain",
    'git commit -m "seo: fixes"',
    "git push -u origin seo/auto-x",
    "gh pr create --fill --label seo-auto",
  ]);
});

test("openPR propagates a push failure so delivery errors surface distinctly", () => {
  const { calls, exec } = recorder({
    "git status --porcelain": " M file.txt",
    "git push": new Error("fatal: remote rejected"),
  });
  assert.throws(() => openPR("seo/auto-x", "seo: msg", "seo-auto", exec), /remote rejected/);
  assert.ok(calls.some((c) => c.includes("git push")));
  assert.ok(!calls.some((c) => c.includes("gh pr create"))); // never reached the PR step
});
