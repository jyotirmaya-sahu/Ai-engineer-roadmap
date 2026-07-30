# Concurrency & pooling

**The one-line idea:** Reuse a small set of pre-opened connections and cap how many operations run at once — instead of opening a fresh connection per request and letting unlimited work pile up — so your service is fast and doesn't tip over under load.

## Why it matters for an AI Engineer

When your app serves many users, two costs quietly kill it. First, **opening a new connection every call is expensive** — the TCP + TLS handshake to a provider can add 50–200 ms *before any real work*, and at high QPS that dominates your latency. **Connection pooling** amortizes that by keeping warm connections around and handing them out. Second, **unbounded concurrency is a trap**: if 5,000 requests arrive and you fire all 5,000 at OpenAI at once, you instantly blow rate limits, exhaust memory, and get worse latency for *everyone*. **Concurrency limits** cap in-flight work to a healthy number and queue the rest. Together, these are what let a single service handle real traffic instead of falling apart at 10 concurrent users.

## The mechanism — how it works

**Connection pooling.** A pool is a fixed set of reusable connections to a backend (a provider, a database, a vector store). A request *borrows* a connection, uses it, and *returns* it — no per-call handshake. You configure pool size (max connections) and keep-alive. The OpenAI/Anthropic SDKs pool automatically via an underlying `httpx` client, but you must **reuse one client instance** — creating a new client per request throws away the pool.

**Concurrency limiting.** You cap how many operations run simultaneously, usually with a **semaphore** — a counter of available "slots." A task acquires a slot before running and releases it after; if all slots are taken, new tasks *wait* rather than pile on. This bounds:
- calls to a rate-limited provider (stay under the QPS/token cap),
- memory (each in-flight LLM request holds buffers),
- fairness (no single burst starves everyone else).

The right limit comes from your provider's rate limit and your latency budget: enough concurrency to keep throughput high, not so much that you queue at the provider or run out of memory. Pair it with **backpressure**: when the queue is full, reject fast (429 to your own caller) rather than accept work you can't do — that's [graceful degradation](graceful-degradation-under-load.md).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 many requests</span>
    <span class="darr">→</span>
    <span class="dbox orange">🚦 semaphore<span class="sub">max 20 in-flight</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">♻️ connection pool<span class="sub">warm, reused</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 provider</span>
  </div>
  <div class="dcap">Cap in-flight work with a semaphore; serve it over warm pooled connections instead of new ones.</div>
</div>

## Concrete example

Reuse one pooled client and bound concurrency with an async semaphore:

```python
import asyncio
from openai import AsyncOpenAI

# ONE client for the whole app → its httpx pool is reused (do NOT make per-request)
client = AsyncOpenAI(max_retries=2)
sem = asyncio.Semaphore(20)     # at most 20 concurrent provider calls

async def ask(prompt: str) -> str:
    async with sem:             # wait here if 20 already in flight (backpressure)
        resp = await client.chat.completions.create(
            model="gpt-4o", timeout=4.0,
            messages=[{"role": "user", "content": prompt}])
        return resp.choices[0].message.content

async def handle_batch(prompts):
    # 1000 tasks created, but only 20 ever hit the provider at once
    return await asyncio.gather(*(ask(p) for p in prompts))

asyncio.run(handle_batch(["q"] * 1000))
```

Explicitly sizing the underlying connection pool:

```python
import httpx
from openai import AsyncOpenAI
client = AsyncOpenAI(http_client=httpx.AsyncClient(
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)))
```

## How a company uses this

A **Dubai property portal** runs a listing-summarization service hit hard when new inventory drops — bursts of ~3,000 summarization jobs in a minute. Their first version created an OpenAI client *per job* and fired them all at once: TLS handshakes added ~120 ms each, they blew the token-per-minute limit within seconds (a storm of 429s), and memory spiked. Switching to **one shared pooled client + a semaphore of 25** fixed all three at once: warm connections dropped per-call overhead, the semaphore kept them just under the rate limit (so 429s went from thousands to near-zero), and memory stayed flat. Throughput actually went *up*, because they stopped wasting time on handshakes and retries. They tuned the semaphore to 25 by watching provider 429 rate vs. queue depth — the sweet spot that maxes throughput without tripping the limit.

## Common mistakes / misconceptions

- **New client per request.** This is the most common perf bug — it discards the connection pool and re-handshakes every call. Instantiate the client once and reuse it.
- **Unbounded concurrency.** Firing everything at once causes 429 storms, memory blowups, and *worse* latency for all. Always cap with a semaphore.
- **Semaphore set by vibes.** Too low wastes throughput; too high queues at the provider or OOMs. Tune from the provider's rate limit and your memory.
- **No backpressure.** When the cap is reached, *waiting forever* just moves the pileup. Bound the queue and reject fast when full.
- **Pool too small for a slow backend.** If each call is slow and the pool is tiny, requests queue on connections. Size the pool to concurrency.

## Interview tip
Say: *"I use one shared, pooled client so I don't re-handshake per call, and I cap in-flight work with a semaphore sized from the provider's rate limit and my memory budget — unbounded concurrency causes 429 storms and OOMs and paradoxically raises latency for everyone. When the cap is saturated I apply backpressure and reject fast rather than queue unboundedly."* Calling out the per-request-client anti-pattern and the semaphore sizing shows you've actually run something under load.

See also: **[Async serving](async-serving.md)** (why one process can hold many pooled calls) and **[Graceful degradation under load](graceful-degradation-under-load.md)** (what to do when the cap is hit).
