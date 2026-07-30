# Prompt & KV caching

**What it is:** Making the provider (or your own server) remember the expensive work of processing a repeated chunk of prompt, so the second time you send it you pay a fraction of the cost and get the answer faster.

## Why it matters for an AI Engineer

Almost every production app sends the *same* prefix on every call — a big system prompt, tool definitions, a few-shot examples, RAG boilerplate. Without caching you re-process (and re-pay for) those thousands of identical tokens every single request. Prompt caching is often the single biggest, easiest cost win available: a 3,000-token static preamble reused across a million calls costs full price a million times without caching, and roughly 10% of that with it. It also cuts latency, because cached tokens skip the slow prefill step. If your app has a fixed preamble and you're not caching it, you're leaving money on the table.

## The mechanism / how it works

To answer, a transformer first **prefills**: it runs every input token through attention and builds a **KV cache** — the key/value tensors that represent "what the model has read so far." Prefill is the compute-heavy part of a request. The insight: if two requests share an identical *prefix*, the KV cache for that prefix is identical too — so compute it once and reuse it.

Two flavors:

- **Provider prompt caching (API).** OpenAI, Anthropic, and Google let you mark or automatically detect a stable prefix. On a cache hit, those input tokens bill at a steep discount (commonly ~10% of normal input price on Anthropic explicit caching; OpenAI/Google auto-discount cached input ~50–90%). The cache lives for minutes (a few-minute TTL, refreshed on use). **The rule: it only hits if the prefix is byte-identical, so static content must come first** — see [cache-friendly prompt structure](cache-friendly-prompt-structure.md).
- **KV caching in your own serving stack** (vLLM, TGI, SGLang). If you self-host, the engine keeps KV caches in GPU memory and reuses shared prefixes across requests (prefix caching / RadixAttention). Same idea, under your control.

Caching does **not** cache the output — the model still generates a fresh answer. It caches the *reading* of the shared input.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 prefill: read prompt<span class="sub">build KV cache</span></span>
    <span class="darr">↓<span class="lbl">store prefix KV</span></span>
    <div class="flow">
      <span class="dbox gray">call 1: full price prefix</span>
      <span class="darr">→</span>
      <span class="dbox green">calls 2..N: prefix ~10%</span>
    </div>
  </div>
  <div class="dcap">Process the shared prefix once; every later call reuses its KV cache at a discount.</div>
</div>

## Concrete example

```python
import anthropic
client = anthropic.Anthropic()

BIG_SYSTEM = open("compliance_policy.txt").read()  # ~2,800 tokens, same every call

def ask(question):
    return client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=400,
        system=[{
            "type": "text",
            "text": BIG_SYSTEM,
            "cache_control": {"type": "ephemeral"},  # mark this prefix cacheable
        }],
        messages=[{"role": "user", "content": question}],
    )
```

Worked numbers, that 2,800-token system prompt, input at $3/MTok, 1M calls/month:

- **No cache:** 2,800 × 1M = 2.8B tokens × $3/MTok = **$8,400/month** just for the preamble.
- **With cache (hit billed ~10%):** ~$840/month + a small one-time write cost.
- **~$7,500/month saved** on one prompt, plus lower latency on every call.

## How a company uses this

A Dubai insurance chatbot ships a 3,200-token system prompt (tone rules, product catalog, compliance disclaimers) on every message. Turning on Anthropic prompt caching cut input cost on that segment ~90% and dropped time-to-first-token noticeably, because the model skipped re-prefilling 3,200 tokens each turn. A self-hosted code assistant using vLLM saw a similar effect from prefix caching: many users share the same long instruction template, so the engine reused one KV cache across them and roughly doubled throughput on the same GPUs. The catch both teams hit: the cache TTL is short (minutes), so it only pays off under steady traffic — bursty, low-QPS features get fewer hits. They monitor **cache hit rate** as a first-class metric.

## Common mistakes

- **Putting dynamic content first.** A timestamp or the user's question at the top of the prompt busts the prefix and the cache never hits. Static first, always.
- **Assuming it caches the answer.** It caches input processing, not the completion — the model still generates fresh output.
- **Ignoring the write cost.** The first call (cache write) can cost slightly *more* than normal; caching only wins when the prefix is reused enough within the TTL.
- **Not measuring hit rate.** Low-traffic or highly-varied prompts may barely hit the cache; check before assuming savings.

## Interview tip
Say: *"Under the hood a transformer prefills a prompt into a KV cache; if requests share a prefix, that KV work is reusable. So I put all static content — system prompt, tools, few-shot — first and cache it, and cached input bills at roughly 10% of normal. On a 3,000-token preamble across a million calls that's thousands of dollars a month plus lower first-token latency. I monitor cache hit rate, because caching only pays under steady traffic within the TTL."* It shows you understand the mechanism, not just the flag.
