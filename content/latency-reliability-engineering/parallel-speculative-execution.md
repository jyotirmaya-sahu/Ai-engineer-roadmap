# Parallel / speculative execution

**The one-line idea:** When steps don't depend on each other, run them *at the same time* instead of one after another (parallel); and when a fast guess is usually right, start on it *before you're sure* and throw it away if wrong (speculative).

## Why it matters for an AI Engineer

LLM pipelines are full of independent-but-slow steps: three retrievals from different sources, two tool calls, a fan-out to five documents each summarized. Done sequentially, their latencies *add up*. Done in parallel, the total is just the *slowest one*. That's often a 3–5× latency cut for free — the difference between fitting your budget and blowing it. Speculative execution goes further: it trades cheap compute for saved wall-clock time, which is exactly the trade you want when a user is waiting. Both are core to hitting aggressive p95 targets, and both come up when an interviewer asks "how would you make this faster without changing the model?"

## The mechanism — how it works

**Parallel execution.** If step B doesn't need step A's output, they can run concurrently. Since LLM/tool calls are **I/O-bound** (you're waiting on the network, not burning CPU), Python's `asyncio.gather` lets one thread fire all calls and await them together. Sequential total = A + B + C; parallel total = max(A, B, C).

The catch: only parallelize **independent** steps. If the reranker needs the retriever's output, that edge is sequential — you parallelize *within* a stage (e.g. query 3 sources at once), not across a true dependency.

**Speculative execution.** Start work on the *likely* path before confirmation, and cancel/discard if the guess was wrong. Flavors you'll use:

- **Speculative decoding** (inside the model server): a small "draft" model proposes several tokens, the big model verifies them in one pass — accepted tokens are free, giving 2–3× faster generation. You get this from vLLM/TGI; you configure it, you don't hand-write it.
- **Speculative prefetch / draft-then-verify at the app level:** fire the expensive call speculatively (e.g. start generating an answer from the top retrieval result *while* the reranker is still running), and use it only if the reranker agrees. You spend some throwaway tokens to shave latency.
- **Hedged requests:** send the same request to two providers/replicas and take whichever returns first — kills the slow tail at the cost of duplicate work.

<div class="diagram">
  <div class="flow v">
    <div class="dgroup"><span class="dgt">SEQUENTIAL — 900ms</span>
      <div class="flow"><span class="dbox blue">A 300ms</span><span class="darr">→</span><span class="dbox blue">B 300ms</span><span class="darr">→</span><span class="dbox blue">C 300ms</span></div>
    </div>
    <div class="dgroup"><span class="dgt">PARALLEL — 300ms</span>
      <div class="flow"><span class="dbox green">A 300ms</span><span class="dbox green">B 300ms</span><span class="dbox green">C 300ms</span><span class="darr">→<span class="lbl">max</span></span><span class="dbox yellow">✅ 300ms</span></div>
    </div>
  </div>
  <div class="dcap">Independent calls run at once; total collapses from the sum to the slowest one.</div>
</div>

## Concrete example

Fan out three independent retrievals concurrently with `asyncio.gather`:

```python
import asyncio, time

async def search_source(name, query):
    await asyncio.sleep(0.3)          # stand-in for a 300ms network call
    return f"{name} results for {query}"

async def retrieve_all(query):
    t0 = time.perf_counter()
    docs = await asyncio.gather(       # all three fire at once
        search_source("vector_db", query),
        search_source("keyword_index", query),
        search_source("sql_facts", query),
    )
    print(f"parallel took {(time.perf_counter()-t0)*1000:.0f}ms")  # ~300ms, not 900
    return docs

asyncio.run(retrieve_all("termination clause"))
```

Hedged request — race two providers, take the winner, cancel the loser:

```python
async def hedged(call_a, call_b):
    tasks = [asyncio.create_task(call_a()), asyncio.create_task(call_b())]
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()                     # drop the slower one
    return done.pop().result()
```

## How a company uses this

A **Dubai logistics** firm's shipment-tracking agent needs three lookups per query — carrier API, internal DB, and a RAG policy search — each ~250–400 ms. Sequentially that's ~1 s before the LLM even starts. Running them with `asyncio.gather` cut it to ~400 ms (the slowest single call), keeping the whole request under their 2 s SLA. Separately, they enabled **speculative decoding** on their self-hosted vLLM endpoint with a small draft model, getting ~2.2× faster generation at peak — meaningful when serving ~60 QPS, where every 100 ms of generation time is GPU-seconds saved. For their premium tier they **hedge** the final generation across two regions, trading ~15% extra token cost to shave the p99 tail from 6 s to 3 s.

## Common mistakes / misconceptions

- **Parallelizing dependent steps.** If B needs A's output, running them "in parallel" just means B runs on stale/empty input. Map the real dependency graph first.
- **Using threads for I/O-bound LLM calls in async code.** `asyncio.gather` with async clients is the clean path; mixing blocking calls into an event loop stalls everything.
- **Unbounded fan-out.** Firing 500 parallel calls at a provider triggers rate limits. Bound concurrency (a semaphore) — see [concurrency & pooling](concurrency-pooling.md).
- **Hedging everything.** Duplicate requests double cost; reserve hedging for the latency-critical tail, not every call.

## Interview tip
Say: *"I map the dependency graph and run every independent step concurrently with asyncio.gather, so total latency becomes the slowest call, not the sum. For the tail I'll hedge critical requests across replicas and take the first to return, and on self-hosted serving I turn on speculative decoding for ~2–3× faster generation. I always bound the fan-out with a semaphore so I don't self-inflict rate limits."* Distinguishing *parallel* (independent steps) from *speculative* (do-it-before-you're-sure) shows real depth.

See also: **[Concurrency & pooling](concurrency-pooling.md)** (bounding the fan-out) and **[Latency budgeting](latency-budgeting.md)** (why overlapping steps fits the budget).
