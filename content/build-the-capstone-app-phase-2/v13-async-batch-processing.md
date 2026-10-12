# v13 · Async & Batch Processing

**What you'll build:** HelpDesk processes several interactive subtasks concurrently and sends large non-urgent workloads through an overnight Batch API pipeline.

## Why this version

Not all work has the same deadline. A customer waiting in chat needs an answer in seconds. Reclassifying 80,000 historical tickets can finish tomorrow. Treating both as synchronous requests either makes the interface slow or makes offline work unnecessarily expensive. This version separates interactive concurrency from asynchronous batch throughput.

## The mechanism

For one uploaded ticket, independent tasks—transcription, image analysis, and metadata lookup—can run concurrently with `asyncio.gather`. Concurrency is not unlimited: a semaphore caps in-flight calls so one busy user cannot consume the provider quota.

For large offline work, create one JSON Lines record per request with a unique `custom_id`. Upload the file, create a batch job, store its provider job ID, and return immediately. A scheduled worker polls infrequently or handles a webhook, downloads the result file, matches each result by `custom_id`, and updates the database idempotently.

<div class="diagram">
  <div class="flow v">
    <div class="flow"><span class="dbox gray">interactive ticket</span><span class="darr">→</span><span class="dbox purple">bounded gather()</span><span class="darr">→</span><span class="dbox green">seconds</span></div>
    <div class="flow"><span class="dbox gray">80k historical tickets</span><span class="darr">→</span><span class="dbox blue">JSONL batch job</span><span class="darr">→</span><span class="dbox green">hours</span></div>
  </div>
  <div class="dcap">Concurrency reduces latency for a small live job; Batch API optimizes cost and throughput for large deferred work.</div>
</div>

## Concrete implementation

```python
import asyncio

async def analyze_ticket(photo, voice, order_id):
    image_task = analyze_image(photo) if photo else asyncio.sleep(0, result=None)
    voice_task = transcribe(voice) if voice else asyncio.sleep(0, result=None)
    order_task = get_order(order_id) if order_id else asyncio.sleep(0, result=None)
    image, transcript, order = await asyncio.gather(
        image_task, voice_task, order_task, return_exceptions=True
    )
    return combine_partial_results(image, transcript, order)
```

Decide how partial failure behaves. A failed transcription should not discard a successful photo analysis; represent each sub-result as `ready`, `failed`, or `skipped`. Give every batch item a local job ID and add a unique database constraint so importing a result twice cannot duplicate work.

Never load a million records into memory to make one upload. Stream the JSONL file, split very large jobs, and keep a manifest containing job version, model, prompt version, expected row count, and checksum. Validate output counts and quarantine failed rows for a smaller retry batch.

For the historical-ticket backfill, each JSONL line contains `custom_id`, `method`, `url`, and a Responses API `body`. Upload with `client.files.create(file=..., purpose="batch")`, then call `client.batches.create(input_file_id=file.id, endpoint="/v1/responses", completion_window="24h")`. Persist the returned batch ID before leaving the worker. Import both output and error files by `custom_id`; never depend on result order. The current 50,000-request input limit means the 80,000-ticket example is split into at least two manifests. Poll slowly or verify signed webhook events, and let the v8.1 reconciliation worker repair missed callbacks and expired leases.

## How a company uses this

Interactive traffic gets reserved quota and tight latency budgets. Offline ticket classification runs in a cheaper batch window and may use a smaller model. Track queue depth, oldest-job age, completion percentage, malformed-result rate, per-item cost, and end-to-end duration. If a job is cancelled, mark it explicitly rather than leaving records “processing” forever.

## Common mistakes

- Calling blocking SDK methods inside `async` endpoints.
- Using unbounded `gather` on thousands of items.
- Assuming batch results return in input order instead of joining by `custom_id`.
- Polling the provider every second for a multi-hour job.
- Reprocessing imported results without idempotency.

## Interview tip

State the decision rule: use bounded concurrency for a small number of independent tasks on the user's critical path; use Batch API when volume is high and the result can wait.

## Practice — assignments

1. Run image, audio, and order lookups concurrently for one ticket.
2. Preserve successful sub-results when one task fails.
3. Enforce a per-process bulkhead plus a shared account-level rate/quota limiter.
4. Create a JSONL batch for historical ticket classification.
5. Match results by `custom_id` and import them idempotently.
6. Show batch progress and failed-row counts in an admin page.
7. Cancel a job safely and reconcile its local state.
