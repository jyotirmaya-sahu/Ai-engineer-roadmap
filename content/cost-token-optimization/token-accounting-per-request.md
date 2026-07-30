# Token accounting per request

**What it is:** Recording exactly how many input and output tokens every LLM call used — and the dollars that implies — so cost becomes a number you can see, not a surprise on the invoice.

## Why it matters for an AI Engineer

You cannot optimize what you don't measure. The first time you look at real per-request numbers, you almost always find something shocking: a "short" system prompt that's actually 3,000 tokens, a RAG step stuffing 12,000 tokens of context in for a one-line answer, or a retry loop silently tripling calls. Token accounting turns a vague "the bill feels high" into "the classify step averages 1,850 input tokens and that's 60% of spend." It's the foundation every other lever in this node stands on, and it's the diagnostic you'll reach for the moment a bill spikes.

## The mechanism / how it works

Every LLM API response includes a **usage** object. That's your source of truth — it reports the *actual* tokens the model counted, including tokenizer quirks you'd get wrong by estimating. You read three numbers:

- `input_tokens` (a.k.a. `prompt_tokens`) — everything you sent: system prompt, tools, history, context.
- `output_tokens` (a.k.a. `completion_tokens`) — what the model generated.
- Cached tokens — on providers with caching, a portion of input billed at a discount (see [prompt & KV caching](prompt-kv-caching.md)).

Cost is then a plain multiply:

```
cost = input_tokens/1e6 × input_price
     + output_tokens/1e6 × output_price
```

To predict token count *before* sending (for budgeting or truncation), use the model's tokenizer locally — `tiktoken` for OpenAI-family, or the provider's count-tokens endpoint. But for billing, always trust the `usage` field from the response, not your estimate.

The engineering move is to **log this on every single call** — wrap your LLM client so usage, model name, computed cost, latency, and a request ID land in your logs or a metrics store automatically. Then per-request accounting rolls up into per-feature and per-tenant views ([cost attribution](cost-attribution.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📤 request</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM API</span>
    <span class="darr">→</span>
    <span class="dbox orange">usage{in,out,cached}</span>
    <span class="darr">→</span>
    <span class="dbox blue">💾 log cost + latency</span>
  </div>
  <div class="dcap">Read the usage object from every response and log the computed dollar cost — that's token accounting.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

PRICE = {"gpt-5-mini": (0.25, 2.00)}  # ($/MTok in, $/MTok out) — check current pricing

def chat(model, messages):
    r = client.chat.completions.create(model=model, messages=messages)
    u = r.usage
    pin, pout = PRICE[model]
    cost = u.prompt_tokens/1e6 * pin + u.completion_tokens/1e6 * pout
    print(f"in={u.prompt_tokens} out={u.completion_tokens} cost=${cost:.5f}")
    return r.choices[0].message.content

chat("gpt-5-mini", [{"role": "user", "content": "Explain KV cache in one line."}])
# in=16 out=28 cost=$0.00006
```

That $0.00006 looks free — until you multiply by 3 million calls a month ($180), and then realize the *real* prompts carry 3,000 tokens of context, not 16 ($22,500). Accounting is what makes that visible early.

## How a company uses this

At production scale the wrapper feeds a dashboard. A typical setup: every call emits a structured log line, and a tool like **Langfuse** or a homegrown Grafana board shows cost/1000-requests, p50/p95 tokens per feature, and a daily spend trend. One e-commerce team in the region set an alert on "input tokens per request > 6,000" and caught a bug where a chat's full history was being re-sent every turn instead of a summary — the fix cut their bill 30% overnight. Without per-request accounting that bug is invisible; it just looks like "AI is expensive." At millions of calls/day, a 500-token accounting error per call is real money, so teams treat the `usage` field as a monitored metric, not a debug print.

## Common mistakes

- **Estimating instead of reading `usage`.** Tokenizers count system messages, tool schemas, and special tokens you forget. Trust the response.
- **Only counting output.** Input is usually the *larger* token count in RAG/agent apps — it's just cheaper per token, so people ignore it and miss the biggest lever.
- **Not logging model + cached tokens.** Cost per token varies by model and cache status; a raw token count without those can't be turned into dollars.
- **Logging in the demo, forgetting in prod.** The wrapper has to be the *only* path to the LLM, or some code path escapes accounting.

## Interview tip
Say: *"I wrap the LLM client so every call logs input tokens, output tokens, cached tokens, model, and computed dollar cost against a request ID. I read the provider's `usage` field rather than estimating, because tokenizers surprise you. That per-request record is what rolls up into cost attribution and tells me which lever to pull."* It signals you instrument before you optimize.
