# Semantic & Prompt Caching

**What it is:** avoiding recomputation by remembering answers. **Prompt caching** reuses the model's processing of the *same* prompt prefix; **semantic caching** returns a stored answer when a *new* question means the *same thing* as one you've already answered.

## Why it matters for an AI Engineer

In production, questions repeat — a lot. "What's the annual leave policy?" gets asked 50 different ways by 50 people. Recomputing embed → search → rerank → a 1.4s LLM call every time is slow and expensive. Caching turns a huge fraction of traffic into ~50ms, near-free responses. On a real support assistant, a **30–60% cache hit rate** is normal, which directly cuts your LLM bill (see [cost-at-scale.md](cost-at-scale.md)) and your p95 (see [latency-budgeting.md](latency-budgeting.md)) by roughly that same fraction. It's the highest-ROI production optimization there is.

## Two different caches — don't confuse them

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ new query</span>
    <span class="darr">↓<span class="lbl">embed + similarity search in cache</span></span>
    <span class="dbox orange">🔍 semantic cache<span class="sub">is a near-identical question cached?</span></span>
    <div class="flow">
      <span class="dbox green">✅ hit → return stored answer (~50ms)</span>
      <span class="dbox purple">❌ miss → full RAG pipeline (~1.4s)</span>
    </div>
  </div>
  <div class="dcap">Semantic cache checks meaning, not exact string — "leave policy?" hits "what's the annual leave?".</div>
</div>

### 1. Prompt caching (provider-side, exact prefix)

Modern LLM APIs (Anthropic, OpenAI, Google) let you mark a stable prompt **prefix** as cached. In RAG, your prompt is usually `[big fixed system prompt + instructions] + [retrieved context] + [user question]`. The long, unchanging **system/instruction prefix** is identical on every call — cache it and the provider skips re-processing those tokens, giving **~50–90% cheaper** cached input tokens and lower latency. It's *exact-match* on the prefix, so put the stable text first and the variable text (context, question) last.

```python
# Anthropic-style prompt caching: mark the stable prefix
messages = [{
    "role": "system",
    "content": [{
        "type": "text",
        "text": LONG_SYSTEM_INSTRUCTIONS,      # same every call → cache this
        "cache_control": {"type": "ephemeral"},
    }],
}]
# retrieved context + user question go AFTER, uncached (they change per request)
```

### 2. Semantic caching (yours, meaning-match)

You store past `(question → answer)` pairs *as embeddings*. On a new question, embed it and do a similarity search against the cache; if the nearest cached question is above a threshold (e.g. cosine ≥ 0.95), return its stored answer. This catches paraphrases that an exact-string cache would miss. Redis (with its vector search / `RediSearch`), or a small dedicated vector index, is the usual backing store.

```python
import redis, numpy as np
r = redis.Redis()
THRESHOLD = 0.95

def cached_answer(query, ttl=3600):
    qvec = embed(query)
    hit = semantic_lookup(r, qvec)              # nearest cached question + score
    if hit and hit.score >= THRESHOLD:
        return hit.answer                       # ~50ms, no LLM call
    answer = run_full_rag(query)                # miss: embed→search→rerank→LLM
    store(r, qvec, query, answer, ttl=ttl)      # remember it, with a TTL
    return answer

# sanity: a paraphrase should hit the same cache entry
assert cached_answer("annual leave policy?") == cached_answer("how many leave days do I get?")
```

**Threshold matters.** Too low (0.85) and you serve a *wrong* stored answer to a subtly different question — the dangerous failure. Too high (0.99) and you almost never hit. Tune it on real query pairs; 0.93–0.97 is the usual band. When correctness is critical, keep it conservative.

## Invalidation — the hard part

A cached answer goes **stale** when the underlying documents change. Strategies:

- **TTL** — expire entries after N minutes/hours. Simple; bounds staleness. Good default.
- **Event-based** — when a doc is updated/deleted (see [incremental-indexing-updates.md](incremental-indexing-updates.md)), purge cache entries whose answer cited that doc. Precise but needs answer→source tracking.
- **Namespace/version key** — prefix cache keys with a corpus version; bump the version on a big re-index to invalidate everything at once.

Never cache without an invalidation story — a stale cached answer about a changed policy is worse than a slow fresh one.

## How a company uses this

> A **Dubai telco**'s customer-support RAG handles ~800k queries/month, heavily repetitive (billing, plan, coverage questions). Adding prompt caching on the fixed system prompt cut input-token cost ~70%. Adding a Redis semantic cache (threshold 0.95, 1-hour TTL) hit ~45% of queries — those now return in ~40ms instead of 1.5s, and the LLM bill dropped almost in proportion. On plan changes they bump a version key to flush the cache so no one gets last month's pricing.

## Common mistakes
- **One cache for everything** — prompt caching (exact prefix) and semantic caching (meaning) solve different problems; use both.
- **Threshold too loose** — serving a stored answer to a genuinely different question. Correctness beats hit rate.
- **No invalidation** — caching a policy answer forever, then the policy changes.
- **Caching per-user data globally** — a semantic cache must be scoped per tenant/user or you leak one person's answer to another (see [sharding-partitioning.md](sharding-partitioning.md)).

## Interview tip
Say: *"I use two caches. Prompt caching marks the stable system-prompt prefix so the provider skips reprocessing it — big cost and latency win, and it's exact-match so the variable context goes last. Semantic caching stores past question embeddings and returns a stored answer when a new question is near-identical above a tuned threshold — I keep that threshold conservative because a false hit serves a wrong answer. Both need invalidation, usually a TTL plus event-based purge when source docs change."*
