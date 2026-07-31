# Embeddings API

**What it is:** A separate endpoint that turns a piece of text into a **vector** — a list of numbers (say 1,536 of them) that captures its *meaning*, so texts about similar things end up near each other in that number-space.

## Why it matters for an AI Engineer

Embeddings are the engine of **semantic search** and the retrieval half of **RAG** — the single most important application pattern on this roadmap. When a user asks a question, you embed the question, compare its vector against your stored document vectors, and pull back the closest ones. No embeddings, no RAG. They also power clustering, deduplication, recommendation, and classification. It's a distinct API from chat: you're not generating text, you're *encoding* it. Every AI Engineer needs to know how to call it, what the output means, and how cost/latency behave — because at scale you might embed *millions* of chunks.

## The mechanism — how it works

You send text to the embeddings endpoint; it returns a fixed-length array of floats — the **embedding**. Key properties:

- **Fixed dimensionality.** Every string, short or long, becomes the same-size vector (e.g. 1,536 or 3,072 dims). That's what makes them comparable.
- **Meaning ≈ direction.** Similar meanings point in similar directions. You measure closeness with **cosine similarity** (angle between vectors); 1.0 = identical direction, 0 = unrelated.
- **Batching.** You can embed many texts in one call — far cheaper and faster than one-at-a-time.
- **Cheap and fast** compared to generation — pricing is per token but rates are low, because it's one forward pass with no autoregressive decoding.
- **Query vs passage.** Some models want you to embed questions and documents slightly differently (a prefix or instruction) for best retrieval — see [Query vs passage embeddings](../embeddings-indexing/query-vs-passage-embeddings.md).

You store these vectors in a [vector database](../embeddings-indexing/pinecone.md) with an [ANN index](../embeddings-indexing/ann-search.md) so search is fast over millions of items.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">"cheap flats near metro"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 embeddings API</span>
    <span class="darr">→</span>
    <span class="dbox blue">[0.12, -0.04, 0.88, …]<span class="sub">1,536 dims</span></span>
    <span class="darr">→<span class="lbl">cosine</span></span>
    <span class="dbox green">🔍 nearest stored chunks</span>
  </div>
  <div class="dcap">Text becomes a fixed-length vector; nearby vectors mean similar meaning — the basis of semantic search.</div>
</div>

## Concrete example

```python
from openai import OpenAI
import numpy as np
client = OpenAI()

docs = ["Studio flat in JLT, 55k/yr", "2BR apartment near Dubai Marina metro",
        "Toyota Corolla 2022 for sale"]
q = "affordable apartment close to the metro"

# Batch-embed the documents in one call:
demb = client.embeddings.create(model="text-embedding-3-small", input=docs)
D = np.array([d.embedding for d in demb.data])
qv = np.array(client.embeddings.create(model="text-embedding-3-small", input=q).data[0].embedding)

cos = D @ qv / (np.linalg.norm(D, axis=1) * np.linalg.norm(qv))
best = docs[int(cos.argmax())]
print(best)   # "2BR apartment near Dubai Marina metro"
```

The car listing scores low; the metro-apartment scores high — pure meaning-matching, no keyword overlap needed.

## How a company uses this

A Dubai real-estate portal embeds all **3 million** listings and property descriptions so users can search in plain language ("family villa with a garden near a good school") instead of rigid filters. **Production reality:** they embed in **batches of ~1,000** during ingestion to stay under rate limits and keep cost low — embedding 3M short listings costs only a few tens of dollars total because embeddings are cheap. They store vectors in a managed vector DB with an HNSW index so a query returns nearest matches in **single-digit milliseconds**. When they re-embed after a model upgrade, they run it through the [Batch API](batch-api.md) overnight at half price.

## Common mistakes

- **Mixing embedding models** — vectors from different models aren't comparable; re-embed *everything* if you switch.
- **Not batching** — one call per document is slow and pricey at scale.
- **Embedding huge chunks** — long text gives a mushy averaged vector (see [Chunking](../chunking.md)); keep chunks focused.
- **Forgetting query/passage asymmetry** for models that need it, hurting recall.
- **Storing vectors in a plain list and doing brute-force search** past a few thousand items — use an ANN index.

## Interview tip
Say: *"Embeddings map text to a fixed-length vector where cosine similarity approximates semantic similarity — that's the retrieval engine of RAG and semantic search. It's a separate, cheap, batchable endpoint. Critical rules: never mix models, keep chunks focused so vectors stay sharp, and store in a vector DB with an ANN index for millisecond search at scale."* That ties the endpoint straight to RAG, which is what they're really testing.
