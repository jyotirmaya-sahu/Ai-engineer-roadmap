# Tool schemas

**What it is:** the JSON description you give the model for each tool — its name, what it does, and the exact shape of its arguments. It's the *contract* the model reads to decide when and how to call your function.

## Why it matters for an AI Engineer

The model never sees your Python. It sees **only the schema**. So the schema is the entire interface between the LLM's reasoning and your code — and it's where tool-calling reliability is won or lost. A vague schema means the model calls the wrong tool, invents bad arguments, or hallucinates a value it should have asked for. A tight schema means it calls correctly the first time. In practice, "my agent keeps misbehaving" is *usually* a schema problem, not a model problem. This is a high-leverage, unglamorous skill that separates people who ship working agents from people whose demos break.

## The mechanism — what a schema contains and why each part matters

A tool schema is [JSON Schema](https://json-schema.org) wrapped in a small envelope. Four parts do the work:

- **`name`** — short, verb-like, unambiguous (`get_order_status`, not `helper2`). The model matches intent to this name.
- **`description`** — a plain-English sentence saying *what the tool does and when to use it*. This is the most under-rated field: the model uses it to *choose* between tools. "Look up a shipment's live status by its ID" beats "shipment tool."
- **`parameters`** — a JSON-Schema object describing each argument: its `type`, a per-field `description`, allowed values via `enum`, and which are `required`. Types and enums *constrain* what the model can emit, so it can't pass a string where you need a number or invent a status value you don't support.
- **`required`** — the fields that must be present. If a required field is missing from the user's request, a good model will *ask the user* instead of guessing — which is exactly what you want.

The model reads all of this, then produces arguments as JSON that *validates against the schema*. Well-specified schema → well-formed call.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 Schema<span class="sub">name + description + typed params</span></span>
    <span class="darr">→<span class="lbl">model reads</span></span>
    <span class="dbox purple">🤖 picks tool + fills args</span>
    <span class="darr">→</span>
    <span class="dbox orange">📦 valid JSON call</span>
  </div>
  <div class="dcap">The schema is the ONLY thing the model knows about your tool. Precision here = correct calls.</div>
</div>

## Concrete example — vague vs tight

```python
# ❌ vague — model guesses argument names, statuses, and when to use it
bad = {"type": "function", "function": {
    "name": "orders", "description": "orders tool",
    "parameters": {"type": "object", "properties": {"x": {"type": "string"}}}}}

# ✅ tight — clear purpose, typed + constrained args, descriptions, required
good = {"type": "function", "function": {
    "name": "get_order_status",
    "description": "Get the current delivery status of a customer order by its order ID. "
                   "Use when the user asks where an order is or if it shipped.",
    "parameters": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string",
                         "description": "The order ID, e.g. 'ORD-4471'."},
            "detail": {"type": "string", "enum": ["summary", "full"],
                       "description": "How much detail to return.",
                       "default": "summary"},
        },
        "required": ["order_id"],
    }}}
```

With `bad`, the model sends `{"x": "where is my stuff"}`. With `good`, it sends `{"order_id": "ORD-4471", "detail": "summary"}` — or, if the user never gave an ID, it *asks for it* because `order_id` is required.

## How a company uses this — production lens

> **A Dubai e-commerce team** had an agent that kept calling `refund_order` when users only *asked about* refund policy — an expensive bug at ~10k conversations/day. Root cause: the description was just "refund tool." They rewrote it to *"Issue a refund for a paid order. Only call after the user explicitly confirms they want a refund."* and added a required `confirmation: boolean`. Mis-fires dropped to near zero. They also enforce the schema **twice**: the model validates against it, and their code *re-validates* the incoming arguments before executing — because a schema guides the model but doesn't *guarantee* valid output. That server-side re-check is the difference between a demo and production.

## Common mistakes

- **Lazy descriptions.** "orders tool" tells the model nothing about *when* to use it. Write a full sentence including the trigger.
- **No `enum` on categorical fields.** Let `status` be a free string and the model invents `"in-transit-ish"`. Constrain it.
- **Everything optional.** Then the model guesses missing values instead of asking. Mark truly-needed fields `required`.
- **Trusting the schema as a guarantee.** Models *usually* comply, not *always*. Re-validate arguments server-side before running.
- **Too many tools with overlapping descriptions.** The model can't tell them apart. Keep tools distinct; merge or split until each has one clear job.

## Interview tip
Say: *"The schema is the only thing the model sees, so it's the real API. I write verb-like names, a description that states when to use the tool, typed and enum-constrained arguments, and mark required fields so the model asks instead of guessing — then I re-validate server-side because the schema guides output, it doesn't guarantee it."* That answer shows you know where tool-calling actually breaks. Pairs directly with [function calling](function-calling.md).
