# Async / await

**The one-line idea:** `async`/`await` lets one program **wait on many slow things at once** — like 100 LLM API calls — instead of doing them one after another. While one call waits for the network, your code does other work.

## Why this matters for an AI Engineer

LLM calls are **I/O-bound**: your code isn't busy computing, it's *waiting* for OpenAI's server to answer (often 1–5 seconds). Do 50 calls one-by-one and you wait minutes. Do them concurrently with `asyncio` and you wait as long as the *slowest single call*. This is the difference between a batch job that takes 5 minutes vs 5 seconds. FastAPI, `httpx`, and every serious LLM backend are async. It's not optional at scale.

## The core idea: waiting is not working

Imagine calling three APIs, each taking 2 seconds.

- **Synchronous:** call 1 (wait 2s), call 2 (wait 2s), call 3 (wait 2s) = **6 seconds**. You stand idle during each wait.
- **Async:** fire all three, then wait for all to come back = **~2 seconds**. During each wait, the others progress.

Async doesn't make one call faster. It stops you from *wasting the waiting time*.

## Coroutines: `async def` and `await`

An `async def` function is a **coroutine** — a function that can pause. `await` marks the pause point: "this is slow; let other work run while I wait here."

```python
import asyncio

async def call_llm(prompt):
    print(f"start {prompt}")
    await asyncio.sleep(2)          # pretend this is a 2s network call
    print(f"done {prompt}")
    return f"answer to {prompt}"

# Calling it does NOT run it — it makes a coroutine object.
# You need an event loop to actually run it:
result = asyncio.run(call_llm("hello"))    # runs one coroutine
```

`asyncio.run(...)` starts the **event loop** — the scheduler that runs coroutines and switches between them at each `await`.

## Running many at once: `asyncio.gather`

This is the payoff. `gather` runs coroutines concurrently and waits for all:

```python
import asyncio, time

async def call_llm(prompt):
    await asyncio.sleep(2)
    return f"answer to {prompt}"

async def main():
    prompts = ["a", "b", "c", "d", "e"]
    start = time.perf_counter()
    # fire all 5 at once, collect results in order
    results = await asyncio.gather(*(call_llm(p) for p in prompts))
    print(f"{len(results)} calls in {time.perf_counter()-start:.1f}s")
    return results

asyncio.run(main())        # "5 calls in 2.0s"  — not 10s!
```

Five 2-second calls finish in 2 seconds total. That's concurrency.

## Don't flood the API: `Semaphore`

Firing 10,000 calls at once will get you rate-limited or banned. A **semaphore** caps how many run *concurrently* — a bouncer letting in N at a time.

```python
async def main():
    sem = asyncio.Semaphore(10)          # at most 10 in flight at once

    async def limited(prompt):
        async with sem:                  # wait for a free slot
            return await call_llm(prompt)

    prompts = [f"q{i}" for i in range(1000)]
    return await asyncio.gather(*(limited(p) for p in prompts))
```

1000 calls, but never more than 10 hitting the API simultaneously. This is the standard, polite way to batch LLM calls.

## The one rule: don't block the loop

`await` only works on things designed for it (`asyncio.sleep`, `httpx.AsyncClient`, async DB drivers). If you call a *blocking* function — `time.sleep()`, the synchronous `requests` library, heavy CPU math — it freezes the **entire** event loop; all your concurrency stops. Use async libraries (`httpx` not `requests`) inside async code.

```python
# WRONG inside async: time.sleep blocks EVERYTHING
async def bad():
    time.sleep(2)          # freezes the whole loop

# RIGHT: await the async version
async def good():
    await asyncio.sleep(2) # yields control while waiting
```

## Real world: how a company uses this

> **A Dubai legal-tech firm** summarizes 500 contract clauses through an LLM every night. The synchronous version took ~25 minutes (500 × 3s, serial). They rewrote it with `asyncio.gather` plus a `Semaphore(20)` — now 500 calls run 20-at-a-time, finishing in about 75 seconds, while staying under the provider's rate limit. Their FastAPI API is `async` too, so one server handles many simultaneous chat users without spinning up a thread per request. Async turned an overnight job into a coffee-break job.

## Common mistakes

- Calling an `async def` without `await`/`asyncio.run` — you get a coroutine object that never runs.
- Using blocking libraries (`requests`, `time.sleep`) inside async code — freezes the loop; use `httpx`, `asyncio.sleep`.
- No semaphore on big batches — you hit rate limits or get banned.
- Thinking async speeds up **CPU-bound** work (math, embeddings on-device). It only helps **I/O-bound** waiting; for CPU work use multiprocessing.

## Interview tip

Say: *"LLM calls are I/O-bound — mostly waiting on the network — so `asyncio.gather` runs them concurrently and the batch takes as long as the slowest call, not the sum. I cap concurrency with a `Semaphore` to respect rate limits, and I never call blocking code inside the loop."* The I/O-bound-vs-CPU-bound distinction plus the semaphore detail is exactly what separates people who've scaled LLM calls from those who haven't.
