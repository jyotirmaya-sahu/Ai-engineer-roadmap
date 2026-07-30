# LangGraph multi-agent

**What it is:** LangChain's framework for building multi-agent systems as an explicit *state graph* — you define nodes (agents), edges (control flow), and a shared state object, giving you precise control over loops, branching, and coordination.

## Why it matters for an AI Engineer

LangGraph is the framework you reach for when you need **control and production-readiness**. Where [CrewAI](crewai-crews-flows.md) hides coordination and [AutoGen](autogen-group-chat.md) leans on free conversation, LangGraph makes the control flow *explicit and inspectable* — which is exactly what you want when the system has to be debuggable, checkpointed, and reliable under real traffic. It's the most-requested agent framework in 2026 production job posts, and it's the one this node's [overview](../multi-agent-systems.md) uses for its core examples. Knowing it deeply is a direct hiring signal.

## The mechanism / how it works

LangGraph is built on three primitives:

1. **State** — a typed [shared-state](shared-state-memory.md) object every node reads and writes, with reducers controlling how updates merge.
2. **Nodes** — functions (usually agents) that take the state, do work, and return updates.
3. **Edges** — the control flow. **Normal edges** wire A→B unconditionally; **conditional edges** call a routing function that returns the next node's name, enabling branching, loops, and [supervisor](supervisor-orchestrator.md) routing.

You compile the graph and invoke it. Because the flow is an explicit graph, LangGraph gives you production features other frameworks bolt on later: **checkpointing** (persist state, resume after a crash or human approval), **streaming** (emit intermediate steps), **human-in-the-loop** (interrupt at a node, wait for approval, resume), and **time-travel** (rewind to a prior state — see [replayable traces](../agent-reliability/replayable-traces.md)). It supports every architecture on this node — supervisor, hierarchical, network, pipeline — because they're all just different edge wirings over the same graph.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue wide">🗂️ Shared state</span>
  </div>
  <div class="flow">
    <span class="dbox purple">🧭 supervisor</span>
    <span class="darr">→<span class="lbl">conditional edge (route)</span></span>
    <span class="dbox blue">🔎 worker</span>
    <span class="darr">↺<span class="lbl">loop back</span></span>
    <span class="dbox green">✅ END</span>
  </div>
  <div class="dcap">Nodes + edges over shared state — explicit control flow means loops, branches, and routing are visible and debuggable.</div>
</div>

## A concrete example

A supervisor graph with a conditional edge (the loop that other frameworks hide):

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class State(TypedDict):
    task: str; draft: str; approved: bool; tries: int

def writer(s): return {"draft": write(s["task"]), "tries": s.get("tries", 0) + 1}
def critic(s): return {"approved": is_good(s["draft"])}

def route(s):                                   # conditional edge = supervisor decision
    if s["approved"] or s.get("tries", 0) >= 3: # hard cap prevents infinite loop
        return END
    return "writer"

g = StateGraph(State)
g.add_node("writer", writer); g.add_node("critic", critic)
g.add_edge(START, "writer"); g.add_edge("writer", "critic")
g.add_conditional_edges("critic", route, {"writer": "writer", END: END})
app = g.compile()                               # add checkpointer=... for persistence
```

The `add_conditional_edges` call is the whole point — the loop and stop condition are *explicit*, so you can see and cap exactly how the system iterates.

## How a company uses this

A Dubai bank runs its customer-facing assistant on LangGraph specifically for the production features. Checkpointing lets a conversation survive a server restart mid-task; the human-in-the-loop interrupt pauses the graph before any money-moving action for staff approval; and time-travel lets support replay the exact state sequence when a customer disputes an answer — critical for a regulated environment. At ~2,000 conversations/day, the explicit graph means every routing decision is logged and reproducible. They evaluated CrewAI for speed but chose LangGraph because *auditability and interrupts* were hard requirements the graph model made trivial.

## Common mistakes / misconceptions

- **Reaching for it on a simple prototype.** LangGraph's explicitness is overhead when a two-agent CrewAI script would do. Use it when you need control.
- **Forgetting reducers on parallel writes.** Concurrent nodes writing the same field need a reducer or one clobbers the other ([shared-state-memory.md](shared-state-memory.md)).
- **Uncapped conditional loops.** A conditional edge that always routes back is an [infinite loop](infinite-loops.md) — always include a stop condition (like the `tries` cap above).
- **Skipping the checkpointer in production.** Without it you lose the crash-recovery and human-in-the-loop features that are the main reason to pick LangGraph.

## Interview tip
Say: *"LangGraph models multi-agent systems as an explicit state graph — nodes, conditional edges, shared state — so control flow is visible and debuggable. I pick it for production because of checkpointing, human-in-the-loop interrupts, and time-travel replay, which matter for reliability and audit. It expresses every architecture; the trade-off is more upfront wiring than CrewAI, which I accept when I need control."* Citing the production features is exactly what senior interviewers probe for.
