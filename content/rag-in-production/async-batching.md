# Async & Batching

**What it is:** two throughput techniques. **Async** lets one process handle many requests concurrently by not blocking while it waits on network calls. **Batching** groups many small operations (like embedding 500 chunks) into one call instead of 500.

## Why it matters for an AI Engineer

A RAG request spends almost all its time *waiting* — for the embedding API, the vector DB, the LLM. A naive synchronous server handles those waits one at a time, so it can serve maybe a handful of requests per second no matter how big your machine is. To hit **hundreds or thousands of QPS**, you need async I/O (wait on many things at once) and batching (do bulk work in one round-trip). Getting this wrong is why "it worked in the demo" turns into a queue of timed-out users at launch. This is core production-Python skill (see [../python-for-ai.md](../python-for-ai.md)).

## The mechanism

### Async: don't block while you wait

A RAG call is I/O-bound — 95%+ of its wall-clock time is waiting on network. Synchronous code sits idle during each wait. **Async** (`asyncio` + `await`) lets the process start request B's work while request A is waiting on the LLM, so one worker overlaps thousands of in-flight waits.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🐌 sync: A waits… B waits… C waits…<span class="sub">one at a time</span></span>
    <span class="darr">↓<span class="lbl">async</span></span>
    <span class="dbox green">⚡ async: A, B, C all waiting at once<span class="sub">overlap the idle time</span></span>
  </div>
  <div class="dcap">Async doesn't make one request faster — it lets one worker handle many in-flight requests during their waits.</div>
</div>

```python
import asyncio
from openai import AsyncOpenAI
client = AsyncOpenAI()

async def embed(text: str) -> list[float]:
    resp = await client.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding

async def handle(query: str):
    qvec = await embed(query)                 # awaits without blocking other requests
    hits = await index.aquery(qvec, top_k=5)  # async vector DB call
    return await llm_async(build_prompt(query, hits))

# 200 concurrent requests handled by ONE event loop, overlapping their waits
async def main():
    results = await asyncio.gather(*(handle(q) for q in queries))
    return results
```

### Batching: one round-trip instead of many

When you have many independent items (embedding a 10,000-chunk document during ingestion, embedding a batch of queries), send them in **one API call**. Embedding APIs accept a list of inputs; the round-trip and per-call overhead are paid once, not 10,000 times.

```python
def embed_batch(texts, batch_size=256):
    vectors = []
    for i in range(0, len(texts), batch_size):
        chunk = texts[i:i + batch_size]
        resp = client.embeddings.create(model="text-embedding-3-small", input=chunk)
        vectors.extend(d.embedding for d in resp.data)
    return vectors

# 10k chunks in ~40 batched calls, not 10k calls → ~50–100× less overhead + far cheaper
assert len(embed_batch(["a", "b", "c"], batch_size=2)) == 3
```

Batch sizes of **128–512** are typical for embeddings — big enough to amortize overhead, small enough to stay under payload/token limits and avoid one giant slow call. For LLM generation at scale, providers also offer **async batch APIs** (submit thousands of prompts, get results later at ~50% cost) — perfect for offline jobs like pre-generating summaries, useless for live user requests.

### Connection pools & concurrency limits

Two production details that bite people:

- **Connection pooling** — reuse HTTP connections (a shared `httpx`/client instance) instead of opening a new TCP+TLS handshake per call. Opening a fresh connection per request adds tens of ms and exhausts sockets under load.
- **A concurrency limit (semaphore)** — don't fire unlimited concurrent calls; you'll hit provider rate limits (429s) and overwhelm your own DB. Cap in-flight calls to a sane number.

```python
sem = asyncio.Semaphore(50)   # at most 50 concurrent LLM calls
async def guarded(query):
    async with sem:
        return await handle(query)
```

## How a company uses this

> A **Dubai e-commerce** platform re-embeds its full 4M-product catalog nightly. The first version embedded one product at a time synchronously — it took ~9 hours and often didn't finish before morning. Switching to **batched embeddings (256 per call) + async concurrency (a semaphore of 20 in-flight batches)** cut it to ~35 minutes. On the serving side, moving their FastAPI app from sync to async handlers took sustained throughput from ~15 QPS to ~600 QPS on the same box, because the workers stopped blocking on the LLM.

## Common mistakes
- **Sync handlers in an async framework** — one blocking call freezes the whole event loop; everything else queues behind it.
- **No batching during ingestion** — 10k separate embedding calls is slow, rate-limited, and needlessly expensive.
- **No concurrency cap** — firing 5,000 concurrent calls → 429 rate-limit errors and a hammered vector DB.
- **A new client/connection per request** — handshake overhead and socket exhaustion; reuse a pooled client.

## Interview tip
Say: *"RAG is I/O-bound, so I use async so one worker overlaps thousands of in-flight waits on the LLM and vector DB — that's what takes a service from ~15 to hundreds of QPS. For bulk work like ingesting a corpus I batch embeddings 128–512 at a time to amortize per-call overhead, use a pooled HTTP client, and cap concurrency with a semaphore so I don't trip provider rate limits. For offline generation I'll use the provider's batch API at half the cost."*
