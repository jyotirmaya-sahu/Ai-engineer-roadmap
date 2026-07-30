# Agent Loop

**What it is:** The core cycle of an agent — the LLM *thinks*, *acts* by calling a tool, *observes* the tool's result, and *repeats* — until the task is done.

## Why it matters for an AI Engineer

A plain LLM call answers once and stops. That's fine for "summarise this" but useless for "find the cheapest flight and book it," because the model doesn't know the prices until it searches. The agent loop is the mechanism that lets an LLM *interact with the real world across multiple steps* and adjust based on what it learns. Nearly every agent framework (LangGraph, CrewAI, the OpenAI Agents SDK) is, underneath, an implementation of this one loop. If you understand the loop, you understand agents — and you understand where they break (loops that never stop, loops with no memory, loops that hallucinate a tool result instead of calling the tool).

## The mechanism: how it works

The loop has four moving parts running in a cycle:

1. **Think** — the LLM receives the goal plus everything that's happened so far (the conversation and prior tool results) and decides the next action. It either picks a tool to call *or* declares the task finished.
2. **Act** — your code executes the tool the model asked for (an API call, a search, running code). The LLM never runs anything itself; it only emits a structured request. *Your* runtime does the acting.
3. **Observe** — the tool returns a real result. You append that result back into the model's context so the next "think" step can see it.
4. **Repeat** — feed the updated context back to the LLM and loop. The cycle ends when the model outputs a final answer instead of a tool call, or when you hit a safety limit (max steps, max spend, timeout).

The critical insight: **the LLM is the brain, your code is the hands and the referee.** The model decides *what* to do; your loop actually does it, records the result, and enforces stopping conditions. Without a stopping condition, the loop is an infinite-cost bug.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🧑 Goal + history</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 LLM: think → choose tool or finish</span>
    <span class="darr">↓<span class="lbl">tool call</span></span>
    <span class="dbox orange">🔧 Runtime executes tool</span>
    <span class="darr">↓</span>
    <span class="dbox blue">👀 Append observation to context</span>
    <span class="darr">↓<span class="lbl">loop back to think</span></span>
    <span class="dbox green">✅ Final answer (or hit step cap)</span>
  </div>
  <div class="dcap">The LLM only decides; your runtime executes tools, records results, and enforces stopping conditions.</div>
</div>

## Concrete example

A minimal loop with the 2026 OpenAI SDK, one tool, and a hard step cap:

```python
from openai import OpenAI
import json

client = OpenAI()

def get_weather(city):
    return f"{city}: 41C, sunny"  # pretend API

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Current weather for a city",
        "parameters": {"type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"]},
    },
}]

messages = [{"role": "user", "content": "What's the weather in Dubai?"}]

for step in range(5):  # step cap = stopping condition
    resp = client.chat.completions.create(
        model="gpt-4.1", messages=messages, tools=tools)
    msg = resp.choices[0].message
    messages.append(msg)

    if not msg.tool_calls:        # model finished
        print(msg.content); break

    for call in msg.tool_calls:   # ACT + OBSERVE
        args = json.loads(call.function.arguments)
        result = get_weather(**args)
        messages.append({"role": "tool",
            "tool_call_id": call.id, "content": result})
```

Turn 1 the model requests `get_weather("Dubai")`; we run it and append the result; turn 2 the model reads "41C, sunny" and writes the final answer. The `range(5)` is the referee — without it, a confused model could loop forever.

## How a company uses this

A customer-support agent at a Dubai fintech runs this loop per ticket. In production the numbers matter: they cap it at **8 steps** and a **$0.05 per-ticket budget**, because a loop with no cap once retried a failing payment API 200 times overnight and cost four figures. They log every think/act/observe triple to a trace store so support engineers can replay exactly why the agent did what it did. Median ticket resolves in **3 loop iterations (~4s)**; anything hitting the step cap is auto-escalated to a human. The loop is cheap to write and expensive to run unsupervised — the caps *are* the product.

## Common mistakes

- **No stopping condition.** The single most common (and most expensive) bug. Always cap steps, spend, and wall-clock time.
- **Trusting the model to "run" the tool.** The LLM only emits a request; if you forget to actually execute it and append the result, the model hallucinates a fake result.
- **Not appending the observation.** If the tool result never re-enters context, the next think step is blind and loops.
- **Confusing one big prompt with a loop.** Chaining text in one call isn't an agent — there's no observe-and-decide step.

## Interview tip
Say: *"The agent loop is think → act → observe → repeat. The LLM decides the action; my runtime executes the tool, feeds the real result back, and enforces stopping conditions — step caps, spend caps, timeouts. The model is the brain, my code is the hands and the referee."* Then mention that most agent incidents are missing stopping conditions — that lands as production experience.

See also: [ReAct](react.md) (the prompting pattern that structures the "think"), [State management](state-management.md) (how the history is carried through the loop).
