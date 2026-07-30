# Dockerfile

**What it is:** A plain-text recipe that tells Docker, step by step, how to build a self-contained image of your app.

## Why it matters for an AI Engineer

The Dockerfile is where deployment starts. Your FastAPI-wrapped LLM service, your RAG API, your agent worker — each ships as an image, and that image is defined by a Dockerfile. Get it right and your app runs identically everywhere. Get it wrong and you get 2GB bloated images, 10-minute builds, or a container that crashes because a system library is missing. Since deployment is the #1 skill in Dubai JDs, the Dockerfile is the first concrete artifact an interviewer expects you to write from memory.

## How it works

A Dockerfile is a list of **instructions**, executed top to bottom. Each instruction creates a **layer** — a cached filesystem snapshot. The key instructions:

- **`FROM`** — the base image you build on (e.g. `python:3.12-slim`). This is your starting operating system + language runtime.
- **`WORKDIR`** — sets the working directory inside the container.
- **`COPY`** — copies files from your project into the image.
- **`RUN`** — executes a command *at build time* (installing packages, compiling). Its result is baked into a layer.
- **`ENV`** — sets an environment variable.
- **`EXPOSE`** — documents which port the app listens on.
- **`CMD`** / **`ENTRYPOINT`** — the command that runs *when the container starts* (not at build time).

The single most important trick: **order instructions from least-changing to most-changing.** Docker caches each layer and reuses it if nothing above changed. Your dependencies change rarely; your code changes constantly. So copy `requirements.txt` and install *before* copying your code. That way editing a Python file doesn't trigger a full re-install — the dependency layer stays cached and the build takes seconds instead of minutes.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">FROM python:3.12-slim<span class="sub">base layer</span></span>
    <span class="darr">↓</span>
    <span class="dbox blue">COPY requirements.txt + RUN pip install<span class="sub">cached — deps rarely change</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">COPY . .<span class="sub">rebuilt often — code changes</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">CMD uvicorn ...<span class="sub">runs at container start</span></span>
  </div>
  <div class="dcap">Least-changing on top, most-changing at the bottom, so the cache does the heavy lifting.</div>
</div>

## Concrete example

A production-shaped Dockerfile for a FastAPI AI service:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Deps first — this layer is cached until requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code second — changing app.py won't re-run pip install
COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run it:

```bash
docker build -t my-ai-service .
docker run -p 8000:8000 --env-file .env my-ai-service
```

`--host 0.0.0.0` is essential: bind to `127.0.0.1` and the app is unreachable from outside the container (a classic "why can't I hit my API?" bug). Pair the Dockerfile with a `.dockerignore` (listing `.git`, `.venv`, `__pycache__`) so junk isn't copied into the image and cache-busting the `COPY . .` layer.

## How a company uses this

A Dubai SaaS team keeps one Dockerfile per service in the repo. CI runs `docker build` on every merge to `main`. Because deps are cached separately from code, a typical code-only change rebuilds in ~15 seconds and produces a fresh image tagged with the git SHA, pushed to ECR. Pinning `python:3.12-slim` (not `python:latest`) means a rebuild six months later still produces the same runtime — no surprise breakage from an upstream version bump. That reproducibility is the whole point: the image built today and the one built next quarter behave the same.

## Common mistakes
- **`COPY . .` before installing deps** — kills the cache; every code edit reinstalls everything.
- **Using `python:latest` or `:3.12` (full)** — huge and non-reproducible; prefer `-slim`.
- **Binding to `127.0.0.1`** — app unreachable from outside the container.
- **Baking secrets in with `ENV API_KEY=...`** — they end up in the image layers forever. See [Env & secrets](env-secrets.md).
- **No `.dockerignore`** — bloats the image and breaks caching.

## Interview tip
Say: *"I order Dockerfile instructions least-changing-first — base, then requirements + pip install, then the code — so dependency layers stay cached and code changes rebuild in seconds. I pin a slim base for reproducibility, bind uvicorn to 0.0.0.0, and never bake secrets into layers."* That shows you understand layer caching, which is the thing juniors miss. Next: [Images](images.md).
