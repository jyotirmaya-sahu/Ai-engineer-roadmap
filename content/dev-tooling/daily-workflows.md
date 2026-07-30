# Claude Code: Daily Workflows

**What it is:** Claude Code is an AI coding assistant that lives in your terminal, reads and edits your actual project files, runs commands, and works alongside you on a real codebase.

## Why it matters for an AI Engineer

AI Engineers build with AI and increasingly build using AI. Claude Code turns plain-English instructions into real edits across your project: it finds the right file, changes it, runs your tests, and reports back. It is not a chatbot you copy-paste from — it acts on your codebase directly. Being fluent with it makes you dramatically faster at exactly the work Dubai employers are hiring for: shipping LLM features, wiring pipelines, and fixing bugs. Knowing how to drive an agent well is itself a hot skill in 2026.

## Getting started

```bash
# Recommended in 2026 — native installer (auto-updates, no Node needed):
curl -fsSL https://claude.ai/install.sh | bash
# (macOS alternative: brew install --cask claude-code)
# Legacy fallback via npm: npm install -g @anthropic-ai/claude-code

cd my-project        # go INTO your project first
claude               # start Claude Code in this folder
```

Always start it from inside the project you want to work on. Claude Code uses your current folder as its workspace — it can see and edit files here, and nowhere it should not.

## The basic loop: ask, review, run

You type what you want in plain English. Claude reads relevant files, proposes edits, and asks before making changes it is unsure about. A typical session:

```
> Add a retry with exponential backoff to the OpenAI call in llm.py
```

Claude finds `llm.py`, shows you the diff, and applies it. Then:

```
> Now run the tests
```

Claude runs `pytest` and shows the output. If a test fails, you say:

```
> Fix the failing test
```

This is the core rhythm: describe a change, review what Claude did, run it, iterate. You stay in control — you read every diff before trusting it.

## Common things you will ask it to do

| You say | Claude does |
|---|---|
| "Explain what `retriever.py` does" | Reads the file and summarizes it |
| "Add a `/health` endpoint to the FastAPI app" | Edits the route file |
| "Run the tests and fix any failures" | Runs pytest, iterates on failures |
| "Why is this function returning None?" | Investigates and explains the bug |
| "Write a README for this project" | Creates `README.md` |
| "Commit this with a good message" | Stages and commits |

## Iterating on a codebase

The power is in the back-and-forth. You rarely get the perfect result on the first try, and that is fine.

```
> Build a script that embeds all PDFs in /docs and saves vectors to a local file
```

Claude writes it. You run it, hit an error, and just paste it back:

```
> It crashed with "file too large" on report.pdf — chunk the text first
```

Claude adjusts. This tight loop — small step, run, feedback, next step — is how real work gets done. Keep each request focused. One clear task at a time beats one giant vague dump.

## A real company example

An AI Engineer at a Dubai logistics firm needs to add caching to a slow LLM route-explanation service. She opens Claude Code in the repo and says "the LLM call in `explain.py` is slow and repeats identical requests — add a cache keyed on the input." Claude reads the file, adds an in-memory cache, and shows the diff. She asks it to run the tests; they pass. She asks it to write a test proving the cache hits on repeat inputs. Then "commit with a clear message." A change that would have taken an hour of context-switching is done in ten minutes — and she reviewed every step.

## Common mistakes and gotchas

- **Starting from the wrong folder.** Launch `claude` from your project root, or it cannot see your files.
- **Blindly trusting edits.** Always read the diff. Claude is fast, not infallible. You own the code.
- **Giant vague requests.** "Refactor everything" gives messy results. Break work into clear steps.
- **Not running the code.** Ask Claude to run tests and scripts after changes so you catch breakage immediately.
- **No version control.** Work inside a Git repo so you can undo anything with `git`.

## Interview / practical tip

If asked how you use AI tools day to day, describe the loop: give a focused instruction, review the diff, run tests, iterate. Stress that you review every change and keep work in Git so nothing is unrecoverable. Employers want engineers who use agents to move fast *and* stay in control — not people who paste AI output unchecked.
