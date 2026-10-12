# v12 · Resilient Provider Client

**What you'll build:** every OpenAI request passes through one shared client that applies timeouts, bounded retries, exponential backoff with jitter, concurrency limits, prompt caching, and consistent metrics.

## Why this version

By v11, model calls are scattered across chat, tools, multimodal processing, transcription, and embeddings. If each endpoint handles failures differently, an outage becomes chaos: some calls hang, some retry forever, and others expose raw provider errors. A provider gateway gives the application one reliable boundary.

## The mechanism

Classify failures before retrying. A timeout, connection error, `429`, or most `5xx` responses may be transient. Invalid input, authentication failure, or content-policy rejection will not improve on retry. Limit both attempts and total elapsed time. Use exponential backoff with random jitter so hundreds of workers do not retry simultaneously.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">HelpDesk feature</span><span class="darr">→</span><span class="dbox orange">deadline + semaphore</span><span class="darr">→</span><span class="dbox purple">provider call</span><span class="darr">→</span><span class="dbox blue">classify failure</span><span class="darr">→</span><span class="dbox green">result or safe fallback</span>
  </div>
  <div class="dcap">Retries are one controlled policy inside the gateway, not ad-hoc loops in every endpoint.</div>
</div>

## Concrete implementation

```python
import asyncio, random, time
from openai import AsyncOpenAI, APIConnectionError, RateLimitError, InternalServerError

client = AsyncOpenAI(timeout=20.0, max_retries=0)
slots = asyncio.Semaphore(20)

async def create_response(**kwargs):
    started = time.monotonic()
    last_error = None
    attempts = 0
    try:
        async with asyncio.timeout(45):  # includes queue wait, calls, and sleeps
            for attempt in range(4):
                attempts = attempt + 1
                try:
                    async with slots:    # per-process bulkhead, not a global quota
                        result = await client.responses.create(**kwargs)
                    record_llm_call(ok=True, attempts=attempts,
                                    elapsed=time.monotonic() - started)
                    return result
                except (APIConnectionError, RateLimitError, InternalServerError) as exc:
                    last_error = exc
                    if attempts == 4:
                        raise
                    retry_after = bounded_retry_after(getattr(exc, "response", None))
                    delay = retry_after or random.uniform(0, min(8.0, 0.5 * 2**attempt))
                    await asyncio.sleep(delay)
    except (TimeoutError, APIConnectionError, RateLimitError, InternalServerError) as exc:
        record_llm_call(ok=False, attempts=attempts,
                        elapsed=time.monotonic() - started)
        raise ProviderUnavailable() from exc
```

`bounded_retry_after` parses the provider header and clamps it to the remaining deadline. Bad requests, authentication/permission errors, policy refusals, and validation errors are deliberately outside the retry tuple and receive one attempt. Add an idempotency key to operations that can create durable side effects. The semaphore is only a per-process bulkhead; size each worker from account quota and use a shared rate/quota service across multiple workers. Keep cacheable prompt prefixes stable and measure cached input tokens rather than assuming a hit.

The browser should receive a stable application error such as `temporarily_unavailable`, never a provider stack trace. For chat, preserve the user's unsent message and offer Retry. For background jobs, move exhausted work to a dead-letter state for inspection.

## How a company uses this

Set service objectives: perhaps p95 first-token latency below 2.5 seconds and successful chat responses above 99.5%. Dashboard requests, tokens, cost, latency, retry count, `429` rate, cache-hit tokens, and errors by feature/model. Alert on sustained failure rate rather than one transient error. A circuit breaker can pause calls briefly when a provider is clearly unhealthy.

## Common mistakes

- Retrying every error, including invalid requests and authentication failures.
- Stacking SDK retries beneath application retries and multiplying attempts.
- Retrying without jitter.
- Holding a database transaction open while sleeping.
- Claiming prompt caching while constantly changing the prefix.

## Interview tip

Give explicit bounds: four attempts, exponential backoff with jitter, an overall deadline, concurrency semaphore, and error classification. “We retry” is not an operational design until those limits are clear.

## Practice — assignments

1. Route chat, embeddings, vision, and transcription through one provider gateway.
2. Unit-test `429`, timeout, `500`, and invalid-request behavior.
3. Respect a mocked `Retry-After` value.
4. Add a concurrency limit and measure queued requests.
5. Report cached and uncached input tokens separately.
6. Preserve a failed user's message and implement Retry in the UI.
7. Add a circuit breaker for a sustained simulated outage.
