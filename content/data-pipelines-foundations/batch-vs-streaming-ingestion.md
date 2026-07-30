# Batch vs Streaming Ingestion

**The one-line idea:** you either move data in big scheduled loads ("every night, grab everything new") or continuously the moment it's created ("this record just happened — process it now"). Batch is a bus on a timetable; streaming is a conveyor belt that never stops.

## Why it matters for an AI Engineer

This is the first fork in every data pipeline, and it sets the *freshness* your AI can offer. A RAG assistant over last-quarter reports is fine on nightly batch. A fraud model or a "what did the customer just do?" support bot needs streaming, or it answers with stale reality. Pick wrong and you either overpay for real-time you don't need, or you ship a system that's always a day behind. Interviewers ask this to check whether you match architecture to the actual latency requirement instead of reaching for the trendy answer.

## The mechanism / how it works

**Batch ingestion** collects data into chunks and processes them on a schedule. You run a job at, say, 2am: read all rows created since yesterday, transform them, load them into the store, done. It's simple, cheap, easy to retry (just re-run the job), and easy to reason about because each run has a clear start and end. The cost is **latency**: data is only as fresh as your last run. Classic tools: a cron-scheduled Python script, Airflow, dbt, Spark batch jobs.

**Streaming ingestion** processes each event as it arrives, typically through a message log like **Kafka** or a cloud queue (Kinesis, Pub/Sub). A producer writes events onto the log; consumers read them continuously and update the store within seconds. You get low latency and always-fresh data, at the cost of more moving parts: you must handle ordering, late/out-of-order events, exactly-once vs at-least-once delivery, and a system that never has a clean "the job finished" moment.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🗄️ Source</span>
    <span class="darr">↓</span>
    <div class="flow">
      <div class="dgroup"><span class="dgt">BATCH</span>
        <span class="dbox orange">⏰ wait for schedule</span>
        <span class="darr">→</span>
        <span class="dbox purple">process all new rows</span>
      </div>
      <div class="dgroup"><span class="dgt">STREAMING</span>
        <span class="dbox orange">📨 event log (Kafka)</span>
        <span class="darr">→</span>
        <span class="dbox purple">process each event now</span>
      </div>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">🏬 Store</span>
  </div>
  <div class="dcap">Batch trades freshness for simplicity; streaming trades simplicity for freshness.</div>
</div>

Many real systems are **hybrid** ("micro-batch"): stream into a log, then process in tiny batches every few seconds — the sweet spot for a lot of near-real-time needs.

## Concrete example

Batch — a nightly pull of new rows:

```python
import datetime as dt, sqlite3
def run_batch(since: dt.datetime):
    src = sqlite3.connect("source.db")
    rows = src.execute(
        "SELECT id, body, updated_at FROM docs WHERE updated_at > ?",
        (since.isoformat(),)
    ).fetchall()
    for doc_id, body, _ in rows:
        load_into_store(doc_id, clean(body))   # embed / upsert
    print(f"batch loaded {len(rows)} rows")
```

Streaming — react to each event off a Kafka topic:

```python
from kafka import KafkaConsumer   # pip install kafka-python
import json
consumer = KafkaConsumer("doc-events", bootstrap_servers="localhost:9092",
                         value_deserializer=lambda b: json.loads(b))
for msg in consumer:                    # blocks, runs forever
    evt = msg.value
    load_into_store(evt["id"], clean(evt["body"]))   # within seconds of creation
```

Same downstream `load_into_store`; the difference is purely *when* it's triggered.

## How a company uses this

A Dubai food-delivery platform runs both. Restaurant menus and analytics dashboards refresh on **nightly batch** — nobody needs a menu update within seconds, and a bulk job over millions of rows is cheap and predictable. But order events (placed, picked up, delivered) go through **Kafka streaming** because the live-tracking map and the "where's my order" support bot need sub-5-second freshness. Scale sharpens the choice: at ~50k orders/hour, re-batching orders would mean either huge latency or hammering the DB every minute — streaming is the only sane option. The rule of thumb they use: *batch by default (it's cheaper and simpler); go streaming only where a human or model visibly suffers from staleness.*

## Common mistakes / misconceptions

- **Reaching for streaming because it sounds modern.** Streaming triples your operational burden. If a nightly refresh meets the requirement, batch is the professional choice.
- **Thinking batch means "slow to run".** A batch job can process millions of rows in minutes; "batch" refers to *scheduling*, not speed.
- **Ignoring failure semantics in streaming.** At-least-once delivery means you *will* see duplicate events — you need idempotent loads or a dedup step (see [Deduplication](./deduplication.md)).
- **Full re-loads in batch.** Once data is large, re-processing everything each night is wasteful — move to [Incremental updates & CDC](./incremental-updates-cdc.md).

## Interview tip

Say: *"I start with batch because it's cheaper, simpler, and trivially retryable, and I only move a data source to streaming when the freshness requirement genuinely demands it — like live order tracking. For a lot of cases the answer is micro-batch, which gets near-real-time without full streaming complexity."* Naming the *default* plus the *trigger to upgrade* is exactly the production judgment interviewers want.
