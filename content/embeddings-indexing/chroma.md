# Chroma

**What it is:** **Chroma** (ChromaDB) — a lightweight, open-source vector database that runs **right inside your Python app** with almost no setup. It's the friendliest on-ramp to vector search: `pip install chromadb` and you're indexing in five lines.

## Why it matters for an AI Engineer

Between "FAISS is too bare-bones" and "Pinecone is a whole cloud account," Chroma is the sweet spot for **building and demoing RAG fast**. It gives you what FAISS lacks — metadata, persistence, and even *embedding for you* — while staying free and local. Most tutorials and a lot of real prototypes use it. For your portfolio project, Chroma lets you ship a working RAG demo without a cloud bill, which is exactly the "I built this" story a Dubai employer wants to see.

## The mechanism — how it works

Chroma's model is **collection → documents**. A *collection* is like a table of vectors. The nice trick: you can hand Chroma **raw text** and it embeds it for you with a built-in model, or you pass your own vectors. It stores the vector, the original document text, and metadata **together**, and can persist to disk.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 documents + metadata</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 embed<span class="sub">built-in or your own</span></span>
    <span class="darr">→</span>
    <span class="dbox blue wide">🗄️ Chroma collection<span class="sub">vector + text + meta, on disk</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🔍 query → docs</span>
  </div>
  <div class="dcap">Chroma stores text, vector, and metadata together and can embed for you — minimal glue code.</div>
</div>

Key points:
- **`PersistentClient(path=...)`** saves to disk so your index survives restarts; `Client()` alone is in-memory only.
- **Returns your actual documents and metadata**, not just ids — less bookkeeping than FAISS.
- **`where=` metadata filters** work like Pinecone's.
- Uses HNSW under the hood; default distance can be L2 — **set `hnsw:space` to `cosine`** for normalized text embeddings.
- Great for laptops and single-server apps; not built for the millions-of-vectors, multi-region scale where you'd reach for Pinecone or a dedicated engine.

## Concrete example

```python
import chromadb
from chromadb.utils import embedding_functions

client = chromadb.PersistentClient(path="./chroma_db")   # persists to disk
oai_ef = embedding_functions.OpenAIEmbeddingFunction(
    model_name="text-embedding-3-small",                 # OPENAI_API_KEY in env
)
col = client.get_or_create_collection(
    "dubai-docs", embedding_function=oai_ef,
    metadata={"hnsw:space": "cosine"},                   # use cosine, not default L2
)

# --- add (Chroma embeds the text for you) ---
col.add(
    ids=["visa1", "ref1"],
    documents=["Golden Visa lasts 10 years.", "Refunds take 14 days."],
    metadatas=[{"topic": "visa"}, {"topic": "refund"}],
)

# --- query with a metadata filter ---
res = col.query(
    query_texts=["How long is the Golden Visa valid?"],
    n_results=2, where={"topic": "visa"},
)
print(res["documents"][0][0])   # → "Golden Visa lasts 10 years."
```

You never manually embedded or stored a vector — Chroma did both, and it handed the original text straight back.

## How a company usage

A team at a Dubai agency builds a client demo: a RAG assistant over a real-estate brochure set. Chroma with a `PersistentClient` runs on one small server, embeds the brochures with OpenAI, filters by `community` and `bedrooms` metadata, and survives restarts — all without provisioning any managed database. If the client signs and traffic grows, they lift the vectors into pgvector or Pinecone.

## Common mistakes / misconceptions

- **Using `Client()` and losing data on restart** — use `PersistentClient(path=...)`.
- **Leaving the default L2 space** for normalized embeddings — set `hnsw:space="cosine"`.
- **Expecting Pinecone-scale performance** — Chroma shines small/medium, not at tens of millions of vectors across regions.
- **Mixing an embedding function on `add` but not on `query`** — use the same collection config for both, always.

## Interview tip

Say: *"Chroma is my go-to for prototypes and demos — local, open-source, stores text + metadata, and can embed for me. I set `hnsw:space=cosine` and `PersistentClient`. When it needs to scale or multi-tenant, I graduate to pgvector or Pinecone."* That shows you match the tool to the stage. Compare with [Pinecone](pinecone.md), [FAISS](faiss.md), and [pgvector](pgvector.md).
