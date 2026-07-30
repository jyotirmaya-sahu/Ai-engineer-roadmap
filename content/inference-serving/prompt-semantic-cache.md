# Prompt / semantic cache

**What it is:** Storing LLM answers so repeated (or *similar*) questions return a saved response instead of paying for a fresh model call — an **exact-match cache** for identical prompts, and a **semantic cache** for prompts that mean the same thing in different words.

## Why it matters for an AI Engineer

Real traffic is repetitive — support bots get the same handful of questions thousands of times a day. Every cache hit is a request that costs **near-zero dollars and returns in milliseconds** instead of seconds. Caching is one of the highest-ROI cost levers because it works even on **hosted APIs** (no GPU needed) and stacks with [routing](model-routing.md) and [quantization](awq.md). Being able to design a semantic cache — and, crucially, know *when it's dangerous* — is a common systems-design interview beat.

## The mechanism / how it works

**Exact-match cache** is a dictionary: hash the prompt (plus model + params), and if that exact key exists, return the stored answer. Trivial, safe, but brittle — "reset my password" and "how do I reset my password?" are different strings, so it misses obvious duplicates.

**Semantic cache** fixes that using embeddings (the same vectors used in retrieval). On each query:

1. Embed the prompt into a vector.
2. Search a vector store of past query embeddings for the **nearest** previous question.
3. If its similarity is **above a threshold** (e.g. cosine ≥ 0.95), it's "the same question" — return that cached answer. Otherwise, call the LLM and store the new (embedding → answer) pair.

The threshold is the whole game. Too **low** and you serve a wrong cached answer to a subtly different question (a *false hit* — the dangerous failure). Too **high** and you rarely hit the cache (little savings). You tune it against real traffic, measuring hit rate versus wrong-answer rate.

Two hard rules:

- **Never cache personalized or fast-changing answers.** "What's *my* balance?" or "today's price?" must not be cached — the cache key must include the user/context, or these queries must bypass caching entirely.
- **Set a TTL.** Cached answers go stale; expire them (hours/days) so updated knowledge propagates.

This is distinct from **provider prompt caching** (OpenAI/Anthropic caching the *KV of a long shared prefix* to cut input cost on repeated system prompts) — that's a related but separate, provider-side feature.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ "how do I reset my password"</span>
    <span class="darr">↓<span class="lbl">embed + nearest search</span></span>
    <div class="flow">
      <span class="dbox blue">🗄️ cache: "reset password" (sim 0.97 ≥ 0.95)</span>
      <span class="darr">→</span>
      <span class="dbox green">✅ return stored answer<span class="sub">~5ms, $0</span></span>
    </div>
    <span class="darr">↓<span class="lbl">no close match</span></span>
    <span class="dbox purple">🤖 call LLM → store (embedding→answer)</span>
  </div>
  <div class="dcap">Similar-meaning queries hit the cache; genuinely new ones call the model and get stored.</div>
</div>

## Concrete example

```python
# Semantic cache sketch
def answer(query, threshold=0.95, ttl=3600):
    v = embed(query)
    hit = vecstore.nearest(v)                     # {answer, sim, ts}
    if hit and hit.sim >= threshold and fresh(hit.ts, ttl):
        return hit.answer                         # cache hit: ~$0, ~ms
    out = llm(query)                              # miss: real call
    vecstore.add(v, {"answer": out, "ts": now()})
    return out
```

Production tools do this for you: **[LiteLLM](litellm-gateway.md)** and **GPTCache** offer built-in semantic caching backed by Redis + a vector store, so you enable it with config rather than hand-rolling.

## How a company uses this

A Dubai telco's support assistant got the same ~200 questions ("how do I check my data balance?", "reset router") in endless phrasings. A semantic cache at threshold 0.95 with a 6-hour TTL served **~40% of traffic from cache** — those responses came back in ~10ms at essentially $0, and the LLM bill dropped by roughly the same 40%. The safeguard that made it viable: any query needing account data (`tenant_id`/`user_id` in context) **bypassed the cache**, so nobody ever got another customer's balance. They monitored a sampled **false-hit rate** and nudged the threshold up when it crept above their tolerance. The classic incident they avoided by design: a cache serving a *stale* policy answer after the policy changed — the TTL forced periodic refresh.

## Common mistakes

- **Caching personalized/real-time answers.** Balances, prices, "my" anything — a false hit leaks or misinforms. Bypass or key by user.
- **Setting the similarity threshold too low.** You start returning confident wrong answers to near-but-different questions.
- **No TTL.** Stale answers persist after the underlying knowledge changes.
- **Confusing app-level semantic cache with provider prefix caching.** Different mechanisms — one caches answers, the other caches shared-prompt KV.

## Interview tip
Say: *"I cache exact-match prompts trivially, and add a semantic cache — embed the query, find the nearest past question, and if similarity clears a tuned threshold, return the stored answer for near-zero cost and millisecond latency. The risks are false hits and staleness, so I tune the threshold against a sampled wrong-answer rate, set a TTL, and never cache personalized or fast-changing responses — those bypass or key on the user. On repetitive support traffic this routinely serves 30–40% of requests from cache."* Naming the false-hit and personalization dangers is what makes it a senior answer.
