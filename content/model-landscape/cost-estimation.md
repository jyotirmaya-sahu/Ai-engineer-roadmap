# Cost Estimation

**What it is:** Projecting what an LLM feature will cost *before* you ship it — turning tokens-per-request and requests-per-month into a real dollar figure (and a per-user unit economic).

## Why it matters for an AI Engineer

"It works in the demo" means nothing if it costs $80k/month at scale. Product and finance will ask "what does this cost per user?" and "what's our monthly bill at 100k users?" — and an AI Engineer who can answer with a defensible number gets trusted with the architecture. Cost estimation is also how you *justify* selection decisions: it converts "the small model is cheaper" into "$12k/month vs $340k/month," which is what actually wins the argument. Interviewers love a candidate who can back-of-envelope this on the spot.

## The mechanism / how it works

The whole model is one formula, applied per feature:

```
monthly_cost = requests_per_month
             × (avg_input_tokens  × input_price
             +  avg_output_tokens × output_price)
```

Estimate each input:

1. **Tokens per request** — measure it. Count a few *representative* real requests (system prompt + retrieved context + user message = input; typical answer length = output). Don't guess; use a token counter. RAG context is usually the biggest, most-forgotten chunk.
2. **Requests per month** — from expected users × actions/user/day × 30. For chat, remember each *turn* is a request, and history makes later turns bigger.
3. **Prices** — per-million rates for the chosen model ([Token pricing](token-pricing.md)).
4. **Apply discounts** — subtract for prompt caching on stable prefixes and batch pricing on offline jobs.

Then compute a **per-user or per-request unit cost** — that's what tells you if the business model survives. Always estimate a **range** (typical and worst-case tokens), because a few users with huge inputs can dominate the bill.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">tokens / request<span class="sub">measured</span></span>
    <span class="darr">→<span class="lbl">×</span></span>
    <span class="dbox orange">requests / month<span class="sub">users × actions</span></span>
    <span class="darr">→<span class="lbl">×</span></span>
    <span class="dbox blue">price / token</span>
    <span class="darr">→</span>
    <span class="dbox green">💰 monthly $ + per-user cost</span>
  </div>
  <div class="dcap">Tokens × volume × price — then divide by users for the unit economic that decides viability.</div>
</div>

## Concrete example

A RAG support bot: each answer sends ~3,000 input tokens (system + 4 retrieved chunks + question) and ~400 output tokens. Model at $3/M in, $15/M out. Expect 50,000 questions/month.

```python
req = 50_000
in_tok, out_tok = 3000, 400
cost_per = in_tok*(3/1e6) + out_tok*(15/1e6)   # $0.015 per answer
monthly  = req * cost_per
print(round(cost_per,4), round(monthly,2))     # 0.015  750.0
# Swap to a small model ($0.2/$0.6 per M): per-answer $0.00084 → ~$42/month.
# Add prompt caching on the 2k static prefix (~90% off it): cheaper still.
```

Now you can tell finance: "$750/month on the mid model, or ~$42 on the small one if quality holds — I'll eval both." That's a decision, not a vibe.

## How a company uses this

A Dubai edtech planned an AI tutor and estimated *before* building: ~15 turns/session, ~2,500 input + 500 output tokens/turn, 20k students doing 3 sessions/week. Back-of-envelope on the frontier model came to ~$180k/month — unviable. The estimate itself drove the redesign: route routine turns to a small model, cache the fixed tutor persona prompt, and reserve the frontier model for the ~10% of turns needing real explanation. Re-estimate: ~$28k/month — viable. They caught a business-killing cost *on a spreadsheet*, before writing production code. That's the entire value of estimating early.

## Common mistakes
- **Forgetting RAG context tokens** — the retrieved chunks are often the biggest input cost and the easiest to overlook.
- **Estimating one turn, not a whole conversation** — history re-billing makes multi-turn sessions far pricier than a single request.
- **Using only average tokens** — heavy users' worst-case inputs can dominate; estimate a range.
- **Ignoring discounts** — caching and batch can move the number 2–10×, changing the decision.

## Interview tip
Say: *"I estimate cost before shipping: measured tokens per request times requests per month times per-token price, then divide by users for the unit cost that decides viability. I include the whole input — system prompt, RAG context, and re-billed history — and I model a range, not just the average, because heavy users skew the bill. I re-estimate across model tiers and with caching/batch discounts, since that's what turns a selection debate into a defensible number."*
