# JSON mode

**What it is:** A setting that forces the model to return **valid, machine-parseable JSON** instead of free-form prose — and its stronger cousin, **structured outputs**, which guarantees the JSON matches a schema you define.

## Why it matters for an AI Engineer

The moment you feed a model's output *into code* — a database, an API call, a UI component — you need it to be a predictable shape, not a friendly paragraph. Without JSON mode, models wrap answers in markdown fences, add "Sure! Here's the JSON:", or drift the field names. Your `json.loads()` throws, and now you're writing brittle regex to scrape JSON out of prose. JSON mode kills that entire class of bug. **Structured outputs** go further: the model is *constrained* so the output is guaranteed to be valid JSON conforming to your schema — no missing fields, no wrong types. This is the backbone of extraction, classification, form-filling, and every agent that must return structured decisions.

## The mechanism — how it works

Two levels:

**1. JSON mode** (`response_format={"type": "json_object"}`): the model is guaranteed to emit *syntactically valid JSON*. You still must describe the shape you want in the prompt, and the model *should* follow it — but structure isn't enforced, only valid-JSON-ness.

**2. Structured outputs** (`response_format={"type": "json_schema", "json_schema": {...}, "strict": true}` on OpenAI; tool-schema/prefill on Anthropic): you attach a **JSON Schema**, and the decoder is constrained token-by-token so it *cannot* produce output that violates the schema. Every required field is present, every type is correct, every enum value is legal. This works via **constrained decoding** — at each step the API masks out any token that would break the schema.

In practice you define the schema with **Pydantic** (Python) or **Zod** (TypeScript) and the SDK converts it. The SDK can even parse the response straight back into your typed object.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🙂 "extract name + age"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model + schema<span class="sub">constrained decoding</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ {"name":"Sara","age":30}<span class="sub">valid, typed, guaranteed</span></span>
  </div>
  <div class="dcap">A schema constrains generation so output is always parseable and correctly shaped — no scraping prose.</div>
</div>

## Concrete example

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class Claim(BaseModel):
    policy_number: str
    amount_aed: float
    category: str  # e.g. "auto", "health", "property"
    urgent: bool

resp = client.chat.completions.parse(          # .parse = structured outputs helper
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": "Extract the insurance claim fields."},
        {"role": "user", "content": "Rear-ended on SZR, policy AE-9921, needs 8,500 dirhams, urgent auto claim."},
    ],
    response_format=Claim,                       # pass the Pydantic model directly
)

claim = resp.choices[0].message.parsed           # already a typed Claim object
print(claim.amount_aed, claim.urgent)            # 8500.0 True
```

No `json.loads`, no try/except, no markdown-fence stripping — the SDK returns a validated `Claim`.

## How a company uses this

A Dubai property portal uses structured outputs to turn messy Arabic-and-English WhatsApp listing messages into clean records: `{bedrooms, area_sqft, price_aed, neighborhood, furnished}`. **Production reality:** before structured outputs they parsed prose with regex and ~6% of listings failed to import, needing manual fixing at scale. With a strict JSON schema, malformed output dropped to effectively zero, and they could pipe results straight into their database. The schema also *documents the contract* — when they add a field, they change the schema, not five regex patterns.

## Common mistakes

- **Using plain JSON mode and assuming structure is enforced** — only *valid JSON* is guaranteed; use a schema (structured outputs) when fields must be exact.
- **Not describing the desired shape in the prompt** even in JSON mode — it still needs guidance.
- **Over-nesting or using unsupported schema features** — strict mode supports a subset of JSON Schema; keep schemas flat and typed.
- **Forgetting the model can still refuse or return an empty object** if the input genuinely lacks the data — validate for that.
- **Parsing streamed JSON before it's complete** (see [Streaming](streaming.md)).

## Interview tip
Say: *"For anything I feed into code I use structured outputs, not free-text parsing. I define the shape with Pydantic or Zod, pass it as a json_schema with strict mode, and the API uses constrained decoding so the result is guaranteed valid and correctly typed. Plain JSON mode only guarantees valid JSON, not the schema — I use the schema version whenever fields matter."* Distinguishing JSON mode from structured outputs shows real depth.
