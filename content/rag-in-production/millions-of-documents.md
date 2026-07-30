# Scaling to Millions of Documents

**What it is:** the point where your in-memory "just load all the vectors and compare against every one" approach stops fitting in RAM and stops answering in time — and what you switch to instead.

## Why it matters for an AI Engineer

In a demo you have 5,000 chunks. In production you have 10 million. The naive **flat index** (compare the query to *every* stored vector — see [../embeddings-indexing/flat-ivf-hnsw.md](../embeddings-indexing/flat-ivf-hnsw.md)) that gave perfect results on 5,000 vectors now needs to scan 10 million on every query, and the vectors alone won't fit in the memory you budgeted. Knowing *when* flat breaks, *what the index costs in GB*, and *when to stop self-hosting and pay for a managed DB* is the difference between a system that scales and one that falls over on launch day.

## The mechanism: do the memory math first

A vector's memory cost is simple:

```
bytes per vector = dimensions × 4      (float32 = 4 bytes)
```

For a modern embedding like OpenAI `text-embedding-3-small` at **1536 dims**:

- 1 vector = 1536 × 4 = **6,144 bytes ≈ 6 KB**
- 1 million vectors = **~6 GB** (raw vectors only)
- 10 million vectors = **~60 GB**

That 60 GB is *before* the index structure, which adds overhead:

- **Flat (brute force):** stores the raw vectors, ~60 GB, and scans *all* of them per query. Latency grows linearly — great recall (it's exact), terrible speed at scale.
- **HNSW:** builds a navigable graph on top. Adds roughly **1.5–2×** memory (graph links), so ~90–120 GB for 10M, but query time is ~logarithmic — milliseconds even at 10M+ vectors.
- **IVF:** clusters vectors into buckets and only searches the nearest few buckets. Memory close to raw; much faster than flat, slightly lower recall.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🔢 10M × 1536-dim vectors</span>
    <span class="darr">↓<span class="lbl">raw</span></span>
    <span class="dbox blue">≈ 60 GB float32</span>
    <span class="darr">↓<span class="lbl">+ HNSW graph</span></span>
    <span class="dbox orange">≈ 90–120 GB in RAM</span>
    <span class="darr">↓<span class="lbl">won't fit one box?</span></span>
    <span class="dbox purple">🗄️ managed / sharded vector DB</span>
  </div>
  <div class="dcap">The memory math tells you when a single machine stops being enough.</div>
</div>

### When flat breaks

Flat is exact and simple — keep it as long as you can. Rough rule of thumb:

- **< 100k vectors:** flat is fine. Queries stay under ~50ms; no reason to add complexity.
- **100k – 1M:** move to **HNSW** (or a managed DB). Flat's linear scan starts costing 100ms+.
- **1M – 10M:** HNSW on a beefy box, *or* a managed vector DB. Memory (60–120 GB) is now the constraint, not just speed.
- **> 10M – 100M+:** you need **sharding** (see [sharding-partitioning.md](sharding-partitioning.md)) and/or **disk-backed indexes** (e.g. DiskANN-style) because RAM gets expensive fast.

### Shrink the vectors instead of adding machines

Two levers cut memory before you scale out:

- **Quantization:** store vectors as int8 instead of float32 → **4× smaller** (60 GB → 15 GB) at a small recall cost. Most managed DBs do this for you.
- **Smaller dimensions / Matryoshka embeddings:** `text-embedding-3-small` can be truncated to 512 dims → 3× smaller, minor quality loss.

## Concrete example: sizing an index

```python
def index_size_gb(num_vectors: int, dims: int, index="hnsw", dtype_bytes=4):
    raw = num_vectors * dims * dtype_bytes
    overhead = {"flat": 1.0, "ivf": 1.1, "hnsw": 1.8}[index]
    return round(raw * overhead / 1e9, 1)

print(index_size_gb(10_000_000, 1536, "flat"))  # 61.4 GB
print(index_size_gb(10_000_000, 1536, "hnsw"))  # 110.5 GB
print(index_size_gb(10_000_000, 512,  "hnsw"))  # 36.8 GB  (Matryoshka trim)
assert index_size_gb(1_000_000, 1536, "flat") == 6.1
```

That one function is the first thing to run when someone says "we have 10 million documents" — it tells you whether this fits on one machine or needs a managed/distributed DB.

## How a company uses this

> A **Dubai logistics company** indexed 12M shipment records + support docs. Their self-hosted FAISS flat index used 74 GB and p95 hit 900ms — too slow and constantly OOM-killing the box. They switched to a **managed vector DB (Pinecone)** with HNSW + int8 quantization: the index dropped to ~20 GB effective, p95 fell to 60ms, and they stopped babysitting memory. The managed bill (~$500/mo) was cheaper than the engineer-hours spent on OOM incidents.

## Common mistakes
- **Sizing on raw vectors only** — forgetting the 1.8× HNSW graph overhead, then getting OOM-killed in prod.
- **Keeping flat "because it's exact"** past ~1M vectors — exactness isn't worth 800ms queries.
- **Self-hosting to save money** at 10M+ scale — the ops burden (sharding, memory tuning, failover) usually costs more than a managed DB.
- **Ignoring quantization** — int8 gives 4× headroom nearly for free.

## Interview tip
Say: *"First thing I do is the memory math: vectors × dims × 4 bytes, times ~1.8 for HNSW overhead. 10M vectors at 1536 dims is ~110GB in RAM — that tells me immediately whether it fits on one box or needs sharding or a managed DB. Below ~100k I'd keep a flat index; past ~1M I move to HNSW and reach for quantization before I reach for more machines."* Concrete numbers signal you've actually sized a real index.
