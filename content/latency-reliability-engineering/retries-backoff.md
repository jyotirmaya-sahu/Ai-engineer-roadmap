# Retries & backoff

**The one-line idea:** When a call fails for a *temporary* reason (rate limit, brief blip), try it again — but wait a little longer before each attempt, with a dash of randomness, so you don't stampede the provider that's already struggling.

## Why it matters for an AI Engineer

LLM providers rate-limit you constantly. Hit their per-minute token cap and you get a **429 Too Many Requests**; a brief backend wobble gives a **503**; a network hiccup drops the connection. These are **transient** — the exact same request succeeds a second later. If you fail the user on the first 429, your app looks broken when it's actually fine. Retrying with backoff turns most of these into invisible, self-healing events. It's the reliability pattern you'll implement most often, and "how do you handle 429s?" is a near-guaranteed interview question for any LLM-serving role.

## The mechanism — how it works

Three ideas stacked together:

1. **Retry only *transient* errors.** Retry: 429 (rate limit), 500/502/503 (server), timeouts, connection resets. **Do not** retry: 400 (bad request), 401 (bad key), 422 (validation) — those fail identically every time, so retrying just wastes time and money. Distinguishing the two is the core skill.
2. **Exponential backoff.** Don't retry immediately — that just re-hammers a busy provider. Wait an increasing delay: 1 s, 2 s, 4 s, 8 s… Each failure doubles the wait, giving the provider room to recover.
3. **Jitter (randomness).** If 1,000 of your requests all fail at once and all back off by *exactly* 2 s, they retry in a synchronized thundering herd and fail together again. Add random jitter (e.g. wait a random amount up to the backoff) so retries spread out.

Bound it: a **max number of attempts** (usually 3–5) and a **max total elapsed** so you don't retry past the user's patience or your latency budget. Honor the **`Retry-After` header** if the provider sends one — it's telling you exactly when to come back.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📞 call</span>
    <span class="darr">→<span class="lbl">429</span></span>
    <span class="dbox orange">wait ~1s</span>
    <span class="darr">→<span class="lbl">429</span></span>
    <span class="dbox orange">wait ~2s</span>
    <span class="darr">→<span class="lbl">429</span></span>
    <span class="dbox orange">wait ~4s</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ success</span>
  </div>
  <div class="dcap">Exponential backoff + jitter: each retry waits longer (and slightly randomized) so a busy provider can recover.</div>
</div>

## Concrete example

Using the `tenacity` library — the standard, batteries-included way in 2026:

```python
from tenacity import (retry, stop_after_attempt, wait_exponential_jitter,
                      retry_if_exception_type)
import httpx
from openai import OpenAI, RateLimitError, APITimeoutError, InternalServerError

client = OpenAI()

@retry(
    retry=retry_if_exception_type(          # ONLY transient errors
        (RateLimitError, APITimeoutError, InternalServerError, httpx.ConnectError)),
    wait=wait_exponential_jitter(initial=1, max=30),  # 1,2,4,8… + jitter
    stop=stop_after_attempt(5),             # bound the attempts
    reraise=True,
)
def ask(prompt: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o", timeout=4.0,
        messages=[{"role": "user", "content": prompt}])
    return resp.choices[0].message.content

# A 400 (bad request) is NOT in the retry set → fails immediately, as it should.
print(ask("Explain a letter of credit in two lines."))
```

The OpenAI/Anthropic SDKs also retry 429/5xx automatically (`max_retries=2` by default) — but you'll often set your own policy for tighter control and to combine with fallbacks.

## How a company uses this

A **Dubai retail** platform runs nightly batch enrichment — classifying ~200,000 product descriptions through an LLM. Bursting that fast slams straight into per-minute rate limits, so **429s are the norm, not the exception.** Their worker wraps each call in tenacity with exponential-backoff-plus-jitter and honors `Retry-After`; ~18% of calls hit a 429 and *silently* succeed on retry, so the batch completes with a ~99.9% success rate and zero manual intervention. The jitter is load-bearing: an earlier version backed off by a fixed 2 s, and 500 workers retried in lockstep, re-triggering the limit in waves — adding randomness flattened the retries and cut total runtime by ~40%. Crucially, they *don't* retry 400s from malformed rows; those are logged and skipped, saving thousands of pointless paid retries.

## Common mistakes / misconceptions

- **Retrying non-transient errors.** Re-sending a 400/401 fails identically and burns money and time. Retry only 429/5xx/timeouts.
- **No jitter.** Synchronized backoff creates a thundering herd that re-fails together. Always jitter.
- **Immediate / linear retries.** Retrying in a tight loop re-hammers a busy provider and makes the outage worse. Back off exponentially.
- **Unbounded retries.** Infinite retries blow your latency budget and mask a real outage — cap attempts and total time.
- **Retrying non-idempotent side effects.** If the call already charged a card or sent an email, a retry double-does it. Ensure the operation is safe to repeat.

## Interview tip
Say: *"I retry only transient errors — 429s and 5xx and timeouts — with exponential backoff plus jitter to avoid a thundering herd, honor Retry-After when present, and bound both attempts and total elapsed so I don't blow the latency budget. I never retry 400s or 401s because they fail deterministically. Above the retry layer I add a circuit breaker so I stop retrying a provider that's fully down."* Naming jitter and the transient-vs-permanent distinction is what separates a real answer from a textbook one.

See also: **[Timeouts](timeouts.md)** (what produces the retryable failure) and **[Circuit breakers](circuit-breakers.md)** (when to stop retrying entirely).
