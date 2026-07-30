# Git Basics

**What it is:** Git is a tool that saves snapshots of your project over time, so you can track changes, undo mistakes, and share code.

## Why it matters for an AI Engineer

Every real job runs on Git. Your code, your notebooks, your prompt templates, your infra config — all of it lives in Git. When you build an AI project and want to show it to a Dubai employer, it lives on GitHub, which is Git in the cloud. If you cannot use Git, you cannot collaborate, and you cannot prove your work exists. It is the single most-used tool in your day. Learn it once, use it forever.

Git also saves you from disaster. Deleted a working RAG pipeline by accident? Git has last week's version. Broke your training script at 2am? Roll back in one command.

## The core idea: three areas

Git moves your changes through three places:

| Area | What it means |
|---|---|
| Working directory | Your actual files on disk, where you edit |
| Staging area (index) | Files you have marked as "ready to save" |
| Repository | The permanent saved history of commits |

You edit files (working directory), pick which ones to save (`git add` → staging), then save them as a snapshot (`git commit` → repository).

## Setup (once per machine)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Starting a repo

```bash
mkdir rag-chatbot
cd rag-chatbot
git init                 # turns this folder into a git repo
```

`git init` creates a hidden `.git` folder. That folder IS the repository — the whole history.

## The daily loop

```bash
git status               # what has changed? what is staged?
git add app.py           # stage one file
git add .                # stage everything changed
git commit -m "Add RAG retrieval function"
```

A **commit** is a saved snapshot with a message. Write clear messages in the present tense: "Add embedding cache", not "stuff".

## Seeing what happened

```bash
git log                        # full history, newest first
git log --oneline              # compact, one line per commit
git diff                       # changes NOT yet staged
git diff --staged              # changes staged but not committed
```

`git diff` is your friend before every commit. It shows exactly what you are about to save. Review it. Catch the debug `print()` you forgot to delete.

## .gitignore — keep junk out

Some files should never go into Git: secrets, huge model weights, caches, virtual environments. List them in a `.gitignore` file at the repo root.

```
# .gitignore
.env                 # secrets — NEVER commit
.venv/               # python virtual env
__pycache__/         # python cache
*.pkl                # pickled models can be huge
data/raw/            # large datasets
.DS_Store            # mac clutter
```

Git will then pretend these files do not exist. `git status` will not nag you about them.

## A real company example

An AI team in Dubai building a customer-support chatbot keeps everything in one Git repo: the prompt files, the FastAPI backend, the evaluation scripts. Each engineer works on their own copy. When someone improves the retrieval logic, they `git add` and `git commit`, and the message explains why. Six months later, when accuracy drops, they run `git log` on the retrieval file, find the exact commit that changed it, and see the reasoning. No guesswork. That history is worth more than the code itself.

## Common mistakes and gotchas

- **Committing secrets.** The number-one mistake. Add `.env` to `.gitignore` on day one. Once a key is committed, it lives in history forever even if you delete the file — rotate the key immediately.
- **Committing huge files.** Git is built for text, not 2GB model weights. It bloats the repo permanently. Ignore them or use Git LFS.
- **Giant vague commits.** "fixed things" with 40 changed files helps no one. Commit small, commit often, one logical change at a time.
- **Forgetting to `git add` before commit.** A commit only saves what is staged. New files you never `add`ed are not in the commit.
- **`git add .` blindly.** It can stage junk. Run `git status` first to see what `.` will grab.

## Interview / practical tip

If asked "walk me through your Git workflow," say: `git status` to see changes, `git diff` to review them, `git add` the specific files, `git commit` with a clear message. Mentioning that you review the diff before committing signals you are careful and do not commit secrets or debug code — exactly what a team lead wants to hear.
