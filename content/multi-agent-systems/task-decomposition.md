# Task Decomposition

**What it is:** breaking one big, vague goal into a set of small, concrete sub-tasks that individual agents can actually execute — the step that turns "help me launch a product" into a checklist.

## Why it matters for an AI Engineer

Decomposition is the first thing any coordinator does, and it's where multi-agent systems most often silently fail. If the breakdown is wrong — sub-tasks overlap, a step is missing, or two steps secretly depend on each other — no amount of good agents downstream can save the result. For an AI Engineer, getting decomposition right is higher leverage than tuning any single agent's prompt: it decides *what work even gets assigned*. It's the multi-agent cousin of chain-of-thought — think first, act second.

## The mechanism / how it works

A planner (usually the [supervisor](supervisor-orchestrator.md), sometimes a dedicated planning agent — see [planning.md](planning.md)) takes the goal and produces a **task list**. Good decomposition has three properties:

1. **Each sub-task is atomic** — small enough that one agent with one prompt can finish it. "Research competitors" is atomic; "launch the product" is not.
2. **Sub-tasks are as independent as possible** — so they can run in [parallel](concurrent-parallel.md) and one's failure doesn't cascade.
3. **Dependencies are explicit** — where B *does* need A's output, that ordering is recorded, not left implicit.

The output is essentially a small dependency graph: nodes are sub-tasks, edges are "must-finish-before." Independent nodes fan out; dependent ones sequence.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 "Write a market report on UAE fintech"</span>
    <span class="darr">↓<span class="lbl">decompose</span></span>
  </div>
  <div class="flow">
    <span class="dbox orange">① gather news</span>
    <span class="dbox orange">② pull market data</span>
    <span class="dbox orange">③ list key players</span>
  </div>
  <div class="flow v">
    <span class="darr">↓<span class="lbl">depends on ①②③</span></span>
    <span class="dbox purple">④ synthesize report</span>
  </div>
  <div class="dcap">A vague goal becomes atomic sub-tasks with explicit dependencies — ①②③ run in parallel, ④ waits.</div>
</div>

## A concrete example

Ask an LLM to decompose into structured, dependency-aware sub-tasks:

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

class SubTask(BaseModel):
    id: int
    description: str
    depends_on: list[int]   # ids that must finish first — makes ordering explicit

class Plan(BaseModel):
    tasks: list[SubTask]

planner = ChatOpenAI(model="gpt-4o").with_structured_output(Plan)
plan = planner.invoke(
    "Break 'write a market report on UAE fintech' into atomic sub-tasks. "
    "Mark dependencies so independent tasks can run in parallel."
)
for t in plan.tasks:
    print(t.id, t.description, "after", t.depends_on)
# 1 gather news []   2 pull market data []   3 list players []   4 synthesize [1,2,3]
```

Forcing structured output with an explicit `depends_on` is what makes the plan *executable* — the coordinator reads the graph and schedules accordingly.

## How a company uses this

A Dubai management consultancy's research assistant decomposes each client brief before any agent runs. A partner asks "assess the EV-charging market in the GCC"; the planner breaks it into ~8 atomic tasks (market size, regulation per country, key operators, demand drivers…), tags which are independent, and the system runs the independent ones in parallel. Early on they skipped explicit decomposition and let one agent free-wheel — it produced rambling, overlapping sections and missed whole countries. Adding a structured decomposition step cut redundant work by ~30% and, critically, made *coverage* auditable: a human can eyeball the task list and spot a missing country before compute is spent.

## Common mistakes / misconceptions

- **Sub-tasks too big.** "Handle the marketing" isn't atomic — an agent will flail. Break until each fits one prompt.
- **Ignoring dependencies.** Running a step before its prerequisite gives it empty input; the output looks confident but is hollow.
- **Over-decomposing.** Fifty tiny tasks multiply coordination overhead and cost. Aim for the fewest atomic tasks that cover the goal.
- **One-shot planning for changing tasks.** If reality shifts mid-run, a static plan goes stale — replan (see [planning.md](planning.md)).

## Interview tip
Say: *"Decomposition is where multi-agent quality is won or lost. I have the planner emit atomic sub-tasks with explicit dependencies as structured output — independent ones fan out in parallel, dependent ones sequence — and I keep the list small enough to audit for coverage before spending compute."* That shows you treat planning as engineering, not vibes.
