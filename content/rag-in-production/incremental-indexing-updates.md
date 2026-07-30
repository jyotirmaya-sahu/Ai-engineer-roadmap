# Incremental Indexing & Updates

**What it is:** adding, updating, and deleting individual documents in your vector index *without* re-embedding and rebuilding the whole thing — so a doc edited at 2pm is searchable by 2:05pm, not after tonight's full rebuild.

## Why it matters for an AI Engineer

In a demo you embed a static folder once. In production, documents change all day: a policy is updated, a support ticket is closed, a product is discontinued. If your only tool is "re-embed everything," then a 10M-document corpus means a multi-hour, expensive rebuild every time *one* file changes — so updates lag by hours, deleted docs keep surfacing (a compliance nightmare), and your embedding bill explodes. Incremental indexing is how a live system stays fresh cheaply.

## The mechanism

The unit of change is a **chunk**, keyed by a stable ID. Every operation targets IDs, not the whole index:

- **Add** — new doc → chunk → embed → insert.
- **Update** — a doc changed → re-chunk it → **upsert** (insert-or-replace by ID). Only that doc's chunks get re-embedded.
- **Delete** — doc removed → delete its chunk IDs. In some index types you can't physically remove a vector immediately, so you use a **tombstone**: mark it deleted and filter it out at query time, then reclaim space during a later compaction.
- **Backfill** — a one-time bulk job to (re)index a range of docs, e.g. after adding a new source or fixing a chunking bug.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📄 doc changed (id=doc_88)</span>
    <span class="darr">↓<span class="lbl">re-chunk</span></span>
    <span class="dbox orange">🔢 embed only doc_88's chunks</span>
    <span class="darr">↓<span class="lbl">upsert by id</span></span>
    <span class="dbox blue">🗄️ index: old chunks replaced, rest untouched</span>
  </div>
  <div class="dcap">One document changing touches only its own chunk IDs — the other 9,999,912 vectors are never re-embedded.</div>
</div>

### Deterministic chunk IDs are the whole trick

Upserts and deletes only work if you can *name* the chunks a document produced. Derive the ID from the doc ID + chunk position, so re-chunking the same doc yields the same IDs:

```python
def chunk_id(doc_id: str, i: int) -> str:
    return f"{doc_id}::chunk_{i}"

def upsert_document(index, doc_id: str, text: str):
    chunks = chunk(text)                     # your chunker (recursive splitter, etc.)
    ids   = [chunk_id(doc_id, i) for i in range(len(chunks))]
    vecs  = embed_batch(chunks)              # only THIS doc's chunks are embedded
    index.upsert(ids=ids, vectors=vecs, metadata=[{"doc_id": doc_id}] * len(chunks))
    # if the new version has FEWER chunks, delete the orphaned tail
    stale = [chunk_id(doc_id, i) for i in range(len(chunks), len(chunks) + 20)]
    index.delete(ids=stale, ignore_missing=True)

def delete_document(index, doc_id: str):
    index.delete(filter={"doc_id": {"$eq": doc_id}})  # all chunks of the doc
```

Note the **orphan problem**: if a doc had 8 chunks and now has 5, chunks 5–7 are still in the index with stale content. Always delete the tail (or delete-then-insert the whole doc's chunks). This is the #1 incremental-indexing bug — old content that quietly keeps getting retrieved.

### Driving updates: change-data-capture

You don't poll every doc. You react to changes:

- **CDC / event stream** — the source system emits `created/updated/deleted` events (via a webhook, Kafka, DB change log). A worker consumes them and calls `upsert`/`delete`. This is the freshest and cheapest approach — see [data-freshness-re-embedding.md](data-freshness-re-embedding.md).
- **Batch diff** — nightly, compare a `content_hash` per doc against last run; re-embed only changed hashes. Simple, but up to 24h stale.

Always store a `content_hash` in metadata so you can **skip re-embedding unchanged docs** during a backfill — that alone can cut a re-index bill by 90%.

## How a company uses this

> A **Dubai real-estate portal** has ~2M listings that change constantly — price drops, "sold," new photos, description edits. A nightly full rebuild meant a buyer could get an assistant answer citing a listing that sold this morning. They wired the listings DB's change stream to an indexing worker: on `update`, re-embed only that listing's chunks and upsert; on `sold`, delete its chunk IDs immediately. Median time from edit to searchable dropped from ~14 hours to ~90 seconds, and their embedding spend fell sharply because they stopped re-embedding the 99.9% of listings that didn't change.

## Common mistakes
- **Random/UUID chunk IDs** — you can never update or delete cleanly; you're stuck with full rebuilds.
- **Orphaned chunks** — updating a doc to fewer chunks but not deleting the old tail → stale answers.
- **Forgetting deletes** — a removed doc keeps getting retrieved; in regulated domains that's a real incident, not a cosmetic bug.
- **Re-embedding unchanged docs** on every backfill — check a `content_hash` first.

## Interview tip
Say: *"I key every chunk by a deterministic ID derived from the doc ID, so updates are upserts and deletes are targeted — one doc changing only re-embeds that doc's chunks, not the whole 10M-vector index. I drive it from a change-data-capture stream for near-real-time freshness, store a content hash to skip unchanged docs, and I'm careful about orphaned chunks when a doc shrinks and about actually deleting removed docs."* The orphan and delete details show you've been burned by this in prod.
