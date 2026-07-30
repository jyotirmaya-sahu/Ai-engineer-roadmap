# RAG & Dynamic Filters

**The one-line idea:** instead of pre-loading documents into the prompt, retrieve *just* the passages relevant to the current question at runtime — and narrow that retrieval with filters (user, date, permission, source) so the model only ever sees the right, allowed slice of your data.

## Why it matters for an AI Engineer

This is the most common source of *dynamic* context — text that changes per request based on what the user actually asked. Your knowledge base might be millions of documents; the window holds a few thousand tokens. RAG is how you bridge that: search first, then inject only the top hits. **Dynamic filters** are the part beginners skip and interviewers probe: in a real company, *which* documents a user may see depends on who they are (permissions), when (freshness), and where the data came from (source/tenant). Retrieving without filtering leaks other tenants' data and drowns the answer in irrelevant or stale text. From a context-engineering view, RAG+filters is your precision tool for putting exactly the right grounding into the window and nothing else.

## The mechanism / how it works

RAG (Retrieval-Augmented Generation) has a full node of its own; here we care about its role as a *context source*. The flow per request:

1. **Embed the query** into a vector, or build a keyword/hybrid query.
2. **Search** the vector store for the most similar chunks — but apply **metadata filters as a `where` clause** so the search space is pre-narrowed to only permitted, relevant records.
3. **Select** the top-K (and optionally rerank/compress) so only the best few chunks survive.
4. **Inject** those chunks into the context with their citations, then generate.

The "dynamic filter" is a structured predicate evaluated *before or during* the similarity search — e.g. `tenant_id = "acme" AND lang = "ar" AND updated_at > 2025-01-01 AND acl CONTAINS user.role`. This does two jobs at once: **security** (a user physically cannot retrieve a document their filter excludes) and **relevance** (you don't waste the window on the wrong department's or last year's docs). Because it runs at query time, the same knowledge base serves every user differently — the context is assembled fresh for each request.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 query + user context (role, tenant, lang)</span>
    <span class="darr">↓<span class="lbl">embed</span></span>
    <span class="dbox blue">🗄️ vector store<span class="sub">millions of chunks</span></span>
    <span class="darr">↓<span class="lbl">filter: tenant + acl + date, then top-K</span></span>
    <span class="dbox orange">🔍 3–5 allowed, relevant chunks</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 grounded answer + citations</span>
  </div>
  <div class="dcap">Filters shrink the search to permitted/fresh records; similarity picks the best few from what's left.</div>
</div>

## Concrete example

```python
# Metadata-filtered retrieval — the filter is a security + relevance boundary.
def retrieve(query, user, store):
    qvec = embed(query)
    where = {                                   # dynamic filter, per request
        "tenant_id": user.tenant_id,            # hard multi-tenant isolation
        "lang":      user.lang,
        "updated_at": {"$gte": "2025-01-01"},   # freshness
        "acl_roles": {"$contains": user.role},  # permission
    }
    hits = store.query(vector=qvec, top_k=5, where=where)  # filter applied in-DB
    context = "\n\n".join(f"[{h.source}] {h.text}" for h in hits)
    return context
```

Every major vector store (Pinecone, Weaviate, pgvector, Chroma) supports this `where`/metadata filter — it's not an afterthought, it's core to production RAG.

## How a company uses this

A Dubai law firm's contract assistant serves multiple client teams from one index. The dynamic filter `client_id = <caller's client> AND confidentiality <= <caller's clearance>` runs *inside* the vector search, so a junior associate literally cannot retrieve another client's privileged documents — the isolation is enforced at the data layer, not by hoping the model behaves. At ~2M chunks, pre-filtering by `client_id` also cuts the ANN search space dramatically, keeping p95 retrieval under ~50ms. The failure mode they audit for is a **missing filter** (a query path that forgets the `where` clause) — that's a data-leak incident, so filters are enforced in a shared retrieval layer no feature can bypass.

## Common mistakes / misconceptions

- **Retrieval without filtering.** In a multi-tenant app this leaks data across tenants and dilutes relevance. Filters are mandatory, not optional.
- **Filtering in Python after retrieval.** Pulling 100 hits then dropping the disallowed ones is slow *and* insecure (the data already left the DB). Filter *in* the query.
- **Injecting too many chunks.** Top-50 buries the answer and blows budget. Retrieve few, [rerank/compress](../retrieval.md), inject the best 3–5.
- **Forgetting freshness.** Without a date filter, stale docs win on similarity and the model confidently cites outdated policy.

## Interview tip

Say: *"RAG is my dynamic context source — I retrieve per query instead of pre-loading. The detail that matters is metadata filtering: I push tenant, ACL, language, and freshness predicates into the vector search itself, so it's both a security boundary and a relevance boost, and I keep top-K small so the window stays focused."* Framing the filter as a *security* mechanism, not just a relevance tweak, is what senior interviewers are listening for. For the full pipeline see the [RAG Architecture](../rag-architecture.md) and [Retrieval](../retrieval.md) nodes.
