# Async Batching

**The one-line idea:** concurrency overlaps waiting for independent online requests; batching combines offline work so the provider or GPU can process it efficiently.

## Why it matters for an AI Engineer

LLM calls are mostly network and inference wait time. Sending independent calls one after another wastes wall-clock time. Unbounded concurrency, however, causes rate-limit failures and memory spikes. Production systems use bounded concurrency for interactive work and provider batch APIs or model-server dynamic batching for large offline jobs.

## Mechanism

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">1,000 jobs</span>
    <span class="darr">→</span>
    <span class="dbox orange">Queue + semaphore<span class="sub">bounded in-flight work</span></span>
    <span class="darr">→</span>
    <span class="dbox green">Results<span class="sub">retryable by job ID</span></span>
  </div>
</div>

Use `asyncio.gather` only behind a semaphore. Preserve a stable request ID so results can be joined even if completion order differs:

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()
limit = asyncio.Semaphore(20)

async def classify(job_id: str, text: str):
    async with limit:
        response = await client.responses.create(
            model="gpt-5-mini",
            input=f"Return one category for:\n{text}",
        )
        return job_id, response.output_text

async def run(rows):
    tasks = [classify(str(i), row) for i, row in enumerate(rows)]
    return dict(await asyncio.gather(*tasks))
```

Twenty is an example, not a universal setting. Derive concurrency from provider request/token limits, average service time, and downstream capacity. Handle `429` and transient `5xx` responses with bounded exponential backoff and jitter; do not retry validation or authentication errors.

For work that need not finish interactively—nightly evaluations, embeddings, classification, migrations—use a provider Batch API. OpenAI’s Batch API accepts JSONL, supports up to 50,000 requests per input file, currently uses a 24-hour completion window, and returns results keyed by `custom_id`. It is not a substitute for a user-facing request path.

## How a company uses this

A recruiting platform may classify 200,000 CV sections overnight through batch processing, while its live search endpoint uses bounded async calls. A durable queue stores job state, workers claim jobs idempotently, and dashboards track queue age, throughput, rate-limit errors, and cost.

## Common mistakes

- Launching thousands of coroutines without a semaphore.
- Calling synchronous SDK methods inside `async def`, which blocks the event loop.
- Assuming output order equals input order.
- Retrying every exception.
- Using offline batching for an interactive UI.

## Interview tip

Explain the distinction: *“Async concurrency reduces wall time by overlapping I/O; batching improves throughput by grouping work. I bound concurrency, attach idempotent job IDs, honor rate limits, and use a durable queue or provider Batch API for offline workloads.”*

