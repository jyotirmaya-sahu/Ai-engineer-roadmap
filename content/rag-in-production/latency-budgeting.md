# Latency Budgeting

**What it is:** treating your end-to-end p95 response time as a fixed budget (say 2000ms) and *dividing* it across every stage — embed the query, search, rerank, call the LLM — so you know exactly where the milliseconds go and which stage to fix when you blow it.

## Why it matters for an AI Engineer

"It feels slow" is not an engineering statement. "Our p95 is 3.2s, the SLA is 2s, and 2.4s of it is the LLM's first-token time" *is* — it points straight at the fix. In production you have a latency SLA (a CTO said "under 2 seconds"), and RAG is a *pipeline* of stages that each add time. Without a budget you optimize the wrong thing (shaving 5ms off vector search while the LLM eats 2 seconds). Budgeting is how you spend your optimization effort where it counts.

## p50, p95, p99 — budget the tail, not the average

- **p50 (median):** half of requests are faster. Looks good in demos.
- **p95:** 1 in 20 requests is slower than this. **This is usually your SLA.**
- **p99:** the slow tail — retries, cold caches, GC pauses. What angry users hit.

Always budget and alert on **p95/p99**, not the average — averages hide the tail that generates complaints.

## The mechanism: divide the budget across stages

A typical RAG request, and where the time realistically goes for a 2000ms p95 budget:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ query</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔢 embed<span class="sub">~40ms</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🔍 vector search<span class="sub">~30ms</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🎯 rerank<span class="sub">~120ms</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM generate<span class="sub">~1400ms</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ answer</span>
  </div>
  <div class="dcap">Rough p95 breakdown of a 2s budget — the LLM dominates; search is tiny.</div>
</div>

A realistic p95 budget table:

| Stage | What it is | Typical p95 | Notes |
|---|---|---|---|
| Embed query | 1 embedding API/local call | 20–60ms | tiny text; local model can be <10ms |
| Vector search | ANN lookup (see [../embeddings-indexing/ann-search.md](../embeddings-indexing/ann-search.md)) | 10–50ms | HNSW is fast even at 10M |
| Rerank | cross-encoder / Cohere rerank ([../retrieval/reranking-cross-encoder-cohere.md](../retrieval/reranking-cross-encoder-cohere.md)) | 80–200ms | scores each candidate; scales with candidate count |
| **LLM generation** | the answer | **800–2500ms** | **usually 70–90% of the budget** |
| Network/overhead | serialization, hops | 20–100ms | adds up across services |

**The headline:** the LLM dominates. If you're over budget, you almost always fix it *there* — not by micro-optimizing search.

## Levers, from biggest to smallest impact

1. **Stream the LLM output.** Time-to-*first*-token (~300–600ms) is what users perceive, not time-to-*last*-token. Streaming makes a 1.4s generation *feel* instant. Biggest perceived-latency win, usually free.
2. **Smaller/faster model for generation.** A Haiku/Flash-class model can answer in a third of the time of a frontier model — often fine for grounded RAG where the context does the heavy lifting.
3. **Cache repeated work.** Semantic + prompt caching (see [semantic-prompt-caching.md](semantic-prompt-caching.md)) turns a 1.4s request into ~50ms on a hit.
4. **Cut rerank candidates.** Reranking 100 candidates costs more than 30; retrieve wide, rerank a sensible slice.
5. **Parallelize.** Embed the query while you're still doing auth/setup; fire independent calls concurrently (see [async-batching.md](async-batching.md)).

## Concrete example: measuring the breakdown

You can't budget what you don't time. Instrument each stage:

```python
import time
from contextlib import contextmanager

timings = {}

@contextmanager
def stage(name):
    t = time.perf_counter()
    yield
    timings[name] = round((time.perf_counter() - t) * 1000, 1)  # ms

def answer(query):
    with stage("embed"):   qvec = embed(query)
    with stage("search"):  hits = index.query(qvec, top_k=30)
    with stage("rerank"):  top  = rerank(query, hits)[:5]
    with stage("llm"):     out  = llm(build_prompt(query, top))
    return out

answer("what is the leave policy?")
print(timings)  # {'embed': 41.2, 'search': 28.7, 'rerank': 118.3, 'llm': 1402.9}
assert sum(timings.values()) < 2000, "over p95 budget — look at the biggest stage"
```

Ship these `timings` to your tracing tool (see [monitoring-online-eval.md](monitoring-online-eval.md)) as span durations so you can watch p95 per stage in prod, not just locally.

## How a company uses this

> A **Dubai fintech**'s support assistant had a 2s SLA and was missing it at p95 (2.9s). The team assumed it was the vector DB and spent a week tuning HNSW — which was already 25ms. Timing the stages showed the LLM was 2.4s. Two changes fixed it: **streaming** (dropped perceived latency to ~500ms first token) and switching grounded answers to a smaller, faster model (last-token p95 to 1.3s). Search — the thing they'd optimized — was never the problem. Budgeting first would have saved the week.

## Common mistakes
- **Optimizing the fast stage** (search) while the LLM eats the budget.
- **Budgeting the average, not p95/p99** — the tail is what breaks the SLA.
- **Not streaming** — shipping a 1.4s wall of text instead of a 400ms first token.
- **No per-stage timing** — you can't fix a latency problem you can't localize.

## Interview tip
Say: *"I treat p95 as a fixed budget and split it across embed, search, rerank, and generation — then instrument each stage as a span. The LLM is almost always 70–90% of it, so that's where I optimize: stream the output so first-token latency is what users feel, drop to a faster model for grounded answers, and cache repeats. I never tune vector search to save 10ms while generation eats two seconds."*
