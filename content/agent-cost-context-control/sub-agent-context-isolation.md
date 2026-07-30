# Sub-agent context isolation

**What it is:** Giving each sub-agent its own fresh, small context window for its sub-task, and returning only a compact result to the parent — instead of letting one giant shared context balloon with everyone's raw work.

## Why it matters for an AI Engineer

Isolation is how you scale an agent to a *complex* task without [overflowing context](context-window-overflow-on-long-runs.md) or paying quadratic costs. It's the architectural pattern behind orchestrator/worker and multi-agent systems. It also improves quality: a sub-agent with a clean, focused context reasons better than one drowning in ten other sub-tasks' noise. This is a favorite senior-interview topic because it forces you to reason about *where context lives* in a multi-agent system.

## The mechanism — separate contexts, thin interfaces

The naive multi-step agent has **one** message history that everything writes into. Every tool call, every reasoning trace, every sub-result piles into the same context — so it grows fast and the model gets distracted by irrelevant detail.

Isolation flips this. A **parent (orchestrator)** agent decomposes the task and spawns **sub-agents (workers)**, each with:

- its **own** system prompt scoped to its sub-task,
- its **own** context window that starts nearly empty,
- its own tools and its own loop.

The sub-agent does its messy work — 20 steps, 50 K tokens of scraped junk — entirely inside its private context. When done, it returns **only a compact result** (a summary, a structured answer, a filename) to the parent. All that intermediate noise **never touches the parent's context**.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 Orchestrator<span class="sub">small context</span></span>
    <span class="darr">↓<span class="lbl">spawn</span></span>
    <div class="flow">
      <div class="dgroup"><span class="dgt">SUB-AGENT A</span><span class="dbox orange">50K messy work<span class="sub">private</span></span></div>
      <div class="dgroup"><span class="dgt">SUB-AGENT B</span><span class="dbox orange">40K messy work<span class="sub">private</span></span></div>
    </div>
    <span class="darr">↓<span class="lbl">return only result</span></span>
    <span class="dbox green">✅ A: 1K summary + B: 1K summary → orchestrator</span>
  </div>
  <div class="dcap">Each sub-agent burns tokens in its own isolated context; only a small result crosses back. The parent stays lean.</div>
</div>

The key insight: **context isolation trades parallelism/tokens for a bounded orchestrator context.** You might spend *more* total tokens (multiple agents, some overhead) but you keep any single context small — which is what prevents overflow and keeps each agent sharp.

## Concrete example

Framework-agnostic orchestrator sketch:

```python
def orchestrator(task):
    subtasks = plan(task)                       # LLM decomposes the goal
    results = []
    for st in subtasks:
        # each sub_agent() starts a FRESH context; its internal steps
        # never enter the orchestrator's history
        result = sub_agent(system=scoped_prompt(st),
                           task=st,
                           tools=tools_for(st),
                           step_cap=15)
        results.append(compact(result))         # keep only the summary
    return synthesize(task, results)            # orchestrator sees only summaries
```

In LangGraph this is a subgraph invoked as a node; in the OpenAI/Anthropic Agents SDKs it's a sub-agent or "agent-as-tool." The mechanic is identical: **the child's transcript stays in the child.**

## How a company uses this

A Dubai real-estate portal built an agent that answers "find me 3-bed villas under 4M AED in Arabian Ranches with recent price drops." One monolithic agent had to search listings, fetch each detail page (huge HTML), check price history, and rank — all in one context that hit 180 K tokens on a busy query. They refactored to an orchestrator + a **`listing_researcher` sub-agent per candidate villa**. Each sub-agent fetches and parses one listing's messy 30 K-token page in isolation and returns a **300-token structured summary**. The orchestrator now peaks around **25 K tokens** regardless of how many villas match, and the sub-agents run **in parallel**, cutting wall-clock latency from ~40 s to ~9 s. Total tokens rose ~20%, but no overflow and 4× faster — a trade the product happily took.

## Common mistakes
- **Returning raw sub-agent transcripts to the parent** — that defeats the entire purpose; return only compact results.
- **Over-decomposing** — spawning a sub-agent for a trivial one-call task adds orchestration overhead for no benefit.
- **Losing traceability** — with private contexts, a failure inside a sub-agent is invisible unless you log each sub-agent's [trajectory](replayable-debuggable-trajectories.md) separately.
- **Assuming isolation is free** — you pay for extra agents and their startup context; use it when context bloat or parallelism justifies it.

## Interview tip
Say: *"Sub-agent isolation gives each worker its own fresh context, so all its messy intermediate work stays private and only a compact result returns to the orchestrator. That keeps the parent context small and bounded no matter how big the sub-tasks are, and lets sub-agents run in parallel. The trade is slightly more total tokens for no overflow and better focus — I reach for it when a single-context agent would balloon past the window."* This shows you think about *where context lives*, which is the senior signal.
