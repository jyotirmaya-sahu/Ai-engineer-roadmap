# Planning

**What it is:** an agent (or team) thinking out the *whole sequence of steps* to reach a goal before executing — and revising that plan as reality pushes back.

## Why it matters for an AI Engineer

Reactive agents that decide one step at a time work for short tasks but drift on long ones — they lose the thread, repeat work, or chase a dead end for ten turns. Planning gives the system a *map*: a plan to follow, check progress against, and correct. For an AI Engineer, planning is what makes agents reliable on multi-step, long-horizon jobs — exactly the tasks worth automating. It also makes runs *auditable*: a written plan is something a human can inspect before compute is spent, which enterprises demand.

## The mechanism / how it works

Planning sits on top of [task decomposition](task-decomposition.md): decomposition produces the sub-tasks; planning orders them, executes, and *adapts*. The dominant pattern is **plan-and-execute** (also called planner-executor):

1. **Plan.** A planner LLM writes an ordered list of steps to reach the goal.
2. **Execute.** An executor (often a sub-agent per step) does step 1, then step 2…
3. **Replan.** After each step, check: did it succeed? Did we learn something that changes the plan? If so, regenerate the remaining steps. If not, continue.

The replanning loop is the whole point. A plan written before any action is a *guess*; the world talks back (a search returns nothing, a tool errors), and a good agent updates its plan rather than blindly marching a stale one. Contrast this with **ReAct**, where the agent interleaves think-act-observe one step at a time with no explicit upfront plan — fine for short tasks, weak for long ones. Plan-and-execute separates "what's the strategy" from "do the next thing," which keeps long runs on track and cheaper (the expensive planner runs occasionally, a cheap executor does the steps).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Goal</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 Plan<span class="sub">ordered steps</span></span>
    <span class="darr">↓</span>
    <span class="dbox blue">⚙️ Execute step</span>
    <span class="darr">↓<span class="lbl">learned something new?</span></span>
    <span class="dbox orange">🔁 Replan remaining</span>
    <span class="darr">↓<span class="lbl">plan empty</span></span>
    <span class="dbox green">✅ Done</span>
  </div>
  <div class="dcap">Plan-and-execute: plan once, do a step, replan if reality changed — repeat until the plan is empty.</div>
</div>

## A concrete example

The plan-and-replan skeleton:

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
model = ChatOpenAI(model="gpt-4o")

class Plan(BaseModel):
    steps: list[str]

planner = model.with_structured_output(Plan)

def run(goal: str, max_steps: int = 10):
    plan = planner.invoke(f"List the steps to achieve: {goal}").steps
    results = []
    for _ in range(max_steps):            # hard cap = safety against runaway loops
        if not plan: break
        step = plan.pop(0)
        result = execute(step, context=results)     # a sub-agent does the step
        results.append(result)
        # replan: given what we just learned, are the remaining steps still right?
        plan = planner.invoke(
            f"Goal: {goal}. Done so far: {results}. Remaining plan was: {plan}. "
            f"Update the remaining steps."
        ).steps
    return results
```

The `max_steps` cap is mandatory — replanning can otherwise keep inventing new steps forever.

## How a company uses this

A Dubai real-estate portal built an agent that answers "find me a 2-bed under AED 120k/yr near a metro station with a gym." It *plans*: (1) parse constraints, (2) query listings DB, (3) filter by metro proximity, (4) check amenities, (5) rank. When step 2 returns too few results, it *replans* — relaxing the price constraint and re-querying — instead of returning an empty list. Before planning, the reactive version often gave up or looped; plan-and-replan raised successful-answer rate meaningfully and, because the plan is logged, support staff can see exactly why a search returned what it did.

## Common mistakes / misconceptions

- **Plan once, never revise.** A static plan can't handle a failed step or new info — always replan on meaningful change.
- **No step cap.** Replanning can spin up endless new steps; cap total iterations (see [infinite-loops.md](infinite-loops.md)).
- **Planning trivial tasks.** For short jobs, an upfront plan is overhead — plain ReAct is fine. Plan when the horizon is long.
- **Planner and executor on the same expensive model unnecessarily.** Plan with the strong model, execute steps with a cheaper one.

## Interview tip
Say: *"For long-horizon tasks I use plan-and-execute: a strong planner writes ordered steps, a cheaper executor runs them, and I replan after each step when reality changes — with a hard step cap. It keeps long runs on track and gives an auditable plan, versus ReAct which decides one step at a time and drifts on long tasks."* Naming plan-and-execute vs ReAct is a clear senior signal.
