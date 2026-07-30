# Data Freshness & Re-embedding

**What it is:** keeping your index in sync with reality — making sure changed documents get re-indexed quickly (freshness), and re-embedding your whole corpus when you switch embedding models (because old and new vectors are incompatible).

## Why it matters for an AI Engineer

Two silent quality killers live here. **Staleness:** a policy changed this morning but the index still holds last week's version, so the assistant confidently cites outdated info — in a Dubai bank or government service that's not a bug, it's a compliance incident. **Model mismatch:** you upgrade to a better embedding model, but every vector already in your index was made by the *old* model, so queries embedded with the new model compare against old vectors and retrieval quietly degrades. An AI Engineer has to keep the corpus fresh *and* handle model migrations without breaking search.

## Part 1: Freshness — keeping up with changing docs

Freshness is a **latency SLA on the index**: "a document edited at time T is searchable by T + Δ." How small Δ needs to be drives the approach:

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 doc changes</span>
    <span class="darr">→<span class="lbl">CDC event</span></span>
    <span class="dbox orange">⚙️ indexing worker</span>
    <span class="darr">→<span class="lbl">re-embed + upsert</span></span>
    <span class="dbox blue">🗄️ searchable</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Δ ≈ seconds–minutes</span>
  </div>
  <div class="dcap">Change-data-capture drives near-real-time freshness — the doc is searchable minutes after it changes.</div>
</div>

- **Change-data-capture (CDC):** the source system emits an event on create/update/delete (webhook, Kafka, DB change log); a worker re-embeds just that doc and upserts (see [incremental-indexing-updates.md](incremental-indexing-updates.md)). Δ ≈ seconds to minutes. Use when freshness matters (prices, policies, "sold" listings).
- **Scheduled batch re-index:** nightly/hourly job diffs a `content_hash` per doc and re-embeds changed ones. Δ ≈ up to the interval. Simpler; fine when hours-stale is acceptable.
- **TTL on volatile facts:** for data with a natural expiry (a quote valid 24h), stamp it and filter out expired chunks at query time.

**Always store a `content_hash` and `updated_at`** in metadata. The hash lets a re-index skip unchanged docs (cutting cost ~90%); `updated_at` lets you detect and prioritize staleness.

## Part 2: Re-embedding when the model changes

This is the one that surprises people. **Embeddings from different models are not comparable.** A vector from `text-embedding-3-small` and one from a newer model live in different geometric spaces — cosine similarity between them is meaningless (see [../embeddings-indexing/openai-text-embedding-3.md](../embeddings-indexing/openai-text-embedding-3.md)). So when you upgrade the embedding model, you must **re-embed the entire corpus with the new model**, and you must embed *queries* with the same model version you used for the documents.

### The safe migration: blue-green re-index

You can't re-embed 10M docs in place while serving — half old, half new vectors = broken search. Do it side by side:

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">🗄️ index v1 (old model) — serving live</span>
    <span class="darr">↓<span class="lbl">backfill in background</span></span>
    <span class="dbox orange">🗄️ index v2 (new model) — building</span>
    <span class="darr">↓<span class="lbl">eval passes → flip</span></span>
    <span class="dbox green">✅ traffic → v2, retire v1</span>
  </div>
  <div class="dcap">Build the new-model index alongside the old one, validate on an eval set, then flip atomically.</div>
</div>

```python
def reembed_corpus(docs, new_model, target_index):
    for batch in batched(docs, 256):                 # batch for throughput
        texts = [d.text for d in batch]
        vecs  = embed_batch(texts, model=new_model)  # ALL with the new model
        target_index.upsert(
            ids=[d.chunk_id for d in batch], vectors=vecs,
            metadata=[{"model": new_model, "content_hash": d.hash} for d in batch],
        )
# 1. build index_v2 with new_model in the background (serving stays on v1)
# 2. run the offline eval set against v2; compare recall vs v1
# 3. only if v2 wins, switch query traffic (and query-embedding model) to v2
# 4. keep v1 briefly for instant rollback, then delete
```

Two hard rules: **stamp the model version in metadata** so you always know what produced a vector, and **query with the matching model version** — the classic outage is upgrading the query embedder but not the index, so every query silently mismatches.

## How a company uses this

> A **Dubai property developer**'s RAG covered pricing and availability that changed hourly. Their nightly batch re-index meant an agent could quote a price that changed at 9am until the next night's job — a real customer-trust problem. They moved to CDC: the CRM emits an event on any price/status change, a worker re-embeds and upserts within ~2 minutes. Separately, when they upgraded embedding models for better Arabic support, they did a blue-green re-index of all 3M chunks over a weekend, validated recall on an eval set, then flipped query traffic — zero downtime, and instant rollback ready in case v2 underperformed.

## Common mistakes
- **Upgrading the embedding model but not re-embedding the corpus** — new-model queries vs old-model vectors = silently broken retrieval.
- **Re-embedding in place while serving** — a half-migrated index returns garbage; use blue-green.
- **Not stamping model version** in metadata — you can't tell which vectors are stale after a migration.
- **Polling every doc for changes** instead of CDC — slow and wasteful; and forgetting deletes leaves stale docs retrievable.

## Interview tip
Say: *"Freshness is an SLA on the index — I drive it with change-data-capture so a changed doc is searchable in minutes, and store a content hash so re-indexing skips unchanged docs. The subtle one is model upgrades: embeddings from different models aren't comparable, so switching models means re-embedding the whole corpus. I do that blue-green — build a new-model index alongside the old, validate on an eval set, flip query traffic atomically, and always query with the same model version the documents were embedded with."*
