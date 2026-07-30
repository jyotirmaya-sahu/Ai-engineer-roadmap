# Metadata Per Chunk

**The one-line idea:** store useful facts *about* each chunk — source file, section, page, date, author — alongside the text, so you can filter, cite, and rank retrieval by more than just embedding similarity.

## Why it matters for an AI Engineer

A chunk is not just text — it's text *from somewhere*. Without metadata, your RAG system can't say "this answer came from the 2025 HR policy, page 3," can't restrict a search to *one* customer's documents, and can't prefer the *newest* version of a policy. Metadata turns a pile of vectors into a queryable, citable, access-controlled knowledge base. It's what makes RAG trustworthy and safe for enterprises — which is exactly why Dubai companies in finance, legal, and healthcare demand it. "How do you cite sources?" and "how do you keep tenant A from seeing tenant B's docs?" are real interview questions, and metadata is the answer to both.

## The mechanism / how it works

When you create a chunk, you attach a small dictionary of key-value pairs to it. In LangChain a chunk is a `Document` with `.page_content` (the text) and `.metadata` (the dict). The vector DB stores both, and you can use metadata three ways:

1. **Pre-filtering retrieval.** Before (or during) the vector search, restrict to chunks matching a metadata condition — e.g. `source == "hr_policy" AND year >= 2024` or `tenant_id == "acme"`. This is faster *and* safer than filtering after: it enforces access control and cuts the search space.
2. **Citation.** After retrieval, read `source`/`page` off each chunk to show the user where the answer came from — essential for trust and auditing.
3. **Ranking / recency.** Prefer chunks with newer `date` metadata when documents get superseded.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue wide">🗄️ Chunk = text + metadata<span class="sub">{source, page, date, tenant}</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">🔍 Search + filter<span class="sub">tenant=acme, year≥2024</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Answer + citation<span class="sub">"hr_policy.pdf, p.3"</span></span>
  </div>
  <div class="dcap">Metadata scopes the search, secures it, and lets you cite the source.</div>
</div>

Good default fields: `source` (filename/URL), `title`/`section`, `page`, `date`/`version`, `author`, and any tenant/permission key. Keep values small and filterable (strings, numbers, dates) — the vector DB indexes them for fast filtering.

## Concrete example

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

raw = open("hr_policy_2025.md").read()
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)

# attach metadata to EVERY chunk from this file
chunks = splitter.create_documents(
    [raw],
    metadatas=[{"source": "hr_policy_2025.md",
                "department": "HR",
                "year": 2025,
                "tenant_id": "acme"}],
)
# create_documents copies that metadata dict onto each chunk it produces

# ...store in a vector DB, then filter at query time:
results = vectorstore.similarity_search(
    "What is the refund window?",
    k=3,
    filter={"tenant_id": "acme", "year": 2025},   # only Acme's 2025 docs
)
for r in results:
    print(r.metadata["source"], "p?", "-", r.page_content[:60])
```

The `filter=` guarantees the search *never* returns another tenant's chunks — a hard security boundary, not a hope.

## How a company uses this

A Dubai bank runs one RAG system for many corporate clients. **Tenant isolation via metadata is non-negotiable**: every chunk carries `client_id`, and every query filters on the logged-in client's ID, so Client A physically cannot retrieve Client B's documents even though they share a vector DB. On top of that, each answer cites `source` and `page` for the compliance audit trail, and `effective_date` metadata ensures a query about "current fees" retrieves the *latest* schedule, not last year's. Strip the metadata and the same system is both a data-leak and an audit failure.

## Common mistakes / misconceptions

- **Filtering *after* retrieval instead of during.** Post-filtering can return zero results (all top-k belonged to another tenant) *and* leaks the wrong docs into the pipeline. Filter in the query.
- **Dumping huge blobs into metadata.** Metadata is for small, filterable facts, not full documents. Bloated metadata slows the store and wastes space.
- **Forgetting to propagate it.** If you split *then* forget to copy source info onto each child chunk, you can't cite anything. Use `create_documents(..., metadatas=...)` or set it before splitting.
- **Treating metadata as optional.** For anything multi-tenant or regulated (finance, health, legal — much of Dubai's market), it's a hard requirement, not a nice-to-have.

## Interview tip

Tie metadata to *trust and safety*: *"Every chunk carries metadata — source, page, date, tenant — so I can pre-filter the search for access control and recency, and cite the exact source in the answer. For multi-tenant systems I filter on tenant ID inside the query so one client can never retrieve another's chunks."* Mentioning citation *and* tenant isolation shows you think about production RAG, not just a demo.
