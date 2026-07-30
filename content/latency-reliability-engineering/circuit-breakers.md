# Circuit breakers

**The one-line idea:** When a provider is clearly down — failing over and over — *stop calling it for a while* and fail instantly, like a household fuse that trips to protect the wiring instead of letting current keep flowing into a fault.

## Why it matters for an AI Engineer

Retries are great for a *blip*. But when a provider is truly **down** (a real OpenAI outage, a region offline), retrying makes everything worse: every request waits for its timeout, then retries 3–5 times, so each user waits 20+ seconds only to fail anyway — and you flood the dying provider with traffic that slows its recovery. A circuit breaker detects "this dependency is broken right now" and **fails fast** — instantly rejecting or rerouting calls without waiting on timeouts. This protects your latency, frees your threads, and gives the provider room to heal. It's the pattern that keeps a *provider* outage from becoming a *your-app* outage.

## The mechanism — how it works

A circuit breaker is a small state machine wrapping a dependency, with three states:

- **Closed** (normal): calls pass through. It counts failures. If failures cross a threshold (e.g. >50% of the last 20 calls, or 5 consecutive failures), it **trips** to Open.
- **Open** (tripped): calls are rejected *immediately* — no network attempt, no timeout wait — for a cooldown period (e.g. 30 s). During this window you fail fast or route to a fallback. This is the key: the outage now costs you ~0 ms per request instead of a full timeout.
- **Half-open** (testing): after the cooldown, it lets *one* trial call through. If it succeeds, the breaker closes (provider recovered). If it fails, it re-opens and waits again.

So the breaker automatically stops hammering a dead provider, and automatically re-checks whether it's back — no human, no redeploy. It pairs with retries and fallbacks: **retry** handles transient errors *inside* Closed; when retries keep failing, the breaker **trips** and hands off to a **fallback**.

<div class="diagram">
  <div class="flow">
    <span class="dbox green">🟢 CLOSED<span class="sub">calls pass, count fails</span></span>
    <span class="darr">→<span class="lbl">too many fails</span></span>
    <span class="dbox orange">🔴 OPEN<span class="sub">fail fast 30s</span></span>
    <span class="darr">→<span class="lbl">cooldown</span></span>
    <span class="dbox yellow">🟡 HALF-OPEN<span class="sub">try 1 call</span></span>
    <span class="darr">→<span class="lbl">ok</span></span>
    <span class="dbox green">🟢 CLOSED</span>
  </div>
  <div class="dcap">Trips open after repeated failures, fails fast during cooldown, then probes with one call to recover.</div>
</div>

## Concrete example

Using `pybreaker` around an LLM provider call:

```python
import pybreaker
from openai import OpenAI, APIError

# trip after 5 consecutive fails; stay open 30s before probing
breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)
client = OpenAI()

@breaker
def call_primary(prompt: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o", timeout=4.0,
        messages=[{"role": "user", "content": prompt}])
    return resp.choices[0].message.content

def ask(prompt: str) -> str:
    try:
        return call_primary(prompt)
    except pybreaker.CircuitBreakerError:
        # breaker is OPEN → fail fast, don't even try the network
        return call_fallback(prompt)          # e.g. Bedrock Claude / cheaper model
    except APIError:
        return call_fallback(prompt)
```

When OpenAI is healthy, calls flow. After 5 straight failures the breaker opens and, for the next 30 s, `call_primary` raises `CircuitBreakerError` **instantly** — every request skips straight to the fallback with zero timeout delay. After 30 s it probes once; success closes it again.

## How a company uses this

A **Dubai bank**'s assistant depends on Azure OpenAI. During a 20-minute regional incident, *without* a breaker their retry logic meant every request burned ~15 s (timeout × retries) before failing — threads saturated, and even *unrelated* endpoints slowed because the pool was exhausted. After adding a circuit breaker (trip on >50% failures over a 20-call window, 30 s cooldown), the *second* the failure rate crossed the threshold the breaker opened and every request flipped to their Bedrock Claude fallback in <10 ms. Users saw a brief quality change, not an outage; p99 stayed under 3 s throughout. The breaker also gave them a clean signal to alert on ("primary breaker OPEN") that fires *before* customers complain. At ~50 QPS, this converted a would-be SEV-1 into a logged blip.

## Common mistakes / misconceptions

- **Retries without a breaker.** Retries alone amplify an outage — you multiply traffic onto a dying provider. The breaker is what stops that.
- **Per-request breaker state.** The breaker must be **shared** across requests/workers (module-level or a shared store), or each request re-learns the outage from scratch. In a multi-process server, consider a shared backend.
- **Cooldown too short or too long.** Too short and it flaps open/closed; too long and you stay degraded after recovery. Tune to the provider's typical recovery time.
- **No fallback behind an open breaker.** Failing fast is only half the win — pair it with a fallback so "open" degrades quality instead of erroring.
- **Tripping on non-dependency errors.** A breaker should trip on *provider* failures, not on your own 400s/validation errors.

## Interview tip
Say: *"A circuit breaker wraps each dependency in a closed/open/half-open state machine. Retries handle blips, but when failures cross a threshold the breaker trips open and fails fast for a cooldown — so a provider outage costs ~0 ms per request instead of a full timeout, and I stop hammering the thing that's already down. It auto-probes to recover, I share its state across workers, and I always pair open with a fallback so it degrades gracefully."* Explaining *why retries alone make outages worse* is the insight interviewers want.

See also: **[Retries & backoff](retries-backoff.md)** (handles the blips before the breaker trips) and **[Fallback chains](fallback-chains.md)** (where traffic goes when it's open).
