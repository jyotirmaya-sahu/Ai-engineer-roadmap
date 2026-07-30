# e5 / BGE Embeddings

**What it is:** The two most popular **open-source, self-hostable** embedding model families — Microsoft's **E5** and BAAI's **BGE** — that you download and run yourself instead of calling an API.

## Why it matters for an AI Engineer

Not every project can send data to OpenAI. Banks, healthcare, and government in the UAE often need embeddings that run **on their own servers** — for data residency, privacy, and zero per-call cost. E5 and BGE are the go-to open models: they're free, they run on a modest GPU (or even CPU), and the best ones now **rival OpenAI on retrieval quality**. Being able to say "I'll host BGE for the private data and use OpenAI for the rest" shows you understand the real trade-off every enterprise faces.

## The mechanism — how it works

Same idea as any embedder: text → fixed-length vector, similar meaning → similar direction. The difference is you run the model with `sentence-transformers` locally instead of hitting an API.

Two things make E5/BGE distinctive:

**1. Instruction prefixes.** These models were trained expecting a short instruction glued to the front of the text. You **must prefix queries and documents differently**:

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">Query text</span>
    <span class="darr">→</span>
    <span class="dbox orange wide">"query: How long is the Golden Visa?"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 E5</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔢 vector</span>
  </div>
  <div class="flow v">
    <span class="dbox gray">Document text</span>
    <span class="darr">→</span>
    <span class="dbox orange wide">"passage: Golden Visa lasts 10 years."</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 E5</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔢 vector</span>
  </div>
  <div class="dcap">E5 needs "query:" / "passage:" prefixes. BGE uses an instruction on the query only. Skipping this quietly wrecks retrieval.</div>
</div>

**2. Sizes.** Both come in small/base/large. Common picks:

| Model | Dims | Notes |
|---|---|---|
| `intfloat/e5-large-v2` | 1024 | strong English, needs query:/passage: |
| `intfloat/multilingual-e5-large` | 1024 | 100 languages incl. **Arabic** |
| `BAAI/bge-large-en-v1.5` | 1024 | top English retrieval |
| `BAAI/bge-m3` | 1024 | multilingual + long docs, very popular |

The **MTEB leaderboard** on Hugging Face is where you compare these against each other and against OpenAI — it's the standard scoreboard.

## Concrete example

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("intfloat/multilingual-e5-large")   # downloads once, runs locally

docs = ["passage: Golden Visa lasts 10 years.",
        "passage: Refunds take 14 days."]
query = "query: How long is the Golden Visa valid?"

D = model.encode(docs, normalize_embeddings=True)               # normalize built in
q = model.encode(query, normalize_embeddings=True)

sims = D @ q                                                     # cosine similarity
print(docs[int(sims.argmax())])                                 # → the Golden Visa passage
```

No API key, no network, no per-token cost. The prefixes and `normalize_embeddings=True` are the only gotchas.

## How a company usage

A UAE government service processing citizen documents can't send that data to a US API. They self-host `bge-m3` on an internal GPU: it handles Arabic and English, works on long documents, and every embedding is free after the hardware. The same model powers both the Arabic and English search boxes on their portal.

## Common mistakes / misconceptions

- **Forgetting the prefixes.** No `query:`/`passage:` on E5 = garbage retrieval that *looks* like it works on easy cases and fails on hard ones.
- **Mixing model versions** between ingest and query — vectors won't match.
- **Assuming open = worse.** `bge-m3` and `multilingual-e5-large` are genuinely competitive; check MTEB, don't guess.
- **Ignoring dimension mismatch** — E5-large is 1024 dims, OpenAI small is 1536; your vector DB index dimension must match the model exactly.

## Interview tip

When asked "OpenAI or open-source embeddings?", frame it as a **data-residency and cost decision, not a quality one**: *"For public data I'd use `text-embedding-3-small` for zero ops. For a UAE bank's private docs I'd self-host `bge-m3` — Arabic support, data stays in-country, and no per-call cost — after checking MTEB that quality holds."* See [OpenAI text-embedding-3](openai-text-embedding-3.md) for the hosted side and [Query vs Passage](query-vs-passage-embeddings.md) for why the prefixes exist.
