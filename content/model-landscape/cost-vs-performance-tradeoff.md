# Cost vs Performance Tradeoff

**What it is:** The central dial of model selection — spending more (bigger model, more tokens, more thinking) buys better quality, but with steeply diminishing returns. The job is finding the point where quality is *good enough* and cost is as low as possible.

## Why it matters for an AI Engineer

Almost every model decision collapses to this tradeoff. Push quality too hard and you build something correct but unaffordable; cut cost too far and quality fails and users leave. The senior skill is placing your app deliberately on this curve *per task* — with data — rather than defaulting to one extreme. This is the tile interviewers circle back to: "how do you balance quality and cost?" is really "do you understand this curve?"

## The mechanism / how it works

Plot quality against cost and you get a curve that **rises fast then flattens**. Going from a weak to a mid model is a big quality jump for modest cost. Going from a strong model to the absolute frontier is a small quality gain for a large cost — you're deep in diminishing returns. Your task defines *where on the curve "good enough" sits*:

- A **legal-clause analysis** has a high quality bar — errors are expensive — so you pay for the frontier region.
- A **support-ticket tag** has a low bar — a cheap model nails it — so paying frontier prices is pure waste.

The levers that move you along the curve:

- **Model tier** — the biggest single lever (20–50× cost swing).
- **Reasoning / thinking budget** — more thinking tokens buy accuracy on hard tasks, at output-token cost and latency.
- **RAG vs bigger model** — often adding retrieval to a mid model beats upgrading to a frontier model, cheaper.
- **Prompt caching / batch** — cut cost *without* touching quality — free wins, always take them first.

<div class="diagram">
  <div class="flow v">
    <span class="dbox green">cheap+small<span class="sub">quality rises fast per $</span></span>
    <span class="darr">↓<span class="lbl">good ROI</span></span>
    <span class="dbox orange">mid model<span class="sub">the "good enough" sweet spot</span></span>
    <span class="darr">↓<span class="lbl">diminishing returns</span></span>
    <span class="dbox purple">frontier<span class="sub">tiny gains, big cost</span></span>
  </div>
  <div class="dcap">Quality-vs-cost flattens: place each task where its quality bar meets the lowest cost.</div>
</div>

## Concrete example — find the knee of the curve

```python
# Eval each candidate: quality (on a labeled set) and cost/request.
candidates = {
    "small":    {"quality": 0.88, "cost": 0.001},
    "mid":      {"quality": 0.94, "cost": 0.015},
    "frontier": {"quality": 0.95, "cost": 0.090},
}
bar = 0.93                                  # this task's quality threshold
ok = {m: v for m, v in candidates.items() if v["quality"] >= bar}
best = min(ok, key=lambda m: ok[m]["cost"])
print(best)     # "mid" — clears the bar at 6x less cost than frontier for +0.01
```

Frontier buys just 1 extra point over mid for 6× the cost — clearly past the knee. The *right* choice is the cheapest model that clears the bar, and only an eval reveals it.

## How a company uses this

A Dubai insurance firm classifies claims *and* drafts customer explanations. They mapped each step on the curve: **classification** sat where a small model already clears the bar (high ROI, cheap) — so they used it. **Explanation drafting**, customer-facing and error-sensitive, had a higher bar where only a strong model qualified — so they paid for it there, but *only* there. They then layered **prompt caching** (free quality-neutral savings) across both. Net effect: they operate each task at its own knee of the curve, spending frontier money on 15% of volume instead of 100% — roughly an 80% cost cut versus "best model everywhere," with no measurable quality loss.

## Common mistakes
- **Living at one extreme** — "best model everywhere" (bankrupt) or "cheapest everywhere" (users leave). The answer is per-task placement.
- **Chasing the last 1–2% of quality** past the knee, paying multiples for a gain users can't perceive.
- **Ignoring free levers** — caching and batch cut cost without touching quality; take them before trading quality away.
- **Deciding without an eval** — you can't find the knee by intuition; you need measured quality-vs-cost points.

## Interview tip
Say: *"Quality versus cost is a curve with diminishing returns — early spend buys big quality gains, frontier spend buys tiny ones. So I place each task at its own knee: define the quality bar, eval candidates, and pick the cheapest model that clears it. I take free quality-neutral savings first — caching, batch — before trading quality for cost, and I often add RAG to a mid model instead of upgrading to frontier. Different tasks sit at different points; that's why routing and tiering exist."*
