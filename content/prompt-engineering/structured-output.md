# Structured output

**What it is:** Structured output is forcing the model to return data in a strict machine-readable shape — usually JSON matching a schema — instead of free-form prose, so your code can reliably parse it.

## Why it matters for an AI Engineer
In real apps the LLM is rarely the last step — its output feeds a database, an API call, a UI, or another model. Prose like "The sentiment is mostly positive, though..." is useless to code; you need `{"sentiment": "positive", "confidence": 0.8}`. Structured output is the seam between the fuzzy LLM and your deterministic software. Getting it *guaranteed* (not "usually valid JSON") is what makes LLM features robust enough to ship. This is one of the most practically important skills for an AI Engineer, because nearly every pipeline depends on parsing the model's output.

## The mechanism
There are three levels, weakest to strongest:

1. **Ask for JSON in the prompt.** "Respond with JSON: `{...}`." Works often, but the model may add prose, wrap it in markdown fences, or drift the schema — you must defensively parse.
2. **JSON mode.** Set `response_format={"type": "json_object"}`. The API guarantees *valid JSON syntax* — but not that it matches *your* schema (right keys, types).
3. **Structured Outputs / schema-constrained decoding (2026 standard).** You pass a JSON Schema (or a Pydantic model) and the provider **constrains token generation** so output *provably* conforms — every required key present, correct types, valid enums. This is the one to use in production; it eliminates a whole class of parse failures.

Under the hood, schema-constrained decoding masks the token sampler at each step: only tokens that keep the output valid against the schema are allowed. So the model literally *cannot* emit a malformed object. You still validate on your side (defense in depth), but failures become rare.

## Concrete example
```python
from pydantic import BaseModel
from openai import OpenAI
client = OpenAI()

class Ticket(BaseModel):
    category: str          # e.g. "billing", "delivery", "technical"
    urgency: int           # 1-5
    summary: str

r = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "Extract structured fields from the support ticket."},
        {"role": "user", "content": "My card was charged twice for order #55! Fix it today."},
    ],
    response_format=Ticket,          # schema-constrained: output MUST match Ticket
)
ticket = r.choices[0].message.parsed  # already a validated Ticket object
print(ticket.category, ticket.urgency)   # -> billing 5
print(ticket.model_dump())               # {'category': 'billing', 'urgency': 5, 'summary': '...'}
```

`.parsed` hands you a typed object — no `json.loads`, no guessing whether it added a Markdown code fence, and no missing-key crashes.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💬 Free text</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM + schema constraint</span>
    <span class="darr">→</span>
    <span class="dbox green">🔢 {category, urgency, summary}</span>
    <span class="darr">→</span>
    <span class="dbox blue">🗄️ Your code / DB / API</span>
  </div>
  <div class="dcap">A schema forces a valid, typed object the rest of your system can trust.</div>
</div>

## How a company uses this
A Dubai HR-tech product parses thousands of résumés into a structured profile (name, skills[], years_experience, education[]). Early versions asked for JSON in the prompt and hit ~3–4% parse failures — a missing quote, an extra sentence, a hallucinated field — each one a broken record needing a manual retry. Switching to schema-constrained Structured Outputs drove parse failures to near zero and let them drop a whole layer of retry/repair code. At their volume, that 3–4% was thousands of failed records per day; eliminating it removed a real operational cost and made the pipeline predictable. They pair it with an enum for `category` so the model can't invent new categories that break downstream routing.

## Common mistakes
- **Trusting "usually valid" JSON.** Prompt-only JSON drifts; on the 1000th call it fails. Use schema-constrained mode in production.
- **JSON mode ≠ schema conformance.** JSON mode guarantees *syntax*, not your *keys/types*. Use a full schema.
- **Over-nesting the schema.** Deep, complex schemas raise error rates and cost; keep them flat and minimal.
- **Free-string fields where enums belong.** Use `enum` for categories so outputs are constrained to valid values.
- **Skipping validation entirely.** Even with constraints, validate on your side — defense in depth.

## Interview tip
Say: *"For anything that feeds code, I use schema-constrained Structured Outputs — pass a Pydantic/JSON Schema so the provider constrains decoding and the output is provably valid, with enums for categorical fields. That eliminates the parse-failure class that plagues prompt-only JSON, and I still validate on my side as defense in depth."* Naming *schema-constrained decoding* (not just "ask for JSON") signals current, production-grade knowledge.
