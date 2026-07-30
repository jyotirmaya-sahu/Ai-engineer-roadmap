# Branches

**What it is:** A branch is a separate line of work in Git — a safe copy of your project where you can build a feature without touching the stable version.

## Why it matters for an AI Engineer

You never build directly on the "good" version of the code. If you experiment with a new prompt strategy or a new model and it breaks everything, you do not want that mess in the version your team relies on. Branches let you try things in isolation. When the experiment works, you merge it in. When it fails, you throw the branch away and nothing is lost.

On a real team, everyone works on their own branches at the same time. The `main` branch stays deployable. This is how ten engineers touch one codebase without stepping on each other.

## The mental model

Think of `main` as the trunk of a tree. A branch grows off it. You make commits on your branch. Later you merge the branch back into the trunk. `main` only gets your work when you decide it is ready.

## Creating and switching branches

```bash
git branch                       # list branches; * marks current
git switch -c add-reranker       # create a branch AND switch to it
# older equivalent:
git checkout -b add-reranker
```

Now you are on `add-reranker`. Every commit you make lands here, not on `main`.

```bash
git switch main                  # go back to main
git switch add-reranker          # return to your feature
```

Use `switch` for moving between branches (it is the modern, clearer command). `checkout` still works and does the same thing plus more.

## The feature-branch workflow

This is the standard flow at almost every company:

```bash
git switch main
git pull                         # get the latest team code first
git switch -c fix-empty-context  # branch named after the task
# ... edit files, test ...
git add .
git commit -m "Guard against empty retrieval context"
# ... more commits as needed ...
```

One branch = one task. Name it clearly: `add-streaming`, `fix-token-limit`, `experiment-gpt5-eval`.

## Merging

When your feature works, bring it into `main`:

```bash
git switch main
git pull                         # make sure main is up to date
git merge add-reranker           # fold your branch into main
```

If nobody else touched the same lines, Git merges cleanly. Done.

## Conflicts — when Git needs your help

A **conflict** happens when your branch and `main` both changed the same lines. Git cannot guess which version wins, so it asks you.

```bash
git merge add-reranker
# CONFLICT (content): Merge conflict in retriever.py
```

Open the file. Git marks the clash:

```python
<<<<<<< HEAD
top_k = 5          # this is what's on main
=======
top_k = 8          # this is your branch's version
>>>>>>> add-reranker
```

Edit the file to what you actually want, delete the `<<<`, `===`, `>>>` marker lines, then:

```bash
git add retriever.py
git commit                       # completes the merge
```

Conflicts feel scary the first time. They are just Git asking a question. Read both sides, pick the right code, remove the markers.

## A real company example

A Dubai fintech's AI team ships an LLM fraud-explanation feature. One engineer is on `improve-prompt`, another on `add-caching`, a third on `fix-latency`. All three branch off `main` on Monday. Each works independently. As each feature passes review, it merges into `main`, which auto-deploys to staging. Because everyone stayed on their own branch, no one's half-finished work ever broke the shared version. That isolation is the whole point.

## Common mistakes and gotchas

- **Working directly on `main`.** Never do it. Always branch. `main` should stay clean and deployable.
- **Forgetting to `git pull` before branching.** You branch off old code, then hit avoidable conflicts later. Pull first.
- **Long-lived branches.** A branch alive for three weeks drifts far from `main` and merges painfully. Keep branches small and short. Merge often.
- **Switching branches with uncommitted changes.** Git may block you or carry the changes over unexpectedly. Commit or `git stash` first.
- **Panicking on conflicts.** They are normal. Do not delete the file or force-push over it. Just resolve the marked lines.

## Interview / practical tip

Say "one branch per task, branched off an up-to-date `main`, small and short-lived." If asked about conflicts, explain you open the file, read both sides, choose the correct result, remove the markers, then `add` and commit. Calmly explaining conflict resolution signals real hands-on experience — junior candidates usually freeze at that question.
