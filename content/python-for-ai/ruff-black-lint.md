# Ruff / Black lint

**The one-line idea:** A **formatter** (Black) auto-arranges your code to a consistent style, and a **linter** (Ruff) catches bugs and bad patterns before you run anything. Together they keep a codebase clean, consistent, and error-free with zero manual effort. Ruff now does *both*, extremely fast.

## Why this matters for an AI Engineer

You'll work on shared repos where ten people touch the same files. Without automated formatting, every diff is polluted by whitespace bickering ("should this be one line or two?") and code review wastes time on style instead of logic. Linting catches real bugs early — an unused import, a variable used before assignment, a shadowed name. Clean, linted code is table stakes on any professional team, and it's the first thing a reviewer notices about your portfolio projects. Sloppy formatting reads as junior.

## Formatter vs linter — two different jobs

| Tool type | Job | Example catch |
|---|---|---|
| **Formatter** | rewrites *layout* — spacing, line length, quotes, indentation | turns messy spacing into consistent style |
| **Linter** | flags *problems* — likely bugs, unused code, bad patterns | "you imported `os` but never used it" |

Black is the classic formatter; **Ruff** is a newer tool (written in Rust) that is both a linter *and* a formatter, and runs 10–100× faster than the older Python-based tools. In 2026, the common setup is simply "Ruff for everything."

## What formatting fixes

Take this messy but valid code:

```python
def  greet( name,times = 3 ):
    return    name*times
x=[1,2,3,4]
```

Run the formatter and it becomes canonical, no decisions required:

```python
def greet(name, times=3):
    return name * times


x = [1, 2, 3, 4]
```

Same behavior, consistent style. The point: nobody *chooses* the style, so nobody argues. Every file in the repo looks like one author wrote it, and diffs show only real changes.

## What linting catches

```python
import os          # F401: imported but never used
import json

def parse(data):
    result = json.loads(data)
    return reslt   # F821: undefined name 'reslt' — a typo the linter catches!
```

The linter flags the unused `os` import and the typo `reslt` (you meant `result`) *before you run the code* — catching a bug that would otherwise crash at runtime, possibly in production.

## Using Ruff

```bash
pip install ruff

ruff check .            # lint: report problems in all files
ruff check . --fix      # lint AND auto-fix what it safely can
ruff format .           # format all files (the Black-style step)
```

Configure it once in `pyproject.toml` so the whole team shares settings:

```toml
[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I"]   # E=style errors, F=bugs, I=import sorting
```

`ruff check --fix` will even sort your imports and remove unused ones automatically.

## pre-commit — enforce it automatically

The best setup runs these *before every commit*, so unformatted or broken code can't enter the repo. The **pre-commit** framework does this via a git hook.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff          # lint (and auto-fix)
        args: [--fix]
      - id: ruff-format   # format
```

```bash
pip install pre-commit
pre-commit install       # sets up the git hook — now it runs on every `git commit`
```

Now `git commit` auto-formats and lints; if something's wrong, the commit is blocked until fixed. Style and lint compliance become automatic, not a thing anyone remembers to do. CI runs the same checks so nothing slips through.

## Why speed matters (why Ruff won)

Old tools (Black, Flake8, isort) each ran separately and slowly on big codebases — seconds to minutes. Ruff replaces all of them in one tool that runs in *milliseconds*, so it can run on every keystroke in your editor and every commit without you noticing. Fast enough to be invisible is what made teams actually adopt it.

## Real world: how a company uses this

> **A Dubai AI team** with six engineers on one LLM-service repo runs Ruff via pre-commit and in CI. Every commit is auto-formatted and linted, so pull-request diffs contain *only* meaningful changes — reviewers discuss logic and prompts, never whitespace. Ruff has caught undefined-variable typos and unused imports before they ever ran, including one where a refactor left a stale variable that would have crashed a nightly batch job. Because Ruff is near-instant, it runs on every save in their editors too, giving red squiggles in real time. Consistency and early bug-catching, for basically free.

## Common mistakes

- Not committing the config (`pyproject.toml`) — everyone formats differently and you get style churn anyway.
- Running the formatter manually and forgetting — set up pre-commit so it's automatic.
- Disabling every lint rule that complains instead of fixing the underlying issue (or thoughtfully ignoring a single line with `# noqa: <code>` and a reason).
- Mixing Black *and* Ruff-format with conflicting settings — pick one formatter (Ruff format is fine) to avoid fights.

## Interview tip

Say: *"I use Ruff for both linting and formatting — it replaces Black, Flake8, and isort in one fast tool — and wire it into pre-commit and CI so every commit is auto-formatted and lint-clean. That keeps diffs meaningful and catches bugs like unused imports and undefined names before runtime."* Knowing Ruff (not just Black) and *why* — one fast tool, enforced via pre-commit — signals you keep up with the current toolchain and care about team-scale code quality.
