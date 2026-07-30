# OpenAI text-embedding-3

**What it is:** OpenAI's current family of embedding models — `text-embedding-3-small` and `text-embedding-3-large` — that turn any piece of text into a list of numbers (a **vector**) so a computer can measure how similar two texts *mean*.

## Why it matters for an AI Engineer

RAG lives or dies on retrieval, and retrieval starts here: the embedding model decides whether "How do I renew my Golden Visa?" lands near the chunk that actually answers it. If the vectors are bad, no reranker or clever prompt saves you. `text-embedding-3` is the **default choice most teams reach for first** — it's cheap, one API call, no GPU to host, and good enough that you only move off it when you have a specific reason. Knowing its dims, cost, and the one trick it has (shortening dimensions) is table-stakes interview knowledge.

## The mechanism — how it works

An embedding model is a neural network trained so that texts with **similar meaning** get vectors that point in **similar directions**. "car" and "automobile" land close; "car" and "banana" land far. It's not keyword matching — "physician" and "doctor" share no letters but sit right next to each other.

Each model outputs a fixed-length vector:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 "Golden Visa lasts 10 years"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 text-embedding-3-small</span>
    <span class="darr">→</span>
    <span class="dbox blue wide">🔢 [0.021, -0.11, …]<span class="sub">1536 numbers</span></span>
  </div>
  <div class="dcap">Text in, one fixed-length vector out. Similar meaning → similar vector.</div>
</div>

| Model | Default dims | Relative cost | Use when |
|---|---|---|---|
| `text-embedding-3-small` | **1536** | ~5× cheaper | default; most RAG apps |
| `text-embedding-3-large` | **3072** | higher | you need max accuracy |

The clever feature is **Matryoshka / `dimensions` shortening**. These models are trained so you can *ask for a shorter vector* and still keep most of the quality — the important information is packed into the earlier numbers (like nested Russian dolls). You can request `text-embedding-3-large` at 1024 dims instead of 3072 and get a smaller, faster, cheaper index that's still strong. This is a real production lever: fewer dimensions = less storage and faster search.

## Concrete example

```python
from openai import OpenAI
import numpy as np

client = OpenAI()

def embed(texts, dims=1536):
    r = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
        dimensions=dims,          # shorten here if you want
    )
    v = np.array([d.embedding for d in r.data])
    return v / np.linalg.norm(v, axis=1, keepdims=True)  # normalize → dot == cosine

docs = ["Golden Visa lasts 10 years.", "Refunds take 14 days.", "The office is in DIFC."]
D = embed(docs)
q = embed(["How long is the Golden Visa valid?"])[0]

sims = D @ q                      # cosine similarity, since everything is normalized
best = sims.argmax()
print(docs[best])                 # → "Golden Visa lasts 10 years."
```

You send text, get vectors back, normalize them, and a plain dot product now gives you cosine similarity. That's the whole loop.

## How a company uses this

A Dubai proptech embeds every property listing description with `text-embedding-3-small` at 1536 dims and stores them in Pinecone. A buyer types "quiet 2-bed near a metro station with a sea view" — that query is embedded the same way, and the closest listing vectors come back even though the listings never used the word "quiet." One API, no ML infra, ships in an afternoon. They only tested `-large` later, for the harder Arabic queries.

## Common mistakes / misconceptions

- **Embedding docs and the query with *different* models.** They must be the same model — vectors from different models live in different spaces and can't be compared.
- **Forgetting to normalize**, then wondering why dot-product scores look weird. Normalize once, then dot = cosine.
- **Assuming bigger is always better.** `-small` beats a poorly-chunked `-large` setup every time; fix chunking before upgrading the model.
- **Ignoring the token limit** (~8191 tokens/input). Huge chunks get silently truncated — you embed only the first part.

## Interview tip

If asked "which embedding model would you start with and why," say: *"`text-embedding-3-small` at 1536 dims — it's cheap, hosted, and strong; I'd only move to `-large` or an open model if evals show retrieval misses, and I'd use the `dimensions` parameter to trade a little accuracy for a smaller, faster index."* That one sentence signals you've actually shipped RAG. See also [e5 / BGE](e5-bge.md) for the open-source alternative and [Cosine / Dot / L2](cosine-dot-l2.md) for the math.
