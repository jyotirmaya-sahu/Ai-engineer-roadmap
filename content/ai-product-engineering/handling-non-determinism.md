# Handling non-determinism

**What it is:** designing your product and code around the fact that an LLM can return a *different* answer to the exact same input every time — the same prompt today and tomorrow may not match.

## Why it matters for an AI Engineer

Every piece of engineering intuition you built on normal software assumes determinism: same input → same output → repeatable tests → cacheable results → stable behavior. LLMs break that assumption. The model samples from a probability distribution, so `f(x)` today can differ from `f(x)` tomorrow — different wording, different JSON shape, sometimes a different *decision*. If you don't design for this, your tests are flaky, your parsing randomly breaks, your users get inconsistent experiences, and one user screenshots two contradictory answers. Handling non-determinism is what makes an LLM feature *feel* like solid software instead of a slot machine. It shows up in almost every production incident, so interviewers love probing it.

## The mechanism: where randomness comes from and how to tame it

The randomness has a knob: **temperature**. At temperature 0, the model (mostly) picks the single highest-probability token at each step, giving near-deterministic output. Higher temperature samples more randomly, giving variety. But even at temperature 0 you're not *guaranteed* identical output — floating-point non-associativity across GPUs, batching, and model updates on the provider side introduce drift. So you manage non-determinism at four layers:

1. **Turn the knob down for structured tasks.** Extraction, classification, routing → `temperature=0`. Reserve higher temperature for creative tasks (brainstorming, varied copy) where variety is the *point*.
2. **Constrain the output shape.** Don't hope for valid JSON — *force* it with structured-output / JSON-schema / function-calling modes, then validate with a schema (Pydantic). This makes the *format* deterministic even when the content varies.
3. **Handle failure with retries and fallbacks.** Wrap calls so a malformed or off-policy response triggers a re-ask or a safe default — never a crash.
4. **Test statistically, not exactly.** You can't assert `output == "exactly this"`. Assert *properties*: valid schema, required fields present, value in an allowed set, an LLM-judge score above threshold — run over many samples, not one.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 LLM (sampled)</span>
    <span class="darr">↓<span class="lbl">temperature=0 for structured</span></span>
    <span class="dbox orange">🔒 Constrained output (JSON schema)</span>
    <span class="darr">↓<span class="lbl">validate</span></span>
    <span class="dbox blue">🔁 Retry / fallback on failure</span>
    <span class="darr">↓<span class="lbl">test properties, not equality</span></span>
    <span class="dbox green">✅ Stable-feeling feature</span>
  </div>
  <div class="dcap">Four layers turn a sampling model into software that behaves predictably enough to ship.</div>
</div>

## Concrete example

Extracting structured data safely, with schema validation and a retry:

```python
from pydantic import BaseModel, ValidationError

class Ticket(BaseModel):
    category: str        # must be one of the allowed set
    priority: str        # "low" | "medium" | "high"
    needs_human: bool

ALLOWED = {"billing", "technical", "account", "other"}

def classify(text: str, tries: int = 2) -> Ticket:
    for _ in range(tries):
        raw = llm(
            text,
            temperature=0,                    # kill needless randomness
            response_format=Ticket,           # force the JSON shape
        )
        try:
            t = Ticket.model_validate_json(raw)
            if t.category in ALLOWED:         # constrain content, not just shape
                return t
        except ValidationError:
            continue                          # malformed → re-ask
    return Ticket(category="other", priority="high", needs_human=True)  # safe fallback
```

Even though the model is non-deterministic, this function *always* returns a valid `Ticket` — worst case, a safe "route to human" default. And its test asserts properties over 50 varied inputs (`category in ALLOWED`, always parses), not one exact string.

## How a company uses this

A Dubai proptech firm auto-tags property listings with an LLM. Early on, the same listing re-processed would sometimes get "Apartment", sometimes "Flat", sometimes "Residential Unit" — inconsistent filters, angry users. They fixed it by (a) dropping temperature to 0, (b) forcing the output into a *fixed enum* of tag values via structured output, and (c) caching the result keyed by listing text, so a given listing is tagged once and stays stable. Reprocessing consistency went from ~80% to effectively 100%, and the cache cut LLM spend by ~40% since unchanged listings never hit the model twice. Non-determinism didn't disappear — it got *contained*.

## Common mistakes
- **`json.loads()` on raw model text and praying** — use structured-output modes + schema validation; free-form generation *will* eventually return prose around your JSON.
- **Exact-match unit tests** — they flake constantly. Test invariants and use an eval set.
- **High temperature on structured tasks** — variety where you wanted consistency.
- **Assuming temperature 0 = fully deterministic** — provider-side drift and model updates still move outputs; pin model versions and re-run your eval set after upgrades.

## Interview tip
Say: *"LLMs are non-deterministic, so I engineer around it: temperature 0 and constrained/structured output for anything parsed, schema validation with a retry-and-fallback wrapper, caching for stable results, and property-based tests plus an eval set instead of exact-match assertions."* Naming *structured output + validation + fallback* as a package tells the interviewer you've actually shipped LLM code, not just prompted a chatbot.
