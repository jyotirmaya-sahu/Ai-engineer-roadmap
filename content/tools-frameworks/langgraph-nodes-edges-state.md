# LangGraph (nodes/edges/state)

**What it is:** a framework that models an agent as an explicit **graph** — *nodes* are steps, *edges* are the paths between them, and a shared *state* object flows through — giving you the control, loops, and checkpoints that high-level agents hide.

## Why it matters for an AI Engineer

This is *the* production-agent framework in 2026, and it's on nearly every serious AI Engineer job description. The reason: real agents need control that a black-box loop can't give — conditional branching, hard loop limits, human-in-the-loop pauses, and the ability to resume after a crash. LangGraph makes the agent's control-flow *explicit and inspectable*: you can see every step, put a cap on any loop, and pause for approval before a risky action. If [LangChain](langchain-agents.md) agents are "describe your tools and hope," LangGraph is "draw the exact flow." Being able to reason in nodes/edges/state is what separates people who ship reliable agents from people whose demos loop forever.

## The mechanism — nodes, edges, state

Three concepts, and that's genuinely all:

- **State** — a shared dictionary (a `TypedDict`) that carries everything: the messages, intermediate results, a step counter. Every node reads it and returns updates to it.
- **Nodes** — plain functions. Each takes the state, does one thing (call the LLM, run a tool, check a condition), and returns a partial state update. One node = one step.
- **Edges** — how nodes connect. A **normal edge** always goes A→B. A **conditional edge** runs a router function on the state and *chooses* the next node — this is how you branch and how you *loop* (edge back to an earlier node). You reach a special `END` node to stop.

Because the loop is an explicit edge you control, you can **cap it** (route to `END` after N steps), **pause it** (a human-approval node), and — via a **checkpointer** — save state after every node so a crashed run resumes exactly where it stopped. That last property is why production teams pick it.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🟢 START</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 agent node<span class="sub">LLM decides</span></span>
    <span class="darr">↓<span class="lbl">conditional edge: tool? or done?</span></span>
    <span class="dbox orange">🔧 tools node</span>
    <span class="darr">↑<span class="lbl">edge loops back to agent</span></span>
    <span class="dbox green">✅ END<span class="sub">when no tool needed / step cap hit</span></span>
  </div>
  <div class="dcap">A conditional edge routes agent→tools→agent (the loop) or agent→END. YOU control when it stops.</div>
</div>

## Concrete example (runnable, 2026-current)

```python
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from typing import Annotated, TypedDict
from langgraph.graph.message import add_messages

@tool
def get_weather(city: str) -> str:
    """Weather for a city."""
    return f"{city}: 41°C"

model = ChatOpenAI(model="gpt-5.4-mini").bind_tools([get_weather])

class State(TypedDict):
    messages: Annotated[list, add_messages]   # reducer: appends instead of overwrites

def agent(state):                              # a NODE
    return {"messages": [model.invoke(state["messages"])]}

def route(state):                              # a CONDITIONAL EDGE
    return "tools" if state["messages"][-1].tool_calls else END

g = StateGraph(State)
g.add_node("agent", agent)
g.add_node("tools", ToolNode([get_weather]))
g.add_edge(START, "agent")
g.add_conditional_edges("agent", route)        # agent -> tools OR END
g.add_edge("tools", "agent")                   # loop back
app = g.compile()                              # add checkpointer=... to resume after crash

out = app.invoke({"messages": [{"role": "user", "content": "Weather in Dubai?"}]})
print(out["messages"][-1].content)
```

The loop (`tools → agent`) is an *explicit edge you drew* — so you can cap it, log it, or pause it. That visibility is the whole point.

## How a company uses this — production lens

> **A Dubai insurance company** runs a claims-triage agent on LangGraph. The graph: `intake → retrieve policy → assess → [human-approval node] → notify`. Three production features earn their keep: (1) a **step counter in the state caps the assess↔retrieve loop at 6** — before this, one ambiguous claim looped 20+ times and cost ~$6; (2) the **human-approval node pauses** the graph before any payout is authorized, and a claims officer approves in a dashboard — the run literally *waits*, state saved by the checkpointer; (3) when a downstream API crashed mid-run, the **checkpointer resumed** the exact claim from the `assess` node instead of restarting and re-billing the LLM. They also get a **replayable trace** of every node for audit — a compliance requirement. None of this is cleanly possible with a black-box agent loop.

## Common mistakes

- **Forgetting the reducer on `messages`.** Without `add_messages`, each node *overwrites* the list instead of appending — you lose history. Use the `Annotated[list, add_messages]` reducer.
- **No loop cap.** A conditional edge that can cycle forever *will*, on some input. Track a step count in state and route to `END`.
- **Skipping the checkpointer in production.** No checkpointer = no resume, no human-in-the-loop pause. Add one.
- **Over-graphing simple tasks.** If it's one prompt, don't build a 6-node graph. Match the tool to the problem.
- **Mutating state in place.** Nodes should *return* updates, not mutate the passed-in dict.

## Interview tip
Say: *"LangGraph models the agent as nodes, edges, and shared state, so the control-flow is explicit. That gives me conditional branching, a hard cap on the tool loop, human-in-the-loop pauses, and — via a checkpointer — resume-after-crash and replayable traces for audit. It's what I reach for when an agent goes to production."* Then draw the agent→tools→agent loop and point to where you'd cap it. That single diagram wins the question. Compare with [CrewAI](crewai.md) and [AutoGen](autogen.md), which trade control for a simpler team abstraction.
