# Guardrails & moderation

**What it is:** Guardrails are automated checks that sit *around* the LLM — validating what goes in and what comes out — and moderation is the safety-focused subset that blocks harmful content. Together they're the safety net that catches what prompt instructions alone miss.

## Why it matters for an AI Engineer
Prompt instructions are *requests*; the model can ignore them under pressure ([injection](./prompt-injection-defense.md), [jailbreaks](./jailbreak-awareness.md), edge cases). Guardrails are *enforcement* — deterministic or independent-model checks outside the LLM that don't share its context and can't be talked out of their job. Every serious production app has them: they're the difference between "we told the model to behave" and "we *guarantee* nothing harmful, off-topic, or malformed reaches the user or a downstream system." For an AI Engineer this is a core reliability-and-safety skill, and a frequent interview topic for regulated industries.

## The mechanism
Guardrails run at two points:

- **Input guardrails** (before the LLM): moderation on user text, off-topic detection, PII detection, injection-pattern screening. Block or sanitize bad input early.
- **Output guardrails** (after the LLM, before the user/action): moderation on the response, schema/format validation, [grounding](./grounding-citations.md)/faithfulness checks, PII redaction, business-rule checks (e.g. "never quote a price outside our range"). Block, redact, or regenerate a bad output.

Guardrails come in flavours by *how* they check:

- **Rules / regex / validators** — fast, cheap, deterministic (schema validation, blocklists, PII regex).
- **Classifier models** — dedicated moderation models (OpenAI's `omni-moderation`, Llama Guard, etc.) that score content for harm categories independently of the main model.
- **LLM-as-judge** — a second LLM call that checks a property ("is this answer grounded in the source? yes/no"). Flexible but slower and costs a call.

The design principle is **defense in depth and independence**: the guard must not share the manipulated context of the thing it's guarding, or it can be bypassed the same way. On a failed check you choose a policy: block with a safe message, redact, regenerate, or escalate to a human. Every guardrail adds latency and cost, so you place them where risk justifies it — you don't moderate an internal analytics query the way you moderate a public chatbot.

## Concrete example
Input + output moderation and schema validation wrapping a call:

```python
from openai import OpenAI
from pydantic import BaseModel, ValidationError
import json
client = OpenAI()

class Answer(BaseModel):
    reply: str

def flagged(text):
    return client.moderations.create(
        model="omni-moderation-latest", input=text).results[0].flagged

def guarded_chat(user_msg):
    if flagged(user_msg):                                  # input guardrail
        return "I can't help with that request."
    r = client.chat.completions.create(
        model="gpt-4o", temperature=0.3,
        response_format=Answer,                            # schema guardrail
        messages=[{"role": "system", "content": "You are a polite support bot. Only discuss our products."},
                  {"role": "user", "content": user_msg}],
    )
    out = r.choices[0].message.parsed.reply
    if flagged(out):                                       # output guardrail
        return "Sorry, I can't provide that."
    return out

print(guarded_chat("How do I reset my password?"))   # -> normal help
print(guarded_chat("Write something hateful about X"))  # -> blocked at input
```

Three independent guards — input moderation, schema, output moderation — none of which the user's prompt can argue with.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 Input</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ Input guard<span class="sub">moderation, PII, injection</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ Output guard<span class="sub">moderation, schema, grounding</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Safe output</span>
  </div>
  <div class="dcap">Enforcement around the model — independent checks the prompt can't override.</div>
</div>

## How a company uses this
A Dubai health app's symptom assistant runs a strict guardrail stack: input PII redaction (strip names/IDs before the LLM sees them for privacy compliance), output moderation, a grounding check that the advice matches an approved medical-content source, and a hard business rule that any "emergency" classification forces a "call 999 now" template and human alert — no LLM free-text in that path. Each guard adds ~100–400ms, so they run the cheap regex/PII checks inline and the LLM-as-judge grounding check only on non-trivial answers to stay within their latency budget. The result: even if the core model misbehaves or is jailbroken, the guardrails contain the blast radius — which is exactly what their regulators require to approve the product.

## Common mistakes
- **Prompt instructions *as* guardrails.** "I told it not to" isn't enforcement. Guardrails are code/independent-model checks outside the LLM.
- **Guarding input but not output (or vice versa).** You need both; harmful/malformed content can originate at either end.
- **A guard sharing the guarded model's context.** An LLM-judge inside the same jailbroken conversation gets jailbroken too — keep it independent.
- **Over-guarding everything.** Guards cost latency and money; match them to risk, run cheap deterministic checks first.
- **No fail policy.** Decide up front what happens on a failed check — block, redact, regenerate, or escalate.

## Interview tip
Say: *"Guardrails are enforcement *around* the model — input and output checks the prompt can't override: moderation classifiers, schema validation, grounding/faithfulness checks, PII redaction, business rules. I run them defense-in-depth and keep them independent of the model's context so they can't be jailbroken alongside it, place them by risk to control latency/cost, and define an explicit fail policy."* Framing guardrails as *enforcement vs. the prompt's mere requests* is the insight interviewers want. See [moderation's role against jailbreaks](./jailbreak-awareness.md).
