# Caching & Streaming

**What it is:** Two production upgrades that don't change *what* your RAG system answers, only *how fast and how cheaply* it does it. **Semantic caching** reuses answers for questions that *mean* the same thing; **streaming** shows tokens as they're generated so the user sees words in ~300ms instead of staring at a spinner for 6 seconds.

## Why it matters for an AI Engineer

A RAG answer is slow and expensive by nature: embed the query, search the index, then wait for an LLM to generate a few hundred tokens. At real traffic this bites twice — **cost** (you re-pay for every call, even identical ones) and **latency** (users abandon a chatbot that hangs). In production these are the two complaints that reach the CEO, and they're the difference between a system people *use* and one they tolerate. Caching attacks cost; streaming attacks *perceived* latency. Neither touches accuracy, so they're pure wins once your answers are good.

## The mechanism / how it works

**Semantic caching.** A plain cache only helps on *byte-identical* questions — useless, because users phrase things a hundred ways. A *semantic* cache stores each past question **as an embedding** alongside its answer. A new question is embedded and compared by similarity; if it's close enough (above a threshold) to a cached one, you return the stored answer and **skip retrieval and generation entirely.** *"What's the refund window?"* and *"How long do I have to get a refund?"* hit the same cache entry.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ New question</span>
    <span class="darr">↓<span class="lbl">embed + similarity search cache</span></span>
    <span class="dbox purple">🔍 Close to a cached question?</span>
    <div class="flow">
      <span class="dbox green">✅ hit → return stored answer<span class="sub">~10ms, $0</span></span>
      <span class="dbox orange">❌ miss → full RAG, then cache it</span>
    </div>
  </div>
  <div class="dcap">Semantic caching matches by meaning, not exact text — a hit skips retrieval and the LLM call entirely.</div>
</div>

**Streaming.** Instead of waiting for the whole answer, you request tokens as a stream (the API sends them incrementally). You forward them to the browser over **Server-Sent Events (SSE)** — a simple one-way HTTP stream — so text appears word-by-word. The *total* time is the same, but **time-to-first-token** drops to a few hundred milliseconds, which is what users actually perceive as "fast."

## A concrete example

Streaming a RAG answer from the LLM and pushing it to the browser over SSE (FastAPI):

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openai import OpenAI

app = FastAPI()
client = OpenAI()

@app.get("/ask")
def ask(q: str):
    context = retrieve(q)                    # your vector search
    def gen():
        stream = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user",
                       "content": f"Answer from:\n{context}\n\nQ: {q}"}],
            stream=True,                     # ← token-by-token
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                yield f"data: {token}\n\n"   # SSE frame
        yield "data: [DONE]\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
```

Semantic caching, using a purpose-built cache (`redis` with vector search, or GPTCache):

```python
from redisvl.extensions.llmcache import SemanticCache

cache = SemanticCache(name="rag", redis_url="redis://localhost:6379",
                      distance_threshold=0.1)   # tighter = fewer false hits

def answer(q: str):
    if hit := cache.check(prompt=q):            # semantic lookup
        return hit[0]["response"]               # ~10ms, no LLM call
    resp = run_full_rag(q)                       # retrieve + generate
    cache.store(prompt=q, response=resp)         # remember for next time
    return resp
```

The `distance_threshold` is the knob that matters: too loose and *"refund policy"* wrongly hits *"return policy"*; too tight and near-duplicates miss. Tune it on real queries.

## How a company uses this

A **Dubai e-commerce** support bot found that its top ~30 questions ("where's my order?", "how do I return this?") made up **over half** of all traffic — asked a thousand different ways. A semantic cache collapsed those into a handful of entries: after warm-up, more than half of requests returned in ~10ms at zero LLM cost, and the monthly OpenAI bill dropped sharply. They paired it with SSE streaming so even cache-miss answers *felt* instant — first words on screen in under 400ms. Same answers, a fraction of the cost, and a chatbot that no longer felt sluggish.

## Common mistakes / misconceptions

- **Caching answers that shouldn't be shared.** Never serve one user's answer to another when the answer is *personalized* (order status, account balance). Cache only generic, non-user-specific Q&A, or scope the cache key per user.
- **Threshold set blind.** A loose semantic-cache threshold returns *confidently wrong* cached answers to different questions — arguably worse than a slow correct one. Measure false-hit rate before trusting it.
- **Streaming ≠ faster.** Streaming doesn't reduce total time or cost; it improves *perceived* speed. Don't cite it as a throughput win.
- **Never invalidating.** When your source documents change, stale cached answers linger. Add a TTL or clear the cache on re-ingestion.

## Interview tip
Say: *"These are cost-and-latency upgrades, not accuracy ones. Semantic caching stores past questions as embeddings and returns a stored answer when a new question is similar enough — skipping retrieval and the LLM entirely — which is huge because a handful of questions are usually most of the traffic. Streaming over SSE cuts time-to-first-token to a few hundred ms without changing total time. I tune the cache similarity threshold to avoid false hits, scope it away from personalized answers, and add TTL for freshness."* That shows you think about production economics, not just correctness. (See [../rag-architecture.md](../rag-architecture.md) for the base pipeline these sit on top of.)
