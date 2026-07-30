# Index Tuning at Scale (HNSW Params)

**What it is:** the three dials on an HNSW index — `M`, `ef_construction`, and `ef_search` — and how you trade **recall** (did we find the truly nearest vectors?) against **latency** and **memory** by turning them.

## Why it matters for an AI Engineer

HNSW (Hierarchical Navigable Small World) is the default index behind almost every production vector DB — Pinecone, Qdrant, Weaviate, pgvector, FAISS (see [../embeddings-indexing/flat-ivf-hnsw.md](../embeddings-indexing/flat-ivf-hnsw.md)). Out of the box it's "fine," but at 10M vectors the defaults often cost you either recall (wrong chunks retrieved → wrong answers) or latency (blowing your p95 budget). Knowing which knob does what — and being able to say "raise `ef_search` from 40 to 100 to buy 3% recall for +8ms" — is exactly the senior-level detail interviewers probe.

## The mechanism: what the three knobs do

HNSW is a graph you walk to find near neighbors. The knobs control how *dense* that graph is and how *hard* you search it.

| Knob | Set at | Controls | Higher value → |
|---|---|---|---|
| **M** | build time | # links per node | better recall, **more memory**, slower build |
| **ef_construction** | build time | effort spent wiring the graph | better recall, slower/more expensive build |
| **ef_search** | **query time** | how wide you explore per query | better recall, **higher latency** |

The crucial one operationally is **`ef_search`**, because it's set *per query* — you can tune recall vs latency live, without rebuilding the index. `M` and `ef_construction` are baked in at build time; changing them means re-indexing.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">ef_search = 40<span class="sub">fast, ~92% recall</span></span>
    <span class="darr">→<span class="lbl">turn up</span></span>
    <span class="dbox orange">ef_search = 100<span class="sub">+8ms, ~97% recall</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">ef_search = 400<span class="sub">+50ms, ~99.5% recall</span></span>
  </div>
  <div class="dcap">ef_search is the live recall↔latency dial — raise it until recall is good enough, stop before latency hurts.</div>
</div>

### Rough numbers for ~10M vectors, 1536 dims

These are ballpark production defaults — always verify on *your* data:

- **M = 16** (default). Memory ≈ raw × ~1.8. Good for most. Raise to **32–48** for high-recall needs (adds memory), drop to **8** to save RAM on lower-stakes data.
- **ef_construction = 128–200.** Higher = better graph but slower build (a 10M rebuild can go from 20min to 2hr). 200 is a solid production choice; you build once, query millions of times.
- **ef_search = 40 → 100 → 200.** Start at ~64. If offline eval shows recall@10 below your target (say 95%), raise it. Watch p95 climb as you do.

**Rule of thumb:** `ef_search` must be ≥ `top_k`, and realistically 4–10× `top_k`. Asking for top-10 with `ef_search=10` gives poor recall.

## Concrete example: tuning against a labeled eval set

You can't tune blind — you need a small set of queries with known-correct doc IDs (see [debugging-retrieval-failures.md](debugging-retrieval-failures.md)). Then sweep `ef_search`:

```python
import time

def recall_at_k(index, eval_set, ef_search, k=10):
    hits, total, latencies = 0, 0, []
    for q_vec, gold_ids in eval_set:            # gold_ids = known-relevant doc ids
        t = time.perf_counter()
        got = index.query(q_vec, top_k=k, ef_search=ef_search)
        latencies.append((time.perf_counter() - t) * 1000)  # ms
        hits  += len(set(got) & set(gold_ids))
        total += len(gold_ids)
    latencies.sort()
    return hits / total, latencies[int(len(latencies) * 0.95)]  # recall, p95 ms

for ef in (40, 64, 100, 200, 400):
    recall, p95 = recall_at_k(index, eval_set, ef)
    print(f"ef_search={ef:>3}  recall={recall:.3f}  p95={p95:.1f}ms")

# pick the smallest ef that clears your recall target within the latency budget
```

Typical output climbs recall from ~0.92 to ~0.99 while p95 rises from ~15ms to ~65ms. You pick the **smallest `ef_search` that meets your recall target** — buying recall you don't need just costs latency.

## How a company uses this

> A **Dubai insurance firm**'s claims-assistant was returning subtly wrong policy clauses ~1 in 20 times. Investigation showed recall@10 was only 89% — HNSW was missing the right chunk. They were on defaults (`M=16, ef_search=40`). Rebuilding with `M=32, ef_construction=200` and raising `ef_search` to 128 pushed recall to 98.5%, at the cost of +12ms p95 (still well under their 1.5s budget) and ~40% more index RAM. Wrong-clause complaints dropped off. The lesson: recall problems are often *index tuning*, not chunking or the model.

## Common mistakes
- **Trying to change `M` at query time** — it's build-time; you must re-index.
- **`ef_search` < `top_k`** — mathematically can't return good top-k.
- **Cranking every knob to max** — you pay memory + latency for recall you may not need. Tune to a *target*.
- **Tuning without an eval set** — "recall" is a number you must measure on labeled queries, not vibes.

## Interview tip
Say: *"HNSW has three knobs: M and ef_construction are build-time and control graph density and memory; ef_search is query-time and is the live recall-vs-latency dial. At 10M vectors I'd start around M=16–32, ef_construction=200, and sweep ef_search against a labeled eval set — I pick the smallest ef_search that clears my recall target inside the p95 budget. If recall's bad, that's usually where I look before blaming the embedding model."*
