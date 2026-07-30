# Supervisor / Orchestrator

**What it is:** the most common multi-agent shape — one manager agent that reads the task, decides which specialist should act next, hands it the work, and assembles the results.

## Why it matters for an AI Engineer

If you ship exactly one multi-agent pattern in your career, it will be this one. Roughly 80% of production multi-agent systems are supervisors, because it's the only architecture that stays *debuggable*: there's a single point where routing decisions happen, so when something goes wrong you know where to look. Interviewers treat "can you describe a supervisor loop" as table stakes for agent roles. It's also the pattern your own [overview diagram](../multi-agent-systems.md) is built around.

## The mechanism / how it works

A supervisor is itself an LLM (or a small deterministic router) whose job is *routing*, not doing the work. The loop:

1. The supervisor sees the current state (task + everything gathered so far).
2. It picks the next agent — "this needs research → call the researcher" — or decides the task is done.
3. The chosen worker runs, produces a result, and returns it to the supervisor.
4. Repeat from step 1 until the supervisor emits "finish."

Crucially, **workers report back to the supervisor, not to each other**. This "hub and spoke" shape is what keeps it traceable: every decision flows through one node. Workers stay dumb about the big picture; the supervisor holds the plan.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 Task</span>
    <span class="darr">↓</span>
    <span class="dbox purple wide">🧭 Supervisor<span class="sub">picks next agent</span></span>
    <span class="darr">↓<span class="lbl">route</span></span>
    <span class="dbox blue">🔎 Researcher</span>
    <span class="darr">↑<span class="lbl">result back</span></span>
    <span class="dbox purple wide">🧭 Supervisor<span class="sub">route again or finish</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Final answer</span>
  </div>
  <div class="dcap">Every worker returns to the supervisor — one hub means one place to debug routing.</div>
</div>

The supervisor's routing is just structured output: it returns the *name* of the next agent (plus optional instructions). That's why you always constrain it to a fixed set of agent names — a free-text supervisor invents nonexistent workers.

## A concrete example

LangGraph's prebuilt supervisor (2026-current):

```python
from langgraph_supervisor import create_supervisor
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")

researcher = create_react_agent(model, tools=[web_search], name="researcher",
    prompt="You gather facts and sources. Return them and stop.")
writer = create_react_agent(model, tools=[], name="writer",
    prompt="You turn gathered facts into a clear summary.")

workflow = create_supervisor(
    agents=[researcher, writer],
    model=model,
    prompt=("You manage a researcher and a writer. "
            "Route research first, then writing. Reply FINISH when done."),
)
app = workflow.compile()
result = app.invoke({"messages": [("user", "Summarize UAE fintech news this week.")]})
```

The supervisor decides `researcher` → `writer` → done. You never hard-code that order; the manager infers it — but the *set* of agents is fixed.

## How a company uses this

A Dubai wealth-management firm runs a "should I rebalance?" assistant as a supervisor. It dispatches a data agent (pull holdings), a market agent (fetch prices), an analysis agent (compute allocation), and a compliance agent (check the advice is legal), then assembles a grounded answer. In production this handles ~2,000 queries/day; the supervisor pattern lets them log *which agent* was called on every request, so when an answer is wrong they replay the exact routing path instead of guessing. That observability is why they chose supervisor over a free-for-all [network](network-peer-to-peer.md) design.

## Common mistakes / misconceptions

- **Letting the supervisor also do the work.** Keep it thin — routing only. A supervisor that researches *and* routes reintroduces the overload you split to avoid.
- **Unbounded routing.** The supervisor can loop forever ("research again... and again"). Always cap total steps — see [infinite-loops.md](infinite-loops.md).
- **Free-text agent selection.** Constrain routing to a fixed enum of agent names, or it hallucinates a worker that doesn't exist.

## Interview tip
Say: *"Supervisor is my default multi-agent pattern — a thin manager agent routes each subtask to a specialist and workers report back to the hub, so there's one place to trace and debug. I constrain routing to a fixed agent set and cap total steps."* It shows you value debuggability, which is exactly what production teams hire for.
