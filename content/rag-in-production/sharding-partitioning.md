# Sharding & Partitioning

**What it is:** splitting one giant index into many smaller isolated ones — by tenant, customer, department, or data slice — so each query only searches the slice it should, and one customer's data never leaks into another's results.

## Why it matters for an AI Engineer

The moment your RAG system serves more than one customer, "one big index" becomes a liability. You get three problems at once: **isolation** (Customer A must never retrieve Customer B's documents), **performance** (searching 50M vectors when the answer is in *this tenant's* 200k is wasteful), and **compliance** (a Dubai bank can't have Department X's confidential circulars surfacing to Department Y). Sharding and partitioning solve all three by making sure every query hits exactly the right subset.

## The mechanism

Two related ideas:

- **Partitioning** = logically dividing vectors into groups (usually called **namespaces** in managed DBs, or **collections/tenants**). Same physical database, but a query scoped to `namespace="tenant_42"` only ever sees that tenant's vectors.
- **Sharding** = physically splitting data across machines/nodes so no single box holds everything. This is what lets you go past ~10M vectors (see [millions-of-documents.md](millions-of-documents.md)).

In production RAG the most common pattern is **one namespace per tenant** (multi-tenancy). Managed vector DBs give this natively — Pinecone namespaces, Qdrant/Weaviate collections or multi-tenancy, pgvector partitioned tables with a `tenant_id` filter.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ query + tenant_id=42</span>
    <span class="darr">↓<span class="lbl">route</span></span>
    <span class="dbox purple">🧭 router picks namespace</span>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox blue">🗄️ ns: tenant_41</span>
      <span class="dbox orange">🗄️ ns: tenant_42 ✅</span>
      <span class="dbox blue">🗄️ ns: tenant_43</span>
    </div>
  </div>
  <div class="dcap">The query is routed to one namespace — the other tenants' vectors are never even scanned.</div>
</div>

### Namespace vs metadata filter — pick the right isolation

There are two ways to scope a query, and mixing them up is a classic bug:

| Approach | How | When to use |
|---|---|---|
| **Namespace / partition** | physically separate index per tenant | strong isolation, many tenants, compliance ("hard wall") |
| **Metadata filter** | one index, filter `where tenant_id = 42` at query time (see [../retrieval/metadata-filtering.md](../retrieval/metadata-filtering.md)) | few tenants, or filtering *within* a tenant (by dept, date, doc type) |

**Rule:** use **namespaces for the hard security boundary** (per customer), and **metadata filters for soft slicing inside** it (per department, per document type). A metadata filter alone is *not* a security boundary — a bug in the `where` clause leaks data. A namespace is.

### Routing queries to the right shard

The router is usually trivial — the tenant ID comes from the authenticated request, not the query text:

```python
def search(query: str, tenant_id: str, top_k: int = 5):
    qvec = embed(query)
    # namespace = hard isolation; the DB never looks outside it
    return index.query(
        vector=qvec,
        top_k=top_k,
        namespace=f"tenant_{tenant_id}",     # routing/isolation
        filter={"department": {"$eq": "risk"}},  # soft slice within tenant
    )

# sanity check: a tenant search must never return another tenant's ids
res = search("expense policy", tenant_id="42")
assert all(m["namespace"] == "tenant_42" for m in res.matches)
```

### Sharding for scale (when one node isn't enough)

Past ~10–50M vectors, even one tenant may not fit on one node. Then you shard *within* a namespace — the DB hashes vectors across nodes, fans a query out to all shards, and merges the top-k. Managed DBs (Pinecone, Qdrant clusters, Weaviate) do this transparently; the cost is a small **fan-out latency** (you wait for the slowest shard). Keep tenants that fit on one node *on* one node — cross-shard fan-out is only worth it when a single tenant genuinely exceeds a machine.

## How a company uses this

> A **Dubai SaaS company** runs a customer-support RAG for 300 client businesses. They started with one index + a `client_id` metadata filter. A filter bug once returned Client A's tickets to Client B — a serious data-leak incident. They moved to **one Pinecone namespace per client**: now isolation is enforced by the DB, not by a `where` clause a developer might forget. Within each namespace they still use metadata filters for `product_area` and `language` (Arabic/English). Small clients share a pod; their three biggest clients (5M+ vectors each) got dedicated sharded indexes.

## Common mistakes
- **Using a metadata filter as a security boundary** — one bad query = data leak. Isolation belongs in the namespace, not the `where` clause.
- **A namespace per *document*** instead of per tenant — thousands of tiny namespaces kill performance and blow past DB limits.
- **Forgetting the tenant_id in one code path** — every retrieval call must be scoped; a single unscoped query searches everything.
- **Sharding too early** — fan-out adds latency and complexity; don't shard a tenant that fits on one node.

## Interview tip
Say: *"For multi-tenant RAG I use one namespace per customer as the hard isolation boundary — enforced by the vector DB, never by a metadata filter, because a filter bug leaks data. Inside a tenant I use metadata filters for soft slicing like department or language. I only shard a single tenant across nodes once it genuinely exceeds one machine, since cross-shard fan-out adds latency."* This shows you understand the security *and* the performance sides.
