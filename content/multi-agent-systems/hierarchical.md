# Hierarchical

**What it is:** a supervisor of supervisors — you nest teams, so a top manager routes to *mid-level managers*, each of whom runs their own squad of worker agents.

## Why it matters for an AI Engineer

A flat [supervisor](supervisor-orchestrator.md) works until it has too many workers to reason about. One manager choosing between 15 specialists faces the same overload problem a single agent has with 15 tools — its routing degrades. Hierarchy is how you scale multi-agent systems past that ceiling *without* the manager's prompt exploding. For an AI Engineer, this is the pattern behind large "AI org chart" products; naming it shows you've thought about what happens when a system grows beyond a handful of agents.

## The mechanism / how it works

You group workers into **teams**, each with its own **team supervisor**. A **top-level supervisor** routes only between teams, never to individual workers. Each layer only knows its immediate children, so no single prompt has to enumerate everything.

- Top supervisor: "This is a research task → hand to the *research team*." It doesn't know or care which worker inside handles it.
- Research-team supervisor: routes among *its* workers (web searcher, PDF reader, summarizer), returns the team's result upward.

This mirrors a real company org chart. The win is **abstraction**: each supervisor reasons over 3–5 children, which LLMs do well, instead of 15+, which they do badly. The cost is an extra hop of latency and tokens per layer, so you only add depth when a flat team stops being reliable.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple wide">🧭 Top supervisor<span class="sub">routes between teams</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">🧭 Research team lead</span>
    <span class="dbox orange">🧭 Writing team lead</span>
    <span class="darr">↓<span class="lbl">each lead routes its own squad</span></span>
    <span class="dbox blue">🔎 searcher</span>
    <span class="dbox blue">📄 pdf reader</span>
    <span class="dbox blue">✍️ drafter</span>
    <span class="dbox blue">🕵️ editor</span>
  </div>
  <div class="dcap">Managers of managers: each layer only routes among its few direct children.</div>
</div>

## A concrete example

In LangGraph, a team is just a compiled graph you drop in as a node of a bigger graph:

```python
from langgraph_supervisor import create_supervisor
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o")

# --- Team 1: research squad (its own supervisor) ---
research_team = create_supervisor(
    agents=[web_searcher, pdf_reader],
    model=model, prompt="Manage searcher and pdf_reader.",
).compile(name="research_team")

# --- Team 2: writing squad ---
writing_team = create_supervisor(
    agents=[drafter, editor],
    model=model, prompt="Manage drafter and editor.",
).compile(name="writing_team")

# --- Top-level supervisor routes between the two TEAMS, not their workers ---
top = create_supervisor(
    agents=[research_team, writing_team],
    model=model, prompt="Route to research_team first, then writing_team.",
).compile()
```

The top supervisor sees exactly two options; each team lead sees exactly two. No prompt ever lists all four workers.

## How a company uses this

A large Dubai consultancy built a report-generation platform with a research division and a production division, each a team of agents. At ~500 reports/month the flat design had one manager juggling eight specialists and misrouting ~15% of tasks. Splitting into two teams under a top supervisor dropped misrouting to under 3%, because each manager now reasons over a handful of choices. The trade: each report costs about one extra routing call per layer (~20% more tokens), which the accuracy gain easily justified at their price point.

## Common mistakes / misconceptions

- **Adding layers prematurely.** Depth costs latency and tokens on *every* request. Stay flat until a single supervisor visibly misroutes; then group.
- **Leaking the hierarchy.** If the top supervisor starts naming individual workers, you've collapsed the abstraction — keep each layer blind to its grandchildren.
- **Confusing it with a [sequential pipeline](sequential-pipeline.md).** Hierarchy is about *who routes to whom*; a pipeline is a fixed order. You can have a hierarchy whose teams internally run pipelines.

## Interview tip
Say: *"Hierarchical multi-agent is supervisors-of-supervisors — I reach for it when a flat team has too many workers for one manager to route reliably. Grouping into teams keeps each routing decision down to a few options, at the cost of an extra hop per layer, so I only add depth when a flat design starts misrouting."* That frames it as a scaling tool with a real cost, not a default.
