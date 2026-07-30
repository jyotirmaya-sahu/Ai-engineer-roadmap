# Pinecone

**What it is:** A **fully-managed, cloud-hosted vector database** — you push your embeddings to it and it handles storing, indexing, and fast similarity search at scale, with no servers for you to run.

## Why it matters for an AI Engineer

Once you have millions of vectors, a NumPy dot-product loop is far too slow. You need a purpose-built vector store, and Pinecone is the **"just make it work in the cloud" default** — SaaS, auto-scaling, no infra to manage. Startups reach for it to ship fast. Knowing Pinecone (plus one open alternative) covers the vector-DB question in almost every AI Engineer interview. It's the storage-and-search layer of your RAG pipeline made someone else's problem.

## The mechanism — how it works

Pinecone is organized as **index → namespaces → vectors**. Each vector carries an **id**, the **embedding**, and **metadata** (arbitrary key–values you can filter on). Under the hood it uses ANN indexing (see [ANN search](ann-search.md)) so search is sub-linear.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 chunks</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 embed</span>
    <span class="darr">→</span>
    <span class="dbox blue wide">🗄️ Pinecone index<span class="sub">id + vector + metadata</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🔍 query → top-k</span>
  </div>
  <div class="dcap">Upsert vectors once; query returns the k nearest, optionally filtered by metadata.</div>
</div>

Two things you configure per index:
- **Dimension** — must exactly match your embedder (1536 for `text-embedding-3-small`, 1024 for `bge-m3`). Mismatch = rejected.
- **Metric** — `cosine`, `dotproduct`, or `euclidean` (see [Cosine/Dot/L2](cosine-dot-l2.md)). Use `cosine` for normalized text embeddings.

Its killer feature is **metadata filtering**: "find the nearest chunks *where `lang == 'ar'` and `year >= 2024`*" in one call — vector search + a database WHERE clause together. **Namespaces** partition one index per tenant (e.g. per customer) so a search only ever touches that tenant's data — huge for multi-tenant SaaS. Modern Pinecone is **serverless**: you pay for usage, not idle servers.

## Concrete example

```python
from pinecone import Pinecone, ServerlessSpec
from openai import OpenAI

pc = Pinecone(api_key="...")          # PINECONE_API_KEY
oai = OpenAI()

# create_index errors if it already exists — guard so re-runs are safe
if "dubai-docs" not in [i.name for i in pc.list_indexes()]:
    pc.create_index(
        name="dubai-docs", dimension=1536, metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
idx = pc.Index("dubai-docs")

def embed(t):
    return oai.embeddings.create(model="text-embedding-3-small", input=t).data[0].embedding

# --- upsert (ingest) ---
idx.upsert(vectors=[
    {"id": "visa1", "values": embed("Golden Visa lasts 10 years."),
     "metadata": {"lang": "en", "topic": "visa"}},
    {"id": "ref1", "values": embed("Refunds take 14 days."),
     "metadata": {"lang": "en", "topic": "refund"}},
])

# --- query with a metadata filter ---
res = idx.query(
    vector=embed("How long is the Golden Visa valid?"),
    top_k=3, include_metadata=True,
    filter={"topic": {"$eq": "visa"}},
)
print(res.matches[0].metadata)   # → the visa chunk
```

Cosine is the metric, so normalized OpenAI vectors compare correctly and the filter narrows the search to visa chunks only.

## How a company usage

A Dubai fintech startup ships a customer-support RAG bot in a week using serverless Pinecone: one index, a **namespace per client bank** so data never mixes, and metadata filters on `product` and `language`. No DevOps hire, scales from 10k to 10M vectors without a config change — exactly why cash-strapped startups pick managed.

## Common mistakes / misconceptions

- **Dimension mismatch** — index says 1536, you send 1024 → error. Match the embedder.
- **Wrong metric** — `euclidean` on un-normalized vectors gives odd rankings; use `cosine` for text.
- **Forgetting `include_metadata=True`** then wondering where the source text went.
- **Storing whole documents as metadata** — keep metadata small (ids, tags); store big text elsewhere.
- **Not using namespaces for multi-tenant apps** — then leaking one customer's data into another's results.

## Interview tip

Position Pinecone as **"managed, ship-fast, great metadata filtering and multi-tenancy via namespaces — the trade-off is vendor lock-in and cost at scale."** Then name an alternative you'd self-host, like [pgvector](pgvector.md) or [Chroma](chroma.md), to show you know the whole landscape.
