# Weaviate

**What it is:** **Weaviate** — an open-source, production-grade vector database you can self-host or run in their cloud. It's a "batteries-included" option: built-in **hybrid search**, modules that embed and rerank for you, and a schema like a real database.

## Why it matters for an AI Engineer

Once RAG goes to production, pure vector search often isn't enough — you also want **keyword matching** (for exact terms, product codes, names) fused with semantic search. Weaviate ships that **hybrid search** natively, which is a genuine accuracy upgrade you'd otherwise assemble by hand. It sits between "just a store" (Chroma/FAISS) and "managed SaaS" (Pinecone): more built-in features, and open-source so you can self-host — which matters for UAE data-residency. Knowing it rounds out your vector-DB vocabulary with the hybrid-search angle interviewers love.

## The mechanism — how it works

Weaviate organizes data into **collections** (classes) with a schema. Each object has properties (your metadata/text) and a vector. You either bring your own vectors or let a **vectorizer module** embed on ingest and query.

Its standout is **hybrid search** — it runs semantic (vector) *and* keyword (BM25) search, then fuses the two ranked lists:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ query</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 vector search<span class="sub">meaning</span></span>
    <span class="darr">→</span>
    <span class="dbox orange wide">fuse (α)</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ ranked results</span>
  </div>
  <div class="flow">
    <span class="dbox gray">❓ same query</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔤 BM25 keyword<span class="sub">exact terms</span></span>
    <span class="darr">→</span>
    <span class="dbox orange wide">fuse (α)</span>
  </div>
  <div class="dcap">Hybrid search blends semantic + keyword. α=1 pure vector, α=0 pure keyword, ~0.5 both.</div>
</div>

The `alpha` knob controls the blend: `1.0` = pure vector, `0.0` = pure keyword, `~0.5` = balanced. This fixes the classic vector-only weakness — semantic search can miss an **exact** term like a policy number "GV-2026" or a proper name, which BM25 nails. Weaviate uses HNSW indexing internally, supports metadata filters, and offers optional reranker and generative modules.

## Concrete example

```python
import weaviate
from weaviate.classes.query import HybridFusion

client = weaviate.connect_to_local()          # or connect_to_weaviate_cloud(...)
col = client.collections.get("DubaiDocs")     # schema created beforehand

# hybrid search: semantic + keyword, blended by alpha
res = col.query.hybrid(
    query="How long is the Golden Visa valid GV-2026?",
    alpha=0.5,                                 # 0.5 = balance meaning + exact terms
    limit=3,
    fusion_type=HybridFusion.RELATIVE_SCORE,
)
for o in res.objects:
    print(o.properties["text"])
client.close()
```

The exact token `GV-2026` gets caught by the keyword half even if the semantic half drifts — that's the whole reason to reach for hybrid.

## How a company usage

A Dubai insurance company's RAG assistant fields queries like "coverage for policy P-88431 in the DIFC clinic." Pure vector search fuzzes the policy number; pure keyword misses the *meaning* of "coverage for a clinic." Weaviate's hybrid search, self-hosted inside their network for data residency, returns the right document by fusing both — the number matched exactly, the intent matched semantically.

## Common mistakes / misconceptions

- **Ignoring `alpha`** — leaving it default when your data is full of codes/names that need keyword weight.
- **Thinking hybrid is always better** — for purely conceptual questions, pure vector can win; tune α on your data.
- **Skipping the schema** — Weaviate wants a collection/class defined; it's not as schema-free as Chroma.
- **Forgetting `client.close()`** — the v4 client holds a connection you should release.
- **Assuming you must use its vectorizer** — you can bring your own vectors from any embedder.

## Interview tip

Weaviate is your **hybrid search** name-drop: *"When exact terms matter — IDs, names, codes — I'd use Weaviate's built-in hybrid search to fuse BM25 keyword with vector search, tuning `alpha`. It's open-source so I can self-host it for UAE data residency."* That connects a real accuracy technique to a real deployment constraint. Contrast with [Pinecone](pinecone.md) and [pgvector](pgvector.md).
