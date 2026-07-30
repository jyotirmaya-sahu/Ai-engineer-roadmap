# CrewAI

**What it is:** a framework for building a *team* of agents by describing them like coworkers — each gets a **role**, a **goal**, and a **backstory** — then assigning **tasks** and letting the "crew" work together toward a result.

## Why it matters for an AI Engineer

CrewAI's superpower is a mental model that *matches how humans think about work*: "I want a researcher, a writer, and an editor." For a large class of business problems — content pipelines, research reports, analysis-then-summary — that role-based framing is the fastest way from idea to working [multi-agent system](../multi-agent-systems.md). It's popular in job descriptions precisely because it's approachable and gets non-trivial multi-agent apps running quickly. As an AI Engineer you should know it as the "team of specialists" option, and be able to say *when* it fits (clear, decomposable roles) versus when you'd want [LangGraph](langgraph-nodes-edges-state.md)'s explicit control instead.

## The mechanism — agents, tasks, crews, process

Four concepts:

- **Agent** — a specialist defined by a `role` ("Senior Researcher"), a `goal` ("find the best sources"), and a `backstory` (flavor that shapes its behavior). It has its own tools and can use its own LLM.
- **Task** — a unit of work with a `description` and an `expected_output`, assigned to an agent. Tasks can depend on each other's outputs.
- **Crew** — the team: a set of agents + tasks run together.
- **Process** — *how* they run. **Sequential**: task 1's output feeds task 2 feeds task 3 (a pipeline). **Hierarchical**: a manager agent delegates tasks to workers and assembles results.

Under the hood each agent is still doing the [function-calling](function-calling.md) loop; CrewAI adds the coordination — passing one agent's output as the next's input, and (in hierarchical mode) a manager that routes work. The role/goal/backstory prompts steer each agent to stay in its lane.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📋 Task: "market report"</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔎 Researcher<span class="sub">gathers sources</span></span>
    <span class="darr">→<span class="lbl">output</span></span>
    <span class="dbox purple">✍️ Writer<span class="sub">drafts</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🧐 Editor<span class="sub">polishes</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ final report</span>
  </div>
  <div class="dcap">Sequential process: each specialist's output becomes the next one's input — a role-based pipeline.</div>
</div>

## Concrete example (runnable, 2026-current)

```python
from crewai import Agent, Task, Crew, Process

researcher = Agent(
    role="Market Researcher",
    goal="Find current, credible facts about the Dubai real-estate market",
    backstory="A meticulous analyst who never states a number without a source.",
    llm="gpt-5.4-mini",
)
writer = Agent(
    role="Report Writer",
    goal="Turn research into a clear 1-page executive summary",
    backstory="A crisp business writer who cuts fluff.",
    llm="gpt-5.4-mini",
)

research_task = Task(
    description="Research 2026 Dubai real-estate price trends and demand drivers.",
    expected_output="A bullet list of key facts, each with a source.",
    agent=researcher,
)
write_task = Task(
    description="Write a 1-page executive summary from the research.",
    expected_output="A polished one-page summary.",
    agent=writer,
    context=[research_task],          # depends on the research output
)

crew = Crew(agents=[researcher, writer], tasks=[research_task, write_task],
            process=Process.sequential)
print(crew.kickoff())                 # researcher runs, then writer uses its output
```

You described *coworkers and their jobs* — no explicit graph — and got a working two-agent pipeline. That readability is CrewAI's pitch.

## How a company uses this — production lens

> **A Dubai property portal** automates weekly market reports with a CrewAI crew: a researcher agent (web-search + their listings DB), an analyst agent (runs the [code-execution](code-execution.md) tool for price stats), and a writer agent. It replaced a task that took an analyst half a day. Production realities they had to manage: **cost multiplies with agents** — three agents each making several LLM calls meant one report was ~8× a single prompt's tokens, so they use a cheap model for research and a stronger one only for the final write-up; **error propagation** — when the researcher returned thin data, the writer confidently wrote a weak report, so they added an expected-output check between tasks; and **determinism** — free-form agent chatter made outputs vary run-to-run, so they tightened each `expected_output` to constrain the format. Great fit because the work genuinely *is* a role-based pipeline; they'd have reached for [LangGraph](langgraph-nodes-edges-state.md) if it needed conditional branching or human approval mid-run.

## Common mistakes

- **Using it when one agent would do.** A team of agents for a single-step task just multiplies cost and latency. Reach for a crew only when roles genuinely differ.
- **Vague roles/goals.** "Assistant" with goal "help" produces mush. Specific role + goal + expected_output is what makes it work.
- **Ignoring cost multiplication.** N agents × several calls each. Use cheap models for cheap roles.
- **No output validation between tasks.** A weak upstream output silently corrupts everything downstream. Check it.
- **Expecting fine-grained control.** CrewAI is role-based, not graph-based. For hard loop caps, branching, and resume, use [LangGraph](langgraph-nodes-edges-state.md).

## Interview tip
Say: *"CrewAI models agents as coworkers — role, goal, backstory — and runs them as a sequential or hierarchical team. I reach for it when the problem decomposes cleanly into roles, like research→analyze→write. Its watch-outs are cost multiplication and error propagation, so I use cheap models per role and validate outputs between tasks. When I need explicit control — loop caps, branching, human approval — I switch to LangGraph."* That shows you pick frameworks by problem shape, not hype. See also [AutoGen](autogen.md), the conversational alternative.
