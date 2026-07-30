# Multi-Agent Systems

**The one-line idea:** instead of one LLM trying to do everything, you split the work across **several specialist agents** — a researcher, a writer, a critic — coordinated like a team with a manager. Each agent has one job, its own tools, and its own prompt.

## Why more than one agent?
A single agent with 20 tools and a 3-page prompt gets confused, picks wrong tools, and loses the thread. Splitting into focused agents = each prompt is short and clear, each agent is easy to test, and you can mix models (cheap model for routing, strong model for reasoning). The tradeoff: coordination is hard and costs multiply.

## Common architectures

<div class="diagram">
  <div class="flow"><span class="dbox gray">👤 User request</span></div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow"><span class="dbox purple wide">🧭 Supervisor</span></div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow">
    <span class="dbox blue">🔎 Researcher<span class="sub">research</span></span>
    <span class="dbox blue">✍️ Writer<span class="sub">write</span></span>
    <span class="dbox blue">🕵️ Critic<span class="sub">check facts</span></span>
  </div>
  <div class="flow"><span class="darr">↓<span class="lbl">results return to supervisor</span></span></div>
  <div class="flow"><span class="dbox purple wide">🧭 Supervisor</span></div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow"><span class="dbox green">✅ Final answer</span></div>
  <div class="dcap">A supervisor routes each subtask to a specialist agent, then assembles their results into the final answer.</div>
</div>

| Architecture | Shape | Use when |
|---|---|---|
| **Supervisor / orchestrator** | one manager routes to workers | most business cases (clear, debuggable) |
| **Hierarchical** | managers of managers | large, layered tasks |
| **Network / peer-to-peer** | agents talk to each other freely | open-ended collaboration |
| **Sequential pipeline** | fixed assembly line A→B→C | well-defined workflows |

Start with **supervisor** — it's the easiest to reason about and 80% of real systems use it.

## A supervisor in LangGraph (the core pattern)

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

class State(TypedDict):
    task: str
    draft: str
    approved: bool
    tries: int          # ALWAYS cap iterations, or the loop can run forever

def researcher(s): return {"draft": research(s["task"])}
def writer(s):     return {"draft": polish(s["draft"]), "tries": s.get("tries", 0) + 1}
def critic(s):     return {"approved": is_good(s["draft"])}

def route(s):      # supervisor decision
    if s.get("approved") or s.get("tries", 0) >= 3:   # hard stop at 3 rewrites
        return END
    return "writer"

g = StateGraph(State)
g.add_node("researcher", researcher)
g.add_node("writer", writer)
g.add_node("critic", critic)
g.set_entry_point("researcher")
g.add_edge("researcher", "writer")
g.add_edge("writer", "critic")
# explicit path map is the clearer, recommended form
g.add_conditional_edges("critic", route, {"writer": "writer", END: END})
app = g.compile()
```

Notice the **evaluator-optimizer loop**: the critic sends bad drafts back to the writer until they pass. That's a named pattern interviewers love.

## Collaboration patterns to name-drop
- **Generator–critic / reflection:** one agent produces, another critiques, repeat.
- **Debate:** agents argue opposing sides; a judge picks — reduces errors on hard questions.
- **Voting / consensus:** run N agents, take the majority answer.

## Frameworks
| Framework | Style | Sweet spot |
|---|---|---|
| **CrewAI** | role/goal/backstory "crews" | fast to build, readable |
| **LangGraph** | explicit state graph | control, loops, production |
| **AutoGen** | conversational group chat | research, flexible dialogue |
| **OpenAI Agents SDK** | lightweight handoffs (replaced the deprecated *Swarm*) | OpenAI-native apps |

> **Interview trap:** don't cite **OpenAI Swarm** — it was experimental and is archived. The production successor is the **Agents SDK**. Naming the wrong one signals out-of-date knowledge.

## The hard problems (this is the senior-level signal)
1. **Cost explosion** — 4 agents × multiple turns = 10–20× the tokens of one call. Watch it or the bill destroys the ROI.
2. **Error propagation** — a wrong fact from the researcher poisons the writer and critic downstream.
3. **Infinite loops** — the critic never approves; you *must* cap iterations.
4. **Coordination overhead** — sometimes a single well-prompted agent beats a multi-agent maze. **Only go multi-agent when the task genuinely has separable sub-jobs.**
5. **Evaluation** — you now grade the *trajectory* (did each agent do its part), not just the final answer.

## Real world: how a company uses this

> **A wealth-management firm (your MS-Fabric project's real analog):** a client asks "should I rebalance my portfolio?" A **supervisor** dispatches a *data agent* (pull holdings from the warehouse), a *market agent* (fetch current prices), an *analysis agent* (compute allocation), and a *compliance agent* (check the advice is within regulation). The supervisor assembles a grounded, compliant answer. No single prompt could safely do all four — and the compliance agent is a hard guardrail the business requires.

## Interview tip
The line that separates juniors from seniors: **"multi-agent isn't automatically better — it multiplies cost and failure modes, so I only use it when the task has clearly separable roles, and I always cap iterations and evaluate the trajectory."** Say that and you sound like someone who's shipped one, not watched a demo.
