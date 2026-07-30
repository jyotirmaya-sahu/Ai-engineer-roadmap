# Cost & Token Optimization

**The one-line idea:** Every call to an LLM is metered by the token — you pay per word in and per word out — so cost optimization is the discipline of getting the same answer for fewer, cheaper tokens.

## Why we even need it

An LLM API bills you on two meters: **input tokens** (your prompt) and **output tokens** (its reply). A token is ~4 characters, or ~0.75 of an English word. Prices are quoted per **million tokens (MTok)**. As of 2026, a rough map:

| Model class | Input $/MTok | Output $/MTok |
|---|---|---|
| Frontier (GPT-5, Claude Opus 4.x) | ~$5–15 | ~$15–75 |
| Mid (Claude Sonnet, GPT-5-mini) | ~$1–3 | ~$5–15 |
| Small/cheap (Haiku, GPT-5-nano, Gemini Flash) | ~$0.05–0.40 | ~$0.30–1.50 |

Here is why this becomes the P&L line. Say a support chatbot handles **100,000 conversations/month**, each with a 4,000-token prompt (system + retrieved context + history) and a 500-token answer, on a frontier model at $10/$30 per MTok:

- Input: 100k × 4,000 = 400M tokens → **$4,000**
- Output: 100k × 500 = 50M tokens → **$1,500**
- **Total: $5,500/month.**

Move the same traffic to a mid model at $3/$15 and it's **$1,950**. Add prompt caching on the 3,000-token static preamble and you shave another ~40% off input. Route the 60% of easy questions to a small model and the bill drops below **$800** — same product, ~7× cheaper. None of that changed the user experience. That gap is what this node teaches you to capture.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 input tokens<span class="sub">prompt</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model<span class="sub">$/MTok</span></span>
    <span class="darr">→</span>
    <span class="dbox green">📤 output tokens<span class="sub">reply</span></span>
  </div>
  <div class="dcap">Cost = (input tokens × input price) + (output tokens × output price). Every lever below shrinks one of those four numbers.</div>
</div>

## Why it matters for an AI Engineer

Prototypes ignore cost; products can't. A feature that costs $0.08 per call is fine in a demo and fatal at a million calls a day. In interviews and on the job, "make it cheaper without making it worse" is a first-class engineering task — right next to latency and accuracy. Companies that skip it discover their gross margin evaporates the month the feature goes viral. The engineer who can say "I cut our token bill 70% and nobody noticed" is the one who gets to keep shipping.

## The levers you'll learn (and when to reach for each)

Cost work splits into three moves: **measure** it, **cut input cost**, and **cut model cost**.

| Lever | Core idea | Reach for it when |
|---|---|---|
| [Token accounting per request](cost-token-optimization/token-accounting-per-request.md) | count tokens in/out for every call | always — you can't cut what you don't measure |
| [Cost attribution](cost-token-optimization/cost-attribution.md) | tag spend by feature/tenant/user | one whale customer or one loop is burning the budget |
| [Prompt compression](cost-token-optimization/prompt-compression.md) | squeeze the prompt to fewer tokens | long, verbose, or redundant prompts |
| [Context trimming](cost-token-optimization/context-trimming.md) | drop history/context you don't need | long chats or over-stuffed RAG context |
| [Prompt & KV caching](cost-token-optimization/prompt-kv-caching.md) | pay once for repeated prefixes | a big static system prompt reused every call |
| [Cache-friendly prompt structure](cost-token-optimization/cache-friendly-prompt-structure.md) | put static content first so caches hit | you use caching and want max hit rate |
| [Model routing / cascades](cost-token-optimization/model-routing-cascades.md) | send easy queries to cheap models | traffic mixes trivial and hard questions |
| [Right-sizing & distillation](cost-token-optimization/right-sizing-distillation.md) | use/train the smallest model that passes | a narrow, high-volume task |
| [Batching](cost-token-optimization/batching.md) | group requests for a bulk discount | offline/async workloads, no latency SLA |
| [Output-token control](cost-token-optimization/output-token-control.md) | make replies shorter | output tokens are 3–5× the input price |

## Real world: how a company uses this

> **A Dubai fintech** shipped an AI statement-explainer on a frontier model. It worked, then a marketing push tripled traffic and the monthly OpenAI bill hit **$41,000**. Their engineer did three things in a week: added [cost attribution](cost-token-optimization/cost-attribution.md) (found 22% of spend came from one enterprise client's automated retries), turned on [prompt caching](cost-token-optimization/prompt-kv-caching.md) for the 2,800-token compliance system prompt (input cost −65% on cache hits), and [routed](cost-token-optimization/model-routing-cascades.md) balance-lookup questions to a cheap model while keeping disputes on the frontier one. The bill landed at **$9,400** — a 77% cut — with no measurable drop in answer quality. That single project paid the engineer's salary for the year.

## Interview tip
Say: *"I treat token cost like any other engineering budget: measure first with per-request token accounting and cost attribution, then attack the biggest line. Input cost I cut with caching, context trimming and prompt compression; model cost I cut with routing cheap-first and right-sizing to the smallest model that passes eval; and I never forget output tokens are the most expensive meter, so I cap and shape the response. The order matters — you optimize what the data says is expensive, not what feels expensive."* That shows you optimize with numbers, not vibes.

---

*Below: deep-dive articles on each cost lever.*
