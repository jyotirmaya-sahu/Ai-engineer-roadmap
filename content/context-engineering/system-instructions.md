# System Instructions

**The one-line idea:** the persistent block of rules, persona, and constraints you place at the very top of the context on *every* call — the model's standing orders, not a one-off request.

## Why it matters for an AI Engineer

System instructions are how you make a model behave *consistently*. A user message is a single question; the system prompt is the policy that governs how *all* questions get answered — tone, output format, safety rules, what tools it may use, what it must never say. In production this is where you encode "always answer in JSON," "you are a UAE banking assistant, never give tax advice," "cite your sources." Get it right and behavior is stable across thousands of users; get it wrong — or let it drift out of context on long sessions — and the model goes off-script in ways that are hard to debug. It's the cheapest, highest-leverage piece of context you own.

## The mechanism / how it works

Chat models take a list of messages, each with a **role**: `system`, `user`, `assistant` (and `tool`). The `system` message is special: it's placed first, the model is trained to weight it as authoritative, and it stays there on every turn while user/assistant messages come and go. Mechanically it's still just tokens in the same window — there's no separate "settings" channel — but the model's post-training teaches it to treat system-role text as the governing instruction and to prefer it when a user message conflicts.

Three properties matter in practice:

- **Persistence.** You re-send the system message on *every* API call (the API is stateless). If you forget to, or if a long conversation pushes it out when you trim history, the model loses its rules mid-session — a classic bug.
- **Priority.** System > user in the instruction hierarchy. This is your defense against prompt injection: "ignore previous instructions" in a user message should lose to a firm system rule (though it's not bulletproof — see mistakes).
- **Position.** Being at the top, it's the most reliably attended part of the window, which is exactly why durable rules go here and not in a user message.

<div class="diagram">
  <div class="dstack">
    <span class="dbox purple">🧠 system — rules, persona, format (pinned every turn)</span>
    <span class="dbox gray">👤 user — turn 1</span>
    <span class="dbox blue">🤖 assistant — turn 1</span>
    <span class="dbox gray">👤 user — turn 2 …</span>
  </div>
  <div class="dcap">The system message sits on top and is re-sent every call; conversation grows below it.</div>
</div>

## Concrete example

```python
# pip install openai  (2026 SDK)
from openai import OpenAI
client = OpenAI()

SYSTEM = """You are a support assistant for Emirates NBD.
Rules:
- Answer only banking questions; refuse anything else politely.
- Never give tax or legal advice.
- Respond in the user's language (English or Arabic).
- Always end with: 'Is there anything else I can help with?'"""

def reply(history: list[dict], user_msg: str) -> str:
    messages = [{"role": "system", "content": SYSTEM}, *history,
                {"role": "user", "content": user_msg}]  # system re-sent EVERY call
    r = client.chat.completions.create(model="gpt-4.1", messages=messages)
    return r.choices[0].message.content
```

The key line is that `SYSTEM` is prepended on every invocation, regardless of how long `history` grows.

## How a company uses this

A Dubai fintech runs one shared system prompt across its whole support product, version-controlled like code and A/B tested. It's long — a few hundred tokens of persona, compliance rules, and format spec — and it's *identical* on every request, which is why they wrap it in [prompt & KV caching](prompt-kv-caching.md): the provider caches the tokenized system prefix so they pay full price for it once, then ~10% on repeats. At their volume (millions of calls/month) that single optimization on the system block saved a five-figure monthly bill. When compliance changes a rule, they edit one string and every conversation inherits it — no retraining, instant rollout.

## Common mistakes / misconceptions

- **Assuming it's permanent.** The API is stateless. If your code doesn't re-send the system message, it's gone. If your history-trimming logic drops it, behavior collapses mid-chat.
- **Treating it as unbreakable security.** System priority is strong but not absolute — determined prompt injection can still leak through. Pair it with output filtering and untrusted-input isolation ([context isolation](context-isolation.md)).
- **Overstuffing it.** A 4,000-token system prompt eats budget every turn and buries the important rules. Keep it tight; move situational data to retrieval ([RAG & dynamic filters](rag-dynamic-filters.md)).
- **Putting durable rules in the user turn.** They'll scroll out of context and lose priority. Persona and policy belong in `system`.

## Interview tip

Say: *"The system prompt is my standing policy — persona, format, and safety rules — and because the API is stateless I re-send it every call and cache the prefix so it's nearly free. I keep it tight and version-controlled, and I rely on system-over-user priority as one layer of injection defense, not the only one."* Mentioning that you cache it and version it shows production maturity, not just prompt-writing.
