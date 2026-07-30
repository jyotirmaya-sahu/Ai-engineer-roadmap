# Advanced RAG

**The one-line idea:** naive RAG with the failure points patched — you improve the retrieval *before* the search (rewrite the query), *during* the search (hybrid dense + keyword), and *after* the search (rerank the results), so the LLM sees the *right* chunks in the *right* order.

## Why it matters for an AI Engineer

Naive RAG works in a demo and disappoints in production. Real corpora have synonyms, acronyms, near-duplicate documents, and vague user questions — and plain top-k vector search misses on all of them. Advanced RAG is the set of techniques that take a system from "impressive demo" to "employees actually trust it." It's also the single most common RAG topic in interviews, because it proves you understand *where retrieval breaks* and have a named fix for each break. This is the difference between someone who imported LangChain once and someone who's debugged a RAG system that was quietly returning garbage.

## The mechanism / how it works

Advanced RAG bolts optimizations onto naive RAG at three stages of the retrieval pipeline. (The deep dives live in the **Retrieval** node; this tile is the map.)

**Pre-retrieval — fix the query.** Users ask short, ambiguous questions. Transform the query before searching:
- **Query rewriting / multi-query:** generate 2–4 reworded versions and search with all of them.
- **HyDE:** have the LLM write a *hypothetical answer*, then embed *that* — it sits closer in vector space to the real answer chunks than the terse question does.
- **Decomposition:** split a multi-part question into sub-questions, retrieve for each.

**Retrieval — fix the search.** Pure vector search is fuzzy on exact terms (product codes, names, "Article 14"):
- **Hybrid search:** run dense (vector) *and* sparse (BM25 keyword) search, then fuse the rankings. Vectors catch meaning; keywords catch exact tokens.
- **Metadata filtering:** restrict to `department="HR"` or `year=2025` before ranking.

**Post-retrieval — fix the ordering.** Vector similarity gets you *roughly* relevant chunks, not the *best* ones:
- **Reranking:** retrieve a wide net (top-20), then a **cross-encoder** (or Cohere Rerank) scores each chunk against the query directly and reorders to the best 3–5. This is the highest-ROI single upgrade.
- **Contextual compression:** trim retrieved chunks down to just the relevant sentences before they hit the prompt.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ Query</span>
    <span class="darr">→<span class="lbl">rewrite / HyDE</span></span>
    <span class="dbox orange">better queries</span>
    <span class="darr">→<span class="lbl">hybrid</span></span>
    <span class="dbox blue">🔍 dense + BM25<span class="sub">top-20</span></span>
    <span class="darr">→<span class="lbl">rerank</span></span>
    <span class="dbox orange">best 3–5</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 LLM</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer</span>
  </div>
  <div class="dcap">Same skeleton as naive RAG — improved at pre-retrieval, retrieval, and post-retrieval.</div>
</div>

## Concrete example — adding a reranker

```python
# pip install cohere langchain-cohere
import cohere
co = cohere.ClientV2()   # COHERE_API_KEY in env

def advanced_retrieve(query, store):
    wide = store.similarity_search(query, k=20)          # 1) cast a wide net
    docs = [d.page_content for d in wide]
    reranked = co.rerank(                                 # 2) cross-encoder reorders
        model="rerank-v3.5", query=query, documents=docs, top_n=4,
    )
    return [docs[r.index] for r in reranked.results]     # best 4, correctly ordered
```

The wide net (k=20) makes sure the right chunk is *in* the candidate set; the reranker makes sure it lands in the top 4 the LLM actually reads. That two-step — over-fetch then rerank — fixes a huge share of "the answer was in the docs but the bot missed it" failures.

## How a company uses this

A UAE bank's policy assistant kept failing on questions like *"what's the limit under Article 14?"* — pure vector search returned semantically similar but wrong articles. They added **hybrid search** (BM25 caught the literal "Article 14") plus a **cross-encoder reranker**, and answer accuracy on their eval set jumped from ~68% to ~89%. The cost: reranking 20 candidates adds ~80–150ms and a fraction of a cent per query — trivial against the trust it bought. At their scale (a few million chunks, ~30 QPS at peak), the reranker runs on a small GPU pool and stays well inside a 2-second latency budget. This is the standard production RAG shape in 2026.

## Common mistakes / misconceptions

- **Adding everything at once.** Bolt on one technique, measure with RAGAS, keep it only if `context_precision`/`context_recall` improve. Otherwise you can't tell what helped.
- **Reranking a tiny candidate set.** Reranking top-3 is pointless — if the right chunk isn't in the initial net, the reranker can't invent it. Over-fetch first (k=20–50).
- **Skipping hybrid on exact-match corpora.** Legal, financial, and code docs are full of exact tokens; dense-only search quietly fails on them.
- **Confusing this with Agentic RAG.** Advanced RAG is still a *fixed* pipeline — every query takes the same path. Letting the system *decide* its path is **Agentic RAG**.

## Interview tip

Frame it by stage: *"Advanced RAG patches naive RAG at three points — pre-retrieval I rewrite the query or use HyDE, at retrieval I go hybrid dense-plus-BM25, and post-retrieval I over-fetch and rerank with a cross-encoder. Reranking is my highest-ROI single upgrade, and I add each one only after measuring it helps."* Structuring your answer around *where in the pipeline* each fix lands signals real production experience.
