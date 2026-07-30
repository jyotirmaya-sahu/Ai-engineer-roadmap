# Model Routing / Cascades

**What it is:** Instead of sending every request to one model, a **router** inspects each request and sends it to the *cheapest model that can handle it*; a **cascade** tries a cheap model first and only escalates to a stronger one if the cheap answer isn't good enough.

## Why it matters for an AI Engineer

This is the single biggest cost lever at scale. Most traffic is easy; a minority is hard. If you send everything to your best model, you pay frontier prices for a million trivial requests. Routing lets ~70–90% of traffic go to a cheap model and reserves the expensive one for the hard slice — often cutting total spend 60–80% with no quality loss on the hard cases. Building this is a concrete, senior-level system-design answer to "how would you make this affordable at a million requests a day?"

## The mechanism / how it works

Two related patterns:

**Routing (classify-then-dispatch).** A lightweight step decides difficulty *up front*, then picks the model:
- *Rule-based* — cheap heuristics: short/simple query → small model; contains code or multi-step reasoning → big model.
- *Model-based* — a tiny, fast classifier model labels the request's difficulty, and you dispatch accordingly.
Fast and simple, but the router can misjudge a request.

**Cascade (try-cheap-then-escalate).** Send the request to the cheap model first, then check the answer's quality (a confidence signal, a validator, or a small "is this good enough?" check). If it passes, done — cheaply. If not, escalate to the stronger model. This self-corrects (the cheap model's failures get caught) but the escalated requests pay for *both* models, so it's only a win when most requests pass the cheap tier.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 request</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔀 router / cheap tier</span>
    <span class="darr">→<span class="lbl">easy (80%)</span></span>
    <span class="dbox green">🐣 small model<span class="sub">cheap</span></span>
  </div>
  <div class="flow">
    <span class="dbox orange">🔀</span>
    <span class="darr">→<span class="lbl">hard (20%)</span></span>
    <span class="dbox purple">🐘 frontier model<span class="sub">only when needed</span></span>
  </div>
  <div class="dcap">Route easy traffic to a cheap model, escalate only the hard minority — big savings at scale.</div>
</div>

## Concrete example — a simple cascade

```python
def answer(query):
    small = small_model(query)                 # cheap first attempt
    if confident_enough(small):                # e.g. self-rated score, or a validator
        return small                           # ~80% stop here, cheaply
    return frontier_model(query)               # escalate the hard 20%

# Cost math at 1M requests, small=$0.001, frontier=$0.09:
# route (no double-pay): 0.8*1M*0.001 + 0.2*1M*0.09 = $800 + $18,000 = $18,800
# vs all-frontier: 1M*0.09 = $90,000  → ~79% cheaper
```

The saving is real *only* if the split is right: measure your actual easy/hard mix before assuming 80/20.

## How a company uses this

A Dubai bank's support assistant handles ~500k messages/day. A **rule + classifier router** sends balance/FAQ/greeting messages (~75%) to a cheap self-hosted Llama, and complex complaints or multi-account reasoning (~25%) to a frontier Claude. They added a **cascade safety net**: if the cheap model's answer fails a quick grounding check, it escalates. Result: frontier-model spend dropped ~70% versus routing everything to it, while hard cases still get top-tier reasoning. They monitor the router's decisions — a drift toward over-escalation quietly erases the savings, so misroute rate is a tracked metric. This pairs with fixed [tiering by task](model-tiering-by-task.md) for the parts where the model choice is known in advance.

## Common mistakes
- **Router misjudging difficulty** — sending a hard query to the small model (wrong answer) or an easy one to frontier (wasted money); measure and tune the misroute rate.
- **Cascade with a low pass rate** — if the cheap tier rarely satisfies, you pay for two models on most requests and *lose* money. Cascades need a high first-tier success rate.
- **Not monitoring the split** — traffic mix drifts; a router tuned last quarter may be over-escalating now.
- **Over-engineering** — for a predictable app, fixed per-task tiering is simpler than a dynamic router; don't build routing you don't need.

## Interview tip
Say: *"At scale I don't send everything to one model — I route. A lightweight classifier or rules dispatch easy traffic to a cheap model and reserve the frontier model for the hard minority, or I cascade: try cheap first, escalate only if the answer fails a quality check. That typically cuts cost 60–80% with no loss on hard cases. The catches are misroute rate and, for cascades, needing a high first-tier pass rate — so I monitor both, since traffic drift can silently erase the savings."*
