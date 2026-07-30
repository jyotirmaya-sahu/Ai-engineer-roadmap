# Sequential Pipeline

**What it is:** an assembly line — agent A always runs, then B, then C, in a fixed order, each feeding its output to the next. No routing decisions, no manager.

## Why it matters for an AI Engineer

When you already *know* the steps, a pipeline is the cheapest, most reliable multi-agent shape there is. There's no supervisor LLM burning tokens to decide "what next" — the order is hard-coded, so it's deterministic, easy to test stage by stage, and trivial to trace. For an AI Engineer, recognizing that a task is a fixed workflow (not an open-ended one) lets you skip the whole cost and complexity of dynamic routing. Many teams over-build a supervisor when a three-line pipeline would do.

## The mechanism / how it works

Each stage is an agent (or plain function) that takes the accumulated state, does one transformation, and passes it forward. The connection between stages is *code*, not an LLM decision — you literally wire `A → B → C`. Because there's no manager choosing paths, there's nothing to hallucinate a wrong route and no risk of routing loops.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Raw input</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔎 Extract</span>
    <span class="darr">→</span>
    <span class="dbox orange">🧮 Transform</span>
    <span class="darr">→</span>
    <span class="dbox purple">✍️ Summarize</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Output</span>
  </div>
  <div class="dcap">A fixed order, wired in code — no supervisor decides the path, so it's deterministic and cheap.</div>
</div>

The limitation is exactly its strength inverted: it can't adapt. If some inputs need to *skip* a stage or loop back, a pure pipeline can't express that — you'd add a conditional edge (which starts turning it into a [supervisor](supervisor-orchestrator.md)) or a [reflection loop](reflection-loop.md). So the rule is: pipeline when the path is the same every time; add routing only when inputs genuinely branch.

## A concrete example

A pipeline in LangGraph is just edges with no conditionals:

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class S(TypedDict):
    text: str
    facts: list
    summary: str

def extract(s):   return {"facts": pull_facts(s["text"])}
def transform(s): return {"facts": normalize(s["facts"])}
def summarize(s): return {"summary": write_summary(s["facts"])}

g = StateGraph(S)
for name, fn in [("extract", extract), ("transform", transform), ("summarize", summarize)]:
    g.add_node(name, fn)
g.add_edge(START, "extract")
g.add_edge("extract", "transform")     # fixed order, no decision
g.add_edge("transform", "summarize")
g.add_edge("summarize", END)
app = g.compile()
```

Every run walks the exact same path. You can test `extract`, `transform`, and `summarize` in isolation like normal functions.

## How a company uses this

A Dubai logistics firm processes ~10,000 scanned delivery documents a day through a fixed pipeline: OCR agent → field-extraction agent → validation agent → database-write. Because it's sequential and deterministic, they can pinpoint failures to an exact stage (validation catches 4% of docs and routes them to humans) and they pay for zero routing overhead — no supervisor LLM call per document, which at 10k/day is real money saved. When someone proposed a "smart" supervisor version, they rejected it: the steps never change, so dynamic routing would add cost and a new failure mode for no benefit.

## Common mistakes / misconceptions

- **Using a supervisor for a fixed workflow.** If the order never changes, a supervisor's routing LLM is pure waste — one extra call per step for a decision you already know.
- **Forcing branching into a pipeline.** The moment some inputs need different paths, a pure pipeline strains. Add conditional routing then, not before.
- **No per-stage validation.** A pipeline propagates a bad early output straight to the end — see [error-propagation.md](error-propagation.md). Validate between stages.

## Interview tip
Say: *"A sequential pipeline is my choice when the steps are the same every time — the order is wired in code, so there's no routing LLM, it's deterministic, and I can test each stage alone. I only upgrade to a supervisor when inputs genuinely branch."* It signals you don't reach for machinery you don't need.
