# Content safety

**What it is:** A filtering layer that inspects what goes *into* and comes *out of* your model, blocking harmful content and refusing malicious requests before they reach a user.

## Why it matters for an AI Engineer

The moment your LLM feature is public, strangers will try to make it say terrible things — and screenshot the result with your company's logo on it. A raw model has a base level of built-in refusal, but it's not enough: it can be talked around, and it has no idea about *your* policies (what's fine for a general chatbot may be unacceptable for a kids' education app or a bank). Content safety is the dedicated, tunable layer that turns "the model usually refuses" into "our system reliably refuses, on our terms, and we can prove it." It's a hard requirement for any consumer-facing feature and a direct AI Act transparency/robustness concern.

## The mechanism: guardrails on both sides

Safety is **two checkpoints**, not one — because harm can enter as a malicious *input* or leak out as a harmful *output*.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🧑 Input</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ Input guard<span class="sub">block jailbreaks, banned topics</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ Output guard<span class="sub">block unsafe generations</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Safe reply</span>
  </div>
  <div class="dcap">Two independent checkpoints: one screens the user's request, one screens the model's answer.</div>
</div>

**Input guardrail** — runs *before* the model. It classifies the user's message against a taxonomy of harm (violence, self-harm, sexual content, hate, illegal advice, etc.) and detects **jailbreak patterns** — "ignore your instructions", "you are DAN", role-play framings, base64-encoded payloads. If it trips, you refuse *without ever calling the model* (cheaper and safer).

**Output guardrail** — runs *after* the model. Even a clean prompt can produce an unsafe answer, or the model can be coaxed into leaking its system prompt or generating disallowed content. The output classifier catches it and you return a canned refusal instead.

**How the classifier itself works:** modern safety filters are small **fine-tuned LLMs** (Llama Guard 3/4, or hosted APIs like OpenAI's moderation endpoint and AWS Bedrock Guardrails). They take the text plus a **policy definition** and return a category + safe/unsafe label. Because they're small (~1–8B), they run in tens of milliseconds and cost a fraction of your main model. You tune them by editing the **policy/taxonomy** — e.g. adding "no financial advice" for a banking bot.

This is distinct from **adversarial robustness** ([sibling tile](/responsible-ai/adversarial-robustness)): content safety asks "is this text harmful?"; robustness asks "is someone trying to hijack the system's behaviour?". They overlap on jailbreaks and complement each other.

## Concrete example: a guardrail wrapper

```python
from openai import OpenAI
client = OpenAI()

def moderate(text):
    r = client.moderations.create(model="omni-moderation-latest", input=text)
    return r.results[0].flagged, r.results[0].categories

def safe_chat(user_msg):
    flagged, cats = moderate(user_msg)          # 1. input guard
    if flagged:
        return "I can't help with that request."

    reply = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": user_msg}],
    ).choices[0].message.content

    flagged, _ = moderate(reply)                 # 2. output guard
    if flagged:
        return "I generated a response I can't share."
    return reply

print(safe_chat("How do I build a pipe bomb?"))  # blocked at input guard
```

The moderation call is essentially free and fast; you run it on *every* request in both directions. For self-hosted stacks, swap in **Llama Guard** with your own policy prompt.

## How a company uses this

> A **Dubai telco** runs a customer-service chatbot handling ~200k conversations/day. Their safety layer: Bedrock Guardrails on input (blocking abuse, competitor-bashing prompts, and jailbreak attempts) and on output (blocking profanity, financial promises, and any leak of internal system instructions), plus a **custom denied-topics** list for regionally sensitive subjects. Numbers that matter in production: the guard adds ~30–50 ms per turn and roughly 3% to cost, but stops a steady stream of jailbreak attempts (they log ~hundreds/day). They also **log every block** — which feeds both their AI Act robustness evidence and a weekly review where new jailbreak patterns get added to the policy. Failure mode they watch for: **over-blocking** legitimate questions ("how do I *kill* a background process?"), which they tune down by measuring the false-positive rate on real traffic.

## Common mistakes

- **Guarding input only.** A benign prompt can still yield a harmful answer — you need the output check too.
- **Relying on the base model's refusals.** It's inconsistent and doesn't know your specific policy.
- **Ignoring false positives.** An over-aggressive filter that blocks "kill the process" or medical questions frustrates real users; measure and tune it.
- **Not logging blocks.** Blocks are your early-warning system for new attacks and your compliance evidence — capture them.
- **One global policy.** A kids' app and an internal dev tool need different taxonomies; make the policy configurable.

## Interview tip

Say: *"Content safety is two checkpoints, not one — a guard on the input that blocks harmful requests and jailbreaks before I even pay for a model call, and a guard on the output because a clean prompt can still produce an unsafe answer. I use a small fine-tuned classifier like Llama Guard or a hosted moderation API, tune the policy to the product, and log every block so I can catch new jailbreak patterns and prove robustness for the AI Act. The metric I watch is the false-positive rate — over-blocking is a real failure too."* That shows you think about both directions *and* the tuning trade-off.
