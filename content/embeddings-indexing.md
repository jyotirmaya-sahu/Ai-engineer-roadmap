# Embeddings & Indexing

**The one-line idea:** Embeddings turn text into lists of numbers (vectors) that capture *meaning*, and indexing stores those vectors so you can find the most similar ones fast — this is how search works on *concepts* instead of exact words.

## Why we even need it

Old-school search matches keywords. Search for "car" and it misses every document that says "automobile," "vehicle," or "sedan." It has no idea those mean the same thing — it's matching letters, not meaning.

RAG needs the opposite. When a user asks *"how do I cancel my subscription?"* you want to retrieve the passage titled *"Ending your membership"* — different words, same meaning. That's **semantic search**, and it only works if you can turn text into something a computer can compare by *meaning*.

That "something" is an **embedding**: a vector — say 1,536 numbers — that represents a piece of text as a point in space. The trick that makes it all work: **texts with similar meaning land close together in that space.** "Cancel subscription" and "end membership" become nearby points; "pizza recipe" lands far away. Now "find relevant text" becomes "find nearby points" — a geometry problem a computer is great at.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📝 "end my membership"</span>
      <span class="darr">→<span class="lbl">embedding model</span></span>
      <span class="dbox purple">🔢 [0.12, -0.4, …]</span>
      <span class="darr">→</span>
      <span class="dbox blue">🗄️ vector store</span>
    </div>
    <div class="flow">
      <span class="dbox gray">❓ "cancel subscription"</span>
      <span class="darr">→</span>
      <span class="dbox purple">🔢 query vector</span>
      <span class="darr">→<span class="lbl">nearest neighbors</span></span>
      <span class="dbox green">✅ closest passages</span>
    </div>
  </div>
  <div class="dcap">The model translates text to vectors; the index finds the vectors nearest to your query — that's semantic search.</div>
</div>

## The two halves of this topic

This node has two clearly separate jobs, and it helps to keep them apart:

- **The embedding MODEL — the translator.** It converts text to vectors. Different models vary in quality, cost, vector size, language coverage, and speed. Picking the right one is the single biggest lever on retrieval quality.
- **The vector STORE / index — the filing cabinet.** Once you have millions of vectors, you can't compare the query against every one (too slow). An index is a clever data structure that finds the *approximate* nearest neighbors in milliseconds instead of scanning everything.

You almost always mix and match: one embedding model + one vector store.

## The pieces you'll learn (and when to reach for each)

| Tile | Half | Reach for it when |
|---|---|---|
| **OpenAI text-embedding-3** | model | you want a strong, easy hosted default |
| **e5 / BGE** | model | you want free, self-hosted, open-weight embeddings |
| **Cohere multilingual** | model | many languages, hosted, strong retrieval |
| **Multilingual & domain-specific** | model | Arabic + English, or legal/medical jargon |
| **Query vs passage embeddings** | model | some models embed questions and docs differently |
| **Pinecone** | store | managed, scalable, zero-ops vector DB |
| **FAISS** | store | fast local/in-memory index, full control |
| **Chroma** | store | lightweight, great for prototyping |
| **pgvector** | store | you already run Postgres and want one DB |
| **Weaviate** | store | hybrid search + metadata filtering built in |
| **Flat / IVF / HNSW** | index type | trading recall vs speed vs memory |
| **ANN search** | concept | why approximate search is fast enough |
| **Cosine / dot / L2** | concept | how "similarity" is actually measured |

## The Dubai / Arabic angle

Most default embedding models are English-first. In Dubai you'll routinely handle **Arabic and English in the same corpus** — and often the same document. A model that embeds Arabic poorly will silently fail to retrieve Arabic passages even when they're the right answer. This is exactly why **multilingual models** (Cohere multilingual, multilingual e5/BGE) matter here: they place "cancel" and "إلغاء" near each other, so a question in one language retrieves answers in the other. Testing retrieval on real bilingual queries is a must, not a nice-to-have.

## Real world: how a company uses this

> **A Dubai real-estate platform** built a bilingual property-search assistant. Their first version used an English-only embedding model, so Arabic listings barely surfaced. Switching to a **multilingual model** + storing vectors in **Weaviate** (for its metadata filtering — price, area, bedrooms) let a user ask *"3-bedroom villa in Jumeirah under 5M"* in either language and get correctly filtered, semantically ranked results. Same listings, new embeddings — night-and-day relevance.

## Interview tip
Say: *"I separate the two decisions: which embedding model translates text to vectors, and which index stores and searches them. For quality I pick the embedding model deliberately — multilingual for Arabic/English corpora — and I evaluate it on real queries. For the store I match ops reality: pgvector if we already run Postgres, Pinecone or Weaviate for managed scale and metadata filtering, FAISS for local control. And I know retrieval is approximate nearest-neighbor over cosine similarity, so recall vs latency is a tunable, not magic."* That shows you understand both halves.

---

*Below: deep-dive articles on each embedding model and vector index.*
