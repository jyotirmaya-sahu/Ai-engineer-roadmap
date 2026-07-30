# Cohere Multilingual Embeddings

**What it is:** Cohere's **Embed** models (current line: `embed-v4.0`, plus the earlier `embed-multilingual-v3.0`) — hosted embeddings built from the ground up for **100+ languages**, so an Arabic query can match an English document and vice versa.

## Why it matters for an AI Engineer

In Dubai, your users type in **Arabic, English, Hindi, Urdu, Tagalog** — often mixed in one sentence. A monolingual embedder treats "متى ينتهي التأشيرة" and "when does the visa expire" as unrelated. Cohere's multilingual models put both near the *same* answer, whatever language the document is in. This is **cross-lingual retrieval**, and it's exactly the capability a UAE employer will probe. Cohere is also one of the few top-tier hosted options besides OpenAI, so knowing it gives you a real alternative to name.

## The mechanism — how it works

Cohere trains its embedder on many languages *simultaneously*, so the vector space is **shared**: the meaning "the visa expires in 10 years" lands in the same region whether the sentence was Arabic, English, or French.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🇦🇪 "التأشيرة صالحة ١٠ سنوات"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 Cohere embed-v4.0</span>
    <span class="darr">↓</span>
    <span class="dbox green wide">🔢 vector A</span>
  </div>
  <div class="flow v">
    <span class="dbox gray">🇬🇧 "The visa is valid for 10 years"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 Cohere embed-v4.0</span>
    <span class="darr">↓</span>
    <span class="dbox green wide">🔢 vector B ≈ vector A</span>
  </div>
  <div class="dcap">Two languages, same meaning → nearly the same vector. That's cross-lingual retrieval.</div>
</div>

Two Cohere-specific features to know:

- **`input_type`** — you tell Cohere the *role* of the text: `search_document` when indexing, `search_query` when searching (also `classification`, `clustering`). This is Cohere's version of the E5 query/passage split, and skipping it hurts retrieval.
- **Compression / int8 & binary embeddings** — Cohere can return quantized vectors (int8 or even binary) that cut storage massively with tiny accuracy loss — valuable at millions of docs. `embed-v4.0` also handles **images and long documents**, and supports Matryoshka-style shorter dimensions like OpenAI.

## Concrete example

```python
import cohere, numpy as np
co = cohere.ClientV2()   # reads COHERE_API_KEY

docs = ["التأشيرة الذهبية صالحة لمدة ١٠ سنوات.",   # Arabic
        "Refunds are processed within 14 days."]
d = co.embed(texts=docs, model="embed-v4.0",
             input_type="search_document",
             embedding_types=["float"]).embeddings.float
q = co.embed(texts=["When does the Golden Visa expire?"],
             model="embed-v4.0",
             input_type="search_query",
             embedding_types=["float"]).embeddings.float[0]

D = np.array(d); q = np.array(q)
D /= np.linalg.norm(D, axis=1, keepdims=True); q /= np.linalg.norm(q)
print(docs[int((D @ q).argmax())])   # → the Arabic Golden Visa line, from an English query
```

An English question retrieves an Arabic answer. That's the payoff.

## How a company uses this

A Dubai government chatbot answers residents who ask in Arabic, English, or Hindi. All the source policy PDFs are bilingual Arabic/English. Using Cohere `embed-v4.0` with `input_type`, a Hindi question retrieves the correct English *and* Arabic policy paragraph — one index, every language, no per-language model to maintain. They store int8 vectors to keep the multi-million-chunk index affordable.

## Common mistakes / misconceptions

- **Using the same `input_type` for docs and queries.** Use `search_document` for indexing, `search_query` for searching — always.
- **Assuming multilingual = worse English.** Cohere's multilingual models are strong on English too; you don't sacrifice much.
- **Mixing float and int8 vectors in one index** — pick one representation and stay consistent.
- **Thinking any embedder does cross-lingual.** Most don't. You need a model *trained* multilingually (Cohere, multilingual-E5, bge-m3) — see [Multilingual & Domain-Specific](multilingual-domain-specific.md).

## Interview tip

Cohere is your answer to "how would you handle Arabic + English users in Dubai?" Say: *"A multilingual embedder with a shared vector space — Cohere `embed-v4.0` or `bge-m3` — using `input_type`/prefixes so cross-lingual retrieval works, plus int8 vectors to keep the index cheap at scale."* That names a real model, the config gotcha, and a scaling lever in one breath.
