# Constrained / structured decoding

**What it is:** Restricting what tokens the model is *allowed* to generate, so its output is guaranteed to fit a shape — valid JSON, a value from an enum, a number, a regex — instead of hoping it formats correctly.

## Why it matters for an AI Engineer

The moment an LLM's output feeds a program — a tool call, a database write, an extraction pipeline — free-form text is a liability. One stray word, a trailing comma, a markdown code-fence around your JSON, and `json.loads()` throws, your agent step crashes, and you're retrying at 2x cost. Constrained decoding makes "the model produced invalid output" *structurally impossible* rather than something you catch after the fact. For any AI Engineer building agents or data-extraction at scale, this is the technique that turns "parses correctly 97% of the time" into 100%.

## The mechanism

An LLM generates one token at a time by picking from a probability distribution over the whole vocabulary. **Constrained decoding masks that distribution**: at each step it sets the probability of any token that would break the target format to zero, then samples only from the survivors.

Concretely, you compile your schema (a JSON Schema, a regex, or a formal grammar) into a **state machine**. At every decoding step the machine knows which tokens are legal *next* — after `{"amount":` only a digit or `-` is valid, never a letter. Illegal tokens are masked out, so the model *cannot* emit them even if it "wanted" to. The output is guaranteed valid by construction.

Two flavours you'll meet:

- **Provider-side (function/tool calling & JSON mode).** OpenAI, Anthropic, and Google let you pass a schema; they enforce it server-side. This is what you use 90% of the time — one API parameter, no infra.
- **Local grammar-constrained decoding.** With open models (vLLM, llama.cpp) you supply a GBNF grammar or JSON Schema and the serving engine does the masking. Needed when you self-host or want a grammar richer than JSON (e.g. valid SQL, a DSL).

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">📋 schema / grammar</span>
    <span class="darr">↓<span class="lbl">compile</span></span>
    <span class="dbox orange">🔢 state machine (legal next tokens)</span>
    <span class="darr">↓<span class="lbl">mask illegal tokens each step</span></span>
    <span class="dbox purple">🤖 constrained sampling</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ always-valid JSON</span>
  </div>
  <div class="dcap">The schema becomes a mask that zeroes out any token which would break the format.</div>
</div>

## Concrete example

```python
from pydantic import BaseModel
from typing import Literal
from openai import OpenAI

class Claim(BaseModel):
    amount_aed: float
    status: Literal["approved", "denied", "pending"]  # enum: only these 3

client = OpenAI()
resp = client.responses.parse(       # structured-output helper
    model="gpt-4.1",
    input="Claim #482: 1,250 dirhams, still under review.",
    text_format=Claim,
)
claim = resp.output_parsed
assert claim.status in ("approved", "denied", "pending")  # guaranteed by decoding
assert isinstance(claim.amount_aed, float)
print(claim)   # amount_aed=1250.0 status='pending'
```

`status` can *only* be one of the three enum values — the decoder physically cannot emit "maybe" or "in review." No post-hoc validation of the field's *shape* is needed; it's enforced during generation.

## How a company uses this

A Dubai logistics firm extracts structured shipment records from thousands of messy PDF invoices a day. Before constrained decoding, ~4% of outputs had a malformed field (currency as a string, a hallucinated status), and each failure meant a retry (double the tokens, +2s latency) or a human fix. Switching to schema-enforced JSON extraction dropped parse failures to **0** — the *shape* is now guaranteed, so their pipeline removed all format-retry logic. That saved roughly 4% of their extraction token spend and, more importantly, made downstream jobs deterministic to build against. Note the ceiling: decoding guarantees the *format*, not the *facts* — a guaranteed-valid `amount_aed` can still be the wrong number, which is why they still sample-audit values (see [Verification & validators](./verification-validators.md)).

## Common mistakes

- **Confusing valid with correct.** Constrained decoding guarantees the JSON parses and the enum is legal — never that the extracted value is *true*. Combine with verification for facts.
- **Over-constraining and forcing a hallucination.** If your enum has no "unknown"/"none" option, the model is forced to pick a wrong category rather than admit uncertainty. Always include an escape value.
- **Regex/grammar too tight.** A rigid grammar can make otherwise-easy generations infeasible, hurting quality or looping. Constrain the *structure*, leave free-text fields free.
- **Rolling your own masking.** Use provider structured outputs or a battle-tested engine (Outlines, XGrammar, vLLM's guided decoding); hand-written masks have subtle tokenizer bugs.

## Interview tip
Say: *"For anything a program parses — tool calls, extraction — I use constrained decoding: the schema compiles to a token mask so invalid output is impossible by construction, not caught afterward. I use provider structured outputs by default, or grammar-constrained decoding in vLLM when self-hosting. Key caveat: it guarantees format, not truth, and I always include an 'unknown' enum value so it can abstain instead of being forced into a wrong category."* That last point separates people who've shipped extraction from people who've only read about JSON mode.
