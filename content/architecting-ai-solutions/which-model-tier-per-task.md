# Which model tier per task

**What it is:** the decision of *which size/price of model* to use for each job — frontier, mid-tier, or small — instead of defaulting every call to the biggest, most expensive model.

## Why it matters for an AI Engineer

The single fastest way to blow an AI feature's budget is to route *every* request to a frontier model "to be safe." Most tasks in a real system — classify, extract, route, summarize — are easy, and a small model does them at a fraction of the cost and latency. The senior skill is **right-sizing**: matching each task's difficulty to the cheapest model that clears the quality bar. This one decision often cuts an AI feature's bill by 5–20× with no user-visible quality loss, and interviewers ask it precisely because it separates people who've run things in production from those who've only prototyped.

## The mechanism: three tiers, matched to difficulty

Models come in rough tiers that trade **capability** against **cost and latency**:

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 Frontier<span class="sub">hardest reasoning · $$$ · slow</span></span>
    <span class="dbox blue">⚙️ Mid-tier<span class="sub">most production work · $$ · fast</span></span>
    <span class="dbox green">🍃 Small / nano<span class="sub">classify, extract, route · $ · instant</span></span>
  </div>
  <div class="dcap">Match the tier to the task's difficulty — don't send easy work to the expensive model.</div>
</div>

- **Frontier (largest):** best reasoning, complex multi-step problems, hardest edge cases, code generation, nuanced judgment. Highest price per token and highest latency. Use *sparingly* — for the genuinely hard slice of your traffic.
- **Mid-tier:** the production workhorse. Handles most RAG answering, drafting, moderate reasoning, and tool orchestration at a fraction of frontier cost and noticeably lower latency. Start here for most user-facing tasks.
- **Small / nano:** fast and cheap. Great for classification, extraction, routing, simple summarization, and "is this relevant?" checks. Often near-frontier quality *on easy tasks*, at a tiny fraction of the price and near-instant.

The decision is per-task, not per-app:

| Task | Tier | Why |
|---|---|---|
| Intent classification / routing | small | easy, high-volume, latency-sensitive |
| Field extraction from a doc | small–mid | structured, well-defined |
| RAG answer over retrieved text | mid | needs fluency, not deep reasoning |
| Multi-step reasoning / hard code | frontier | genuine difficulty |
| Final "does this look right?" check | frontier (low volume) | catch what cheap models miss |

**The pattern that ties it together — model cascade/routing:** send everything to a cheap model first; escalate to a bigger one *only* when the cheap model is low-confidence or the router flags the task as hard. Most traffic stays cheap; the expensive model handles the hard tail. (More in [Cost & Token Optimization](../cost-token-optimization.md).)

## Worked example: cascade economics

100k requests/month; 80% are easy (classify/extract), 20% are hard (reasoning).

- **All-frontier:** 100k × $0.04 = **$4,000/month** and slow on every call.
- **Cascade:** 80k on a small model ($0.001) = $80 + 20k on frontier ($0.04) = $800 → **$880/month**, and the 80% of users on easy queries get near-instant responses.

Same quality where it matters, ~4.5× cheaper *and* faster for most users. The whole win is *not* paying frontier prices for classification.

## How a company uses this

> **A Dubai fintech's transaction-support assistant.** Every incoming message first hits a **small model** that classifies intent (balance query, dispute, general question) and extracts entities — cheap, ~200ms, ~70% of traffic resolves here with a templated + RAG answer from a **mid-tier** model. Only genuinely ambiguous or multi-step cases ("dispute this recurring charge and check if others were affected") escalate to a **frontier** model. They measured it: routing by difficulty cut their monthly LLM spend ~85% versus their original all-frontier prototype, with *no* drop on their quality eval — because the frontier model was overkill for the 70% that were simple lookups. The router itself is a tiny classifier, so its cost is negligible.

## Common mistakes
- **Defaulting everything to frontier.** "To be safe" is how you get a bill 10× larger than needed. Most tasks don't need it.
- **Using a small model for genuinely hard reasoning.** The opposite error — cheaping out on the 20% that needs real capability produces wrong answers on the cases that matter most.
- **Choosing a tier once for the whole app.** Right-sizing is *per task*. A single app should mix tiers.
- **Ignoring latency.** Frontier models aren't just pricier — they're slower. For a real-time UI, a small model's speed can matter as much as its cost.
- **Not re-evaluating.** Model prices and capabilities shift fast; a task that needed frontier last year may run fine on this year's mid-tier. Re-check periodically.

## Interview tip
Say: *"I right-size per task, not per app. Classification, extraction, and routing go to a small model; most RAG and drafting to mid-tier; only genuinely hard reasoning to frontier. In production I wire a cascade — cheap model first, escalate on low confidence — so the bulk of traffic stays cheap and fast and the expensive model only sees the hard tail. That typically cuts spend several-fold with no quality loss on the eval set."* Naming the cascade *and* the eval set shows you'd verify the savings, not just assume them.
