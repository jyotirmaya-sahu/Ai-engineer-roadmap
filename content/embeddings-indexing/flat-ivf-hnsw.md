# Flat / IVF / HNSW Indexes

**What it is:** The three main **ways a vector database organizes vectors** so it can find nearest neighbors — from `Flat` (check everything, exact) to `IVF` and `HNSW` (clever shortcuts, approximate but far faster).

## Why it matters for an AI Engineer

At 1,000 vectors, search speed doesn't matter. At 10 million, the index type is the difference between a **5ms** answer and a **5-second** one. Every vector DB — Pinecone, pgvector, Chroma, Weaviate, FAISS — exposes these choices (usually defaulting to HNSW). Understanding the **speed / accuracy / memory trade-off** lets you tune retrieval and answer the classic interview question "how does vector search stay fast at scale?" This is the "how the storage actually works" knowledge under all the vector-DB tiles.

## The mechanism — how it works

The naive way to find the nearest vector is to compare the query against **every** stored vector. That's `Flat` — exact, but O(n), too slow at scale. `IVF` and `HNSW` are **ANN** ([approximate](ann-search.md)) indexes: they skip most comparisons and still almost always find the right neighbors.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">📦 Flat<span class="sub">compare to ALL — exact, slow</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">🗂️ IVF<span class="sub">cluster first, search a few clusters</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">🕸️ HNSW<span class="sub">navigate a graph — fastest, default</span></span>
  </div>
  <div class="dcap">Top = exact & slow; down = approximate & fast. HNSW is the modern default.</div>
</div>

**Flat** — brute force. Compare the query to every vector, return the closest. 100% accurate, no build step, but linear time and full memory. Great under ~10k–100k vectors, or when you need *guaranteed* exact results.

**IVF (Inverted File)** — first **cluster** all vectors into, say, 1000 groups (via k-means). At query time, find the few nearest cluster centers and only search *those* clusters. The `nprobe` knob = how many clusters to check: higher = more accurate, slower. You must **train** it on your data first. Risk: the true neighbor sits in a cluster you didn't probe (an edge miss).

**HNSW (Hierarchical Navigable Small World)** — build a multi-layer **graph** where each vector links to its neighbors, with sparse "express lanes" on top. Search greedily hops through the graph toward the query. Excellent speed *and* recall, no training needed — which is why it's the **default in Weaviate, pgvector, Chroma, and Pinecone**. Cost: more memory and slower inserts. Two build knobs: `M` (links per node) and `ef_construction` (build effort); at query time `ef_search` trades speed for recall.

| Index | Accuracy | Speed | Memory | Build |
|---|---|---|---|---|
| Flat | exact | slow | low | none |
| IVF | tunable | fast | low–mid | train (k-means) |
| HNSW | high | fastest | high | build graph |

## Concrete example

```python
import faiss, numpy as np
d = 1536
X = np.random.rand(50000, d).astype("float32"); faiss.normalize_L2(X)

flat = faiss.IndexFlatIP(d); flat.add(X)                     # exact baseline

ivf = faiss.IndexIVFFlat(faiss.IndexFlatIP(d), d, 256)       # 256 clusters
ivf.train(X); ivf.add(X); ivf.nprobe = 16                    # probe 16 clusters

hnsw = faiss.IndexHNSWFlat(d, 32)                            # M=32 links/node
hnsw.hnsw.efSearch = 64; hnsw.add(X)                         # no training needed

q = X[:1]
for name, idx in [("flat", flat), ("ivf", ivf), ("hnsw", hnsw)]:
    print(name, idx.search(q, 5)[1][0])   # compare which neighbors each returns
```

Flat gives the ground truth; you tune `nprobe` / `efSearch` until IVF and HNSW match it closely enough while being much faster.

## How a company usage

A Dubai e-commerce site with 20M product vectors uses **HNSW** (via pgvector) for its "similar items" search — sub-10ms, and it never retrains when new products arrive. Their tiny internal 8k-doc policy tool stays on a **Flat** index: exact, zero tuning, plenty fast. Same company, two index choices driven by scale.

## Common mistakes / misconceptions

- **Using Flat at scale** — correct but unusably slow past hundreds of thousands of vectors.
- **Forgetting to train IVF** — it errors or returns nonsense.
- **Leaving `nprobe`/`efSearch` at 1** — blazing fast, terrible recall; raise them until recall is acceptable.
- **Ignoring HNSW memory cost** — the graph is RAM-hungry; budget for it.
- **Chasing exact search when approximate is fine** — 99% recall at 100× speed is the right trade for RAG.

## Interview tip

Nail the trade-off in one line: *"HNSW is the default — a navigable graph giving near-exact recall very fast, at higher memory. IVF clusters and probes a few, cheaper on memory but needs training. Flat is exact brute force, only for small sets. I tune `ef_search`/`nprobe` to hit the recall I need."* See [ANN search](ann-search.md) for the accuracy side.
