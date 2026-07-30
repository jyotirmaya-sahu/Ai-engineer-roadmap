# Model Tiering by Task

**What it is:** Assigning a *fixed* model to each type of task in your application — small model for the simple steps, big model for the hard ones — decided at design time rather than per-request.

## Why it matters for an AI Engineer

Most real AI apps aren't one model doing one thing — they're a pipeline of distinct steps (classify → retrieve → summarize → reason → format), and those steps have wildly different difficulty. Tiering matches each step to the cheapest sufficient model, so you never pay frontier prices for a formatting step. It's the *predictable* cousin of [routing](model-routing-cascades.md): where routing decides dynamically per request, tiering decides statically per task. It's simpler, easier to reason about, and the right default whenever you know each step's difficulty in advance.

## The mechanism / how it works

You decompose the app into named steps, then assign a tier to each based on what that step demands ([Capability vs task](capability-vs-task.md)):

- **Cheap/small tier** — classification, routing, extraction, reformatting, simple summarization. High volume, low difficulty.
- **Mid tier** — grounded RAG answers, standard drafting, most business logic.
- **Frontier tier** — genuine multi-step reasoning, complex coding, ambiguous decisions, final customer-facing quality.

Because the mapping is fixed, it's trivial to implement (just call a different model per function), easy to cost-estimate (you know exactly how much traffic hits each tier), and easy to debug (a step's model is deterministic, not decided by a router you have to second-guess). The tradeoff versus routing: tiering can't adapt when an *individual* request in an "easy" step happens to be hard — every request in that step gets the same model. So you tier by step, and add routing *within* a step only if that step's difficulty genuinely varies request-to-request.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 input</span>
    <span class="darr">→</span>
    <span class="dbox green">classify<span class="sub">small</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">retrieve + summarize<span class="sub">mid</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">final reasoning<span class="sub">frontier</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ output</span>
  </div>
  <div class="dcap">Each pipeline step gets a fixed model tier sized to its difficulty — frontier only where it's earned.</div>
</div>

## Concrete example — one pipeline, three tiers

```python
def handle_ticket(text, docs):
    # cheap tier: narrow classification
    category = small_model(f"Classify as billing/technical/account: {text}")

    # mid tier: grounded summary from retrieved docs
    context  = mid_model(f"Summarise the relevant policy from: {docs}")

    # frontier tier: the customer-facing reasoned reply
    reply    = frontier_model(
        f"Category: {category}\nPolicy: {context}\nWrite a helpful, accurate reply to: {text}")
    return reply
```

Three models, each sized to its step. Only the final reply — the part where quality is visible and reasoning matters — pays frontier prices; the classify and summarize steps run cheap.

## How a company uses this

A Dubai legal-tech contract reviewer runs a fixed four-tier pipeline: a **small** model tags each clause's type (~50k clauses/day, must be cheap), a **mid** model extracts key terms, a **frontier** model does the actual risk-and-liability reasoning on flagged clauses only, and a **small** model formats the final report. Because the tiering is static, they cost-estimated the whole thing precisely before launch — they knew exactly how many clauses hit each tier — and it came in ~85% cheaper than routing every clause to the frontier model. When one step (risk reasoning) turned out to have variable difficulty, they added a small router *inside just that step*. Tiering everywhere, routing only where difficulty varies.

## Common mistakes
- **One model for the whole pipeline** — either overpaying on simple steps or underperforming on the hard one.
- **Tiering a step whose difficulty actually varies per request** — there you need routing, not a fixed tier.
- **Not re-checking tiers over time** — models improve and prices change; a step that needed frontier last year may run fine on mid now.
- **Over-tiering** — splitting into ten micro-steps with ten models adds complexity; tier at meaningful boundaries.

## Interview tip
Say: *"I decompose an app into steps and assign each a fixed model tier by its difficulty — small for classify/extract/format, mid for grounded answers, frontier only for real reasoning and customer-facing quality. It's simpler than dynamic routing and makes cost estimation exact because I know the traffic per tier. I add routing only inside a step whose difficulty genuinely varies per request. Tiering is my default; routing is the exception."*
