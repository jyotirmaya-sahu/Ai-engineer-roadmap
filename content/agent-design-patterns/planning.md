# Planning

**What it is:** the model **writes out a multi-step plan first**, then executes the steps one by one — thinking about the whole journey before taking the first move, instead of deciding each action blind.

## Why it matters for an AI Engineer

Give an agent an open-ended goal — "organize my inbox and draft replies to anything urgent" — and a react-as-you-go approach can wander: it does something, sees the result, does something else, and easily loses the thread or repeats itself. Planning forces the model to lay out the route up front, which keeps a long task coherent.

For an AI Engineer, planning is what makes agents handle tasks with **no fixed sequence**. It's the core of autonomy: the model, not your code, decides the steps. That's powerful — it can tackle problems you never explicitly programmed — and dangerous, because a bad plan or an endless loop is now the model's fault, not a bug you can point to. Understanding planning (and how to bound it) is the line between "I've built a chatbot" and "I've built an agent" on a résumé.

## The mechanism / how it works

The dominant real-world pattern is **ReAct** (Reason + Act): the model interleaves *thinking* and *doing* in a loop.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Goal</span>
    <span class="darr">↓</span>
    <div class="dgroup"><span class="dgt">AGENT LOOP</span>
      <div class="flow">
        <span class="dbox purple">🧠 Thought<span class="sub">what next?</span></span>
        <span class="darr">→</span>
        <span class="dbox orange">🔧 Action<span class="sub">call a tool</span></span>
        <span class="darr">→</span>
        <span class="dbox blue">👀 Observation<span class="sub">tool result</span></span>
      </div>
      <span class="darr">↺<span class="lbl">until goal met or cap hit</span></span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Goal achieved</span>
  </div>
  <div class="dcap">ReAct: the model reasons, takes an action, observes the result, and repeats — deciding each step itself.</div>
</div>

Two schools of planning:

- **Plan-and-execute:** write the *entire* plan first ("1. search, 2. summarize, 3. email"), then run it. Cheaper and more predictable, but brittle if reality deviates from the plan.
- **ReAct (react-as-you-go):** decide the next single step after seeing each observation. More adaptive to surprises, but more calls and more room to wander.

Modern agents often **replan**: make an initial plan, execute a step, and if an observation invalidates the plan, revise it. The non-negotiable engineering requirement is **bounds** — a max-steps cap and often a spend cap — because an unbounded planning loop is the classic way an agent runs forever and racks up a huge bill.

## A concrete example

A minimal ReAct loop with a hard step cap, choosing between two tools.

```python
import json
from openai import OpenAI
client = OpenAI()

def search(q): return f"[results for {q}]"
def finish(a): return a
TOOLS = {"search": search, "finish": finish}

def react(goal: str, max_steps: int = 5) -> str:
    history = f"Goal: {goal}\nTools: search(query), finish(answer)."
    for _ in range(max_steps):                       # hard bound
        step = client.chat.completions.create(
            model="gpt-4o", temperature=0,
            messages=[{"role": "user", "content":
                history + "\nReply JSON: {\"tool\":..., \"arg\":...}"}]
        ).choices[0].message.content
        call = json.loads(step)
        result = TOOLS[call["tool"]](call["arg"])
        if call["tool"] == "finish":
            return result
        history += f"\nAction: {call}\nObservation: {result}"
    return "Stopped: step cap reached."               # safety exit

print(react("Find the capital of the UAE and state it."))
```

The `max_steps` loop is the guardrail — without it, a confused model could think-act-observe forever. The `finish` tool is how the agent signals it's done.

## How a company uses this

A **Dubai property-management firm** runs an agent that handles tenant maintenance requests end-to-end: it reads the ticket, plans (check warranty status → find an available vendor → draft a work order → notify the tenant), and executes each step with tools. It replans when reality intervenes — no vendor available today means it revises to "escalate to on-call." Each run is capped at 10 steps and $0.25. Those caps aren't optional: an early unbounded version got stuck re-checking vendor availability in a loop and spent ~$40 on a single ticket before someone noticed. Bounded, it now closes ~70% of routine tickets with no human, at ~$0.08 each.

## Common mistakes / misconceptions

- **No step or spend cap.** The single most common agent disaster. An unbounded planner can loop forever. Always cap (see [../agent-cost-context-control.md](../agent-cost-context-control.md) if it exists in your roadmap).
- **Planning when a workflow would do.** If the steps are known and fixed, don't pay the model to "plan" — write a [chain](prompt-chaining.md). Planning is for genuinely open-ended tasks.
- **Rigid plan-and-execute on messy tasks.** If reality often deviates, a fixed upfront plan breaks. Use ReAct or add replanning.
- **No stop condition.** The agent needs a clear way to declare "done" (like a `finish` tool), or it never terminates cleanly.

## Interview tip
Say: *"Planning is what makes a system an agent — the model decides the steps, not my code. The workhorse is ReAct: reason, act with a tool, observe, repeat, often with replanning when an observation breaks the plan. Plan-and-execute is cheaper and predictable; ReAct is more adaptive but wanders more. The non-negotiable is bounds — a max-steps cap and a spend cap — because an unbounded planning loop is the number-one way agents run forever and blow the budget."* Leading with the bounding requirement signals you've actually run agents in production.
