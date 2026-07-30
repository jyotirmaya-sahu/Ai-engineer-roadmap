# Metadata Filtering

**The one-line idea:** Metadata filtering narrows the search to only the chunks whose **tags** match — `year = 2025`, `department = HR`, `tenant = client_A` — *before or during* the vector search, so "what changed in the 2025 policy?" can't accidentally return a 2023 document.

## Why it matters for an AI Engineer

Semantic similarity is blind to facts *about* a document — a 2023 clause and a 2025 clause read almost identically, so dense search happily returns the wrong year. Metadata filtering adds a hard constraint the embedding can't override. It's also how you do **multi-tenancy** (client A must never see client B's data), **access control** (a user only retrieves docs they're cleared for), and **freshness** (latest version only). In enterprise and Dubai-regulated contexts (banking, healthcare, government), this isn't a nice-to-have — it's a compliance requirement, and interviewers in those sectors will probe it.

## The mechanism — how it works

Two pieces:

**1. Attach metadata at indexing time.** When you store each chunk, you also store a small dict of structured fields: `{"year": 2025, "dept": "HR", "source": "leave_policy.pdf", "lang": "en", "tenant": "acme"}`. This is decided during chunking — you can't filter on a field you never stored.

**2. Apply the filter at query time.** The vector DB combines the filter with the similarity search. Under the hood there are two strategies:
- **Pre-filtering:** narrow to matching chunks *first*, then do nearest-neighbor within that subset. Exact, but can be slow if the filter is very selective.
- **Post-filtering:** do the vector search, then drop non-matching results. Fast, but risky — if all top-K happen to fail the filter, you get nothing back.

Good vector DBs (Pinecone, Qdrant, Weaviate, pgvector) do **filtered ANN** that blends both efficiently, so you usually just pass a filter and trust the engine.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ "2025 remittance fee change?"</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔖 filter: year=2025, dept=finance</span>
    <span class="darr">→<span class="lbl">then similarity</span></span>
    <span class="dbox blue">🗄️ only matching chunks</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ correct-year answer</span>
  </div>
  <div class="dcap">The tag filter is a hard gate the embedding can't override — wrong-year docs can't leak in.</div>
</div>

## Concrete example

Store metadata, then filter at query time (LangChain + a store that supports filters):

```python
from langchain_core.documents import Document

docs = [
    Document(page_content="Remittance fee is 15 AED.", metadata={"year": 2023, "dept": "finance"}),
    Document(page_content="Remittance fee reduced to 10 AED.", metadata={"year": 2025, "dept": "finance"}),
    Document(page_content="Annual leave is 30 days.",        metadata={"year": 2025, "dept": "hr"}),
]
# store = <VectorStore>.from_documents(docs, embeddings)

retriever = store.as_retriever(
    search_kwargs={"k": 3, "filter": {"year": 2025, "dept": "finance"}}
)
retriever.invoke("what changed in the remittance fee?")
# -> only the 2025 finance chunk is eligible; the near-identical 2023 chunk is excluded
```

Without the filter, the 2023 and 2025 fee chunks are nearly tied on cosine similarity and the wrong one can win. The filter removes the ambiguity entirely.

## How a company uses this

A **Dubai law firm** serving many corporate clients runs one vector store for all of them, with every chunk tagged `client_id`. Each query is filtered to the requesting client's `client_id` — so client A physically cannot retrieve client B's contracts, even if the text is semantically similar. That single tag turns a shared index into a compliant multi-tenant system.

## Common mistakes / misconceptions

- **Forgetting to index the metadata.** You can only filter on fields you stored at ingestion. Plan your metadata schema during chunking.
- **Over-filtering to zero results.** Too many `AND` conditions can leave nothing eligible. Handle the empty case (broaden, or tell the user).
- **Treating it as security by itself.** Filtering enforces access *only if* you set the filter correctly on every query — a missing filter is a data leak. Enforce it server-side, never trust the client to pass it.
- **Post-filter surprise.** If your DB post-filters, a tight filter over a small top-K can silently return empty; prefer engines with native filtered ANN.

## Interview tip
Say: *"Metadata filtering is a hard constraint on top of similarity — I tag chunks at ingestion with things like year, department, tenant, and language, then filter at query time. It's essential for freshness, multi-tenancy, and access control; I enforce the filter server-side because a missing filter is a data leak, and I watch for over-filtering to empty results."* Mentioning multi-tenancy and server-side enforcement lands well in enterprise/banking interviews.

See also: **Dense Retrieval** (what filtering constrains) and **Metadata per chunk** in the chunking node.
