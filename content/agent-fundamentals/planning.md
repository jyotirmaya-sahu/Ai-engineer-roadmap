# Planning

**What it is:** Planning is when the agent lays out the *whole sequence of steps up front* — a plan — before executing any of them, instead of deciding one step at a time.

## Why it matters for an AI Engineer

[ReAct](react.md) decides the next action step-by-step, which is great for short, reactive tasks but wanders on long ones — it can lose the thread, redo work, or forget a sub-goal. Planning fixes that by making the agent commit to a roadmap first ("1. gather requirements, 2. draft, 3. review, 4. send"), then work the list. For any task with more than a handful of steps — a research report, a multi-file code change, a data pipeline — planning is what keeps the agent coherent and lets you *see and correct its intended approach before it burns tokens executing a bad one*. It's also cheaper and more parallelisable: independent plan steps can run at the same time.

## The mechanism: how it works

Planning splits the agent into two phases:

1. **Plan** — one LLM call takes the goal and produces an explicit, ordered list of sub-tasks. This is "decomposition": break a big fuzzy goal into small concrete steps.
2. **Execute** — the agent works through the plan step by step (often each step is its own small [ReAct](react.md) loop with tools). As results come in, it can **re-plan**: revise the remaining steps if reality didn't match the plan.

The key variants:

- **Plan-and-execute** — plan once, then run the whole plan. Simple, cheap, but brittle if the plan was wrong.
- **Plan-and-solve / re-planning (ReWOO, LLMCompiler-style)** — after each step, check progress and update the plan. More robust, slightly more expensive.
- **Decomposition-first** — for parallelisable goals, the plan identifies which steps are independent so they can run concurrently, then a final step joins the results.

The win over pure step-by-step is *foresight*: the model reasons about the entire task at once, catching dependencies ("I need the data before I can chart it") and ordering that a greedy one-step-at-a-time agent misses.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🧑 Fuzzy goal</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 PLAN: decompose into ordered steps</span>
    <span class="darr">↓</span>
    <div class="dgroup"><span class="dgt">EXECUTE</span>
      <div class="flow">
        <span class="dbox orange">1️⃣ step</span><span class="darr">→</span>
        <span class="dbox orange">2️⃣ step</span><span class="darr">→</span>
        <span class="dbox orange">3️⃣ step</span>
      </div>
    </div>
    <span class="darr">↓<span class="lbl">re-plan if off track</span></span>
    <span class="dbox green">✅ Result</span>
  </div>
  <div class="dcap">Plan the whole task first, then execute step by step, re-planning when reality diverges.</div>
</div>

## Concrete example

A plan-then-execute skeleton:

```python
from openai import OpenAI
import json
client = OpenAI()

def make_plan(goal):
    r = client.chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "user",
            "content": f"Break this goal into 3-6 ordered, concrete steps. "
                       f"Return a JSON list of strings.\nGoal: {goal}"}],
        response_format={"type": "json_object"})
    return json.loads(r.choices[0].message.content)["steps"]

def do_step(step, context):
    r = client.chat.completions.create(model="gpt-4.1",
        messages=[{"role": "user",
            "content": f"Context so far:\n{context}\n\nDo this step: {step}"}])
    return r.choices[0].message.content

goal = "Write a short market brief on fintech hiring in Dubai"
plan = make_plan(goal)          # ["Research demand", "List top employers", ...]
context = ""
for step in plan:               # execute in order, accumulating context
    result = do_step(step, context)
    context += f"\n## {step}\n{result}\n"
print(context)
```

Ask for the plan as JSON so you can loop over it; feed accumulated context into each step so later steps build on earlier ones. To add re-planning, call `make_plan` again with the current context whenever a step reports a problem.

## How a company uses this

A consultancy in the DIFC builds a "research agent" that produces client briefs. It **plans first** (identify sources → pull data → analyse → write → cite), and a human reviews the *plan* before execution — a 30-second check that prevents a 5-minute, $2 wrong run. Independent steps (pulling three different data sources) run **in parallel**, cutting a 90-second sequential job to ~35 seconds. When a source is unavailable, the agent **re-plans** the remaining steps rather than failing. Planning turned an agent that used to wander and produce inconsistent briefs into one whose output structure is predictable enough to ship to clients.

## Common mistakes

- **Planning trivial tasks.** A two-step task doesn't need a plan; the extra LLM call is pure overhead. Reserve planning for genuinely multi-step goals.
- **Never re-planning.** A rigid plan-and-execute agent marches off a cliff when step 1's result invalidates the plan. Add a re-plan check for anything non-trivial.
- **Plans too vague to execute.** "Analyse the data" isn't a step. Prompt for concrete, self-contained sub-tasks.
- **Ignoring dependencies.** If the plan runs steps out of order (chart before data), you get garbage. Make the model state ordering explicitly.

## Interview tip
Say: *"Planning means decomposing the goal into an explicit ordered set of steps before executing, versus ReAct's step-by-step. I reach for it on long or multi-step tasks — it gives foresight, lets me review the approach before spending tokens, and lets independent steps run in parallel. I add re-planning so the agent can adapt when a step's result changes the picture."* Contrasting it cleanly with ReAct shows you know *when* to use each.

See also: [ReAct](react.md) (reactive alternative), [Agent loop](agent-loop.md) (each plan step is often its own loop).
