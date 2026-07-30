# Shared Scratchpad

**What it is:** a specific kind of [shared state](shared-state-memory.md) — a common "working notes" space where agents jot intermediate thoughts, partial results, and to-do items as they collaborate, like a shared whiteboard the whole team writes on.

## Why it matters for an AI Engineer

A scratchpad is how agents keep *reasoning* visible to each other without dumping their entire context. One agent writes "I checked source A, it's outdated"; another reads that and doesn't waste a call re-checking A. For an AI Engineer, a well-designed scratchpad is a cheap way to reduce duplicated work and keep a team of agents *coordinated on progress* — it's the difference between agents that build on each other and agents that redo each other's work. It's also the artifact you inspect when debugging *why* a team reached its answer.

## The mechanism / how it works

The scratchpad is a mutable field in shared state (often a running list or markdown blob) reserved for **process notes**, distinct from the final output fields. Agents *append* to it: observations, decisions, open questions, "done" markers. When an agent takes a turn, it reads the scratchpad to see what's already been figured out, adds its contribution, and writes back.

Two design rules make it work:

1. **Append, don't overwrite.** The scratchpad is a shared log — each agent adds, so the reducer for that field is "concatenate" (like [shared state](shared-state-memory.md)'s `operator.add`). Overwriting erases teammates' notes.
2. **Bound it.** A scratchpad grows every turn and re-loads into every agent's context — so it has the same balloon risk as a message transcript. Summarize or trim it on long runs, keeping the live "still-relevant" notes and compacting the rest.

The scratchpad differs from full [message passing](message-passing.md) in *intent*: messages are addressed communication ("writer, do this"); the scratchpad is a shared *notepad* of facts and status anyone can consult. Many systems use both — messages to coordinate, a scratchpad to accumulate findings.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue wide">📝 Scratchpad<span class="sub">shared notes — append only</span></span>
  </div>
  <div class="flow">
    <span class="dbox purple">🔎 A: "source X is stale ✅"</span>
    <span class="dbox purple">🧮 B: "used Y, got 42"</span>
    <span class="dbox purple">✍️ C: reads both, writes draft</span>
  </div>
  <div class="dcap">A shared whiteboard of findings and status — agents build on each other instead of redoing work.</div>
</div>

## A concrete example

A scratchpad field agents append to:

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
import operator

class State(TypedDict):
    task: str
    scratchpad: Annotated[list[str], operator.add]  # append-only shared notes
    answer: str

def analyst(s):
    note = "Checked Q3 filings: revenue AED 12M, up 8%."
    return {"scratchpad": [f"[analyst] {note}"]}     # appends one note

def writer(s):
    # reads the accumulated notes instead of redoing the analysis
    notes = "\n".join(s["scratchpad"])
    return {"answer": summarize(s["task"], notes)}

g = StateGraph(State)
g.add_node("analyst", analyst); g.add_node("writer", writer)
g.add_edge(START, "analyst"); g.add_edge("analyst", "writer"); g.add_edge("writer", END)
app = g.compile()
```

The writer consumes the analyst's notes verbatim — no re-computation. That's the scratchpad's whole value.

## How a company uses this

A Dubai due-diligence firm runs a team of agents assessing acquisition targets. Each agent (financials, legal, market, reputation) writes findings to a shared scratchpad as it goes. The synthesis agent reads the *whole* scratchpad to write the final memo, and — crucially — because the scratchpad is the running record, a human analyst reviews it to catch a hallucinated figure *before* it reaches the client memo. They cap the scratchpad and summarize it once it passes ~4,000 tokens, since on complex targets it grew large enough to slow every agent's turn. The summary keeps live risks and compacts settled points.

## Common mistakes / misconceptions

- **Overwriting the scratchpad.** It's a shared log; overwrite and you delete teammates' work. Append (concatenate reducer).
- **Letting it grow forever.** It reloads into every agent's context — same balloon problem as transcripts. Summarize/trim past a threshold.
- **Mixing final output into the scratchpad.** Keep process notes separate from the answer field, or you can't cleanly extract the result.
- **No structure.** A wall of freeform notes gets ignored; light structure (`[agent] fact`) keeps it scannable by both agents and humans.

## Interview tip
Say: *"A shared scratchpad is an append-only notes field in shared state where agents record findings and status so they build on each other instead of redoing work — and it doubles as the human-readable audit trail. I keep it append-only and summarize it past a token threshold, because like any shared transcript it reloads into every agent's context."* That shows you know both its value and its cost.
