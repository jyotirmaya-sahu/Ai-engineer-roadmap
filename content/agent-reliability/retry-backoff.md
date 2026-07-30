# Retry / Backoff

**The one-line idea:** Retry with backoff automatically re-attempts a failed call, waiting a little longer between each try (and adding a bit of randomness), so a transient hiccup — a rate limit, a timeout, a blip — recovers on its own instead of crashing the whole agent run.

## Why it matters for an AI Engineer

Agents make many external calls per run — LLM APIs, tool APIs, databases — and *all* of them fail sometimes. Not because your code is wrong, but because the network dropped a packet, the LLM provider throttled you (HTTP 429), or a service was briefly overloaded (503). Without retries, one transient failure on step 7 of 20 kills the whole run and wastes everything before it. With naive retries (hammer immediately, forever) you make an overloaded service *worse* and can spin up a cost/rate-limit disaster. Backoff is the disciplined middle: retry, but back off politely. Getting this right is basic production hygiene — and interviewers notice when a candidate *doesn't* mention it for agent robustness.

## The mechanism — how it works

Three ideas stack together:

1. **Exponential backoff.** Wait `base × 2^attempt` between retries: 1s, 2s, 4s, 8s… Each failure means the service needs more breathing room, so you give it exponentially more. A cap (e.g. 60s) stops the delay growing absurdly.
2. **Jitter.** Add randomness to each delay. Without it, 1000 clients that all failed at the same instant will all retry at the *exact same* moment — a "thundering herd" that re-crashes the service. Jitter spreads the retries out.
3. **Retry only what's retryable.** Retry *transient* errors — 429 (rate limit), 500/503, timeouts, connection resets. **Never** retry *permanent* ones — 400 (bad request), 401 (auth), 404. Retrying a permanent error just wastes time and money; it'll fail identically every time.

You also cap the **number** of attempts (say 5) so a truly-down service doesn't loop forever, and ideally respect a `Retry-After` header if the API tells you how long to wait.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🔧 call fails (429)</span>
    <span class="darr">→<span class="lbl">wait 1s±j</span></span>
    <span class="dbox orange">retry (429)</span>
    <span class="darr">→<span class="lbl">wait 2s±j</span></span>
    <span class="dbox orange">retry (429)</span>
    <span class="darr">→<span class="lbl">wait 4s±j</span></span>
    <span class="dbox green">✅ success</span>
  </div>
  <div class="dcap">Exponential backoff + jitter: each retry waits longer, with randomness to avoid a thundering herd.</div>
</div>

## Concrete example

The `tenacity` library gives you production-grade retry in a decorator:

```python
from tenacity import (retry, stop_after_attempt, wait_random_exponential,
                      retry_if_exception_type)
import openai

@retry(
    wait=wait_random_exponential(multiplier=1, max=60),   # 1,2,4,8…s + jitter, capped 60s
    stop=stop_after_attempt(5),                           # give up after 5 tries
    retry=retry_if_exception_type(                        # only these are transient
        (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError)
    ),
)
def call_llm(prompt):
    return client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": prompt}]
    )
# a 400 BadRequestError is NOT in the retry set -> fails fast, no wasted retries
```

Wrap every external call an agent makes — LLM and tools — the same way.

## How a company uses this

A **Dubai e-commerce** company's product-enrichment agent processes 50k SKUs/night, each needing several LLM calls. At that volume they routinely hit the provider's rate limit. Before backoff, a burst of 429s would abort whole batches and leave thousands of SKUs unprocessed. After adding `wait_random_exponential` with jitter and a 5-attempt cap, the *same* traffic sails through: retries absorb the throttling invisibly, the batch completes, and — crucially — the jitter stopped their own fleet of workers from synchronizing their retries into a self-inflicted DDoS on the API. Nightly failure rate dropped from ~4% of SKUs to under 0.1%.

## Common mistakes / misconceptions

- **Retrying without backoff.** Immediate retries hammer an already-struggling service and can trip harder rate limits — you cause the outage you're retrying through.
- **No jitter.** Synchronized retries across many workers = thundering herd. Always add randomness.
- **Retrying permanent errors.** Retrying a 400/401/404 wastes attempts on something that will never succeed. Whitelist only transient errors.
- **Infinite retries.** No attempt cap means a truly-down dependency hangs the agent forever — pair retries with a max and a step/spend cap.
- **Retrying non-idempotent actions blindly.** Retrying `issue_refund` after a timeout might double-charge if the first call *actually succeeded*. Use idempotency keys — see [error recovery](error-recovery.md).

## Interview tip
Say: *"I wrap every external call — LLM and tools — in retry with exponential backoff and jitter, capped at ~5 attempts, and I only retry transient errors like 429s and timeouts, never a 400 or 401. Jitter matters at scale so my own workers don't synchronize into a thundering herd. And for non-idempotent actions like payments I use an idempotency key so a retry after a timeout can't double-execute."* The idempotency callout is what separates a senior answer from a textbook one.

See also: **[Error recovery](error-recovery.md)** (what to do when retrying isn't enough) and **[Step / spend budget caps](step-spend-budget-caps.md)** (the ceiling that stops retries running up the bill).
