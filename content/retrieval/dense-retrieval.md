# Dense Retrieval

**The one-line idea:** Dense retrieval finds relevant chunks by **meaning** — it turns your query into a vector and grabs the chunks whose vectors sit closest to it, so "how do I cancel my plan?" can match a paragraph titled "Terminating a subscription" even with zero shared words.

## Why it matters for an AI Engineer

This is the *default* search in almost every RAG system, so you have to understand it cold. Its superpower is **semantic matching**: it handles paraphrases, synonyms, and typo-ish wording that keyword search would miss. Its blind spot — which you'll get grilled on — is **exact terms**: product codes, names, and rare acronyms. Knowing *why* it's blind there (and that hybrid search fixes it) is the difference between "I use a vector DB" and "I understand what my vector DB can and can't do."

## The mechanism — how it works

Three ideas stacked together:

**1. Embeddings.** An embedding model maps any text to a fixed-length vector (e.g. 1536 numbers) so that texts with *similar meaning* land near each other in that space. "Dubai" and "UAE" end up close; "Dubai" and "banana" end up far apart. Your chunks were embedded offline and stored; at query time you embed the *question* with the **same model**.

**2. Similarity = distance.** "Closest" is measured by **cosine similarity** — the angle between two vectors. Cosine 1.0 = identical direction (same meaning), 0 = unrelated, −1 = opposite. Most systems normalize vectors so cosine and nearest-neighbor agree.

**3. ANN, not brute force.** Comparing your query against millions of chunk vectors one by one is too slow. Vector DBs use **Approximate Nearest Neighbor (ANN)** indexes (like HNSW) that trade a tiny bit of accuracy for enormous speed — sub-millisecond search over millions of vectors. "Approximate" is why occasionally a relevant chunk is missed; that's the price of speed.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ "how do I cancel my plan?"</span>
    <span class="darr">→<span class="lbl">embed</span></span>
    <span class="dbox purple">🔢 query vector</span>
    <span class="darr">→<span class="lbl">ANN search</span></span>
    <span class="dbox blue">🗄️ vector store</span>
    <span class="darr">→<span class="lbl">cosine</span></span>
    <span class="dbox green">✅ "Terminating a subscription…"</span>
  </div>
  <div class="dcap">Same model embeds query and chunks; nearest vectors by cosine similarity win — meaning, not words.</div>
</div>

## Concrete example

Using LangChain with an OpenAI embedding model and an in-memory vector store (2026-current API):

```python
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

docs = [
    Document(page_content="To terminate a subscription, open Settings > Billing and click Cancel."),
    Document(page_content="Bananas are a good source of potassium."),
    Document(page_content="Refunds are processed within 5 business days of cancellation."),
]

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
store = FAISS.from_documents(docs, embeddings)

# dense retrieval: no shared keywords with the docs, but meaning matches
retriever = store.as_retriever(search_kwargs={"k": 2})
hits = retriever.invoke("how do I cancel my plan?")
for h in hits:
    print(h.page_content)
# -> "To terminate a subscription..."   (matched on MEANING, not words)
# -> "Refunds are processed within 5 business days of cancellation."
```

Notice the query shares no words with the top hit — "cancel" ≠ "terminate," "plan" ≠ "subscription" — yet it's retrieved. That's dense retrieval earning its keep.

## How a company uses this

A **Dubai real-estate portal** built a "describe your ideal home" search. Users type "quiet 2-bed near a metro with a sea view," and dense retrieval matches listings whose descriptions say "peaceful two-bedroom, walkable to the station, waterfront-facing" — none of the exact words, all of the meaning. Keyword search would have returned almost nothing; semantic search nails it.

## Common mistakes / misconceptions

- **Using different embedding models for indexing and querying.** The vectors must live in the *same* space. Mismatch = garbage results. Same model, always.
- **Expecting it to find exact codes.** "E-4021" or "ADCB-SAV-01" often *won't* surface — dense search averages meaning, and a code carries little semantic signal. That's a job for sparse/hybrid search.
- **Thinking cosine "0.82" is a truth score.** Similarity scores are only meaningful *relative to each other* and to a threshold you tune per corpus — they're not calibrated probabilities.
- **Ignoring that ANN is approximate.** A relevant chunk can occasionally be skipped; raising the index's search-effort setting trades speed for recall.

## Interview tip
Say: *"Dense retrieval embeds the query with the same model as the chunks and finds nearest neighbors by cosine similarity, using an ANN index like HNSW for speed. It's my default because it handles paraphrasing, but it's weak on exact terms — codes, names, acronyms — which is exactly why I pair it with sparse search in a hybrid setup."* Naming HNSW and the exact-term weakness signals real production experience.

See also: **Sparse Retrieval (BM25/TF-IDF)** for the keyword complement, and **Hybrid Search** to combine both.
