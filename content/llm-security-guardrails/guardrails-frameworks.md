# Guardrails frameworks

**What it is:** libraries that let you *declare* the rules an LLM app must follow — valid formats, allowed topics, no-PII, safety — and enforce them automatically around every model call, instead of hand-writing `if` checks everywhere.

## Why it matters for an AI Engineer

You *can* build [input/output validation](input-output-validation.md) by hand, but in a real app the checks multiply: schema, PII, toxicity, topic, competitor-mention, hallucination. Scattering that logic across your code gets unmaintainable fast. Guardrails frameworks give you a structured, reusable, declarative layer — define validators once, apply them consistently, get automatic retries when output fails. Interviewers like to hear a *named* framework and a clear picture of what it does versus what you still own, because it shows you know the ecosystem, not just the concept.

## The mechanism

The frameworks share a common shape:

- **Validators** — small, composable units that each check one thing (valid JSON, no PII, on allowed topics, no profanity, answer grounded in sources). You compose the set your app needs.
- **On-fail policies** — for each validator you choose what happens on a violation: `exception` (block), `fix`/`reask` (auto-retry the model to correct it), `filter` (strip the bad part), or `noop`/`log` (flag only).
- **A wrapper** around your LLM call — the framework runs input validators before the call and output validators after, applying your policies. Re-ask loops re-prompt the model with the validation error until it produces conforming output or a retry cap is hit.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 request</span>
    <span class="darr">→</span>
    <span class="dgroup"><span class="dgt">GUARDRAILS WRAPPER</span>
      <span class="dbox orange">✔️ input validators</span>
      <span class="darr">→</span>
      <span class="dbox purple">🧠 LLM</span>
      <span class="darr">→</span>
      <span class="dbox orange">✔️ output validators<span class="sub">fix / reask / block</span></span>
    </span>
    <span class="darr">→</span>
    <span class="dbox green">✅ guaranteed-valid result</span>
  </div>
  <div class="dcap">Declare validators + on-fail policies once; the wrapper enforces them on every call.</div>
</div>

The main players in 2026: **Guardrails AI** (the `guardrails-ai` package, a big validator hub, strong on structured-output enforcement and re-asking), **NVIDIA [NeMo Guardrails](nemo-guardrails.md)** (rail engine focused on conversation flow), and **Llama Firewall / provider-native guardrails** (e.g. Bedrock Guardrails, OpenAI moderation) baked into a platform. Guardrails AI is the common general-purpose pick.

## Concrete example

Guardrails AI enforcing "valid structure + no competitor mentions," with automatic re-ask on failure:

```python
from guardrails import Guard
from guardrails.hub import CompetitorCheck  # installed from the validator hub
from pydantic import BaseModel

class Reply(BaseModel):
    answer: str
    confidence: float

guard = Guard.for_pydantic(Reply).use(
    CompetitorCheck(competitors=["BankB", "BankC"], on_fail="fix")  # strip/redact
)

result = guard(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "How do we compare to BankB on fees?"}],
)
print(result.validated_output)   # dict matching Reply, with competitor names removed
# If the model returns malformed JSON, Guard automatically re-asks until it parses.
```

You declared *what* must be true; the framework handled schema enforcement, the competitor validator, and the retry loop. Adding a PII or toxicity validator is one more `.use(...)`.

## How a company uses this

**A Dubai wealth-management firm** built an advisor-assist tool that drafts client messages. Compliance had a long list of rules: output must be valid JSON for their CRM, must never promise returns, must never name a competitor product, must not contain client PII in the logged draft. Rather than bury that in code, they encoded each rule as a validator in Guardrails AI with `on_fail="reask"` for format issues and `on_fail="exception"` for the hard compliance rules (promise-of-returns → block and alert). When regulators asked "how do you enforce your marketing rules on AI output?", they pointed at a single, auditable validator config instead of a maze of `if` statements. The re-ask loop also cut their malformed-JSON failure rate to near zero, which mattered because bad JSON was silently dropping drafts before.

## Common mistakes

- **Reaching for a framework before you understand the underlying validate-both-sides pattern.** The library isn't magic; it's structured `if` checks.
- **Unbounded re-ask loops.** Each retry is another paid call and added latency — cap retries and fail closed.
- **Assuming built-in validators cover your domain.** Competitor lists, product-specific rules, and Arabic-language safety often need custom validators.
- **Treating the framework as your *only* defense.** It's one layer; you still need least privilege and safe output handling.

## Interview tip
Say: *"For anything beyond a couple of checks I use a guardrails framework — Guardrails AI for general structured-output and validator enforcement, NeMo Guardrails when I need conversation-flow rails. I declare validators with explicit on-fail policies (block vs fix vs reask), cap the reask loop, and keep it as one layer alongside least privilege and output sanitization."* Naming a specific library and its on-fail semantics shows hands-on familiarity.
