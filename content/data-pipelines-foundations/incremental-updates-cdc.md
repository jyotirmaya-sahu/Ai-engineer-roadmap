# Incremental Updates & CDC

**The one-line idea:** instead of re-processing your entire dataset every run, only touch what *changed* since last time. **CDC (Change Data Capture)** is the technique that tells you exactly which rows were inserted, updated, or deleted — so your pipeline does a little work often instead of enormous work repeatedly.

## Why it matters for an AI Engineer

Re-embedding a million-document corpus every night is slow, expensive (every embedding is an API call you pay for), and pointless when 200 documents changed. Incremental processing is what makes a large RAG system affordable and fresh at the same time. It's also the only way to keep a vector store correctly in sync with a source database — including handling *deletes*, which naive pipelines forget, leaving the model able to retrieve a document that no longer exists. Interviewers probe this because "how do you keep the index in sync without re-doing everything?" separates people who've run RAG at scale from people who've only built a demo over a fixed folder.

## The mechanism / how it works

There are two ways to know what changed.

**1. Incremental by watermark (poll-based).** You track a "high-water mark" — usually a `updated_at` timestamp or a monotonically increasing `id`. Each run: "give me rows where `updated_at` > last-seen". Simple, works on any database, no special setup. Its weaknesses: it **can't see deletes** (a deleted row just vanishes; there's no `updated_at` to catch), and it relies on the source diligently bumping `updated_at` on every change.

**2. CDC (log-based).** Databases keep a **write-ahead log** (WAL / binlog) of every change for their own crash recovery. CDC tools (**Debezium** is the standard) *read that log* and emit a stream of change events: `{op: insert|update|delete, before, after}`. This catches **everything, including deletes**, in near real-time, without polling or trusting an `updated_at` column. It's the gold standard for keeping systems in sync, and it pairs naturally with streaming ([Batch vs streaming ingestion](./batch-vs-streaming-ingestion.md)).

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">🗄️ Source DB<span class="sub">insert / update / delete</span></span>
    <span class="darr">↓<span class="lbl">writes to WAL/binlog</span></span>
    <span class="dbox orange">📜 Change log</span>
    <span class="darr">↓<span class="lbl">Debezium reads log</span></span>
    <span class="dbox purple">📨 Change events<span class="sub">op + before + after</span></span>
    <span class="darr">↓<span class="lbl">apply only the delta</span></span>
    <span class="dbox green">✅ Vector store in sync<span class="sub">upserts + deletes</span></span>
  </div>
  <div class="dcap">CDC turns "what changed?" into a precise stream of insert/update/delete events — deletes included.</div>
</div>

The action you take per event: **insert/update → upsert** the chunk+embedding; **delete → remove** the corresponding vectors. That delete path is exactly what watermark polling misses.

## Concrete example

Watermark-based incremental pull (the 80% solution, no special infra):

```python
import json, pathlib, datetime as dt
STATE = pathlib.Path("state.json")

def last_mark():
    return STATE.exists() and json.loads(STATE.read_text())["mark"] or "1970-01-01"

def run_incremental(conn):
    mark = last_mark()
    rows = conn.execute(
        "SELECT id, body, updated_at FROM docs WHERE updated_at > ? ORDER BY updated_at",
        (mark,)
    ).fetchall()
    new_mark = mark
    for doc_id, body, updated_at in rows:
        upsert_vectors(doc_id, embed(clean(body)))   # idempotent upsert
        new_mark = max(new_mark, updated_at)
    STATE.write_text(json.dumps({"mark": new_mark}))
    print(f"processed {len(rows)} changed rows since {mark}")
```

To also handle deletes without full CDC, add a **soft-delete** column (`deleted_at`) and treat rows with it set as "remove from index" — a pragmatic middle ground when you can influence the source schema.

## How a company uses this

A Dubai real-estate portal keeps ~2 million property listings searchable by an AI assistant. A nightly full re-embed would be ~2M embedding calls every day — real money and hours of compute — for maybe 30k listings that actually changed. They run **Debezium CDC** off their Postgres WAL into Kafka: an agent adds a listing → an `insert` event → the new listing is embedded and searchable within seconds; a listing is sold and deleted → a `delete` event → its vectors are removed so the assistant can never recommend a property that's off the market. Cost dropped ~98% versus full re-processing, and freshness went from 24 hours to seconds. The delete handling is the part that mattered most for trust: recommending sold properties was their #1 complaint before CDC.

## Common mistakes / misconceptions

- **Forgetting deletes.** The classic incremental bug: your index keeps growing and starts serving documents that no longer exist in the source. Handle deletes explicitly (CDC events or soft-delete).
- **Trusting `updated_at` that isn't maintained.** If some code path updates a row without bumping the timestamp, watermark polling silently misses it. CDC sidesteps this because it reads the actual log.
- **Non-idempotent applies.** Re-processing the same change (retries, replays) must not create duplicates — use upserts keyed by document id.
- **Reaching for CDC on day one.** For a small or slow-changing dataset, watermark polling is far less operational overhead. Earn CDC with scale.

## Interview tip

Say: *"For anything large I process incrementally, not with full re-loads. Watermark polling on `updated_at` is the simple version; once deletes and reliability matter I move to log-based CDC with Debezium, which streams inserts/updates/deletes off the WAL — and I make sure the pipeline actually *removes* vectors on delete so the index never serves data that's gone from the source."* Volunteering the delete-handling detail is the tell that you've kept a real index in sync.
