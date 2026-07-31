# Stop sequences

**The one-line idea:** a list of strings you pass to the API that act as content-triggered kill switches — the moment the model's output is about to contain one of them, generation halts immediately and the stop string itself is not included in what you get back.

> **Coming from max tokens.** The previous tile taught you that `max_tokens` stops generation by *count* — it doesn't care what the model is saying, it just halts after N tokens. Stop sequences are the complementary tool: they stop by *content* — you name a specific string, and the instant the model would produce it, the loop ends. A well-tuned production call uses both: stop sequences for clean, semantically correct stopping points, and `max_tokens` as the hard backstop in case the marker never appears.

## Why it matters for an AI Engineer

Without stop sequences a language model will keep generating until it either runs out of things to say, hits `max_tokens`, or produces a natural end-of-turn token — and "runs out of things to say" is surprisingly rare. In practice, models trained on dialogues will continue a conversation by *inventing the other side*. Ask for an agent reply, and the model keeps going: it writes the customer's follow-up question, then answers *that*, then invents another customer line, and so on.

Stop sequences are how you prevent this. They are cheap (you're paying *fewer* output tokens, not more), they're exact (the boundary is defined by the marker you choose), and they're the standard solution for three of the most common real-world needs:

1. **Chat-turn boundaries** — stop before the model hallucinates the next speaker
2. **Structured output** — stop after a closing tag so no trailing prose leaks into your parser
3. **Few-shot prompting** — stop after the answer so the model doesn't invent the next example

## The mechanism / how it works

You pass a `stop` parameter — a list of strings (OpenAI allows up to 4; Anthropic's `stop_sequences` is similarly capped). The API wraps the token loop with a string-watcher: after every token is appended to the running output, the watcher checks whether the accumulated text ends with any of your stop strings. The moment it matches, **the model is halted before emitting that string**, and the response is returned as-is.

Two things to lock in:

1. **The stop string is never in the output.** If you stop on `"\n\nCustomer:"`, you receive everything *before* it. If you need the marker in your final text, append it yourself after the call.
2. **`finish_reason` tells you what stopped.** When generation ends because a stop sequence fired, `finish_reason` is `"stop"` (same as a natural end-of-turn). On Anthropic's API, the `stop_sequence` field on the response tells you *which* string triggered it. On OpenAI you infer it by comparing the output against your list.

The third possible `finish_reason` is `"length"` (max_tokens fired — see **[max tokens](max-tokens.md)**). Checking this is important: if your stop marker never appears and the model runs all the way to the token limit, you get a `"length"` finish, not `"stop"`, and you know the output may be incomplete.

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">token-by-token generation loop</span>
    <div class="flow">
      <span class="dbox gray">📝 Prompt<span class="sub">ends with "Agent:"</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">🧠 Model<span class="sub">generates tokens…</span></span>
      <span class="darr">→<span class="lbl">each token</span></span>
      <span class="dbox orange">👁️ String watcher<span class="sub">accumulated text so far</span></span>
    </div>
    <div class="flow">
      <span class="dbox orange">👁️ matches "\n\nCustomer:"?</span>
      <span class="darr">→<span class="lbl">YES — halt, strip marker</span></span>
      <span class="dbox green">✅ return text<span class="sub">finish_reason: "stop"</span></span>
    </div>
    <div class="flow">
      <span class="dbox orange">👁️ matches "\n\nCustomer:"?</span>
      <span class="darr">→<span class="lbl">NO — continue</span></span>
      <span class="dbox purple">🧠 predict next token…</span>
    </div>
  </div>
  <div class="dcap">The watcher runs after every token. The first match ends the loop; the marker is stripped before returning.</div>
</div>

## Connecting back to what you already know

You learned in **Working with LLM APIs** that every `create()` call works by sending a `messages` array with `role` and `content`. The model is trained to continue a *conversation*, so if your prompt ends with `"Agent:"`, it knows its job is to write the agent's turn — but it also knows that in a real dialogue, a customer line follows. Without a stop sequence, it will faithfully continue the pattern it was trained on.

Stop sequences give you a surgical cut: you let the model generate the agent turn, then the moment it starts the pattern that would begin the next customer line, you pull the plug. The model never "sees" it was stopped — from its perspective, you just chose not to ask for more.

## Concrete example

```python
from openai import OpenAI

client = OpenAI()

# HelpDesk scenario: templated prompt ends at "Agent:" — we want exactly one agent turn.
prompt = (
    "You are a helpful support agent. Answer in 2–3 sentences.\n\n"
    "Customer: My order hasn't arrived — it's been 10 days.\n"
    "Agent:"
)

r = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": prompt}],
    stop=["\n\nCustomer:"],   # halt the instant the model starts the next customer line
    max_tokens=200,           # backstop: stop even if the marker never fires
)

reply = r.choices[0].message.content
finish = r.choices[0].finish_reason

print(repr(reply))
# → "I'm sorry to hear that! Let me check on your order right away. Could you share..."
# → Note: no "\n\nCustomer:" line. The marker fired, was stripped, generation stopped.

print(finish)
# → "stop"  ← good: the marker fired cleanly
# → "length" would mean the marker never appeared and max_tokens kicked in instead
```

Two things to notice:
- The reply contains only the agent's turn. The model didn't invent the customer's next message.
- We pair `stop` with `max_tokens=200`. If for some reason the model produces 200 tokens without ever generating `"\n\nCustomer:"`, we still stop — and `finish_reason == "length"` signals something unexpected happened.

## Stopping on structured output markers

The same pattern works for any structured format. Say you ask the model to emit JSON wrapped in `<json>` tags:

```python
r = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content":
        "Extract the order ID from this message as JSON.\n\n"
        "Message: My order #A1234 hasn't arrived.\n\n"
        "<json>"}],
    stop=["</json>"],   # stop after the closing tag — no trailing commentary
    max_tokens=100,
)
# output: {"order_id": "A1234"}
# NOT: {"order_id": "A1234"}\n</json>\nNote: I extracted the order ID above...
```

Without the stop sequence, the model often appends a helpful sentence after the closing tag — which breaks any downstream JSON parser. With it, you get exactly the structured block you asked for.

## How a company uses this — HelpDesk

This is the exact setup the node overview described for HelpDesk. The production support bot uses a templated prompt that ends with `"Agent:"` and sets `stop=["\n\nCustomer:"]`. Without it, the model would write the agent reply, then invent the customer's next complaint, then answer *that* — shipping a fabricated conversation to a real user. With it, generation ends cleanly after the agent's turn, every time.

A second stop sequence is added for the edge case where the model tries to invent another agent line: `stop=["\n\nCustomer:", "\n\nAgent:"]`. Two entries, both covering the next-speaker pattern, `max_tokens=300` as the hard floor. That's the complete stopping strategy for a chat application — two semantically meaningful markers plus one numeric backstop.

At scale this also saves money. If the model would have generated 180 tokens of hallucinated conversation before hitting `max_tokens`, and you process 100,000 messages per day, the stop sequence eliminates those wasted tokens entirely — the equivalent of cutting output length by 30–50% on hallucination-prone prompts.

## Choosing good stop markers

The marker must be distinctive — something that won't appear naturally mid-answer. Rules of thumb:

| Pattern | Good or risky? |
|---|---|
| `"\n\nCustomer:"` | Good — the double newline + label is a structural delimiter |
| `"</json>"` | Good — won't appear in JSON values |
| `"."` | Risky — stops after the first sentence every time |
| `" the"` | Risky — appears in almost every English sentence |
| `"\n\n"` | Context-dependent — fine for single-paragraph answers, breaks multi-paragraph ones |

For few-shot prompting (where you show the model examples and want only the answer to the final one), the stop string is usually the prefix of the *next* example: `"Q:"` or `"Example 3:"`.

## Common mistakes / misconceptions

- **Expecting the stop string in the output.** It's stripped — if your downstream code needs it, append it yourself after the API call.
- **Forgetting whitespace is literal.** `"Customer:"` and `"\n\nCustomer:"` and `" Customer:"` are three different strings. Match the exact whitespace the model produces.
- **Using a marker that appears mid-answer.** This truncates at the first accidental match. Test your marker against real model output before deploying.
- **Relying on stop sequences without a `max_tokens` backstop.** If the model never produces the marker (because the prompt didn't lead it there), generation runs to the token limit. Always pair the two.
- **Too many sequences.** APIs typically cap the list at 4. Keep it tight; overlapping markers can confuse which one fired.

## Interview tip

Say: *"Stop sequences are strings that end generation the moment the model would produce them — the marker is excluded from the output, and `finish_reason` tells me it was a stop-sequence halt versus a max_tokens cutoff. I use them for chat-turn boundaries — stopping on the next speaker's label so the model can't hallucinate the other side of the conversation — and for structured output, stopping on a closing tag to prevent trailing commentary from breaking my parser. I always back them with a `max_tokens` ceiling in case the marker never fires."* The hallucination-prevention framing shows you understand the real production motivation, not just the mechanics.

---

*You can now stop generation precisely — by count with `max_tokens`, by content with stop sequences. The next tile, **[Seed](seed.md)**, adds the third control: fixing the randomness itself so the same call produces the same output every time, which is what makes evaluation and testing reliable.*
