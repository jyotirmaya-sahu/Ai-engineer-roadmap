# ANN (Approximate Nearest Neighbor) Search

**What it is:** **ANN** = finding the vectors *closest* to your query **without checking every single one** — accepting a tiny chance of missing the exact top match in exchange for enormous speed.

## Why it matters for an AI Engineer

ANN is the idea that makes vector databases *possible* at scale. Exact search (compare against all N vectors) is fine for thousands but collapses at millions — too slow, too expensive. Every production vector store (Pinecone, Weaviate, pgvector, Chroma) is really "an ANN engine plus features." Understanding ANN — and its one key metric, **recall** — lets you reason about the speed/accuracy dial instead of treating the DB as a black box. It's the concept behind [Flat/IVF/HNSW](flat-ivf-hnsw.md), one level up.

## The mechanism — how it works

**Exact** nearest-neighbor (kNN) compares the query to every stored vector — guaranteed correct, but O(N). **Approximate** nearest-neighbor uses a pre-built index (clusters, graphs, hashes) to look at only a small, promising *slice* of the vectors. It's usually right, occasionally misses a true neighbor at the edge — and it's **100–1000× faster**.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue wide">Exact kNN<span class="sub">check all N — 100% recall, slow</span></span>
    <span class="darr">→<span class="lbl">trade a little accuracy</span></span>
    <span class="dbox green wide">ANN<span class="sub">check a smart subset — ~99% recall, fast</span></span>
  </div>
  <div class="dcap">ANN gives up a sliver of accuracy for a massive speed win. For RAG that trade is almost always worth it.</div>
</div>

The metric that measures the "approximate" cost is **recall@k**: of the *true* top-k neighbors, what fraction did ANN actually return?

> **recall@10 = 0.95** means ANN found 9–10 of the true top-10 on average.

You **tune** recall with the index knobs: HNSW's `ef_search`, IVF's `nprobe` — higher = closer to exact, but slower. The engineering job is picking a point on this curve:

- **RAG Q&A** → ~0.95 recall is plenty; the LLM tolerates a near-miss chunk, and a [reranker](../rag-architecture.md) cleans up the rest. Speed matters more.
- **Fraud / dedup / legal** → push recall near 1.0; a missed match has real cost.

Why "approximate" is safe for RAG specifically: you usually fetch **top-20**, then rerank to the best 5. Even if ANN drops one true neighbor, the other 19 candidates almost always still contain the right answer.

## Concrete example — measuring recall

```python
import faiss, numpy as np
d, N = 128, 100_000
X = np.random.rand(N, d).astype("float32"); faiss.normalize_L2(X)
Q = X[:1000]                                   # 1000 queries

exact = faiss.IndexFlatIP(d); exact.add(X)     # ground truth
_, true_ids = exact.search(Q, 10)

hnsw = faiss.IndexHNSWFlat(d, 32); hnsw.add(X)
for ef in (16, 64, 256):                        # crank the accuracy knob
    hnsw.hnsw.efSearch = ef
    _, ann_ids = hnsw.search(Q, 10)
    recall = np.mean([len(set(a) & set(t)) / 10 for a, t in zip(ann_ids, true_ids)])
    print(f"efSearch={ef:>3}  recall@10={recall:.3f}")
# recall rises toward 1.0 as efSearch grows — and search gets slower. Pick your point.
```

This is *exactly* how you'd justify a config in production: measure recall against exact search, raise the knob until recall is "good enough," stop.

## How a company usage

A Dubai ride-hailing app matches a rider's request to nearby driver/route vectors in **milliseconds** across millions of entries using ANN — exact search would blow the latency budget. They benchmarked and settled on `ef_search` giving ~0.97 recall: fast enough for a live map, accurate enough that riders never notice a missed match.

## Common mistakes / misconceptions

- **Thinking ANN is "wrong."** It's *approximately* right by design, and you control how approximate via recall.
- **Never measuring recall** — then you can't tell if retrieval misses are the index or the embeddings.
- **Maxing recall everywhere** — you pay in latency for accuracy the LLM+reranker didn't need.
- **Blaming the LLM for a retrieval miss** that was actually low recall — always check recall separately.

## Interview tip

Show you think in the trade-off: *"Vector DBs use ANN, not exact search — I tune recall@k with `ef_search`/`nprobe`. For RAG I target ~0.95 recall and fetch top-20 then rerank, so a rare miss doesn't matter; for fraud I'd push recall near 1.0."* Mentioning recall@k as the metric is the tell that you truly understand ANN. See [Flat/IVF/HNSW](flat-ivf-hnsw.md).
