# Async

**What it is:** Async lets one Python process handle many requests at once by *not blocking* while it waits — so while one request waits 5 seconds for an LLM to answer, the same worker serves dozens of others.

## Why it matters for an AI Engineer

AI endpoints are almost never CPU-bound in your code — they're **waiting**: on an LLM API, a vector DB, an embedding call, an HTTP fetch. That waiting is dead time. Without async, each slow request holds a worker hostage and your API can serve maybe a handful of users at once. With async, one worker juggles hundreds. For LLM apps — where every call blocks for seconds — async isn't a nice-to-have; it's the difference between an API that scales and one that falls over at 10 concurrent users. This is *the* most common serving mistake, and interviewers probe it.

## The mechanism / how it works

Normal ("sync") code runs one line at a time and *blocks* on I/O — when you call the LLM, the whole thread stops and stares at the network until the answer comes back. Async code uses `async def` and `await`: at an `await`, the function says *"I'm waiting on I/O — go do other work and wake me when it's ready."* A single-threaded **event loop** cycles through all in-flight requests, running whichever one is ready. No request is faster, but the worker is never idle, so **throughput** soars.

The rule that trips everyone: **inside an `async def`, one blocking call freezes the whole event loop** — and thus *every* concurrent request. So you must `await` async libraries (`httpx`, `AsyncOpenAI`, async DB drivers), never call sync-blocking ones (`requests`, `time.sleep`, heavy CPU loops) directly. FastAPI has a safety valve: if you write a plain `def` handler (not `async def`), it runs it in a **thread pool** so it can't block the loop. So the safe rules are: **`async def` + `await` everywhere**, or **plain `def`** if you must use blocking libraries.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">req A<span class="sub">await LLM…</span></span>
    <span class="dbox orange">req B<span class="sub">await DB…</span></span>
    <span class="dbox orange">req C<span class="sub">await LLM…</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🔁 one event loop<span class="sub">runs whoever's ready</span></span>
  </div>
  <div class="dcap">While each request waits on I/O, the single worker serves the others — high throughput, no extra threads.</div>
</div>

## Concrete example

```python
# pip install "fastapi[standard]" openai httpx
from fastapi import FastAPI
from openai import AsyncOpenAI       # the ASYNC client — key detail

app = FastAPI()
client = AsyncOpenAI()

@app.post("/chat")
async def chat(message: str):
    # await hands control back to the loop while the LLM thinks
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": message}],
    )
    return {"reply": resp.choices[0].message.content}

# fan out to many models CONCURRENTLY, not one-after-another
import asyncio
@app.post("/ensemble")
async def ensemble(message: str):
    async def ask(m):
        r = await client.chat.completions.create(
            model=m, messages=[{"role": "user", "content": message}])
        return r.choices[0].message.content
    replies = await asyncio.gather(ask("gpt-4o-mini"), ask("gpt-4o"))
    return {"replies": replies}
```

The `/ensemble` case shows the payoff: `asyncio.gather` fires both LLM calls at once, so two 3-second calls finish in ~3s total, not 6.

## How a company uses this

A Dubai e-commerce support bot handles ~300 concurrent chat sessions at peak. Each `/chat` call waits ~4 seconds on the LLM. **Sync math:** with 4 workers and 4s per blocked request, you serve ~1 req/s — customers queue for minutes. **Async math:** each worker holds hundreds of awaiting requests cheaply, so those same 4 workers absorb the 300 concurrent sessions with latency staying near the model's own 4s, not ballooning from queueing. The one production bug they hit: a teammate dropped a synchronous `requests.get()` for a currency lookup inside an `async def` handler — it froze the event loop, and *every* concurrent chat stalled behind that one call until they swapped it for `httpx.AsyncClient`. Classic, and exactly what interviewers want you to know.

## Common mistakes

- **A blocking call inside `async def`** (`requests`, `time.sleep`, a sync DB driver, heavy CPU) — freezes all concurrent requests. Use async libs or move to a plain `def`.
- **Using the sync client** (`OpenAI` not `AsyncOpenAI`) in an async handler.
- **Thinking async makes one request faster** — it doesn't; it raises *throughput* (concurrency), not per-request speed.
- **`async def` with no `await`** — pointless; it just runs on the loop with zero benefit.

## Interview tip
Say: *"LLM endpoints are I/O-bound — they wait on the model — so I make handlers `async def` and `await` async clients like `AsyncOpenAI` and `httpx`. That lets one worker serve hundreds of concurrent waiting requests. The cardinal rule is never put a blocking call inside an async handler, because it stalls the whole event loop; if I must use a blocking library I fall back to a plain `def` so FastAPI runs it in a threadpool."* Nailing the "one blocking call freezes everything" point signals real experience.

See also: [Streaming responses](streaming-responses.md) (async's payoff for UX), [Uvicorn / Gunicorn](uvicorn-gunicorn.md) (workers × async).
