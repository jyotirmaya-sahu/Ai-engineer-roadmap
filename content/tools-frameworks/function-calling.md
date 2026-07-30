# Function calling

**What it is:** the mechanism where an LLM, instead of answering in prose, emits a *structured request to run one of your functions* — and your code runs it and hands the result back.

## Why it matters for an AI Engineer

Function calling is the single most important primitive in applied GenAI. Every "agent," every tool, every plug-in is this one loop underneath. It's how a language model that can only produce text becomes software that can check inventory, book a meeting, or query a database. If you understand this round-trip cold, agents stop being magic — they're just this loop, repeated. Nearly every 2026 AI Engineer interview probes it.

## The mechanism — how the round-trip actually works

The model does **not** run your code. It only *asks* to. The round-trip has five steps:

1. **You describe your tools** to the model (name, what they do, what arguments they take — see [tool schemas](tool-schemas.md)).
2. **The model reads the user's request** and decides a tool is needed. Instead of text, it returns a structured `tool_call`: the function name plus JSON arguments it invented from the conversation.
3. **Your code parses that call and actually runs the function** — the model never touches your API keys or database.
4. **You append the result** back into the message list as a `tool` message.
5. **You call the model again.** Now it sees the result and writes the final natural-language answer. If it needs another tool, it asks again — that's the *agent loop*.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 "Weather in Dubai?"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 LLM: "call get_weather{city:'Dubai'}"</span>
    <span class="darr">↓<span class="lbl">your code runs it</span></span>
    <span class="dbox orange">🔧 get_weather("Dubai") → 41°C</span>
    <span class="darr">↓<span class="lbl">append as tool result</span></span>
    <span class="dbox purple">🤖 LLM (2nd call, now sees 41°C)</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ "It's 41°C and sunny in Dubai."</span>
  </div>
  <div class="dcap">The model asks twice: once to request the tool, once to answer with the result. The loop repeats if more tools are needed.</div>
</div>

## Concrete example (runnable, 2026-current)

```python
from openai import OpenAI
import json
client = OpenAI()

def get_weather(city):
    return {"city": city, "temp_c": 41, "sky": "sunny"}   # real code hits an API

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Current weather for a city.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

msgs = [{"role": "user", "content": "What's the weather in Dubai?"}]

# 1st call: model asks for the tool
r = client.chat.completions.create(model="gpt-5.4-mini", messages=msgs, tools=tools)
call = r.choices[0].message.tool_calls[0]
args = json.loads(call.function.arguments)          # {"city": "Dubai"}
result = get_weather(**args)                         # YOU run it

# feed the result back
msgs.append(r.choices[0].message)                    # the assistant's tool request
msgs.append({"role": "tool", "tool_call_id": call.id,
             "content": json.dumps(result)})

# 2nd call: model answers using the result
final = client.chat.completions.create(model="gpt-5.4-mini", messages=msgs, tools=tools)
print(final.choices[0].message.content)   # "It's 41°C and sunny in Dubai."
```

That's the entire mechanism. Wrap steps 1–2 in a `while` loop and you have an agent.

## How a company uses this — with the production lens

> **A Dubai fintech** support bot exposes `get_balance`, `list_transactions`, and `freeze_card`. At ~30 tool calls/second peak, they learned the hard lessons: (1) **the model can request tools in parallel** — one turn returned three `tool_calls`, so they run them concurrently and append all three results before re-calling, cutting latency from ~2.4s to ~0.9s. (2) **A tool can fail** — `get_balance` timed out; they feed `{"error": "timeout"}` back as the tool result rather than crashing, and the model gracefully says "I couldn't reach your account, try again." (3) **Cost** — each tool round-trip is a *fresh* LLM call billed on the full growing message history, so a 5-step agent can cost 5× a single reply. They cap steps and trim old tool results to control the bill.

## Common mistakes

- **Thinking the model runs your function.** It only emits the request; you execute it. Forgetting this leaks security assumptions.
- **Not feeding the result back.** After running the tool you *must* append it and call the model again — otherwise there's no final answer.
- **Ignoring parallel tool calls.** Modern models return a *list* of `tool_calls`. Handle all of them.
- **No error path.** When the tool throws, return an error object as the tool result; don't crash the loop.
- **Forgetting `tool_call_id`.** The result message must reference the exact call id, or the model can't match request to result.

## Interview tip
Draw the round-trip: model *requests*, your code *executes*, result *goes back*, model *answers*. Then add: "the model never runs my code — that's the security boundary — and everything an agent does is this loop with a step cap." That one sentence separates people who've built agents from people who've only read about them. See [tool schemas](tool-schemas.md) for how the model knows what to call.
