# Routing

**What it is:** deciding *which* agent (or tool, or model) should handle a given request — the classification step that sends a task to the right specialist.

## Why it matters for an AI Engineer

Routing is the single most reused decision in multi-agent systems. A [supervisor](supervisor-orchestrator.md) routes on every turn; a triage bot routes each incoming message; a model-cascade routes easy queries to a cheap model and hard ones to an expensive one. Good routing means the right specialist handles each job — cheaply and accurately. Bad routing sends billing questions to the tech-support agent and burns a frontier model on "hi." For an AI Engineer, routing is where a lot of both *cost* and *quality* is quietly decided.

## The mechanism / how it works

Routing is a classification problem: given the input, output a label from a **fixed set** of destinations. Three ways to do it, cheapest first:

1. **Rules / keywords** — if the message contains "refund," route to billing. Free and instant, but brittle and can't handle nuance.
2. **Embedding similarity** — embed the query, compare to a labeled example per route, pick the closest. Cheap, fast, no LLM call, handles paraphrases. Great default for high-volume routing.
3. **LLM classifier** — ask a (usually small) model to pick the route via structured output. Most flexible, handles subtle intent, but costs a call per request.

The non-negotiable rule at every level: **constrain the output to the known set of routes.** A router that can emit free text will eventually name a destination that doesn't exist. Use an enum / structured output. Always include a `fallback` route for "none of these / unclear" so ambiguous inputs go somewhere safe instead of a random guess.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">💬 "I was double-charged"</span>
    <span class="darr">↓<span class="lbl">classify</span></span>
    <span class="dbox purple">🧭 Router<span class="sub">enum output</span></span>
    <span class="darr">↓</span>
  </div>
  <div class="flow">
    <span class="dbox blue">💳 Billing ✅</span>
    <span class="dbox gray">🛠️ Tech</span>
    <span class="dbox gray">↩️ Fallback</span>
  </div>
  <div class="dcap">Routing = classify into a fixed set of destinations, always with a fallback for the unclear.</div>
</div>

## A concrete example

An LLM router constrained to an enum:

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from typing import Literal

class Route(BaseModel):
    # Literal forces the model to pick ONLY these — it can't invent a route
    destination: Literal["billing", "tech_support", "sales", "fallback"]

router = ChatOpenAI(model="gpt-4o-mini").with_structured_output(Route)  # small model = cheap

def route(msg: str) -> str:
    return router.invoke(f"Classify this customer message: {msg}").destination

print(route("I was charged twice this month"))  # -> billing
print(route("asdkjh what"))                      # -> fallback
```

Using `gpt-4o-mini` here is deliberate: routing is a simple classification, so you pay pennies and route the *hard* downstream work to a bigger model.

## How a company uses this

A Dubai telco's WhatsApp assistant handles ~50,000 messages a day. A first-pass embedding router (no LLM call) sorts each into billing, coverage, device help, or human-agent — at that volume, doing it with a frontier LLM would cost thousands of dirhams daily, but embeddings make it near-free and sub-100ms. Only messages the embedding router is unsure about (low similarity to any route) escalate to an LLM classifier. This two-tier routing — cheap classifier first, expensive one only on the uncertain tail — keeps 90%+ of traffic on the free path. A missing fallback route once sent gibberish messages to random departments; adding one fixed it.

## Common mistakes / misconceptions

- **Free-text routing.** Unconstrained output eventually names a nonexistent route. Use an enum / structured output.
- **No fallback.** Ambiguous input forced into a real category produces confident wrong routing. Always have an "unclear" path.
- **Using a big model for trivial routing.** Routing is classification — a small model or embeddings usually suffice, at a fraction of the cost.
- **Routing on stale context.** Route on the *current* message/intent, not a summary that's drifted.

## Interview tip
Say: *"Routing is classification into a fixed set of destinations — I constrain the output to an enum with a fallback, and I pick the cheapest method that's accurate enough: keywords, then embedding similarity for high volume, then a small LLM classifier only on the uncertain tail. Routing is where I control both cost and correct-specialist accuracy."* That shows cost-awareness at scale.
