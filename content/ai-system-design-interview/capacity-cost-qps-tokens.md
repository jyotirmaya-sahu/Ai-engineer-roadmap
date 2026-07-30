# Capacity & cost (QPS, tokens, $)

**What it is:** the back-of-the-envelope math that turns "some traffic" into concrete numbers — queries per second, tokens per request, and dollars per month — so your [design](sketch-components.md) is sized to reality and your [SLAs](define-slas-latency-cost-accuracy.md) are met.

## Why it matters for an AI Engineer

Interviewers *love* to ask "how much would this cost to run?" or "how many servers do you need?" — because the answer separates people who've shipped from people who've only prototyped. You don't need exact figures; you need a **defensible estimate you can compute out loud in 60 seconds.** Getting the order of magnitude right ("that's ~$50k/month, so we must cache") drives real architecture decisions. Fumbling it — or worse, hand-waving — reads as "never operated anything at scale."

## The mechanism: three quick calculations

Every estimate is the same three steps. Round aggressively; you're after the order of magnitude.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">📈 Daily volume → QPS<span class="sub">÷ 86,400s, ×2–3 for peak</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">🔢 Tokens / request<span class="sub">prompt + context + output</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">💰 Cost<span class="sub">tokens × price × volume</span></span>
  </div>
  <div class="dcap">Volume → QPS → tokens → dollars. Three multiplications, done out loud.</div>
</div>

**1. QPS from daily volume.** A day is ~86,400 seconds, but round to **~100k seconds** to make the math trivial. So *average QPS ≈ daily requests / 100,000.* Then multiply by **2–3× for peak** (traffic isn't flat — it clusters in business hours). Example: 1M requests/day → ~10 QPS average → **~25 QPS peak.** Peak QPS is what you size servers and rate limits for.

**2. Tokens per request.** Add up: system prompt + retrieved context (RAG chunks are the big one — 4 chunks × ~500 tokens = 2,000) + user question + **output tokens.** A rough rule: **1 token ≈ 0.75 words**, so ~1.3 tokens/word. A typical RAG request: ~2,500 input + ~400 output ≈ **~2,900 tokens.** Output tokens usually cost 3–5× more than input, so track them separately.

**3. Dollars.** Cost per request = (input tokens × input price) + (output tokens × output price). Use round 2026 numbers: a **mid-tier** model runs roughly **$0.15–1 per 1M input / $0.60–5 per 1M output tokens**; a **frontier** model is several times that; a **small** model is a fraction. Then **monthly = cost/request × daily volume × 30.**

## Worked example (do this on the whiteboard)

Support RAG: **500k requests/day**, ~2,900 tokens each (2,500 in / 400 out), mid-tier model at ~$0.30/1M input, $1.20/1M output.

- **QPS:** 500k / 100k = 5 avg → **~12 QPS peak.** One or two well-sized instances handle that; the vector DB and LLM API are the real limits, not compute.
- **Cost/request:** input 2,500 × $0.30/1M = $0.00075; output 400 × $1.20/1M = $0.00048 → **~$0.0012/request.**
- **Monthly:** $0.0012 × 500k × 30 = **~$18k/month** on the model alone (add vector DB + infra).

Now the design falls out: $18k/month is real money, so **caching repeat queries and routing easy ones to a small model** could halve it — that's a concrete, numbers-driven optimization, not a guess. And note how *output* tokens, though fewer, cost nearly as much as the 6× larger input — trimming verbose answers is a lever.

## How a company uses this

> **A Dubai SaaS startup** pitched investors an AI feature and did exactly this math before building. Projected 2M requests/day at ~4,000 tokens each on a frontier model penciled out to **~$0.09/request → ~$5.4M/year** — instantly non-viable. The 60-second estimate *killed the naive design in the meeting* and forced the real architecture: cache (30% of queries repeat → free), route (55% to a small model at 1/10th the price), trim context (rerank 4 chunks down to 2). Re-estimated blended cost landed near **$0.012/request → ~$260k/year** — viable. The capacity math didn't just size servers; it decided whether the product could exist. That's why interviewers ask.

## Common mistakes
- **Forgetting peak vs average.** Sizing for average QPS means you fall over at the daily spike. Always ×2–3.
- **Ignoring output tokens.** They're fewer but priced far higher; leaving them out understates cost badly.
- **Forgetting context tokens in RAG.** The retrieved chunks are usually the *largest* part of the prompt — that's where the token cost lives.
- **Over-precision.** Don't reach for a calculator and 4 decimals. Round to clean numbers; the order of magnitude is what drives decisions.

## Interview tip
Narrate the three multiplications: *"Let me size it. 500k/day over ~100k seconds is ~5 QPS, call it ~12 at peak. Each RAG request is ~2,500 input plus 400 output tokens — the context dominates. At mid-tier pricing that's ~$0.0012 a request, so ~$18k/month, which is exactly why I'd cache and route to bring it down."* Doing this fluently, out loud, is one of the clearest senior signals in the whole round — and it feeds straight into [failure-mode analysis](failure-mode-analysis.md) (what happens when peak is 5× your estimate?).
