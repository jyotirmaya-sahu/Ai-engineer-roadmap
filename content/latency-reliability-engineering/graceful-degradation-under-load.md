# Graceful degradation under load

**The one-line idea:** When traffic exceeds what you can serve well, *deliberately do less* — shed excess requests, queue them, or turn off expensive features — so the service stays up and mostly-good instead of collapsing for everyone.

## Why it matters for an AI Engineer

Demand isn't steady. A product launch, a Ramadan spike, a viral moment, or a rate-limit ceiling means requests can suddenly outpace capacity. The naive service tries to accept *everything*, runs out of memory or provider quota, and **everyone** gets errors or 30-second hangs — a total collapse. Graceful degradation is the discipline of failing *partially and predictably*: serve as many users as you can at full quality, give the rest a fast, honest "try again" or a cheaper/faster version, and never let the whole thing fall over. For LLM apps this matters extra because every request is expensive (tokens, GPU, rate limits), so overload arrives faster and costs more. It's the reliability topic most likely to come up as "what happens when you get 10× your normal traffic?"

## The mechanism — how it works

You have a menu of degradation levers, from gentlest to hardest:

1. **Load shedding.** When you're at capacity, *reject new work fast* with a 429/503 and a `Retry-After` — a quick honest "no" beats a slow "maybe" that hangs. Better to serve 90% well than 100% terribly. This is **backpressure** made visible to the caller.
2. **Queue with bounded depth.** Buffer a *limited* number of waiting requests; when the queue is full, shed. An unbounded queue just moves the collapse (latency grows to infinity, memory blows).
3. **Feature degradation.** Turn off the *expensive-but-optional* parts under load: skip the reranker, drop to fewer retrieved docs, disable a second "critique" LLM pass, shorten `max_tokens`. The answer gets slightly worse but far cheaper/faster, so throughput rises.
4. **Model degradation.** Route overflow traffic to a smaller/faster/cheaper model (a form of [fallback](fallback-chains.md) triggered by *load*, not failure).
5. **Prioritize.** Shed low-value traffic first (free tier, background jobs) and protect high-value (paying users, interactive requests).

The trigger is a **capacity signal**: queue depth, in-flight count vs. your [concurrency cap](concurrency-pooling.md), provider 429 rate, or CPU/memory. Cross a threshold → start degrading; drop back → restore.

<div class="diagram">
  <div class="flow v">
    <div class="dgroup"><span class="dgt">NORMAL</span>
      <div class="flow"><span class="dbox green">all requests</span><span class="darr">→</span><span class="dbox purple">🧠 big model + rerank</span><span class="darr">→</span><span class="dbox green">✅ full quality</span></div>
    </div>
    <div class="dgroup"><span class="dgt">OVERLOADED</span>
      <div class="flow"><span class="dbox gray">excess</span><span class="darr">→<span class="lbl">shed 429</span></span><span class="dbox orange">↩️ retry later</span><span class="dbox yellow">rest → 🤖 mini, no rerank</span></div>
    </div>
  </div>
  <div class="dcap">Past capacity: shed excess fast and degrade features/model for the rest — stay up, don't collapse.</div>
</div>

## Concrete example

Shed load past capacity and degrade features when the queue is deep:

```python
import asyncio
from fastapi import FastAPI, HTTPException, Response

app = FastAPI()
MAX_INFLIGHT = 50
sem = asyncio.Semaphore(MAX_INFLIGHT)
inflight = 0

@app.post("/answer")
async def answer(q: str, tier: str = "free"):
    global inflight
    if sem.locked() and tier == "free":           # at capacity → shed low-value first
        raise HTTPException(503, "Busy, retry shortly",
                            headers={"Retry-After": "3"})
    async with sem:
        inflight += 1
        try:
            heavy_load = inflight > MAX_INFLIGHT * 0.8   # >80% full
            if heavy_load:
                return await cheap_path(q)     # mini model, no rerank, short answer
            return await full_path(q)          # big model + rerank + long answer
        finally:
            inflight -= 1

async def full_path(q):  ...   # gpt-4o, rerank top-20→5, max_tokens=600
async def cheap_path(q): ...   # gpt-4o-mini, top-3 no rerank, max_tokens=250
```

## How a company uses this

A **Dubai food-delivery** app's in-chat AI helper runs quiet most of the day, then gets slammed at iftar during Ramadan — traffic ~4×. Their first Ramadan, the service tried to serve everything at full quality (big model + a reranker + a self-critique pass), hit the Azure OpenAI token limit, and *everyone* got 30-second hangs and 500s during the busiest hour — exactly when it mattered most. They rebuilt with graceful degradation: past 80% of their concurrency cap they **disabled the reranker and the critique pass and dropped to a mini model**, and past 100% they **shed** free-tier and background traffic with a `Retry-After`. The next Ramadan, peak hour served ~92% of requests successfully at slightly reduced quality with p95 ~2.5 s, instead of ~100% failing — and token spend during the spike was *lower*, not higher, because the degraded path is cheaper. The capacity signal (in-flight vs cap, plus provider 429 rate) drove it automatically; no human toggled anything.

## Common mistakes / misconceptions

- **Accepting everything.** Trying to serve 100% under overload collapses to 0% for all. Shedding to protect the majority is *the* move.
- **Unbounded queues.** A queue with no cap just converts overload into unbounded latency and memory growth. Bound it, then shed.
- **Slow rejection.** Rejecting *slowly* (after a timeout) is as bad as hanging. Shed *fast* with a 429/503 + Retry-After.
- **No prioritization.** Shedding randomly can drop your paying users. Protect high-value traffic; shed free/background first.
- **No auto-recovery.** Degradation must *lift* when load drops, or you stay degraded forever. Tie it to a live capacity signal.

## Interview tip
Say: *"Under overload I degrade deliberately instead of collapsing: shed excess fast with a 429 and Retry-After, bound the queue so latency can't run away, and turn off the expensive optional stages — reranker, critique pass — or drop to a smaller model. I shed low-value traffic first to protect paying, interactive users, and drive it all from a live capacity signal like in-flight-vs-cap and provider 429 rate so it auto-recovers. Serving 90% well beats serving 100% terribly."* That last line, plus prioritized shedding, is the answer that lands.

See also: **[Concurrency & pooling](concurrency-pooling.md)** (the cap that signals overload) and **[Fallback chains](fallback-chains.md)** (model degradation is a load-triggered fallback).
