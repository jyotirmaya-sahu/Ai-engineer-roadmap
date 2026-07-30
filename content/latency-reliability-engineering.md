# Latency & Reliability Engineering

**The one-line idea:** Making an AI feature *fast enough to feel instant* and *reliable enough to never hang* — because a user-facing LLM app has hard millisecond budgets and depends on a provider that will, sometimes, be slow or down.

## Why we even need it

A demo that works on your laptop and a service that works for 10,000 users are different engineering problems. Two brutal facts force this node into existence:

1. **LLMs are slow *and* variable.** A single `gpt-4o` call might return in 900 ms one moment and 6 seconds the next. A multi-step agent chains five of those — now you're staring at a 30-second spinner. Users abandon a page after ~3 seconds; an agent that "hangs" is unshippable no matter how smart it is.
2. **You don't own the model.** Your app calls OpenAI, Anthropic, or Bedrock over the network. Those providers rate-limit you (429s), time out, deploy, and occasionally have full outages. If your code assumes the call always succeeds instantly, one provider hiccup takes your whole product down.

So this node is two disciplines fused: **latency engineering** (spend your milliseconds wisely, stream, parallelize) and **reliability engineering** (survive slowness and failure gracefully — timeouts, retries, circuit breakers, fallbacks, load handling).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 User request</span>
    <span class="darr">→<span class="lbl">budget</span></span>
    <span class="dbox purple">🧠 LLM / agent<span class="sub">slow · variable</span></span>
    <span class="darr">→<span class="lbl">may 429 / time out / be down</span></span>
    <span class="dbox orange">🛡️ timeout · retry · breaker · fallback</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ fast, reliable answer</span>
  </div>
  <div class="dcap">Every user call has a ms budget and passes through a provider that can be slow or fail — this node makes both survivable.</div>
</div>

## Why it matters for an AI Engineer

This is the line between "I built a cool notebook" and "I run this in production." Dubai JDs ask for deployment in 82% of postings, and *deployment* means the model has to hold up under real traffic and real failures. In interviews, the moment you say "I'd wrap the call in a timeout and a retry with backoff, fall back to a cheaper model, and put a circuit breaker on the provider" you sound like someone who's been paged at 3am — which is exactly who they want to hire.

## The tiles (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| **[Latency budgeting](latency-reliability-engineering/latency-budgeting.md)** | split your total ms budget across each step | you have a user-facing SLA (e.g. p95 < 3s) |
| **[Streaming & first-token time](latency-reliability-engineering/streaming-first-token-time.md)** | show tokens as they arrive | any chat/generation UI — perceived speed |
| **[Parallel / speculative execution](latency-reliability-engineering/parallel-speculative-execution.md)** | run independent calls at once; race a guess | multiple retrievals/tools, or draft-then-verify |
| **[Timeouts](latency-reliability-engineering/timeouts.md)** | never wait forever for a call | *every* network/LLM call, no exceptions |
| **[Retries & backoff](latency-reliability-engineering/retries-backoff.md)** | try again, spaced out, on transient errors | 429s, 503s, connection resets |
| **[Circuit breakers](latency-reliability-engineering/circuit-breakers.md)** | stop hammering a dead provider | a dependency is failing repeatedly |
| **[Fallback chains](latency-reliability-engineering/fallback-chains.md)** | if plan A fails, try plan B, then C | provider outage or overload; must stay up |
| **[Concurrency & pooling](latency-reliability-engineering/concurrency-pooling.md)** | reuse connections, cap in-flight work | any service handling more than one user |
| **[Async serving](latency-reliability-engineering/async-serving.md)** | don't block a thread waiting on I/O | high-QPS API in front of slow LLM calls |
| **[Graceful degradation under load](latency-reliability-engineering/graceful-degradation-under-load.md)** | shed/queue work instead of collapsing | traffic spikes, capacity limits |

Rough mental order: **budget** first (know your target), then make it *feel* fast (streaming, parallelism), then make it *survive* failure (timeouts → retries → breakers → fallbacks), then make it *scale* (pooling, async, degradation).

## Real world: how a company uses this

> **A Dubai bank** shipped a customer-support RAG assistant with a p95 latency SLA of **3 seconds**. They budgeted it: 150 ms retrieval, 300 ms rerank, ~2.2 s generation, 350 ms slack. They **streamed** the answer so first token appeared in ~600 ms (the spinner never lasted long). Every OpenAI call had a **4 s timeout** and **3 retries with exponential backoff + jitter**. A **circuit breaker** on the primary region meant that during an Azure OpenAI incident, requests flipped to a **fallback** Bedrock Claude endpoint within one failed call instead of piling up. When Ramadan traffic tripled overnight, **graceful degradation** queued excess requests and disabled the (expensive) reranker rather than 500-ing every user. Same model, same prompts — the difference between a 99.95% and a 96% uptime quarter was entirely this node.

## Interview tip
Say: *"For any user-facing LLM feature I start from a latency budget and an availability target, then I stream to cut perceived latency, wrap every provider call in a timeout plus retry-with-jittered-backoff, add a circuit breaker so a dead provider fails fast, and a fallback chain to a cheaper or alternate model so an outage degrades quality instead of taking us down. Under load I shed or queue rather than collapse."* That single sentence covers the whole node and signals production experience.

---

*Below: deep-dive articles on each latency and reliability technique.*
