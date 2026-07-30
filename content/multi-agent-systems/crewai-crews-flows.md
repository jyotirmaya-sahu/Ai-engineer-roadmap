# CrewAI (crews / flows)

**What it is:** a popular Python framework for building multi-agent systems using a *role-based* metaphor — you define agents by their job (role, goal, backstory) and group them into a "crew" that works a set of tasks, with "flows" for more explicit control.

## Why it matters for an AI Engineer

CrewAI is the fastest framework to *read and build* — its role/goal/backstory model reads almost like plain English, so you go from idea to running crew in minutes. That makes it a common choice for prototypes, demos, and business teams who want agents without wrestling a state graph. For an AI Engineer, knowing CrewAI's sweet spot (and its ceiling) lets you pick it when speed-to-build matters and reach for [LangGraph](langgraph-multi-agent.md) when you need tight control. It's a name that comes up constantly in 2026 job posts.

## The mechanism / how it works

CrewAI has two modeling layers:

**Crews** — the high-level, autonomous mode. You define:
- **Agents** by `role`, `goal`, and `backstory` (the backstory shapes their behavior via the system prompt), plus their `tools` and `llm`.
- **Tasks** with a description and expected output, each assigned to an agent.
- A **Crew** that runs the tasks either *sequentially* (a [pipeline](sequential-pipeline.md)) or *hierarchically* (a manager LLM coordinates — the [manager/worker](manager-worker-roles.md) pattern).

You hand it the goal and the crew figures out the collaboration. Great for speed, less predictable step-to-step.

**Flows** — the newer, lower-level mode for when you need *determinism*. Flows use explicit `@start` and `@listen` decorators to wire event-driven control between steps, mixing agent calls with plain Python. When you need exact ordering, branching, and state control, you use Flows (or combine: Flows orchestrating Crews).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Goal + Tasks</span>
    <span class="darr">→</span>
    <span class="dbox purple wide">👥 Crew<span class="sub">role · goal · backstory agents</span></span>
    <span class="darr">→<span class="lbl">sequential or hierarchical</span></span>
    <span class="dbox green">✅ Result</span>
  </div>
  <div class="dcap">CrewAI: describe agents by their role and let the crew collaborate — Flows add explicit control when needed.</div>
</div>

## A concrete example

A two-agent crew, sequential process (CrewAI 2026):

```python
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool

researcher = Agent(
    role="Market Researcher",
    goal="Find accurate, current facts about {topic}",
    backstory="A meticulous analyst who always cites sources.",
    tools=[SerperDevTool()], verbose=True,
)
writer = Agent(
    role="Content Writer",
    goal="Write a clear, engaging brief",
    backstory="A concise business writer.",
)

research = Task(description="Research {topic}", expected_output="5 key facts with sources",
                agent=researcher)
write = Task(description="Write a 200-word brief", expected_output="A polished brief",
             agent=writer, context=[research])          # writer sees research output

crew = Crew(agents=[researcher, writer], tasks=[research, write],
            process=Process.sequential)
print(crew.kickoff(inputs={"topic": "UAE fintech in 2026"}))
```

`context=[research]` passes the researcher's output to the writer — CrewAI's way of chaining tasks. Note the readability: the whole team is legible at a glance.

## How a company uses this

A Dubai marketing agency prototyped a content pipeline in CrewAI in an afternoon — researcher, writer, editor crew — because the role metaphor let their non-ML marketers actually *read and tweak* the agents' goals and backstories themselves. It shipped for their internal blog. When they later needed strict step ordering and human-approval gates for *client* work (regulated claims), they moved that pipeline to CrewAI **Flows** for the explicit control, keeping the fast Crew version for low-stakes internal drafts. That progression — Crew for speed, Flow for control — is CrewAI's intended path.

## Common mistakes / misconceptions

- **Expecting Crews to be deterministic.** Autonomous crews decide their own collaboration; for exact control use Flows or LangGraph.
- **Over-investing in backstories.** A vivid backstory helps a little, but it's still just prompt text — it won't fix a badly scoped task.
- **No iteration/step limits.** Like any agent system, crews can loop or over-spend — set `max_iter` and watch cost ([cost-explosion.md](cost-explosion.md)).
- **Reaching for CrewAI when you need fine state control.** That's LangGraph's territory; forcing it into a Crew fights the framework.

## Interview tip
Say: *"CrewAI's role/goal/backstory model is the fastest way to build a readable multi-agent system — I use Crews for quick, autonomous collaboration and Flows when I need deterministic ordering and control. Its sweet spot is speed-to-build and legibility; when I need fine-grained state and loop control I switch to LangGraph."* Knowing Crews-vs-Flows and the LangGraph boundary shows current, hands-on knowledge.
