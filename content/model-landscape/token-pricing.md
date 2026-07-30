# Token Pricing

**What it is:** How LLM APIs actually bill you — per **token**, with a *different* (usually higher) price for output tokens than input, quoted per million tokens. Reading a price sheet correctly is the base skill for controlling spend.

## Why it matters for an AI Engineer

You can't estimate or control cost if you don't understand the meter. Teams routinely misjudge their bill by 5–10× because they forgot output costs more, ignored that the whole chat history is re-billed every turn, or missed caching and batch discounts. Since model selection is largely a cost decision, knowing exactly how pricing works turns "it feels expensive" into a concrete number you can optimize. It underpins [Cost estimation](cost-estimation.md) and [Cost vs performance](cost-vs-performance-tradeoff.md).

## The mechanism / how it works

The unit is the **token** (~4 characters / ~0.75 words of English — [Context length](context-length.md)). Every request is billed as:

```
cost = (input_tokens  × input_price)
     + (output_tokens × output_price)
```

Prices are quoted **per 1,000,000 tokens**. Critical facts people miss:

- **Output costs more than input** — typically 3–5× more per token, because generating is more expensive than reading. Long answers hurt more than long prompts, per token.
- **You pay for *everything* in the input** — system prompt + full chat history + retrieved RAG context + user message. In a long conversation you re-send and re-pay for the entire history *every turn*, so cost per turn *grows* as the chat lengthens.
- **Model tier changes the rate massively** — a frontier model can be 20–50× the per-token price of a small one. This is the biggest lever.
- **Discounts exist:** **prompt caching** (a stable re-used prefix is billed at a large discount, often ~90% off on cache hits), **batch APIs** (~50% off for non-urgent jobs), and **reasoning tokens** on o-series/thinking models are billed as output — an easily-missed extra.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">Input tokens<span class="sub">sys+history+RAG+msg · cheaper</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model</span>
    <span class="darr">→</span>
    <span class="dbox orange">Output tokens<span class="sub">3–5× pricier</span></span>
  </div>
  <div class="dcap">Both directions billed per million tokens — output costs several times more, and input includes the whole prompt every call.</div>
</div>

## Concrete example — compute a real bill

Say input is $3/M and output $15/M (a typical mid model). One request with 2,000 input tokens and 500 output tokens:

```python
IN, OUT = 3/1_000_000, 15/1_000_000       # $ per token
cost = 2000*IN + 500*OUT
print(round(cost, 5))                      # $0.01350 per request
# 1,000,000 such requests/month:
print(round(cost * 1_000_000, 2))          # $13,500 / month
```

Notice output (500 tokens) contributes $0.0075 vs input (2000 tokens) $0.006 — fewer tokens, more cost, because output is 5× the rate. Now swap to a small model at $0.20/$0.60 per M and the monthly bill drops to ~$700. *That* is why right-sizing dominates cost.

## How a company uses this

A Dubai SaaS with a chat assistant got a bill 4× their estimate. Root cause: they re-sent the entire growing conversation history every turn, so a 20-turn chat paid for the first message twenty times. Fixes: they (1) summarized/pruned old turns to cap history tokens, (2) moved their static 3k-token system prompt into **prompt caching** (~90% off that prefix on every call), and (3) shifted nightly report generation to the **Batch API** at half price. Combined, the bill fell ~65% with no quality change — purely from understanding how the meter runs.

## Common mistakes
- **Forgetting output is pricier** — trimming a long system prompt saves less than capping verbose answers, per token.
- **Ignoring that history is re-billed every turn** — long chats silently balloon cost; prune or summarize.
- **Overlooking caching and batch discounts** — leaving 50–90% savings on stable/offline work unclaimed.
- **Forgetting reasoning tokens** — o-series "thinking" is billed as output and can dwarf the visible answer.

## Interview tip
Say: *"Billing is per token, quoted per million, with output 3–5× the input rate — and the input includes the whole prompt: system, full history, and retrieved context, re-billed every turn. So cost grows with conversation length. I control it by right-sizing the model tier (the biggest lever), pruning history, using prompt caching for stable prefixes, and batch APIs for offline jobs. I also remember reasoning-model thinking is billed as output."*
