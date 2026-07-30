# Messages & roles

**What it is:** Every modern chat-LLM request is a *list of messages*, and each message carries a **role** that tells the model who is speaking. That list — not a single prompt string — is the actual unit you send to the API.

## Why it matters for an AI Engineer

The old "completion" style ("here's a string, finish it") is gone. Every current API — OpenAI, Anthropic, Google, and open-model servers that copy their format — is *chat-shaped*: you hand it an array of `{role, content}` objects and it appends one more message (the assistant's reply). Understanding this is non-negotiable because **the message list is where conversation memory, system instructions, tool results, and multimodal content all live.** Get the shape wrong and you get 400 errors, ignored instructions, or a model that "forgets" the conversation. Multi-turn chat, agents, and RAG all work by *appending to and re-sending this list.*

## The mechanism — how it works

A request body looks like this: an array where each element has a `role` and `content`.

- **`system`** — standing instructions and persona. Set once, sets the rules. (OpenAI puts it in the array; Anthropic passes it as a top-level `system` parameter.)
- **`user`** — a human turn. What the person typed.
- **`assistant`** — a model turn. Either replies you got back, or ones you *inject* to fake a partial answer ("prefill").
- **`tool` / `tool_result`** — the output of a function the model asked you to call, fed back in.

The critical fact: **the API is stateless.** The provider does not remember your last call. "Memory" is an illusion you create by *keeping the running list yourself and resending the whole thing every turn.* Turn 5 sends messages 1–9. That's why long conversations cost more (you resend everything) and eventually overflow the context window.

Roles alternate `user` → `assistant` → `user` → `assistant`. The model is trained on this pattern; violating it (two user messages in a row, or ending on an assistant message when you want a reply) causes confusion or errors depending on the provider.

<div class="diagram">
  <div class="dstack">
    <span class="dbox purple">🧠 system<span class="sub">"You are a support agent."</span></span>
    <span class="dbox gray">🙂 user<span class="sub">"My order is late."</span></span>
    <span class="dbox green">🤖 assistant<span class="sub">"Sorry! What's your order #?"</span></span>
    <span class="dbox gray">🙂 user<span class="sub">"#4471"</span></span>
    <span class="dbox orange">⬅ model appends the next assistant message</span>
  </div>
  <div class="dcap">A request is the whole ordered list. The model reads it and writes the next assistant turn.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

messages = [
    {"role": "system", "content": "You are a terse assistant. Answer in one sentence."},
    {"role": "user", "content": "What is the capital of the UAE?"},
]
resp = client.chat.completions.create(model="gpt-4.1", messages=messages)
reply = resp.choices[0].message

print(reply.content)  # "The capital of the UAE is Abu Dhabi."

# To continue the conversation, APPEND and resend the whole list:
messages.append({"role": reply.role, "content": reply.content})
messages.append({"role": "user", "content": "And its population?"})
resp2 = client.chat.completions.create(model="gpt-4.1", messages=messages)
print(resp2.choices[0].message.content)
```

Note how turn two resends turn one. That is the entire mechanism of "conversation."

## How a company uses this

A Dubai fintech's support bot keeps a per-session `messages` array in Redis. Each incoming user text appends a `user` message; the model's reply appends an `assistant` message; the whole array is resent to the API. **Production reality:** they cap the stored history at ~20 turns and summarize older turns into a single system note, because resending a 40-turn history means paying to re-read ~15k tokens *on every single reply* — at 2,000 concurrent chats that cost balloons fast, and eventually the list exceeds the model's context window and the API rejects it. Managing this list *is* the app.

## Common mistakes

- **Assuming the API remembers.** It doesn't — you must resend history every call.
- **Forgetting to append the assistant's reply** before the next user turn, so the model loses its own last answer.
- **Two `user` messages in a row** or non-alternating roles — errors on Anthropic, degraded quality on OpenAI.
- **Stuffing system instructions into a `user` message.** They're weaker there; use the proper role (see [System / user / assistant](system-user-assistant.md)).

## Interview tip
Say: *"LLM chat APIs are stateless — the request is an ordered list of role-tagged messages, and 'conversation memory' is just me keeping that list and resending it each turn. That's also why cost grows with conversation length and why I truncate or summarize old turns."* It shows you understand the API's real shape, not just the SDK sugar.
