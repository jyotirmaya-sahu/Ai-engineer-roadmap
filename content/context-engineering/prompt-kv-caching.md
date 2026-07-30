# Prompt & KV Caching

**The one-line idea:** when a big chunk of your context repeats across calls (the same system prompt, the same documents), the provider can *reuse the computation* it already did for that prefix — so you pay a fraction of the cost and get the answer faster.

## Why it matters for an AI Engineer

This is the single biggest cost-and-latency lever in production LLM apps, and it's almost free to turn on. Real systems re-send the *same* system prompt, tool schemas, few-shot examples, and often the same retrieved documents on call after call. Without caching you pay full price to re-process that identical prefix every time. With caching, the provider serves it from a cache at ~10% of the input cost and skips the compute, cutting time-to-first-token dramatically. On a high-QPS product this is the difference between a viable and an unaffordable bill — a five-figure monthly saving is routine. Interviewers ask "how would you cut LLM cost?" and prompt caching is the first answer they want to hear.

## The mechanism / how it works

To generate text, a transformer computes internal **key/value (KV) tensors** for every token in the context — this is the expensive attention work, and it's what "processing the input" actually means. The crucial fact: the KV tensors for a token depend only on the tokens *before* it. So if two requests share an identical **prefix**, the KV cache for that prefix is identical too — and can be reused instead of recomputed.

That's KV caching. **Prompt caching** is the productized API version providers expose:

- You structure your prompt so the **stable, repeated part comes first** (system prompt → tools → few-shot → static docs), and the **variable part** (the user's actual question) comes **last**.
- On the first call, the provider computes and stores the prefix's KV cache.
- On later calls with the *same* prefix, it's a **cache hit**: the prefix isn't reprocessed. You pay a reduced cached-input rate (often ~10% of normal) and skip the latency.
- Caches are **prefix-exact** — they match from the start until the first differing token. Change one character near the top and everything after it is a cache miss.

Two flavors: **automatic** (OpenAI caches long prompt prefixes for you) and **explicit** (Anthropic uses `cache_control` breakpoints you place). Same underlying idea.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ cached prefix<span class="sub">system + tools + docs (reused)</span></span>
    <span class="darr">→</span>
    <span class="dbox gray">👤 user question<span class="sub">varies — recomputed</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ answer<span class="sub">~10% input cost, faster TTFT</span></span>
  </div>
  <div class="dcap">Put stable content first so it's a cache hit; only the changing tail is recomputed.</div>
</div>

## Concrete example

```python
# Anthropic explicit prompt caching: mark the stable prefix as cacheable.
import anthropic
client = anthropic.Anthropic()

resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=512,
    system=[{
        "type": "text",
        "text": LONG_SYSTEM_PROMPT + POLICY_DOCS,     # big + stable → cache it
        "cache_control": {"type": "ephemeral"},        # cache breakpoint
    }],
    messages=[{"role": "user", "content": user_question}],  # the ONLY varying part, at the end
)
# 1st call: writes cache. Subsequent calls within the TTL: cache hit on the prefix.
```

For OpenAI it's automatic: just keep the stable content at the top and the variable content at the bottom, and long shared prefixes are cached without any flag.

## How a company uses this

A Dubai bank's support agent (from the node overview) sends a ~1,500-token system prompt plus compliance policy on *every* one of millions of monthly calls. Turning on prompt caching made that prefix a cache hit after the first request: input cost on the cached portion dropped ~90%, and time-to-first-token fell by hundreds of milliseconds because the prefix skipped reprocessing. At their volume this alone saved a five-figure monthly bill. The one discipline it forces: they never put anything *variable* (like a timestamp or the user's name) *before* the stable block — that would bust the cache on every call. Variable data goes strictly at the end.

## Common mistakes / misconceptions

- **Variable content near the top.** A timestamp, session ID, or the user's name placed before the stable prefix causes a cache miss every call. Stable first, variable last — always.
- **Expecting semantic caching.** Prompt caching is *exact-prefix*, not "similar question." For "similar query → reuse answer" you want a separate semantic cache (see [RAG in Production](../rag-in-production.md)).
- **Ignoring TTL.** Provider caches expire (minutes). Sparse traffic may never hit; steady traffic hits well.
- **Reordering the prompt casually.** Any edit to the prefix invalidates the cache from that point on. Keep the stable block byte-stable.

## Interview tip

Say: *"Prompt caching reuses the KV computation for a repeated prefix, so I structure prompts stable-first, variable-last: system prompt, tools, few-shot, and static docs up front — the user's question last. That gives cache hits at ~10% input cost and cuts time-to-first-token, and at scale it's the biggest single cost win. It's exact-prefix, not semantic, so I never put anything variable before the stable block."* Explaining it as *KV reuse* and stressing the stable-first ordering shows you understand the mechanism, not just the buzzword.
