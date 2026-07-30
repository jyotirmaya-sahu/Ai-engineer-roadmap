# Document / Feature Stores

**The one-line idea:** two purpose-built homes for AI data — a **document store** (often a vector database) that holds your text/chunks+embeddings for retrieval, and a **feature store** that holds the pre-computed inputs ("features") an ML model needs, served fast and consistently whether you're training or serving live.

## Why it matters for an AI Engineer

A plain SQL database is great for structured records but wrong for two AI-specific jobs: **similarity search** over millions of embeddings, and **serving model features with sub-100ms latency, consistently between training and production**. Document stores power the "retrieve" step of every RAG system; feature stores power classic ML and the structured signals that increasingly feed LLM apps (a fraud score, a customer's recency/frequency stats). Knowing *which store for which job* — and why not to just cram everything into Postgres — is a core architecture decision interviewers test. It's the "stores & access" endgame of the data layer: how the model actually *gets* its data at runtime.

## The mechanism / how it works

**Document / vector store.** You embed each cleaned chunk into a vector, and store `(vector, text, metadata)`. At query time you embed the user's question and ask the store for the **nearest vectors** by cosine/dot similarity — this is **ANN (Approximate Nearest Neighbor)** search, which uses an index (HNSW is the common one) to find close vectors in milliseconds without comparing against all N. Most also support **metadata filtering** ("only chunks where `dept = 'legal'`") and increasingly **hybrid search** (vector + keyword). Examples: Pinecone, Weaviate, Qdrant, Milvus, or `pgvector` (vector search bolted onto Postgres). This is the store behind [Retrieval](../retrieval.md) and [Embeddings & Indexing](../embeddings-indexing.md).

**Feature store.** A feature is a model input computed from raw data — e.g. "customer's average order value over 30 days." A feature store solves three problems: (1) **reuse** — compute a feature once, share it across models; (2) **train/serve consistency** — the *exact same* feature logic runs in batch (to build training data) and online (to serve a live prediction), eliminating "training-serving skew" where the model was trained on values computed differently than production sends; (3) **freshness + speed** — an **online store** (Redis/DynamoDB-backed) serves the latest feature values in a few ms, while an **offline store** (a warehouse) holds history for training. Feast is the open-source standard; cloud versions exist (SageMaker, Vertex).

<div class="diagram">
  <div class="flow">
    <div class="dgroup"><span class="dgt">DOCUMENT / VECTOR STORE</span>
      <span class="dbox purple">❓ query embedding</span>
      <span class="darr">→<span class="lbl">ANN + filter</span></span>
      <span class="dbox blue">🗄️ nearest chunks</span>
    </div>
    <div class="dgroup"><span class="dgt">FEATURE STORE</span>
      <span class="dbox blue">📊 offline: history<span class="sub">training</span></span>
      <span class="dbox green">⚡ online: latest<span class="sub">serving, ~ms</span></span>
    </div>
  </div>
  <div class="dcap">Document store = similarity search over text/embeddings. Feature store = consistent, fast model features for train + serve.</div>
</div>

## Concrete example

Document store — write and query with Qdrant:

```python
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
qc = QdrantClient(":memory:")   # pip install qdrant-client
qc.create_collection("docs", vectors_config={"size": 1536, "distance": "Cosine"})
qc.upsert("docs", [PointStruct(id=1, vector=embed(chunk), payload={"dept": "legal", "text": chunk})])

hits = qc.search("docs", query_vector=embed("termination notice period"), limit=3,
                 query_filter=Filter(must=[FieldCondition(key="dept", match=MatchValue(value="legal"))]))
```

Feature store — define once, serve online with Feast:

```python
# after `feast apply`, fetch the latest features for a live request (~ms):
from feast import FeatureStore
store = FeatureStore(repo_path=".")
feats = store.get_online_features(
    features=["customer_stats:avg_order_30d", "customer_stats:orders_7d"],
    entity_rows=[{"customer_id": 42}],
).to_dict()   # same feature logic that built the training set — no skew
```

## How a company uses this

A Dubai bank's assistant uses both stores in one request. A customer asks "am I eligible for a higher credit limit?" → the app pulls **features** from Feast's online store (income band, 90-day spend, risk score) in ~5ms and retrieves **policy chunks** from a vector store (the eligibility rules) — then the LLM reasons over both: real numbers *and* grounded policy. The feature store is what guarantees the risk score the model sees in production is computed identically to how it was during training; before Feast they had a subtle skew (a 7-day window computed as calendar-days offline but rolling-hours online) that silently degraded predictions. Production numbers that matter: the online feature lookup must stay under ~10ms (it's on the request path), the vector store serves ANN over ~3M policy chunks at p95 ~40ms, and both scale independently of the SQL system of record.

## Common mistakes / misconceptions

- **Using a vector DB as a source of truth.** It's a derived, rebuildable index of your data — the authoritative copy stays in your SQL/document system. Treat it as disposable and re-buildable.
- **Skipping metadata filtering.** Pure similarity search returns semantically-close-but-wrong-scope chunks; filter by dept/date/source alongside the vector query.
- **Ignoring train/serve skew.** The #1 feature-store reason for existing — if offline and online feature logic differ, your live model silently underperforms.
- **Building a feature store you don't need.** For a pure RAG app with no ML features, a vector store is enough; Feast is overhead until you have shared, latency-critical features.

## Interview tip

Say: *"I match the store to the access pattern: a vector/document store for similarity search over embeddings — with metadata filtering and ANN indexes like HNSW for millisecond retrieval — and a feature store like Feast when I have model features that need train/serve consistency and low-latency online serving. The vector DB is a rebuildable index, not the source of truth, and the feature store's whole point is killing training-serving skew."* Naming train/serve skew and "index, not source of truth" are the two lines that show you've run these in production.
