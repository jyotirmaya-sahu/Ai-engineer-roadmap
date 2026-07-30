# Async serving

**The one-line idea:** Because LLM calls spend almost all their time *waiting on the network*, use async I/O so one process can juggle hundreds of in-flight requests at once — instead of one thread sitting idle, blocked, per request.

## Why it matters for an AI Engineer

LLM serving has a peculiar shape: each request takes 1–5 seconds, but during those seconds your server is doing *nothing* — just waiting for tokens to come back over the network. In a traditional **blocking** model, each request holds a whole thread hostage for that entire wait. With, say, 50 threads, request #51 must wait even though the CPU is 99% idle. That's a disaster for an LLM API where waits are long. **Async serving** flips it: while one request awaits the provider, the same thread picks up and progresses others. One process can hold *thousands* of concurrent, mostly-waiting requests. For an AI Engineer this is the difference between a service that handles 10 QPS and one that handles 1,000 on the same box — and it's why FastAPI/`async` is the default for LLM backends.

## The mechanism — how it works

The core distinction is **CPU-bound vs I/O-bound work**:
- **CPU-bound** (crunching numbers) keeps the processor busy — async doesn't help; you need more cores/processes.
- **I/O-bound** (waiting on network/disk) leaves the CPU idle during the wait — async shines here. **LLM calls are almost pure I/O-bound wait.**

An async runtime (Python's `asyncio`) runs a single-threaded **event loop**. When your code hits `await` on a network call, it *yields* control back to the loop, which runs *other* ready tasks; when the awaited response arrives, the loop resumes your task. No thread is blocked during the wait. So concurrency is bounded by memory (each task is cheap) rather than by a thread pool.

Two rules make this real:
1. **Use async all the way down.** An async endpoint must use an *async* client (`AsyncOpenAI`, `httpx.AsyncClient`). A single blocking call inside the event loop (a sync HTTP call, `time.sleep`, a heavy CPU loop) **freezes the entire loop** — every concurrent request stalls. Push blocking/CPU work to a thread/process pool (`run_in_executor`).
2. **Scale processes for cores.** One event-loop process uses one core. To use an 8-core box, run multiple worker processes (Uvicorn/Gunicorn `--workers`), each with its own loop. Async handles *concurrency within* a worker; processes handle *parallelism across* cores.

<div class="diagram">
  <div class="flow v">
    <div class="dgroup"><span class="dgt">BLOCKING — 1 thread per wait</span>
      <div class="flow"><span class="dbox orange">req A ⏳ blocks thread</span><span class="dbox gray">req B waits its turn</span></div>
    </div>
    <div class="dgroup"><span class="dgt">ASYNC — 1 loop, many awaits</span>
      <div class="flow"><span class="dbox green">A awaits</span><span class="dbox green">B awaits</span><span class="dbox green">C awaits</span><span class="darr">→<span class="lbl">loop juggles all</span></span><span class="dbox yellow">✅✅✅</span></div>
    </div>
  </div>
  <div class="dcap">Blocking wastes a thread per idle wait; async lets one loop progress hundreds of waiting requests.</div>
</div>

## Concrete example

An async FastAPI endpoint that stays responsive under many concurrent slow calls:

```python
from fastapi import FastAPI
from openai import AsyncOpenAI
import asyncio

app = FastAPI()
client = AsyncOpenAI()          # async client — required inside async endpoints

@app.post("/chat")
async def chat(q: str):
    resp = await client.chat.completions.create(   # yields to the loop while waiting
        model="gpt-4o", timeout=4.0,
        messages=[{"role": "user", "content": q}])
    return {"answer": resp.choices[0].message.content}

# CPU-bound work must NOT run inline — it would freeze the loop:
def heavy_cpu(x):     # e.g. big local embedding / parse
    ...

@app.post("/embed")
async def embed(text: str):
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, heavy_cpu, text)  # offload to a thread
    return {"vector_len": len(result)}
```

Run it across cores in production:

```bash
uvicorn app:app --workers 4 --host 0.0.0.0 --port 8000   # 4 loops = 4 cores
```

## How a company uses this

A **Dubai SaaS** startup serves an AI writing assistant. Their v1 used a blocking Flask app with a 40-thread pool; at ~45 concurrent users (each holding a thread for a ~3 s generation) the 41st user queued, latency spiked, and they were scaling out expensive boxes just to add threads. Rewriting to **async FastAPI + AsyncOpenAI** let a *single* 4-worker instance hold **~800 concurrent** streaming requests on the same hardware, because idle waits no longer consumed threads — their cloud bill for the tier dropped ~60%. The one bug that bit them: a synchronous PDF-parsing call left inside an async route froze the whole loop under load (every request stalled together); moving it to `run_in_executor` fixed it. They now hold the rule "no blocking call in an async path" as a code-review checklist item.

## Common mistakes / misconceptions

- **Blocking call inside the event loop.** One sync HTTP call, `time.sleep`, or heavy CPU loop stalls *every* concurrent request. Use async clients; offload CPU work to an executor.
- **Thinking async adds parallelism for CPU work.** Async only helps I/O-bound waits. For CPU-bound work you need more processes/cores.
- **One worker on a multi-core box.** A single event loop uses one core — run multiple workers to use them all.
- **Mixing sync and async clients carelessly.** An async endpoint calling a *sync* SDK method blocks the loop. Match the client to the endpoint.
- **Assuming async = infinite scale.** You're still bounded by provider rate limits and memory — pair it with a [concurrency cap](concurrency-pooling.md).

## Interview tip
Say: *"LLM serving is I/O-bound — the request spends seconds just awaiting tokens — so async lets one event-loop process hold hundreds of concurrent requests instead of one blocked thread each. The cardinal rule is no blocking or CPU-heavy call inside the loop, or it freezes every request; I offload CPU work to an executor and run multiple Uvicorn workers to use all cores. Async gives concurrency within a worker; processes give parallelism across cores."* The I/O-bound framing plus the "one blocking call freezes the loop" gotcha is exactly what they're probing for.

See also: **[Concurrency & pooling](concurrency-pooling.md)** (bounding those async calls) and **[Streaming & first-token time](streaming-first-token-time.md)** (async is what holds many streams open at once).
