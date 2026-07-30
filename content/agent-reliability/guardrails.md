# Guardrails

**The one-line idea:** Guardrails are programmatic checks that sit *around* the agent — validating what goes in, what comes out, and which actions it's allowed to take — and block anything unsafe *before* it reaches the user or the outside world.

## Why it matters for an AI Engineer

The LLM is unpredictable; guardrails are the deterministic wall that makes an unpredictable component safe to deploy. A model might obey a prompt-injection buried in a document, leak a customer's phone number, produce toxic text, or decide to call a `delete_account` tool it should never touch. You can't fine-tune those risks to zero — so you wrap the agent in code that *checks and blocks*. This is the single most-requested skill for enterprise and finance AI roles in Dubai, because no bank ships an agent that can output PII or execute an arbitrary action. Guardrails are how "the model usually behaves" becomes "the system provably won't cross these lines."

## The mechanism — how it works

Guardrails run at three points in the agent loop:

- **Input guardrails** — inspect the user's message (or a retrieved document) *before* the LLM sees it. Catch prompt injection, off-topic requests, jailbreak patterns, or disallowed intents. If tripped, you short-circuit and refuse.
- **Output guardrails** — inspect the LLM's generated text *before* it reaches the user. Redact PII, block toxic/unsafe content, enforce a JSON schema, or check the answer is grounded in retrieved context (no hallucinated facts).
- **Action/tool guardrails** — inspect a *proposed tool call* before it executes. Is this tool allowed for this user? Are the arguments in range (refund ≤ AED 1000)? Is the target inside an allowlist? This is the most important layer for agents, because tools are where real damage happens.

Each guardrail is a **validator** — a function returning pass/fail, sometimes with a fixed-up value. Validators can be simple (regex for emails, an allowlist of tools) or model-based (a classifier like Llama Guard for safety, a small LLM judge for "is this on-topic"). On failure you choose a policy: **block** (refuse), **fix** (redact and continue), or **escalate** (hand to a human — see [human approval](human-approval.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 Input</span>
    <span class="darr">→<span class="lbl">input guard</span></span>
    <span class="dbox purple">🧠 LLM / agent</span>
    <span class="darr">→<span class="lbl">action guard</span></span>
    <span class="dbox orange">🔧 tool call</span>
    <span class="darr">→<span class="lbl">output guard</span></span>
    <span class="dbox green">✅ user</span>
  </div>
  <div class="dcap">Three checkpoints: validate input, validate proposed actions, validate output — block or fix on failure.</div>
</div>

## Concrete example

Using the Guardrails framework (2026) to enforce no-PII and a tool allowlist:

```python
from guardrails import Guard
from guardrails.hub import DetectPII, ToxicLanguage

# output guardrail: block/redact PII and toxic text before it reaches the user
guard = Guard().use_many(
    DetectPII(pii_entities=["EMAIL_ADDRESS", "PHONE_NUMBER"], on_fail="fix"),
    ToxicLanguage(threshold=0.5, on_fail="exception"),
)

raw = agent.generate(user_msg)
safe_output = guard.validate(raw).validated_output   # PII redacted, toxic -> raises

# action guardrail: hand-rolled allowlist + argument bounds (deterministic, un-bypassable)
ALLOWED = {"lookup_order", "issue_refund"}
def check_tool(call):
    if call.name not in ALLOWED:
        raise PermissionError(f"tool {call.name} not allowed")
    if call.name == "issue_refund" and call.args["amount"] > 1000:
        raise PermissionError("refund over AED 1000 needs human approval")
```

Model-based safety guards (Llama Guard, NeMo Guardrails) slot in the same way for nuanced content classification.

## How a company uses this

A **Dubai bank**'s customer agent must never expose another customer's data or issue an unauthorized transaction. They run **input guards** (block prompt-injection and account-number fishing), **output guards** (redact any PII not belonging to the authenticated user, verify every claim is grounded in the retrieved record), and **action guards** (tool allowlist per user role; transfers over a threshold blocked entirely). The action guard is deterministic code, *not* a prompt instruction — because "please don't do X" in a system prompt is a suggestion an attacker can override, while an allowlist in code cannot be talked around. This is what let the agent clear the bank's security review.

## Common mistakes / misconceptions

- **Relying on the system prompt as a guardrail.** "Never reveal PII" in the prompt is bypassable by injection. Real guardrails are code *outside* the model.
- **Only guarding output.** For agents, the *action* guard matters most — that's where money moves and data deletes.
- **Guards so strict they block valid traffic.** Over-tuned toxicity/PII filters create false positives; measure and tune the threshold.
- **Trusting retrieved documents.** A poisoned document can carry an injection; input guards must cover *retrieved* text, not just the user message.

## Interview tip
Say: *"Guardrails are deterministic checks around the model at three points: input (injection, off-topic), output (PII redaction, toxicity, grounding), and — most important for agents — proposed actions (tool allowlist, argument bounds). The key principle is they live in code outside the model, never in the system prompt, because a prompt instruction is bypassable and an allowlist is not. On failure I block, redact, or escalate to a human."* Stressing "code, not prompt" is the answer that lands.

See also: **[Human approval](human-approval.md)** (the escalate policy), **[Sandboxing & agent security](sandboxing-agent-security.md)** (containing what does slip through), and the **LLM Security & Guardrails** node (the threat models these defend against).
