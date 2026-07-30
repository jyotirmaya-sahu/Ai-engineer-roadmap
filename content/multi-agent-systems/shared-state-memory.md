# Shared State / Memory

**What it is:** a common data object that all agents read from and write to — a shared workspace — instead of passing messages back and forth. The "blackboard" model of coordination.

## Why it matters for an AI Engineer

Shared state is the other fundamental communication model (versus [message passing](message-passing.md)), and it's the one LangGraph is built on. It's usually the more *efficient* and *controllable* choice for structured multi-agent work: agents don't re-read a growing transcript, they read exactly the fields they need from a typed object. For an AI Engineer, understanding shared state is essential because it's how you keep multi-agent context small and predictable — each agent sees the current *facts*, not the whole conversation that produced them.

## The mechanism / how it works

You define a **state object** — a typed dictionary of the fields the team works on (`task`, `draft`, `facts`, `approved`, …). Every agent is a function: it receives the current state, does its job, and returns an *update* (which fields changed). The framework merges updates back into the shared state, and the next agent reads the fresh version.

Two things make this powerful:

1. **Selective reads.** An agent takes only the fields it needs. The writer reads `facts`, ignores everything else — its context stays tiny regardless of how much total state exists.
2. **Controlled writes.** Updates are explicit ("I changed `draft`"), so you can log exactly what each agent mutated. That's far easier to debug than inferring changes from a chat transcript.

The subtlety is **concurrent writes**: if two agents run in [parallel](concurrent-parallel.md) and both write the same field, you need a *reducer* that says how to combine them (append to a list, keep the latest, etc.), or one clobbers the other.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue wide">🗂️ Shared state<span class="sub">task · facts · draft · approved</span></span>
  </div>
  <div class="flow">
    <span class="dbox purple">🔎 Researcher<span class="sub">writes facts</span></span>
    <span class="dbox purple">✍️ Writer<span class="sub">reads facts→writes draft</span></span>
    <span class="dbox purple">🕵️ Critic<span class="sub">reads draft→writes approved</span></span>
  </div>
  <div class="dcap">A shared blackboard: each agent reads the fields it needs and writes back only what it changed.</div>
</div>

## A concrete example

LangGraph state, with a reducer for a concurrently-written field:

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
import operator

class State(TypedDict):
    task: str
    facts: Annotated[list, operator.add]   # reducer: parallel writes APPEND, not overwrite
    draft: str
    approved: bool

def researcher(s): return {"facts": find_facts(s["task"])}   # only touches 'facts'
def writer(s):     return {"draft": write(s["facts"])}       # reads 'facts' only
def critic(s):     return {"approved": check(s["draft"])}

g = StateGraph(State)
for n, f in [("researcher", researcher), ("writer", writer), ("critic", critic)]:
    g.add_node(n, f)
g.add_edge(START, "researcher"); g.add_edge("researcher", "writer")
g.add_edge("writer", "critic");  g.add_edge("critic", END)
app = g.compile()
```

Each node returns *only the changed field*. The `operator.add` reducer means if two agents wrote `facts` in parallel, their lists merge instead of one erasing the other.

## How a company uses this

A Dubai e-commerce company runs a product-listing pipeline on shared state: a state object holds the product, and specialist agents fill different fields — one writes the SEO title, one the description, one the category tags, one the compliance flags. They run several of these agents in parallel writing *different* fields, so there's no conflict, and each agent's context is just "here's the product" plus its one job. Using shared state instead of a message transcript cut their per-listing token cost by roughly half — no agent re-reads a conversation, it just reads the product object. The explicit writes also give them a clean per-field audit of which agent set what.

## Common mistakes / misconceptions

- **Concurrent writes without a reducer.** Two parallel agents writing the same field silently overwrite each other. Define how updates merge.
- **A giant god-state.** Cramming everything into one huge object means every agent loads it all. Keep state lean; agents read only their fields.
- **Using shared state for genuine dialogue.** When the back-and-forth *is* the point (debate, negotiation), [message passing](message-passing.md) reads more naturally.
- **Unbounded growth.** State fields like `facts` or `history` can grow forever; trim or checkpoint them on long runs.

## Interview tip
Say: *"Shared state is a typed blackboard — each agent reads only the fields it needs and writes back only what it changed, which keeps context small and gives per-field audit. It's LangGraph's model and my default for structured work; the one gotcha is concurrent writes, where I add a reducer so parallel updates merge instead of clobbering. I switch to message passing only when the dialogue itself is the product."* That contrast is exactly what interviewers want.
