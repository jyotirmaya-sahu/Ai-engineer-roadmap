# Multi-stage

**What it is:** A multi-stage build uses one Docker image to *build* your app and a separate, tiny image to *run* it — so all the heavy build tooling gets thrown away and only the final artifact ships.

## Why it matters for an AI Engineer

AI images bloat fast. Compilers, build tools, caches, and dev dependencies pile up and you end up shipping a 2GB image where 300MB would do. Big images mean slower deploys, slower cold starts on [ECS](ecs-app-runner.md) and [Lambda](lambda.md), higher registry storage bills, and a larger attack surface. Multi-stage builds are the standard fix — it's the difference between a professional image and an amateur one, and interviewers notice.

## How it works

A Dockerfile can contain **multiple `FROM` statements**. Each `FROM` starts a new **stage** with its own filesystem. The trick: do the messy work — installing compilers, building wheels — in an early "builder" stage, then in the final stage start from a clean slim base and **`COPY --from=builder`** only the finished artifacts you actually need to run.

Everything left behind in the builder stage — gcc, build caches, dev tools, intermediate files — never makes it into the final image. The runtime image contains just your app, its runtime dependencies, and a minimal OS.

Why this matters concretely: `pip install` for many AI libraries needs a C compiler and build headers *to install*, but not *to run*. So you install in the builder (which has the compiler), then copy the resulting site-packages into a slim runtime that has no compiler at all.

<div class="diagram">
  <div class="flow">
    <span class="dgroup"><span class="dgt">STAGE 1 · builder</span>
      <span class="dbox purple">gcc + build tools</span>
      <span class="darr">→</span>
      <span class="dbox orange">pip install → wheels</span>
    </span>
    <span class="darr">→<span class="lbl">COPY --from=builder</span></span>
    <span class="dgroup"><span class="dgt">STAGE 2 · runtime</span>
      <span class="dbox green">slim base + app only<span class="sub">~300MB</span></span>
    </span>
  </div>
  <div class="dcap">Build heavy, ship thin — the compiler stays in stage 1 and never reaches production.</div>
</div>

## Concrete example

```dockerfile
# ---- Stage 1: builder (has compilers) ----
FROM python:3.12 AS builder
WORKDIR /app
COPY requirements.txt .
# Build wheels into a folder using the full image's toolchain
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ---- Stage 2: runtime (slim, no compilers) ----
FROM python:3.12-slim
WORKDIR /app
# Bring only the prebuilt wheels over, then install offline
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

Result: the `python:3.12` builder is ~1GB, but the shipped `python:3.12-slim` runtime lands around **300–400MB** for a typical FastAPI + LLM-client app. Check it:

```bash
docker build -t my-ai-service .
docker images my-ai-service   # SIZE ~350MB instead of ~1GB
```

For GPU/PyTorch images the win is even bigger — build-time CUDA toolkits are enormous and don't belong at runtime.

## How a company uses this

A Dubai logistics firm cut its document-processing service image from **1.9GB to 380MB** with a multi-stage build. The payoff was concrete: ECS Fargate **cold starts dropped from ~40s to ~12s** (the platform pulls a smaller image faster), CI pushes to ECR got quicker, and monthly registry storage across dozens of tagged versions fell noticeably. The smaller image also passes security scans with fewer flagged packages, because the runtime no longer contains gcc and a pile of build-only libraries an attacker could exploit. Same code, same behavior — a third of the size.

## Common mistakes
- **Copying too much with `COPY --from`** — pull only the artifacts you need, not the whole builder filesystem.
- **Forgetting runtime system libs** — some packages need a shared `.so` at runtime; `apt-get install` those (only those) in the final stage.
- **Naming stages inconsistently** — use `AS builder` and reference the exact name.
- **Skipping it for GPU images** — that's exactly where multi-stage saves the most.

## Interview tip
Say: *"I use multi-stage builds: a full builder image compiles wheels, then I COPY only the built artifacts into a slim runtime with no compiler. It typically takes an AI image from ~2GB to ~350MB, which cuts cold-start time on Fargate, speeds deploys, and shrinks the attack surface."* Concrete before/after numbers land this point. Next: [Env & secrets](env-secrets.md).
