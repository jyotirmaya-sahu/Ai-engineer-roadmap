# Retries & backoff

**What it is:** The pattern for surviving *transient* failures — network blips, 429 rate limits, 500/503 server errors — by **retrying the request**, but waiting **longer each time** (exponential backoff) with a little randomness (jitter), instead of hammering the API.

## Why it matters for an AI Engineer

LLM APIs fail *sometimes*, even when you did everything right — a momentary overload, a dropped connection, a rate-limit spike. Without retries, every one of those failures becomes a user-facing error or a broken batch job. With naive retries (immediate, in a loop), you make an overloaded server *worse* and can get yourself throttled harder. Exponential backoff with jitter is the industry-standard fix, and it's the single most important reliability pattern for any code that calls an external API. Interviewers ask about it because it reveals whether you've operated real systems or only happy-path demos.

## The mechanism — how it works

**Retry** = try again on failure. **Backoff** = wait progressively longer between tries. **Jitter** = add randomness to the wait so many clients don't retry in lockstep.

The exponential schedule: wait `base × 2^attempt` seconds, capped at a max, plus a random fraction.
- Attempt 1 fails → wait ~1s
- Attempt 2 fails → wait ~2s
- Attempt 3 fails → wait ~4s
- Attempt 4 fails → wait ~8s … up to a ceiling, then give up.

**Jitter** matters: if 1,000 clients all fail at once and all wait exactly 2s, they retry *simultaneously* and re-overload the server (a "thundering herd"). Randomizing each wait spreads them out.

**Retry only what's retryable:**
- ✅ **429** (rate limit — honor `Retry-After`), **500/502/503** (transient server), **timeouts / connection resets**.
- ❌ **400** (bad request), **401** (bad key), **403**, **422** (invalid schema) — these will *never* succeed on retry; retrying wastes time and money. Fix the request instead.

Also make retries **idempotency-aware**: for non-streaming completions a retry just costs another call; be careful retrying anything with side effects (a [tool call](function-tool-schemas.md) that charged a card).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📤 request</span>
    <span class="darr">→</span>
    <span class="dbox orange">⛔ 503</span>
    <span class="darr">→<span class="lbl">wait 1s+jit</span></span>
    <span class="dbox orange">⛔ 503</span>
    <span class="darr">→<span class="lbl">wait 2s+jit</span></span>
    <span class="dbox orange">⛔ 429</span>
    <span class="darr">→<span class="lbl">wait 4s+jit</span></span>
    <span class="dbox green">✅ 200</span>
  </div>
  <div class="dcap">Retry transient failures with exponentially growing, jittered waits — up to a cap, then surface the error.</div>
</div>

## Concrete example

```python
import random, time
from openai import OpenAI, RateLimitError, APIStatusError, APITimeoutError
client = OpenAI()

RETRYABLE = (RateLimitError, APITimeoutError)   # + 5xx via APIStatusError check

def robust_call(messages, base=1.0, cap=30.0, max_tries=6):
    for attempt in range(max_tries):
        try:
            return client.chat.completions.create(model="gpt-4.1", messages=messages)
        except APIStatusError as e:
            if e.status_code < 500:          # 4xx (except 429) won't fix on retry
                raise
        except RETRYABLE:
            pass
        wait = min(cap, base * 2 ** attempt) + random.uniform(0, 1)  # backoff + jitter
        time.sleep(wait)
    raise RuntimeError("exhausted retries")
```

The official OpenAI and Anthropic SDKs already retry with backoff automatically (configurable via `max_retries`) — but knowing the mechanism lets you tune it and build your own for custom clients.

## How a company uses this

A Dubai trading platform generates market summaries via an LLM every minute. **Production reality:** during a provider incident they saw a burst of 503s; their **jittered exponential backoff** rode through it with zero user-visible failures, retrying a handful of times over ~15 seconds until the provider recovered. Critically, they *don't* retry 400/422 errors — a malformed prompt from a bug once caused an old version to retry the same doomed request six times, wasting quota and delaying the real fix. They also cap total retry time so a truly down provider fails fast into a fallback (a cheaper backup model) rather than hanging the whole pipeline.

## Common mistakes

- **Retrying non-retryable errors** (400/401/422) — they never succeed; fix the request.
- **No jitter** — synchronized retries cause a thundering herd that re-overloads the server.
- **Immediate/tight-loop retries** — hammering makes rate limits and outages worse.
- **No cap on attempts or total time** — a down provider hangs your app forever; fail fast into a fallback.
- **Blindly retrying side-effecting calls** — a retried tool action can double-charge; ensure idempotency.

## Interview tip
Say: *"I retry only transient failures — 429 and 5xx and timeouts — with exponential backoff plus jitter, honoring Retry-After, capped in both attempts and total time. Jitter avoids a thundering herd; I never retry 4xx like 400 or 422 because they won't succeed. And I'm careful with side-effecting calls so a retry doesn't double-execute. The SDKs do this by default, but I tune max_retries and add a fallback model for hard outages."* Distinguishing retryable from non-retryable and mentioning jitter is the tell of real ops experience.
