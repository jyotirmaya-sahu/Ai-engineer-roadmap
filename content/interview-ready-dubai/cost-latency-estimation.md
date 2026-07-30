# Cost / Latency Estimation

**What it is:** the drill of putting *real numbers* on an LLM system — how many tokens, how many milliseconds, how many dollars — on the spot, without a calculator, so you can answer "how much will this cost?" and "how fast is it?" in an interview.

## Why it matters for an AI Engineer

Every design and deployment question ends with a numeric follow-up: *"How much would this cost at 100k requests a day?"* or *"Can you hit a 2-second latency budget?"* Vague answers ("it'll be cheap") signal you've never owned a production bill. Dubai teams run lean and watch spend closely, so **cost fluency is a differentiator**. Being able to do the arithmetic out loud proves you understand the two things that actually bill and block: **tokens** and **time**.

## The mechanism: the numbers you must know cold

**Tokens.** ~**1 token ≈ 4 characters ≈ 0.75 words**. So 1,000 tokens ≈ 750 words ≈ 1.5 pages. You're billed **separately for input and output tokens**, and output is typically **3–5× more expensive** than input. Memorize a rough price anchor (2026, mid-tier model): roughly **$3 per million input tokens, $15 per million output tokens**. Cheaper "mini/haiku" tiers are ~10× less; frontier tiers ~2–5× more.

**Cost formula:**
```
cost = (input_tokens × input_price) + (output_tokens × output_price)
```
Do it per request, then multiply by volume.

**Latency.** LLM latency has two parts:
- **Time-to-first-token (TTFT)** — the wait before streaming starts, usually ~0.3–1s, driven by input length + model size.
- **Per-output-token time** — roughly **~30–100 tokens/second** for a hosted mid-tier model. So a 500-token answer ≈ 5–15s of generation.

**Total latency ≈ TTFT + (output_tokens ÷ tokens_per_sec) + your app overhead** (retrieval, network). This is why **output length dominates latency** — capping `max_tokens` is the biggest latency lever, and why streaming matters (users see tokens as they arrive instead of waiting for all 500).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 Input tokens<span class="sub">cheap, adds TTFT</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Model<span class="sub">~50 tok/s</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">📤 Output tokens<span class="sub">3–5× cost, drives latency</span></span>
  </div>
  <div class="dcap">Output is the expensive, slow half — cap it first.</div>
</div>

## Concrete example: estimate on the spot

*"A RAG support bot: system prompt 500 tokens + 5 retrieved chunks ×400 tokens = 2,500 input tokens, ~300-token answer. 100,000 requests/day. Cost and latency?"*

**Cost per request:**
- Input: 2,500 × $3/1M = **$0.0075**
- Output: 300 × $15/1M = **$0.0045**
- Total ≈ **$0.012/request** → ×100k = **~$1,200/day** ≈ **$36k/month**.

Then show the lever: *"Prompt-caching the 500-token system block and routing 80% of easy queries to a 10×-cheaper model drops this to roughly $300–400/day."*

**Latency:** TTFT ~0.6s + 300 tokens ÷ 50 tok/s = 6s generation + ~0.3s retrieval ≈ **~7s** — too slow. *"I'd stream (user sees first token in <1s), cap max_tokens at 300, and shorten context. Perceived latency drops to sub-second even if total stays ~4s."*

That two-minute answer — arithmetic *plus* the optimization lever — is exactly what interviewers want.

## How a company uses this (production lens)

A Dubai e-commerce team modelled a product-description generator *before building it*: 200-token input, 150-token output, 2M SKUs. Naïve estimate: 2M × (200×$3 + 150×$15)/1M ≈ **$5,700** for one full run — and they'd re-run monthly. That number killed the plan to use a frontier model; they switched to a mini-tier model (~10× cheaper, ~$570/run) and batch-generated overnight when latency didn't matter. The estimate *changed the architecture before a line of code shipped* — which is the whole point of this skill.

## Common mistakes
- **Forgetting input ≠ output pricing.** Output is the expensive half; conflating them undercounts by 3–5×.
- **Ignoring that retrieved context is input tokens.** RAG prompts are huge — 5 chunks can be 2k+ tokens billed every call.
- **Quoting latency without output length.** Latency is meaningless without saying how many tokens you're generating.
- **No optimization lever.** An estimate alone is half an answer; always follow with "and here's how I'd cut it."

## Interview tip
Memorize three anchors: **1 token ≈ 4 chars**, **$3/$15 per million in/out** (mid-tier), and **~50 tokens/sec**. When asked a cost or latency question, narrate the arithmetic out loud, land a number, then *immediately* name the lever (caching, routing, capping output, streaming). The combination of a real number and a fix is the senior signal. Feeds directly into [System design](system-design.md) and [Deploy / LLMOps / cost](deploy-llmops-cost.md).
