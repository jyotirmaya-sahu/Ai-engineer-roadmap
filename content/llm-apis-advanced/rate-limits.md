# Rate limits

**What it is:** The caps a provider puts on how much you can call it — typically **requests per minute (RPM)** and **tokens per minute (TPM)** — beyond which it rejects your calls with an HTTP **429 (Too Many Requests)**.

## Why it matters for an AI Engineer

The gap between a demo and a product is often just rate limits. A notebook that calls the API a few times works fine; the moment you loop over 10,000 rows or serve 500 concurrent users, you slam into 429s and your app starts failing. Handling rate limits — knowing your quota, spreading load, and reacting to 429s — is the first real *production* skill in this node. It's also a frequent interview question ("what happens when you exceed the rate limit, and how do you handle it?") precisely because it separates people who've only prototyped from people who've run something at scale.

## The mechanism — how it works

Providers meter two things per minute (sometimes per day too):
- **RPM** — number of requests.
- **TPM** — total tokens (input + output) across those requests.

You can hit *either* first: many tiny requests exhaust RPM; a few huge prompts exhaust TPM. Limits scale with your **usage tier** — as you spend more and your account ages, providers raise your quotas automatically.

When you exceed a limit, the API returns **429**, usually with a **`Retry-After`** header telling you how many seconds to wait. Responses also often include headers like `x-ratelimit-remaining-requests` / `-tokens` so you can see how close you are *before* getting blocked.

The three defenses, in order:
1. **Stay under proactively** — throttle your own sending rate; use a concurrency limit (see [Async batching](async-batching.md)).
2. **React to 429 gracefully** — retry after the indicated wait with [backoff](retries-backoff.md), never in a tight loop.
3. **Restructure the workload** — move bulk, non-urgent jobs to the [Batch API](batch-api.md), which has its own separate high quota.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📤 many requests</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 API<span class="sub">RPM / TPM meter</span></span>
    <span class="darr">→<span class="lbl">over limit</span></span>
    <span class="dbox orange">⛔ 429 + Retry-After</span>
    <span class="darr">→<span class="lbl">wait + retry</span></span>
    <span class="dbox green">✅ succeeds</span>
  </div>
  <div class="dcap">Exceed RPM or TPM and you get a 429 with a wait hint — throttle proactively, retry politely.</div>
</div>

## Concrete example

```python
import time
from openai import OpenAI, RateLimitError
client = OpenAI()

def call_with_limit_handling(messages, max_tries=5):
    for attempt in range(max_tries):
        try:
            return client.chat.completions.create(model="gpt-4.1-mini", messages=messages)
        except RateLimitError as e:
            # Honour Retry-After if present, else exponential backoff
            wait = getattr(e, "retry_after", None) or (2 ** attempt)
            print(f"429 hit — waiting {wait}s")
            time.sleep(wait)
    raise RuntimeError("still rate-limited after retries")

# Proactively cap concurrency so you rarely hit 429 in the first place:
import asyncio
sem = asyncio.Semaphore(10)   # at most 10 in-flight requests
```

The reactive retry catches the occasional 429; the concurrency cap prevents most of them.

## How a company uses this

A Dubai marketing agency runs a nightly job scoring **50,000** ad creatives. **Production reality:** their first version fired all 50k requests as fast as possible and got a wall of 429s, so the job actually ran *slower* (constant retries) than a paced version. They fixed it two ways: a **semaphore capping concurrency** so they hover just under TPM, and moving the whole job to the **Batch API**, which has a separate large quota and doesn't compete with their live app's real-time limit. For the live app they monitor the `x-ratelimit-remaining` headers and shed load (queueing) *before* hitting the wall, and they requested a **tier upgrade** to raise quotas as volume grew.

## Common mistakes

- **Retrying 429s in a tight loop** — hammering the API makes it worse; back off (see [Retries & backoff](retries-backoff.md)).
- **Ignoring `Retry-After`** and guessing the wait, causing more 429s.
- **Only watching RPM** while a few giant prompts blow the TPM limit — track both.
- **Running bulk work on the real-time endpoint** instead of the [Batch API](batch-api.md)'s separate quota.
- **Not requesting a tier upgrade** — quotas grow with usage/spend; many teams never ask.

## Interview tip
Say: *"Providers cap requests-per-minute and tokens-per-minute; exceed either and you get a 429 with a Retry-After. I handle it in three layers: proactively cap my own concurrency to stay under TPM, react to 429s with exponential backoff honoring Retry-After, and push bulk non-urgent work to the Batch API which has a separate quota. I also watch the remaining-limit headers to shed load before hitting the wall."* Naming RPM *and* TPM, plus the Batch-quota escape hatch, signals real scale experience.
