# Reranking (Cross-Encoder / Cohere)

**The one-line idea:** Reranking takes the top ~20–50 chunks from fast search and **re-scores each one against the query with a slower, much smarter model**, then keeps only the best 3–5 — so the chunk that *actually* answers the question rises to the top.

## Why it matters for an AI Engineer

This is the single highest-leverage precision upgrade in RAG. First-stage search (dense/sparse/hybrid) is fast but *coarse* — it's good at "these are in the neighborhood," bad at "this exact one answers the question." A reranker is the opposite: too slow to run over a million chunks, but devastatingly accurate over 40. The two-stage pattern — **retrieve wide, rerank narrow** — is the standard modern architecture, and "do you rerank?" is a near-guaranteed RAG interview question. Adding a reranker is often the biggest quality jump you can make without touching the LLM or the embeddings.

## The mechanism — how it works

The key is **bi-encoder vs. cross-encoder**:

- **Bi-encoder (first-stage search):** embeds the query and each chunk *separately* into vectors, then compares. Fast — chunk vectors are precomputed — but the model never sees query and chunk *together*, so it can't reason about their exact interaction. This is your vector DB.
- **Cross-encoder (the reranker):** feeds the query and one chunk into the model **together** as a single input, and outputs one relevance score. Because it reads both at once with full attention, it catches nuance a bi-encoder misses — negation, exact conditions, which entity the question is really about. The cost: it must run *per candidate* (can't precompute), so it's far too slow for the whole corpus but perfect for re-scoring a shortlist.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ 1M chunks</span>
    <span class="darr">→<span class="lbl">bi-encoder<br>fast, coarse</span></span>
    <span class="dbox orange">📄 top 40</span>
    <span class="darr">→<span class="lbl">cross-encoder<br>slow, precise</span></span>
    <span class="dbox green">✅ top 4 to LLM</span>
  </div>
  <div class="dcap">Cheap wide net for recall, then an expensive per-pair model on the shortlist for precision.</div>
</div>

## Concrete example — two ways

**Cohere Rerank v3** (managed API, 2026-current, strong default):

```python
import cohere
co = cohere.ClientV2()  # COHERE_API_KEY in env

query = "What is the notice period to close a savings account?"
candidates = [c.page_content for c in first_stage_retriever.invoke(query)]  # ~40 chunks

reranked = co.rerank(
    model="rerank-v3.5",
    query=query,
    documents=candidates,
    top_n=4,
)
best = [candidates[r.index] for r in reranked.results]  # 4 most relevant, re-ordered
```

**Local cross-encoder** (no API, runs on CPU/GPU via sentence-transformers):

```python
from sentence_transformers import CrossEncoder
ce = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

pairs = [(query, c) for c in candidates]
scores = ce.predict(pairs)                       # one relevance score per (query, chunk)
top = [c for _, c in sorted(zip(scores, candidates), reverse=True)][:4]
```

In LangChain this slots in as a `ContextualCompressionRetriever` wrapping your base retriever with a `CohereRerank` compressor — one clean line in the chain.

## How a company uses this

The **Dubai bank** assistant retrieved 40 candidates with hybrid search, then ran **Cohere Rerank v3** to pick the final 4. Result: the precise clause that answered a policy question consistently landed at position #1 instead of #7 — and because only 4 tight chunks went to the LLM, answers got both more accurate *and* cheaper. That reranking step was the change that moved them from "demo" to "shipped."

## Common mistakes / misconceptions

- **Reranking too many.** Cross-encoders are slow and cost per pair — rerank 20–50 candidates, not 500. The point is a *shortlist*.
- **Skipping the wide first stage.** Reranking can only reorder what search retrieved; if recall was bad (k too small), the answer never reaches the reranker. Retrieve wide first.
- **Confusing it with an embedding model.** A reranker outputs a *relevance score for a pair*, not a reusable vector. You can't index with it.
- **Ignoring latency.** It adds a round-trip / model pass. For latency-critical apps, cap candidates and consider a small local model.

## Interview tip
Say: *"Reranking is stage two of a two-stage retriever: a fast bi-encoder pulls ~40 candidates, then a cross-encoder — Cohere Rerank v3 or a local ms-marco model — scores each query-chunk pair *together* and keeps the top few. The cross-encoder sees both texts jointly so it catches nuance the bi-encoder can't, and it's the biggest precision win in RAG without changing the LLM."* Naming the bi-encoder/cross-encoder distinction is the exact thing interviewers listen for.

See also: **Top-K Selection** (retrieve wide, rerank narrow), **Hybrid Search** (feeds the reranker), and **MMR** (diversity, not precision).
