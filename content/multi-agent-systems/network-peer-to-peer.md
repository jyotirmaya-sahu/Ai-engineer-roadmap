# Network / Peer-to-Peer

**What it is:** the "no boss" architecture — any agent can hand off to any other agent directly, with no central supervisor routing traffic.

## Why it matters for an AI Engineer

Most tasks want a [supervisor](supervisor-orchestrator.md), but some are genuinely open-ended — you don't know the order of steps in advance, and forcing everything through one manager becomes a bottleneck. A network lets agents collaborate fluidly, deciding among themselves who acts next. The AI-Engineer skill here is *restraint*: knowing this is the most flexible **and** the hardest-to-debug pattern, so you only use it when the problem truly can't be pre-structured. Recognizing when *not* to reach for it is the senior move.

## The mechanism / how it works

In a network, each agent's toolset includes **handoff tools** — one per other agent it's allowed to pass control to. When an agent decides another is better suited, it calls that handoff, transferring control (and usually the shared state) to the target. There's no hub; the "routing" is distributed across every agent's own decisions.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🔎 Research</span>
    <span class="darr">→<span class="lbl">handoff</span></span>
    <span class="dbox blue">✍️ Write</span>
    <span class="darr">→</span>
    <span class="dbox blue">🕵️ Critic</span>
  </div>
  <div class="flow">
    <span class="darr">↑<span class="lbl">critic can hand back to anyone</span></span>
  </div>
  <div class="dcap">Any agent may hand off to any other — flexible, but no single place traces the path.</div>
</div>

The freedom is the danger. With no central controller, the *whole system* can loop (A→B→A→B), stall (nobody takes ownership), or wander (agents pass a task around without finishing). You must build the guardrails yourself: a shared step counter that halts the run, a clear "who finishes" convention, and logging on every handoff so you can reconstruct the path after the fact. Everything the supervisor gave you for free, you now do by hand.

## A concrete example

Handoffs as tools (the model the OpenAI Agents SDK and modern LangGraph both use):

```python
from langgraph.graph import StateGraph, MessagesState, START
from langgraph.types import Command
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o")

def make_agent(name, peers):
    def node(state) -> Command:
        # the LLM may respond, OR emit a handoff to a peer
        decision = model.invoke(state["messages"])  # returns next agent or FINISH
        target = pick_handoff(decision, peers)       # parse to a peer name or None
        return Command(goto=target or "__end__",
                       update={"messages": [decision]})
    return node

g = StateGraph(MessagesState)
g.add_node("research", make_agent("research", ["write"]))
g.add_node("write",    make_agent("write", ["research", "critic"]))
g.add_node("critic",   make_agent("critic", ["write"]))
g.add_edge(START, "research")
app = g.compile()  # NOTE: add a step-count guard in state or it can loop forever
```

Each node returns a `Command(goto=...)` — that *is* the peer-to-peer handoff. No supervisor node exists.

## How a company uses this

A Dubai game studio uses a peer-to-peer swarm for open-ended design brainstorming: a "worldbuilder," a "narrative," and a "mechanics" agent bounce ideas among themselves with no fixed order, which suits creative divergence better than a rigid pipeline. But they cap the swarm at 12 total handoffs and log every one — early versions ran the token bill to \$40 on a single session by ping-ponging between two agents. The cap and logs turned an unshippable toy into a tool. For their *shipping* content pipeline, they deliberately switched back to a supervisor: creativity wants a network, production wants a hub.

## Common mistakes / misconceptions

- **Using it as a default.** Networks are for genuinely unstructured collaboration. If you can name the steps, use a supervisor or [pipeline](sequential-pipeline.md).
- **No global stop condition.** With no hub, nothing naturally ends the run — you *must* add a shared step budget or it loops (see [infinite-loops.md](infinite-loops.md)).
- **No handoff logging.** Without a trace of every handoff, a misbehaving network is nearly impossible to debug.

## Interview tip
Say: *"Network / peer-to-peer lets any agent hand off to any other with no supervisor — maximum flexibility for open-ended tasks, but I lose the single trace point, so I add a global step budget and log every handoff. I only pick it when the task order genuinely can't be pre-structured; otherwise a supervisor is more debuggable."* Showing you know its danger is the point.
