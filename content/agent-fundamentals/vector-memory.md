# Vector Memory

**What it is:** Storing memories as *embeddings* (numeric vectors) in a vector database, so the agent can recall the most *semantically similar* memories to the current situation — even without exact keyword matches.

## Why it matters for an AI Engineer

Vector memory is the *retrieval mechanism* that makes [long-term memory](long-term.md) actually usable at scale. Once an agent has stored thousands of memories, you can't dump them all into the context window — you need to fetch just the handful relevant to *right now*. Vector memory does that by meaning, not keywords: ask "what are my travel preferences?" and it surfaces "user likes window seats and morning flights" even though none of those words appear in the query. This is the same technology as RAG retrieval, applied to an agent's own memory. If you understand embeddings and similarity search, vector memory is where that knowledge directly powers agents — and it's a near-universal component of production memory systems in 2026.

## The mechanism: how it works

The building blocks (the same ones behind RAG):

1. **Embed** — pass each memory through an embedding model, which converts text into a vector (a list of ~1,000+ numbers) that captures its meaning. Similar meanings → nearby vectors.
2. **Store** — save each vector in a vector database (Chroma, Pinecone, pgvector, Qdrant…) alongside the original text and metadata (user ID, timestamp, memory type).
3. **Query** — embed the current query the same way, then ask the DB for the *k nearest vectors* by similarity (usually cosine). Those are the most relevant memories.
4. **Inject** — put the retrieved memory texts into the agent's context so it can use them.

Why vectors beat keyword search for memory: memories and queries rarely share exact words. "Where should I invest?" should recall "user has a high risk tolerance" — semantically related, zero keyword overlap. Embeddings capture that relatedness. You typically add **metadata filters** (e.g. `where user_id = 42`) so you only search *this* user's memories, and **recency** signals (timestamp) so fresh memories can be preferred — because pure similarity ignores time.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">💬 "what should I invest in?"</span>
    <span class="darr">→<span class="lbl">embed</span></span>
    <span class="dbox purple">🔢 query vector</span>
    <span class="darr">→<span class="lbl">nearest-k</span></span>
    <span class="dbox blue">🗄️ vector DB<span class="sub">user's memories</span></span>
    <span class="darr">→</span>
    <span class="dbox green">📌 "high risk tolerance" recalled</span>
  </div>
  <div class="dcap">Vector memory recalls by meaning: the query and memory need no shared keywords.</div>
</div>

## Concrete example

A minimal vector memory with similarity recall plus per-user filtering:

```python
import chromadb
from openai import OpenAI
client = OpenAI()
db = chromadb.Client().create_collection(
    "memories", metadata={"hnsw:space": "cosine"})

def embed(t):
    return client.embeddings.create(
        model="text-embedding-3-small", input=t).data[0].embedding

def save(user, text):
    db.add(ids=[f"{user}-{hash(text)}"], embeddings=[embed(text)],
           documents=[text], metadatas=[{"user": user}])

def recall(user, query, k=3):
    r = db.query(query_embeddings=[embed(query)], n_results=k,
                 where={"user": user})       # metadata filter = this user only
    return r["documents"][0]

save("u1", "User has a high risk tolerance and a 20-year horizon.")
save("u1", "User dislikes crypto.")
save("u1", "User prefers window seats.")   # unrelated — won't be recalled

print(recall("u1", "what should I invest in?"))
# -> ['User has a high risk tolerance ...', 'User dislikes crypto.']
```

Notice the "window seats" memory is stored but *not* recalled — similarity search fetches only what's relevant to an investing query, and the `where` filter keeps one user's memories out of another's.

## How a company uses this

A robo-advisor in the DIFC uses vector memory across **~2 million user memories**. Each query does a metadata-filtered nearest-neighbour search (top-5) that returns in **~10–20ms** thanks to an HNSW index — fast enough to run inside every agent turn. Two production refinements matter: they **combine similarity with recency** (a small time-decay boost) so a user's latest stated preference wins over an old contradictory one, and they run a nightly **consolidation** job that merges near-duplicate vectors to control cost and keep recall sharp. Cost is dominated by embedding calls, so they cache embeddings and only re-embed changed memories. Vector memory is what lets the product feel personal at 2M-user scale without ever overflowing a context window.

## Common mistakes

- **Ignoring metadata filters.** Without a `where user_id` filter you leak one user's memories into another's recall — a privacy and correctness bug.
- **Similarity-only recall.** Pure cosine similarity has no sense of time and can surface a stale memory over a current one. Blend in recency.
- **Wrong distance metric.** Mismatching the metric (cosine vs L2) to how the embeddings were trained silently degrades recall. Match the model's recommended metric.
- **Never de-duplicating.** Storing the same fact 50 times floods the top-k with near-copies and crowds out other relevant memories. Consolidate.
- **Embedding everything, forever.** Unbounded stores cost money and slow search. Pair with [eviction](memory-eviction-forgetting.md).

## Interview tip
Say: *"Vector memory stores memories as embeddings and recalls the top-k most semantically similar to the current query — recall by meaning, not keywords. It's the same retrieval stack as RAG, applied to an agent's own memory. In production I always add metadata filters for per-user isolation, blend recency with similarity so fresh memories win, and consolidate duplicates to keep recall sharp and cost bounded."* Connecting it to RAG and naming the per-user filter shows applied depth.

See also: [Long-term memory](long-term.md) (what it powers), [Episodic](episodic.md) and [Semantic memory](semantic-memory.md) (what gets embedded), [Memory eviction / forgetting](memory-eviction-forgetting.md).
