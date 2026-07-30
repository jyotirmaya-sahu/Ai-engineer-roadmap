# Fallbacks & load balancing

**What it is:** The reliability layer of serving — **load balancing** spreads requests across multiple model instances or providers so no one is overwhelmed, and **fallbacks** automatically retry a failed request on a backup so a provider outage or rate limit doesn't become a user-facing error.

## Why it matters for an AI Engineer

LLM providers rate-limit, throttle, and occasionally go down; GPUs fail. A production AI feature that hard-depends on a single endpoint **will** have outages — and "the AI is down" is a bad look on a customer-facing product. Fallbacks and load balancing are what turn a fragile single-provider call into a resilient system with real uptime. This is the reliability half of the [gateway](litellm-gateway.md) story and shows up directly in [system-design interviews](../rag-in-production/high-availability-fallbacks.md) as "how do you make this highly available?"

## The mechanism / how it works

**Load balancing** distributes load across a *pool* of equivalent backends — several replicas of your self-hosted model, or the same model across OpenAI + Azure + Bedrock. Strategies:

- **Round-robin / least-busy:** rotate, or send to whichever replica has the shortest queue.
- **Weighted:** send more traffic to bigger/cheaper capacity.
- **Rate-limit-aware:** track each provider's remaining quota (RPM/TPM) and steer away from ones near their cap — critical for LLM APIs, where hitting a limit means 429s.

**Fallbacks** handle failure of a single call. When a request errors, times out, or gets a 429, the system doesn't surface the error — it **retries on a backup**, in a defined chain: e.g. `gpt-4o → azure/gpt-4o → claude-sonnet`. Key components:

- **Retry with backoff + jitter:** transient errors (429, 503) get a few retries with exponential backoff, so you don't hammer a struggling provider in lockstep.
- **Timeouts:** cap how long you wait before failing over — a hung provider shouldn't hang the user.
- **Circuit breaker:** if a provider fails repeatedly, *stop sending to it* for a cooldown window (trip the breaker) instead of retrying into a wall; probe occasionally to see if it recovered.
- **Fallback chain:** ordered backups, ideally across *different* providers so one vendor's outage doesn't take out every option.

The subtle part: fallbacks must be **idempotent-safe** and cost-aware — blind infinite retries can amplify load during an incident and multiply spend. Cap retries; trip breakers.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📨 request</span>
    <span class="darr">↓<span class="lbl">load balance</span></span>
    <div class="flow">
      <span class="dbox blue">OpenAI</span>
      <span class="dbox purple">✗ 429 / down</span>
      <span class="darr">→<span class="lbl">fallback</span></span>
      <span class="dbox blue">Azure OpenAI</span>
      <span class="darr">→</span>
      <span class="dbox green">✅ answer<span class="sub">user never sees the failure</span></span>
    </div>
  </div>
  <div class="dcap">Spread load across a pool; on failure, retry down a cross-provider fallback chain with backoff and a circuit breaker.</div>
</div>

## Concrete example

With [LiteLLM](litellm-gateway.md), this is config, not code — one public name, a pool, and a fallback chain:

```yaml
router_settings:
  routing_strategy: "usage-based-routing"   # steer by remaining rate limit
  num_retries: 2
  request_timeout: 30
  fallbacks: [{"smart": ["smart-azure", "smart-claude"]}]  # try in order on failure
  cooldown_time: 60                          # circuit-breaker cooldown for a failing model
```

Your app calls `model="smart"`; the router load-balances across healthy backends and fails over transparently — the app code is unchanged whether it took one hop or three.

## How a company uses this

A customer-facing product ran its assistant on OpenAI but couldn't tolerate downtime. They put a LiteLLM router in front with a pool of **OpenAI + Azure OpenAI + Anthropic** behind one model name, usage-based load balancing to dodge rate limits, and a fallback chain with a circuit breaker. During a **multi-hour OpenAI incident**, traffic auto-shifted to Azure and Claude and **users saw no outage** — the incident showed up only as a blip in the dashboard. Separately, during a traffic spike the rate-limit-aware balancing spread load so no single account hit its TPM ceiling, avoiding the 429 storm that had taken them down months earlier. Their measured result: assistant availability went from ~99.0% (single provider) to ~99.9%. The guardrail they added after an early scare: **capped retries + circuit breaker**, because an initial naive "retry forever" config had amplified load and cost during a partial outage.

## Common mistakes

- **Single provider, no fallback.** One vendor's outage or your rate limit = a full user-facing outage.
- **Fallbacks to the *same* provider.** If OpenAI is down, another OpenAI region may be too — chain across different vendors.
- **Unbounded retries.** Blind retries amplify load and cost during incidents — cap them and use a circuit breaker.
- **No rate-limit awareness.** Round-robin into a provider that's already at its TPM cap just generates 429s — steer by remaining quota.

## Interview tip
Say: *"For HA I put a gateway in front that load-balances across a pool of backends — ideally the same model across multiple providers — using rate-limit-aware routing so I don't trip 429s, and a fallback chain across *different* vendors so one outage doesn't take everything down. Failures retry with backoff and a circuit breaker so I don't hammer a struggling provider or blow up cost. That's how a single-provider dependency at ~99% becomes ~99.9% with users never seeing the failover."* The cross-provider point plus capped-retries/circuit-breaker is what signals real production experience.
