# ReAct

**What it is:** ReAct (Reason + Act) is a prompting pattern where the model alternates between *thinking* and *taking actions* (calling tools), using each tool's result to inform its next thought — it's the loop that turns an LLM into an agent.

## Why it matters for an AI Engineer
A plain LLM only knows its training data and can't *do* anything — it can't check today's price, query your database, or run code. ReAct is the pattern that closes that gap: the model reasons about what it needs, calls a tool to get it, observes the result, and reasons again. Almost every "agent" you'll build is ReAct under the hood (LangChain agents, OpenAI/Anthropic tool-use loops). Understanding it is the bridge from "chatbot" to "system that gets real work done," which is exactly the AI Engineer job.

## The mechanism
ReAct structures each step as three parts:

- **Thought**: the model reasons about the current state ("I need the user's account balance").
- **Action**: it emits a tool call in a fixed format (`get_balance(user_id="123")`).
- **Observation**: your code runs the tool and feeds the result back into the context.

Then it loops: Thought → Action → Observation → Thought → … until the model decides it has enough and emits a **final answer** instead of another action. It's [Chain-of-Thought](./chain-of-thought.md) interleaved with real actions — reasoning grounds the tool choice, and tool results ground the next reasoning, breaking the model's tendency to hallucinate facts it could just *look up*.

In 2026 you rarely hand-format ReAct text. Models expose native **tool/function calling**: you describe tools as JSON schemas, the model returns a structured tool call, you execute it and return the result as a `tool` message, and it continues. The *pattern* is identical — reason, act, observe, repeat — but the plumbing is a clean API loop, not string parsing.

## Concrete example
```python
from openai import OpenAI
client = OpenAI()

def get_weather(city):  # your real tool
    return {"dubai": "42°C, sunny"}.get(city.lower(), "unknown")

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Current weather for a city",
        "parameters": {"type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"]},
    }}]

msgs = [{"role": "user", "content": "Should I wear a jacket in Dubai right now?"}]
r = client.chat.completions.create(model="gpt-4o", messages=msgs, tools=tools)

call = r.choices[0].message.tool_calls[0]          # ACT: model asks for the tool
msgs.append(r.choices[0].message)
result = get_weather("Dubai")                        # OBSERVE: we run it
msgs.append({"role": "tool", "tool_call_id": call.id, "content": result})

final = client.chat.completions.create(model="gpt-4o", messages=msgs, tools=tools)
print(final.choices[0].message.content)
# -> "No — it's 42°C and sunny in Dubai, definitely no jacket."
```

The model *reasoned* it needed weather, *acted* by calling the tool, *observed* 42°C, then answered — grounded in a real fact, not a guess.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Thought</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔧 Action (tool)</span>
    <span class="darr">→</span>
    <span class="dbox blue">👁️ Observation</span>
    <span class="darr">→<span class="lbl">loop</span></span>
    <span class="dbox green">✅ Final answer</span>
  </div>
  <div class="dcap">Reason → act → observe, repeating until the model has enough to answer.</div>
</div>

## How a company uses this
A Dubai logistics company's ops assistant answers "where is shipment SH-4821 and will it be late?" It ReAct-loops: think → call `track_shipment` → observe location → think → call `get_traffic` → observe delay → answer. In production the killer detail is the **step cap**: without a max-iteration limit, a confused model can loop forever, burning tokens and latency. They cap at 6 tool calls, log every Thought/Action/Observation for debugging, and set a 20-second budget after which it returns a partial answer. Each tool call also adds ~1–2s latency, so they parallelize independent calls (track + traffic at once) to stay under SLA.

## Common mistakes
- **No loop limit.** A model that keeps calling tools with no `max_steps` cap is a runaway cost/latency bug. Always cap.
- **Vague tool descriptions.** The model picks tools from their descriptions; fuzzy descriptions → wrong tool. Write them like API docs.
- **Not returning errors as observations.** If a tool fails, feed the error back so the model can recover, don't crash.
- **Reinventing text-format ReAct.** Use native function calling; hand-parsed `Action:` strings are brittle and outdated.

## Interview tip
Say: *"ReAct is the reason-act-observe loop behind every agent — the model thinks, calls a tool, reads the result, and repeats until it can answer. In production I use native function calling, cap the loop steps, feed tool errors back as observations, and log every step for debugging."* That shows you understand agents as a *controlled loop*, not magic. See [prompt chaining & decomposition](./prompt-chaining-decomposition.md) for the non-tool cousin.
