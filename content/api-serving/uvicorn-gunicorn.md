# Uvicorn / Gunicorn

**What it is:** FastAPI is just code — it can't listen on a network port by itself. **Uvicorn** is the server that actually runs it and speaks HTTP; **Gunicorn** is a manager that runs *several* Uvicorn workers so you use every CPU core and survive crashes.

## Why it matters for an AI Engineer

`fastapi dev` (which uses Uvicorn with auto-reload) is for your laptop only — single process, debug mode, unsafe for the internet. To deploy, you must know how to run the app *for real*: how many workers, why, and how they interact with async. This is the boundary between "runs on my machine" and "runs in production," and it's exactly the kind of ops detail a Dubai deployment-heavy role expects you to get right. Set workers wrong and you either waste money on idle cores or crash under load.

## The mechanism / how it works

**ASGI:** FastAPI is an ASGI *application* — a standard interface for async Python web apps. It needs an ASGI *server* to receive raw HTTP and call it. **Uvicorn** is that server: fast, async, the standard choice.

One Uvicorn process runs on **one CPU core**. Python's GIL means a single process can't use multiple cores for CPU work. So to use an 8-core box you run **multiple worker processes**. Two ways:

- **Gunicorn** as a process manager with the Uvicorn worker class — the long-standing production pattern. Gunicorn spawns N workers, restarts any that crash or hang, and handles graceful reloads.
- **Uvicorn's own `--workers N`** — simpler; Uvicorn now manages its own worker pool, enough for many deployments (and common inside containers where the orchestrator handles restarts).

**How many workers?** The old CPU-bound rule of thumb is `(2 × cores) + 1`. But **AI endpoints are I/O-bound** — each async worker already juggles hundreds of concurrent awaiting requests (see [Async](async.md)), so you don't need many workers to get concurrency; you mainly want *enough workers to cover all cores*. A common, sane start is **one worker per core** (e.g. 4 workers on a 4-core container), then tune by load-testing. Piling on workers wastes RAM (each loads the whole app + model) without adding throughput for I/O-bound work.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">Gunicorn<span class="sub">master / manager</span></span>
    <span class="darr">↓<span class="lbl">spawns + restarts</span></span>
  </div>
  <div class="flow">
    <span class="dbox orange">Uvicorn worker 1<span class="sub">core 1 · async loop</span></span>
    <span class="dbox orange">worker 2<span class="sub">core 2</span></span>
    <span class="dbox orange">worker 3<span class="sub">core 3</span></span>
    <span class="dbox orange">worker 4<span class="sub">core 4</span></span>
  </div>
  <div class="dcap">Each worker owns a core and runs its own async event loop; the manager keeps them alive.</div>
</div>

## Concrete example

```bash
# DEV — one process, auto-reload on code change. Laptop only.
fastapi dev main.py            # ≈ uvicorn main:app --reload

# PROD option A — Uvicorn manages its own workers
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# PROD option B — Gunicorn managing Uvicorn workers (classic pattern)
gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120                # LLM calls are slow — raise the kill timeout
```

`main:app` means "the object named `app` in `main.py`." The `--timeout 120` matters for AI: Gunicorn's default 30s would **kill a worker mid-generation** on a long LLM response.

## How a company uses this

A Dubai SaaS runs its FastAPI assistant on ECS Fargate tasks sized at 4 vCPU. Each container runs **4 Uvicorn workers** — one per vCPU — behind an Application Load Balancer, and **ECS itself handles restart-on-crash and horizontal scaling** (add more containers under load), so they use Uvicorn's built-in `--workers` and skip Gunicorn entirely. Two hard-won settings: they raised the request timeout to 120s so streaming LLM responses aren't killed, and they enabled **graceful shutdown** — on deploy, workers finish in-flight chats before exiting, so no user's message is dropped mid-answer. Cost note: because the workload is I/O-bound, they found going from 4 to 8 workers on the same 4-core box *didn't* raise throughput but doubled memory — proving the "match workers to cores, then scale containers" rule.

## Common mistakes

- **Running `--reload` / `fastapi dev` in production** — slow, single-process, insecure. Dev only.
- **Too many workers** — wastes RAM (each reloads the app/model) with no throughput gain for I/O-bound AI work.
- **Default 30s timeout** killing long LLM/streaming requests — raise it.
- **No graceful shutdown** — deploys cut off in-flight requests.
- **Adding workers to fix concurrency** when the real lever is async — one async worker already handles hundreds of waiting requests.

## Interview tip
Say: *"In prod I run FastAPI under Uvicorn workers — roughly one per core — either via Gunicorn with the Uvicorn worker class or Uvicorn's own `--workers`, and often let the orchestrator handle restarts and scaling instead of Gunicorn. Because AI endpoints are I/O-bound, I match workers to cores and scale out with more containers rather than piling on workers, and I raise the request timeout so long LLM generations aren't killed."* The "workers = cores, scale via async + containers" framing is exactly right.

See also: [Async](async.md) (why few workers suffice), [Streaming responses](streaming-responses.md) (why timeouts matter).
