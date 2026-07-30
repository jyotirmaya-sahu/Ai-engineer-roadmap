# venv & pip

**The one-line idea:** A **virtual environment** (`venv`) is a private, isolated Python setup for one project, and **pip** installs packages into it — so Project A's `openai==1.2` never clashes with Project B's `openai==2.0`.

## Why this matters for an AI Engineer

AI projects pull in heavy, fast-moving, version-sensitive packages: `openai`, `langchain`, `torch`, `numpy`, `pydantic`. Two projects will want *different* versions, and installing everything globally guarantees "it works on my machine but not in production." A venv per project keeps dependencies isolated and reproducible — the baseline hygiene every serious Python job expects. Skip it and you'll spend days on dependency hell instead of building.

## The problem: one global Python is a trap

Without venvs, `pip install` dumps every package into your *system* Python, shared by all projects. Then:

- Project A needs `pydantic 1.x`; Project B needs `pydantic 2.x`. You can only have one. One project breaks.
- You upgrade a package for one project and silently break three others.
- You can't tell which packages a given project actually needs.

A virtual environment gives each project its **own** folder of packages, isolated from the system and from other projects.

## Create and activate a venv

`venv` is built into Python — nothing to install.

```bash
# Create a venv (makes a .venv/ folder in your project)
python3 -m venv .venv

# Activate it (macOS / Linux)
source .venv/bin/activate

# Activate it (Windows PowerShell)
.venv\Scripts\Activate.ps1
```

Once activated, your shell prompt shows `(.venv)`. Now `python` and `pip` point *inside* this folder, not the system. To leave:

```bash
deactivate
```

Convention: name the folder `.venv` and add it to `.gitignore` — you never commit the venv itself (it's big and machine-specific), only the *list* of packages (next article).

## Installing packages with pip

```bash
pip install openai                 # latest version
pip install "openai==1.55.0"       # an exact version (pinned)
pip install "numpy>=1.26,<2.0"     # a version range
pip install openai httpx pydantic  # several at once
pip install --upgrade openai       # upgrade to latest
pip uninstall openai               # remove
pip list                           # what's installed here
pip show openai                    # details + dependencies of one package
```

Because the venv is active, these land *only* in this project. Another project's venv is untouched.

## Capturing dependencies: `pip freeze`

To share a project or deploy it, you need to record exactly what's installed. `pip freeze` prints every installed package with its exact version:

```bash
pip freeze > requirements.txt
```

That file (covered fully in the next article) lets anyone — or a production server — recreate your exact environment:

```bash
pip install -r requirements.txt
```

This is the reproducibility loop: `freeze` to record, `install -r` to recreate. Same versions everywhere = "works on my machine" becomes "works everywhere."

## A clean per-project workflow

```bash
python3 -m venv .venv              # 1. create isolated env
source .venv/bin/activate          # 2. activate it
pip install openai pydantic httpx  # 3. install what you need
pip freeze > requirements.txt      # 4. record it for others/deploy
# ... work ...
deactivate                         # 5. leave when done
```

Every new project starts with steps 1–2. That habit alone prevents most Python environment pain.

## Real world: how a company uses this

> **A Dubai AI consultancy** runs client projects side by side: one on `langchain 0.2` with an older `pydantic`, another on the latest `openai` SDK and `pydantic 2`. Each project has its own `.venv`, so upgrading one client's stack can't break another's. When code ships to their container, the Dockerfile just runs `pip install -r requirements.txt` into a fresh environment — the server gets byte-identical package versions to the developer's laptop, so a bug never appears in production that was invisible locally. Isolation locally + pinned installs in the container = zero "dependency drift."

## Common mistakes

- **Forgetting to activate** the venv — you `pip install` into the global Python and pollute everything. Check for `(.venv)` in your prompt.
- Committing the `.venv/` folder to git — huge, machine-specific, useless to others. Gitignore it; commit `requirements.txt` instead.
- Installing globally with `sudo pip install` — a classic way to corrupt your system Python.
- One giant shared venv for all projects — recreates the exact clash isolation was meant to prevent.
- Forgetting to run `pip freeze` after adding a package, so your `requirements.txt` drifts out of date.

## Interview tip

Say: *"Each project gets its own `.venv` so dependencies are isolated — different projects can use different versions without clashing. I `pip freeze > requirements.txt` to pin versions, gitignore the venv itself, and the deploy just runs `pip install -r requirements.txt` for a reproducible environment."* Framing it as *reproducibility and isolation* (not just "how to install packages") is the professional answer. (Bonus: mention that modern tools like `uv` do the same, much faster — see the next article.)
