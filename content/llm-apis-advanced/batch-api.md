# Batch API

**What it is:** A way to submit a *big pile of requests as one job* that the provider processes **asynchronously within a window (usually up to 24 hours)** in exchange for a **~50% discount** and much higher throughput. You upload, wait, download results.

## Why it matters for an AI Engineer

Not everything needs an answer *right now*. Classifying a million support tickets, embedding an entire document archive, generating product descriptions for a whole catalog, or re-scoring historical data overnight — these are **offline** jobs where a few hours' delay is fine. Paying full real-time price and fighting [rate limits](rate-limits.md) for them is wasteful. The Batch API cuts cost in half and lets you push far more volume than the synchronous endpoint allows. Knowing when to reach for batch vs real-time is a core cost-engineering skill — it's often the single biggest lever on an AI product's bill.

## The mechanism — how it works

Batch is **file-based and asynchronous**:

1. **Build a JSONL file** — one line per request, each with a `custom_id` (so you can match results back), the endpoint, and the usual request body (model, messages, etc.).
2. **Upload it** via the [Files API](files-api.md).
3. **Create a batch job** pointing at that file, with a completion window (e.g. `24h`).
4. **Poll** the job's status — it moves `validating → in_progress → completed` (or `failed`). You do *not* hold a connection open; you check back later.
5. **Download the output file** — a JSONL where each line has your `custom_id` and that request's response. Errors come in a separate error file.

Trade-offs vs synchronous calls: **cheaper (~50%)** and **higher throughput** (its own large quota), but **not instant** — results arrive within the window (often much sooner, but no guarantee). It's the opposite end of the spectrum from [streaming](/working-with-llm-apis/streaming).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 requests.jsonl<span class="sub">1M lines</span></span>
    <span class="darr">→<span class="lbl">upload</span></span>
    <span class="dbox purple">🧠 batch job<span class="sub">async, ≤24h</span></span>
    <span class="darr">→<span class="lbl">poll</span></span>
    <span class="dbox orange">⏳ in_progress</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ results.jsonl<span class="sub">~50% cheaper</span></span>
  </div>
  <div class="dcap">Upload a file of requests, poll, download results — half price, high volume, for non-urgent work.</div>
</div>

## Concrete example

```python
import json
from openai import OpenAI
client = OpenAI()

# 1) Write a JSONL: one request per line, each with a custom_id
rows = [
    {"custom_id": "ticket-1", "method": "POST", "url": "/v1/chat/completions",
     "body": {"model": "gpt-4.1-mini",
              "messages": [{"role": "user", "content": "Classify: 'My card was declined.'"}]}},
    {"custom_id": "ticket-2", "method": "POST", "url": "/v1/chat/completions",
     "body": {"model": "gpt-4.1-mini",
              "messages": [{"role": "user", "content": "Classify: 'How do I reset my PIN?'"}]}},
]
with open("batch.jsonl", "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")

# 2) Upload + 3) create the batch
up = client.files.create(file=open("batch.jsonl", "rb"), purpose="batch")
job = client.batches.create(input_file_id=up.id,
                            endpoint="/v1/chat/completions", completion_window="24h")

# 4) Poll later; 5) when completed, download results
job = client.batches.retrieve(job.id)
if job.status == "completed":
    out = client.files.content(job.output_file_id).text  # JSONL keyed by custom_id
    print(out)
```

## How a company uses this

A Dubai e-commerce marketplace enriches **2 million** product listings with AI-generated Arabic + English descriptions and category tags. **Production reality:** doing this synchronously would take days of babysitting rate limits and cost twice as much. They chunk the catalog into JSONL files, submit them to the Batch API each night, and by morning have results keyed by `product_id` (their `custom_id`) ready to load. The **50% discount** on a job this size saves them thousands of dollars per run, and because it's offline they don't compete with their live storefront's real-time quota. Failed lines land in the error file and get re-submitted the next night.

## Common mistakes

- **Using batch for interactive requests** — users won't wait hours; batch is for offline work only.
- **Forgetting `custom_id`**, then being unable to match results back to inputs — order is not guaranteed.
- **Not handling the error file** — some lines fail (bad input, content filter); process both output and error files.
- **Assuming it's always fast** — it *usually* finishes early but you must design for up-to-window latency and poll, not block.
- **Ignoring per-file size/line limits** — split very large jobs into multiple files.

## Interview tip
Say: *"For any offline, non-urgent, high-volume job — bulk classification, embedding an archive, catalog enrichment — I use the Batch API: upload a JSONL of requests with custom_ids, poll, download results. It's roughly 50% cheaper and has its own high-throughput quota, so it doesn't fight my real-time traffic. The trade-off is up-to-24-hour latency, so it's strictly for work a user isn't waiting on."* Framing it as a cost/throughput-vs-latency decision is exactly the judgment they want.
