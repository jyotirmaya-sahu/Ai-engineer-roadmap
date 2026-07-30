# FAISS

**What it is:** **FAISS** (Facebook AI Similarity Search) — a free, blazing-fast **library** (not a server) for storing vectors in memory and finding nearest neighbors. It's the engine many other vector databases are built on top of.

## Why it matters for an AI Engineer

FAISS is the **low-level workhorse**. It has no server, no API, no metadata filtering, no auth — just raw, extremely fast vector math running in your own process. That makes it perfect for prototypes, notebooks, on-device search, and *understanding what a vector DB actually does under the hood*. When an interviewer asks "how does Pinecone find neighbors so fast?", the honest answer is "an ANN index like the ones in FAISS." Knowing FAISS means you understand the machinery, not just the SaaS wrapper.

## The mechanism — how it works

FAISS is a **library you import**. You build an *index object*, `add()` your vectors to it, then `search()` for neighbors. The index type you pick decides the speed/accuracy trade-off — this is the same Flat/IVF/HNSW choice covered in [Flat/IVF/HNSW](flat-ivf-hnsw.md):

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">IndexFlatIP<span class="sub">exact, brute force, small data</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">IndexIVFFlat<span class="sub">cluster + skip, faster, ~exact</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">IndexHNSWFlat<span class="sub">graph, very fast, approximate</span></span>
  </div>
  <div class="dcap">Same API, swap the index type to trade a little accuracy for a lot of speed.</div>
</div>

Key facts:
- **In-memory** — vectors live in RAM; you `faiss.write_index()` / `read_index()` to save to disk yourself.
- **`IndexFlatIP`** = inner product (dot). Normalize your vectors first and inner product **is** cosine ([see the math](cosine-dot-l2.md)).
- **No metadata** — FAISS returns integer *positions*; you keep a separate Python list/dict mapping position → your text and metadata.
- **GPU support** — it can run on GPU for enormous datasets, which is why it powers big-scale systems.

## Concrete example

```python
import faiss, numpy as np
from openai import OpenAI
oai = OpenAI()

def embed(texts):
    r = oai.embeddings.create(model="text-embedding-3-small", input=texts)
    v = np.array([d.embedding for d in r.data], dtype="float32")
    faiss.normalize_L2(v)            # normalize → inner product == cosine
    return v

docs = ["Golden Visa lasts 10 years.", "Refunds take 14 days.", "Office is in DIFC."]
X = embed(docs)

index = faiss.IndexFlatIP(1536)     # dim must match the embedder
index.add(X)                        # store vectors

q = embed(["How long is the Golden Visa valid?"])
scores, ids = index.search(q, k=2)  # top-2
print([docs[i] for i in ids[0]])    # → ['Golden Visa lasts 10 years.', ...]
```

Notice you map `ids` back to `docs` yourself — FAISS only knows positions, not your text. `normalize_L2` + `IndexFlatIP` is the cosine recipe.

## How a company usage

An engineer at a Dubai startup prototypes a document-search feature in a Jupyter notebook with FAISS `IndexFlatIP` over 5,000 chunks — instant, zero infra, runs on a laptop. Once it proves out and needs multi-user access, metadata filters, and persistence, they migrate the *same vectors* into Pinecone or pgvector. FAISS was the cheap way to validate before paying for infrastructure.

## Common mistakes / misconceptions

- **Expecting metadata filtering** — FAISS has none; you bolt on your own id→metadata map.
- **Forgetting to normalize** with `IndexFlatIP`, then getting dot-product (not cosine) rankings.
- **Losing the index on restart** — it's in RAM; you must `write_index` to persist.
- **Wrong dtype** — FAISS wants `float32`; passing `float64` errors or silently misbehaves.
- **Using it as a production multi-user DB** — it's a library, not a server; wrap it or use a real DB for that.

## Interview tip

Frame FAISS as **"the ANN engine, not a database"**: *"For a prototype I'd use FAISS in-process — flat index for exact search on small data, HNSW when it grows. It's what a lot of vector DBs use internally. For production auth, metadata filters, and persistence I'd move to pgvector or Pinecone."* Mentioning that vector DBs wrap FAISS-style indexes shows depth. See [ANN search](ann-search.md).
