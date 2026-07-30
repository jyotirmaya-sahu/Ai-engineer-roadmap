# Input / output validation

**What it is:** the core guardrail pattern — check everything going *into* the model (block bad/malicious input) and check everything coming *out* (block unsafe, off-topic, or malformed output) before it's used.

## Why it matters for an AI Engineer

This is the baseline defense that every other tile builds on. [Guardrails frameworks](guardrails-frameworks.md), [Llama Guard](llama-guard.md), and [NeMo Guardrails](nemo-guardrails.md) are all *implementations* of input/output validation. If you understand the pattern itself, you can defend an app even with plain Python. Interviewers use it as a quick competence check: "how do you keep this chatbot on-topic and safe?" The right shape of answer — *two checkpoints, one before and one after the model* — instantly reads as someone who's shipped a real LLM app.

## The mechanism

Think of the model as a black box you don't fully trust, sitting between two gates:

**Input validation (before the model):**
- **Structural checks** — length limits (reject a 100k-char prompt), allowed characters, valid schema for structured requests.
- **Safety checks** — detect prompt-injection patterns, jailbreak phrasing, disallowed topics, and PII you don't want sent onward.
- **Policy checks** — is this user allowed to ask this? Rate limits.

**Output validation (after the model):**
- **Format checks** — does the JSON parse and match the schema? Is a required field present?
- **Safety checks** — run the answer through a toxicity/PII/safety classifier.
- **Grounding/relevance checks** — is it on-topic, and (for RAG) is it actually supported by the retrieved sources?
- **Sink-specific checks** — sanitize before rendering/executing (see [insecure output handling](insecure-output-handling.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 input</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ input gate<span class="sub">length • injection • PII • policy</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ output gate<span class="sub">schema • safety • grounding</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ use it</span>
  </div>
  <div class="dcap">Two gates: nothing untrusted reaches the model unchecked, nothing unchecked reaches the user.</div>
</div>

A gate can **block** (refuse), **fix** (redact PII, re-ask for valid JSON), or **flag** (allow but log for review). Fast, cheap checks (regex, length) run first; expensive ones (a classifier model) only if needed.

## Concrete example

A minimal two-gate wrapper — cheap input checks, a schema check on output, with a retry:

```python
import re, json
from pydantic import BaseModel, ValidationError

class Answer(BaseModel):
    reply: str
    category: str

INJECTION = re.compile(r"ignore (all|previous) instructions|you are now|system prompt", re.I)

def guarded_call(user_text, llm):
    # INPUT GATE
    if len(user_text) > 4000:
        return "Message too long."
    if INJECTION.search(user_text):
        return "I can't help with that request."          # block

    for _ in range(2):                                     # OUTPUT GATE with one retry
        raw = llm(user_text)                               # your model call → JSON string
        try:
            ans = Answer.model_validate_json(raw)          # schema check
        except ValidationError:
            continue                                       # malformed → re-ask
        if ans.category not in {"billing", "technical", "account"}:
            return "I can only help with billing, technical, or account questions."
        return ans.reply
    return "Sorry, I couldn't process that."               # fail closed
```

Regex is a weak input check on its own — pair it with a real classifier ([Llama Guard](llama-guard.md)) for anything public-facing. The pattern is what matters: validate, and **fail closed** (deny) when a check can't pass.

## How a company uses this

**A Dubai retail bank's** support assistant runs a strict two-gate pipeline at ~20 requests/second. The input gate does length + language detection + a lightweight injection classifier (≈15 ms) and drops the request to a safe canned reply on a hit. The output gate validates the model's JSON against a schema, runs a PII scan so account numbers never render in the transcript, and checks that any factual claim cites a retrieved KB article — if not, it returns "let me connect you to an agent." Cheap checks run inline; the heavier classifier is skipped when the fast checks already pass, keeping p95 latency under budget. Crucially they **fail closed**: if a validator errors, the request is denied, never silently passed through. That posture is what let compliance sign off.

## Common mistakes

- **Only validating input.** The dangerous content is usually in the *output* — always check both.
- **Failing open.** If a validator throws, defaulting to "allow" hands attackers a bypass. Deny on error.
- **Relying on regex alone.** Attackers rephrase; combine cheap heuristics with a real classifier.
- **Leaking the block reason**, which teaches attackers what tripped it. Return a generic message.
- **Forgetting sink-specific validation** (escape/sanitize before rendering or executing).

## Interview tip
Say: *"Every LLM feature I build has two gates. Before the model: length, allowed topics, injection/PII checks. After it: schema validation, a safety classifier, and — for RAG — a grounding check. Cheap checks first, expensive ones only if needed, and I always fail closed."* The phrase "fail closed" plus "two gates" is the exact vocabulary that signals production experience.
