# Manager + Worker Roles

**What it is:** the division of labor that makes multi-agent systems work — a *manager* agent that plans and coordinates but does no real work, and *worker* agents that do one narrow job each and report back.

## Why it matters for an AI Engineer

This is the conceptual backbone of the whole [supervisor](supervisor-orchestrator.md) family, and getting the *separation* clean is what makes a system maintainable. The most common multi-agent bug is a manager that also tries to do the work — it gets overloaded, exactly the problem you split agents to avoid. For an AI Engineer, being able to articulate "the manager coordinates, the workers execute, and neither does the other's job" signals you understand *why* the pattern works, not just how to wire it.

## The mechanism / how it works

Think of it as a real team. The **manager**:
- Holds the goal and the plan (see [planning.md](planning.md)).
- Decomposes and assigns sub-tasks ([task-decomposition.md](task-decomposition.md), [routing.md](routing.md)).
- Assembles worker outputs into the final result.
- Does **not** call domain tools or write the actual content — its only "output" is coordination.

Each **worker**:
- Has one narrow role, a short prompt, and only the tools that role needs.
- Knows *nothing about the overall plan* — it just does its assigned task and returns.
- Is independently testable, because its input/output contract is small and fixed.

The reason to keep the manager "thin" (routing only) is the same reason you went multi-agent at all: **a focused context stays sharp.** A manager juggling both coordination *and* domain work has a bloated context and degrades. Workers stay reliable precisely because they're ignorant of everything except their slice.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple wide">👔 Manager<span class="sub">plans · assigns · assembles — no domain work</span></span>
    <span class="darr">↓<span class="lbl">assign narrow tasks</span></span>
  </div>
  <div class="flow">
    <span class="dbox blue">🔎 Worker: search</span>
    <span class="dbox blue">🧮 Worker: compute</span>
    <span class="dbox blue">✍️ Worker: write</span>
  </div>
  <div class="flow v">
    <span class="darr">↑<span class="lbl">results back to manager</span></span>
  </div>
  <div class="dcap">Manager coordinates only; each worker does one job and knows nothing of the wider plan.</div>
</div>

## A concrete example

CrewAI makes the manager/worker split explicit via roles and a manager LLM:

```python
from crewai import Agent, Crew, Task, Process
from langchain_openai import ChatOpenAI

researcher = Agent(role="Researcher", goal="Find facts and sources",
                   backstory="Meticulous analyst.", tools=[search_tool])
writer = Agent(role="Writer", goal="Write a clear brief",
               backstory="Concise business writer.", tools=[])  # no tools — writing only

crew = Crew(
    agents=[researcher, writer],
    tasks=[Task(description="Research UAE fintech", agent=researcher),
           Task(description="Write a 200-word brief", agent=writer)],
    process=Process.hierarchical,                 # a manager LLM coordinates the workers
    manager_llm=ChatOpenAI(model="gpt-4o"),
)
print(crew.kickoff())
```

`Process.hierarchical` spins up a manager agent that decides which worker acts and assembles the result — the workers never coordinate among themselves.

## How a company uses this

A Dubai insurance company's claims assistant runs a manager agent that never touches a claim directly. It assigns a document worker (extract the claim form), a policy worker (look up coverage), and a fraud-check worker (flag anomalies), then compiles a decision packet. Keeping the manager coordination-only means each worker's behavior is auditable in isolation — regulators can review "the fraud worker's exact prompt and outputs" without wading through coordination logic. When an earlier build let the manager also do coverage lookups, its context ballooned and it started misassigning tasks; enforcing the thin-manager rule fixed the reliability.

## Common mistakes / misconceptions

- **The manager doing real work.** The classic failure — it overloads and misroutes. Keep it to coordination only.
- **Fat workers.** A worker with ten tools and a vague goal is a single overloaded agent in disguise. One job per worker.
- **Workers coordinating directly.** In a manager/worker design, workers report *up*, not sideways — sideways is a [network](network-peer-to-peer.md), a different pattern with different trade-offs.
- **Sharing the full plan with workers.** Extra context they don't need just adds cost and noise; give each only its task.

## Interview tip
Say: *"I keep a strict manager/worker split — the manager plans, assigns, and assembles but does no domain work, and each worker does exactly one job with only its own tools and no knowledge of the wider plan. Keeping the manager thin is what stops it overloading, which is the whole reason to go multi-agent."* That shows you understand the *why*, which separates senior from junior.
