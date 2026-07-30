# pyproject / requirements

**The one-line idea:** These files record *what your project depends on* so anyone — a teammate, a server, future-you — can recreate the exact same environment. `requirements.txt` is the simple list; `pyproject.toml` is the modern, richer standard.

## Why this matters for an AI Engineer

"It works on my machine" is the enemy of shipping AI. A model call that works with `openai 1.55` might break on `2.0`; `pydantic 1` vs `2` is a famous breaking change. Pinning exact versions in these files makes your app **reproducible** — the container, the CI runner, and your laptop all install the same thing. Every deployable AI project has one of these files. Reviewers judge your professionalism by whether versions are pinned.

## `requirements.txt` — the simple list

A plain text file, one package per line, ideally with a pinned version:

```text
openai==1.55.0
pydantic==2.9.2
httpx==0.27.2
numpy==2.1.1
```

Install everything with one command:

```bash
pip install -r requirements.txt
```

You generate it from a working venv with `pip freeze > requirements.txt` (see the venv article). Simple, universal, understood by every tool.

## Pinning: the single most important habit

The `==` matters enormously. Three styles, very different safety:

```text
openai            # ANY version — a new release can break you overnight
openai>=1.50      # 1.50 or newer — still lets a breaking 2.0 sneak in
openai==1.55.0    # EXACTLY this — reproducible, safe
```

**Pin exact versions (`==`) for deployable apps.** Unpinned dependencies mean your app can break with no code change on your side, just because a package released a new version. Loose ranges are for libraries meant to be flexible; applications should pin. This is *the* reproducibility rule.

## `pyproject.toml` — the modern standard

`pyproject.toml` is the official, richer replacement. It holds not just dependencies but your project's *metadata* (name, version, Python requirement) and tool configuration (Ruff, pytest, etc.) — all in one file. TOML is a simple key-value format.

```toml
[project]
name = "visa-assistant"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "openai==1.55.0",
    "pydantic==2.9.2",
    "httpx==0.27.2",
]

# Optional extras — e.g. dev-only tools not needed in production
[project.optional-dependencies]
dev = ["pytest==8.3.3", "ruff==0.6.9"]

# Tools can be configured right here too — one file for everything
[tool.ruff]
line-length = 100
```

Install a project defined this way from its folder:

```bash
pip install .            # install the project + its dependencies
pip install ".[dev]"     # also install the dev extras
```

The big wins over `requirements.txt`: it separates real dependencies from *dev* dependencies (tests/linters you don't ship), carries metadata, and centralizes tool config so you don't have five little config files.

## The lockfile idea (why `uv`/Poetry exist)

There's a subtle gap: even if *you* pin `openai==1.55`, that package pulls in *its own* dependencies, which might not be pinned — so two installs can still differ slightly. A **lockfile** records the exact version of *every* package in the whole tree, including sub-dependencies, for perfect reproducibility.

Two popular tools produce lockfiles and manage all of the above:

- **`uv`** — an extremely fast (Rust-based) tool that's become the modern default in 2025–2026. It creates/uses `pyproject.toml`, writes a `uv.lock`, and installs in seconds.
- **Poetry** — an older, established tool with the same idea (`poetry.lock`).

You don't need to master them to start — plain `pip` + a pinned `requirements.txt` is completely fine for learning and small projects. But know the words: when someone says "we use `uv`" or "check the lockfile," they mean this exact-reproducibility layer on top of `pyproject.toml`. Typical `uv` commands look like `uv add openai` (adds + pins + locks) and `uv sync` (installs exactly the lockfile).

## Real world: how a company uses this

> **A Dubai startup** ships an LLM API in a Docker container. Their `pyproject.toml` pins every dependency and lists `pytest`/`ruff` under `dev` extras. A `uv.lock` freezes the *entire* dependency tree, so the CI test runner, the staging server, and production all install byte-identical packages — a `pydantic` point-release can never silently change behavior between environments. The Dockerfile installs only production deps (not the dev extras), keeping the image small. When a new engineer joins, `uv sync` reproduces the exact environment in seconds. That reproducibility is why they can deploy confidently on a Friday.

## Common mistakes

- **Not pinning versions** (`openai` instead of `openai==...`) in a deployable app — invites surprise breakage.
- Committing `requirements.txt` but forgetting to update it after `pip install`ing something new — deploy then fails on a missing package.
- Mixing dev tools (pytest, ruff) into the main dependencies that ship to production — bloats the image.
- Ignoring the lockfile concept and being confused when "same requirements.txt" still produces different sub-dependency versions.

## Interview tip

Say: *"I pin exact versions for reproducibility, keep dependencies in `pyproject.toml` with dev tools as optional extras, and use a lockfile — via `uv` these days — so every environment installs the identical full dependency tree. That kills 'works on my machine' bugs."* Naming `uv` and the *lockfile-pins-sub-dependencies-too* nuance signals you track the modern toolchain, not just `pip install`.
