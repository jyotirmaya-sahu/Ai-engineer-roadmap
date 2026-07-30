# High Availability & Fallbacks

**What it is:** designing your RAG system so that when a dependency fails — the vector DB times out, the LLM API returns 500s, the reranker is down — users get a *useful degraded answer* instead of an error page.

## Why it matters for an AI Engineer

Production RAG chains together several services that *will* fail: the embedding API, the vector DB, the reranker, the LLM. If any one going down takes the whole system down, your uptime is the *product* of all their uptimes — five 99.9% dependencies chained give only ~99.5%, which is hours of downtime a month. Users don't care whose fault it was; they care that the assistant returned a 500. **Graceful degradation** — returning *something* useful when a piece fails — is what keeps a RAG system usable through the inevitable hiccups. It's a hallmark of production maturity that senior interviews probe directly.

## The mechanism: timeouts, retries, replicas, fallbacks

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🔍 vector search</span>
    <span class="darr">↓<span class="lbl">times out / errors</span></span>
    <span class="dbox orange">🔤 fallback: keyword / BM25 search</span>
    <span class="darr">↓<span class="lbl">also down?</span></span>
    <span class="dbox blue">🗄️ fallback: cached answer</span>
    <span class="darr">↓<span class="lbl">nothing?</span></span>
    <span class="dbox green">🙏 graceful message: "I can't reach the docs right now"</span>
  </div>
  <div class="dcap">A ladder of fallbacks — each rung is worse than the last but far better than a 500.</div>
</div>

### 1. Timeouts on every external call

Never call a dependency without a timeout. A hung vector DB call with no timeout blocks the request forever and cascades — one slow dependency exhausts your workers and takes the whole service down. Set aggressive timeouts tied to your latency budget (see [latency-budgeting.md](latency-budgeting.md)): e.g. search 200ms, rerank 400ms, LLM 5s.

### 2. Retries with backoff — but bounded

Transient errors (a 503, a blip) deserve *one or two* retries with exponential backoff + jitter. But retry only **idempotent** calls, cap the attempts, and never retry into a timeout you've already blown — retrying forever turns a small outage into a self-inflicted overload.

### 3. Replicas & redundancy

Run the stateless parts (your API workers) as **multiple replicas** behind a load balancer across availability zones, so one dying box doesn't drop traffic. For the vector DB, use a managed service with built-in **replication** (a read replica keeps serving if the primary fails). Health checks pull unhealthy replicas out of rotation.

### 4. The fallback ladder — degrade, don't die

When retrieval or generation still fails, step down a ladder of progressively simpler responses:

| Failure | Fallback | Result |
|---|---|---|
| Reranker down | skip rerank, use raw vector top-k | slightly worse ranking, still works |
| Vector DB down | **keyword / BM25 search** (see [../retrieval/sparse-bm25-tf-idf.md](../retrieval/sparse-bm25-tf-idf.md)) | lower-quality retrieval, still grounded |
| Everything retrieval down | serve a **cached answer** for a similar question (see [semantic-prompt-caching.md](semantic-prompt-caching.md)) | possibly slightly stale, still helpful |
| LLM API down | fall back to a **second LLM provider** | seamless if prompts are portable |
| All of the above | honest message + escalate to human | no wrong answer, no fake "success" |

The golden rule for a grounded system: **degrade quality, never fabricate.** A slightly-worse keyword result is fine; a hallucinated answer because retrieval failed silently is not. If you truly can't retrieve, say so — don't let the LLM answer ungrounded.

## Concrete example: a fallback chain

```python
async def robust_answer(query: str):
    try:
        hits = await asyncio.wait_for(vector_search(query), timeout=0.2)
    except (TimeoutError, VectorDBError):
        try:
            hits = await keyword_search(query)          # BM25 fallback
        except Exception:
            cached = semantic_cache_lookup(query)       # last-resort cache
            if cached:
                return cached
            return "I can't reach the knowledge base right now — please retry shortly."
    try:
        return await asyncio.wait_for(generate(query, hits), timeout=5.0)
    except Exception:
        return await generate_with_backup_provider(query, hits)  # second LLM

# check: a dead vector DB still returns SOMETHING, never raises to the user
assert asyncio.run(robust_answer("leave policy?")) is not None
```

Each `except` is a rung: retrieval degrades to keyword, then to cache, then to an honest message; generation degrades to a backup provider. The user never sees a stack trace.

## How a company uses this

> A **Dubai airline**'s customer RAG can't go down during a flight disruption — that's exactly when everyone asks it questions. They run API workers across two AZs behind a load balancer, use a replicated managed vector DB, and have a fallback ladder: if the vector DB is slow it drops to a BM25 keyword index of the same docs; if the primary LLM provider throttles during a traffic spike it fails over to a second provider with the same prompt; and if retrieval is fully down it serves cached answers for the top FAQs and shows an honest "systems are busy" note rather than guessing. During a real regional cloud incident, retrieval degraded to keyword search and users barely noticed — no wrong answers, no error pages.

## Common mistakes
- **No timeouts** — one hung call blocks a worker and cascades into a full outage.
- **Failing hard** on a reranker or vector-DB blip instead of degrading to a simpler path.
- **Hallucinating when retrieval fails** — the worst outcome; degrade quality but stay grounded or say "I don't know."
- **Unbounded retries** — turning a brief provider blip into a self-inflicted overload.
- **Single LLM provider, no failover** — one provider outage = full downtime.

## Interview tip
Say: *"I assume every dependency will fail, so uptime is a chain — I put timeouts on every external call, bounded retries with backoff, and run stateless workers as replicas across zones behind a managed, replicated vector DB. Then I build a fallback ladder: reranker down → raw top-k; vector DB down → BM25 keyword search; retrieval fully down → cached answer; LLM down → a backup provider; and if all else fails, an honest message. The rule is degrade quality, never fabricate — a grounded system must never hallucinate just because retrieval broke."*
