# Function / tool schemas

**What it is:** A way to tell the model "here are functions you're allowed to call, and here's each one's inputs." The model can then *request* a call — returning the function name and arguments as JSON — and you run the real code and feed the result back. This is the mechanism behind every agent.

## Why it matters for an AI Engineer

A raw LLM is frozen at its training cutoff and can't *do* anything — it can't check today's weather, query your database, book a flight, or run a calculation. Tool calling breaks that wall: it lets the model reach out to the live world through functions *you* control. This is the single most important primitive for building agents, and it's the difference between a chatbot and a system that takes actions. If you can define tool schemas, handle the model's tool-call requests, and loop results back, you can build the entire [Tools & Frameworks](../tools-frameworks/function-calling.md) layer of the roadmap. Interviewers treat this as the core competency for "can you build an agent?"

## The mechanism — how it works

The full loop, step by step:

1. **You declare tools.** Each tool has a `name`, a `description` (this is a prompt — the model reads it to decide *when* to use the tool), and a **JSON Schema** for its `parameters`.
2. **You send tools with the messages.** The model, seeing the user's request plus the tool list, decides whether calling a tool helps.
3. **The model returns a tool call**, not prose: `{"name": "get_weather", "arguments": {"city": "Dubai"}}`. It does *not* run the function — it just asks you to.
4. **You execute the function** in your own code with those arguments.
5. **You append the result** as a `tool` message and resend. The model reads the result and produces a final natural-language answer (or another tool call).

The model can call **multiple tools in parallel**, or none. The schema is doing double duty: the `description` fields *teach* the model, and the parameter schema *constrains* the arguments (same constrained-decoding idea as [JSON mode](json-mode.md)).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🙂 "Weather in Dubai?"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 model + tool schema</span>
    <span class="darr">↓<span class="lbl">tool_call</span></span>
    <span class="dbox orange">get_weather(city="Dubai")</span>
    <span class="darr">↓<span class="lbl">you run it</span></span>
    <span class="dbox blue">🗄️ {"temp": 41, "sky": "clear"}</span>
    <span class="darr">↓<span class="lbl">tool_result back</span></span>
    <span class="dbox green">🤖 "It's 41°C and clear in Dubai."</span>
  </div>
  <div class="dcap">The model asks for a call; you execute it and feed the result back for a grounded final answer.</div>
</div>

## Concrete example

```python
from openai import OpenAI
import json
client = OpenAI()

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current weather for a city. Use when the user asks about weather.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "City name"}},
            "required": ["city"],
        },
    },
}]

def get_weather(city):                       # your real implementation
    return {"temp_c": 41, "sky": "clear"}    # (would call a weather API)

messages = [{"role": "user", "content": "What's the weather in Dubai?"}]
r = client.chat.completions.create(model="gpt-4.1", messages=messages, tools=tools)

call = r.choices[0].message.tool_calls[0]
args = json.loads(call.function.arguments)   # {"city": "Dubai"}
result = get_weather(**args)

messages += [
    r.choices[0].message,                                    # the assistant's tool-call turn
    {"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)},
]
final = client.chat.completions.create(model="gpt-4.1", messages=messages, tools=tools)
print(final.choices[0].message.content)      # "It's 41°C and clear in Dubai."
```

## How a company uses this

A Dubai bank's virtual assistant exposes tools like `get_balance(account_id)`, `list_transactions(account_id, days)`, and `block_card(card_id)`. **Production reality:** the tool `description` fields are carefully worded because they *are* the routing logic — a vague description made the model call `list_transactions` when users asked for their balance, so they tightened wording and added examples. For the dangerous `block_card` tool they added a human-confirmation step before executing, since a tool call is a *request*, not an authorization. At scale they also cap the tool loop (max N calls per turn) so a confused model can't spin forever and rack up token cost.

## Common mistakes

- **Vague tool descriptions.** The description *is* the prompt that decides when the tool fires — write it carefully.
- **Executing dangerous tools without confirmation.** A tool call is the model's *suggestion*; gate anything irreversible.
- **Forgetting to append both the assistant tool-call message and the tool result** before resending — the model loses the thread.
- **No loop limit**, letting the model call tools indefinitely and burn tokens.
- **Trusting arguments blindly** — validate them; the model can hallucinate an out-of-range value.

## Interview tip
Say: *"Tool calling is a request-response loop: I declare tools as JSON-schema functions with rich descriptions, the model returns a structured call, I execute it, feed the result back as a tool message, and it produces the grounded answer. The description is effectively the routing prompt, so I write it precisely, and I gate destructive tools behind confirmation and cap the loop to control cost."* That framing — description-as-prompt, confirmation gate, loop cap — signals production agent experience.
