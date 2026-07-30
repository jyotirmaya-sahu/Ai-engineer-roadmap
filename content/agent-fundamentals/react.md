# ReAct

**What it is:** ReAct ("Reason + Act") is the pattern where the agent writes down a short *reasoning* thought, then takes an *action*, then reads the *observation* — visibly interleaving thinking and doing at every step.

## Why it matters for an AI Engineer

ReAct is the default recipe for single-agent behaviour. It's what turned the [agent loop](agent-loop.md) from a vague idea into something that reliably works. The trick is simple but powerful: by forcing the model to *say why* before it acts, you get more accurate tool choices, fewer hallucinations, and — crucially — a readable trace you can debug. When an agent misbehaves in production, the ReAct "Thought:" lines are the first thing you read to see where its reasoning went wrong. Almost every framework's default agent is a ReAct agent.

## The mechanism: how it works

Pure "chain-of-thought" reasoning lets a model think, but it can't check its thinking against reality — so it confidently hallucinates facts. Pure action (just call tools) grounds the model in reality but gives it no space to plan. **ReAct interleaves the two**, so each thought is immediately grounded by an observation, and each action is guided by a fresh thought.

Each loop iteration produces a three-line trace:

- **Thought:** the model reasons about what it needs next ("I need the user's current balance before I can answer").
- **Action:** the model emits a tool call (`get_balance(user_id=42)`).
- **Observation:** your runtime runs the tool and feeds the real result back ("balance: 3,200 AED").

Then it loops: the next Thought uses that observation. This continues until a Thought concludes with a **Final Answer** instead of another Action. The reasoning being *explicit and in-context* is what makes ReAct work — the model literally reads its own prior reasoning on the next turn, which keeps it on track.

<div class="diagram">
  <div class="dstack">
    <span class="dbox purple">🧠 Thought: I need the balance first</span>
    <span class="dbox orange">🔧 Action: get_balance(42)</span>
    <span class="dbox blue">👀 Observation: 3,200 AED</span>
    <span class="dbox purple">🧠 Thought: enough to cover the fee — answer</span>
    <span class="dbox green">✅ Final Answer: Yes, you can pay it</span>
  </div>
  <div class="dcap">ReAct = a visible Thought → Action → Observation trace, repeated until a Final Answer.</div>
</div>

## Concrete example

Modern SDKs give you native tool-calling, so you rarely hand-write ReAct's text format any more — but you can still make the reasoning explicit and get its benefits:

```python
from openai import OpenAI
import json
client = OpenAI()

SYSTEM = ("You are a ReAct agent. Before each tool call, first state a one-"
          "sentence Thought explaining why. When you have enough info, give the "
          "Final Answer. Do not invent tool results.")

tools = [{"type": "function", "function": {
    "name": "get_balance",
    "description": "Account balance in AED for a user id",
    "parameters": {"type": "object",
        "properties": {"user_id": {"type": "integer"}},
        "required": ["user_id"]}}}]

def get_balance(user_id): return "3200"  # pretend API

messages = [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": "User 42 wants to pay a 500 AED fee — can they?"}]

for _ in range(6):
    r = client.chat.completions.create(model="gpt-4.1", messages=messages, tools=tools)
    m = r.choices[0].message; messages.append(m)
    if not m.tool_calls:
        print(m.content); break            # Final Answer
    for c in m.tool_calls:                  # Act + Observe
        out = get_balance(**json.loads(c.function.arguments))
        messages.append({"role": "tool", "tool_call_id": c.id, "content": out})
```

The system prompt's "state a Thought first" instruction is the ReAct part; the tool-call loop is the Act/Observe part.

## How a company uses this

A logistics company in Dubai runs a ReAct agent that answers "where's my shipment?" It reasons ("I need the tracking ID from the order"), calls the orders API, observes, then calls the courier API. In production the **Thought lines are logged as structured trace events** and are the #1 debugging tool: when the agent gave a wrong ETA, the trace showed the Thought "the order has two shipments, I'll use the first" — a reasoning bug, fixed with a prompt tweak, not a model change. They found ReAct-style explicit reasoning cut wrong tool calls by roughly a third versus letting the model call tools with no stated rationale, at the cost of ~15% more output tokens per step — a trade they gladly take for debuggability.

## Common mistakes

- **Letting the model hallucinate observations.** If you don't actually execute the action and feed back the real result, the model happily makes one up. Always ground the observation in a real tool call.
- **Over-verbose thoughts.** Multi-paragraph reasoning per step burns tokens and latency. One or two sentences is enough.
- **Hand-rolling the text format when native tool-calling exists.** In 2026, use the SDK's structured tool calls; keep the *explicit-reasoning* spirit via the system prompt.
- **No step cap.** ReAct is still a loop — it needs the same stopping conditions as any [agent loop](agent-loop.md).

## Interview tip
Say: *"ReAct interleaves reasoning and acting — Thought, Action, Observation, repeat. Pure reasoning hallucinates; pure acting can't plan; interleaving grounds each thought in a real observation. The explicit Thought trace is also my main debugging tool in production."* Mentioning the debuggability angle shows you've actually run one.

See also: [Reasoning + acting](reasoning-acting.md) (the theory of *why* combining them wins), [Planning](planning.md) (plan-first as an alternative to ReAct's step-by-step).
