# Pull Requests

**What it is:** A pull request (PR) is a formal proposal to merge your branch into another branch, where teammates review it before it goes in.

## Why it matters for an AI Engineer

Code does not go straight into the main branch on a real team. It goes through a pull request. Someone reads your changes, comments, maybe asks for fixes, and only then approves. This is how teams keep quality high and catch bugs before they hit production. As an AI Engineer you will open PRs for your prompt changes, your pipeline code, your evaluation scripts — and you will review other people's PRs too. Knowing the PR flow is table stakes for any team job in Dubai or anywhere.

PRs are also your portfolio. A hiring manager can look at your PRs on GitHub and see how you write code, how you explain it, and how you respond to feedback.

## Remotes and forks — where the code lives

- A **remote** is a copy of the repo hosted somewhere (usually GitHub), named `origin` by default.
- A **fork** is your own copy of someone else's repo under your account. You fork open-source projects you cannot push to directly.

For your own team repo, you clone it and push branches to `origin`. For an open-source project you do not own, you fork, then work in your fork.

## The full PR flow

```bash
# 1. Start from fresh main
git switch main
git pull

# 2. Make a feature branch
git switch -c add-answer-citations

# 3. Do the work, commit
git add .
git commit -m "Add source citations to LLM answers"

# 4. Push the branch to GitHub
git push -u origin add-answer-citations
```

The `-u` sets `origin/add-answer-citations` as the upstream, so next time you just `git push`.

After pushing, GitHub prints a link to open a PR. Or use the CLI:

```bash
gh pr create --title "Add answer citations" \
  --body "Attaches source doc IDs to each generated answer. Closes #42."
```

## What goes in a good PR

- **A clear title.** What does it do.
- **A description.** Why the change, what you tested, anything reviewers should watch for.
- **Small scope.** One focused change. A 40-file PR is unreviewable and will sit for days.
- **Linked issue.** `Closes #42` auto-closes the ticket when merged.

## Review — the heart of a PR

A reviewer reads your diff and can:
- Leave comments on specific lines ("this will crash if context is empty").
- Request changes (blocks the merge until you fix them).
- Approve (green light).

You respond by pushing more commits to the same branch. The PR updates automatically — no new PR needed. Once approved, someone clicks **Merge** and your branch folds into `main`.

```bash
# reviewer looks locally if needed
gh pr checkout 57      # check out PR #57's branch to test it
```

## CI checks — the robot reviewer

Most repos run **CI** (Continuous Integration) automatically on every PR. It runs your tests, linting, and type checks. You see a green check or a red X on the PR. If tests fail, fix them before anyone merges. This catches broken code before a human even looks.

## A real company example

At a Dubai e-commerce company, an AI Engineer improves the product-recommendation prompt. She branches, commits, and opens a PR. GitHub Actions runs the evaluation suite automatically and posts the new accuracy score right in the PR. A senior engineer comments that the new prompt might leak the system instructions and asks for a guard. She pushes a fix; CI goes green; he approves; it merges and deploys. Nothing reached production without a test run and a second pair of eyes. That is the safety net PRs give.

## Common mistakes and gotchas

- **Huge PRs.** The most common way to get ignored. Keep them small and focused.
- **Empty descriptions.** "Update code" tells the reviewer nothing. Explain the why and what you tested.
- **Pushing to `main` directly.** Defeats the whole purpose. Always branch and PR.
- **Ignoring red CI.** Merging over failing tests breaks the build for everyone. Fix it first.
- **Taking review comments personally.** Reviews critique the code, not you. Respond, fix, thank them.

## Interview / practical tip

Describe the loop end to end: branch → commit → push → open PR → CI runs → reviewer comments → you push fixes → approved → merged. Add that you keep PRs small so they get reviewed fast. If you have public PRs on GitHub where you clearly responded to feedback, mention them — it is direct proof you can work on a team, which is exactly what worries employers about a solo candidate.
