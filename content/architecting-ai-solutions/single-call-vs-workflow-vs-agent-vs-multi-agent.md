# Single call vs workflow vs agent vs multi-agent

**What it is:** the decision of *how much autonomy* to give your system — from one LLM call, to a fixed pipeline you script, to an agent that decides its own steps, to a team of agents.

## Why it matters for an AI Engineer

This is where over-engineering does the most damage. "Agents" is the buzzword of the era, so the reflex is to build one for everything. But autonomy is a *trade-off, not an upgrade*: more autonomy means more flexibility **and** more ways to fail, higher cost, higher latency, and much harder debugging. The senior skill is picking the *least* autonomy that does the job. An interviewer who hears "I'd use a multi-agent system" for a task a scripted workflow handles has learned you'll build them something expensive and flaky.

## The mechanism: the autonomy spectrum

The four options trade **control** for **flexibility**. As you go right, *you* decide less and the *model* decides more:

<div class="diagram">
  <div class="flow">
    <span class="dbox green">1️⃣ Single call<span class="sub">you: everything</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🔗 Workflow<span class="sub">you script the steps</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🤖 Agent<span class="sub">model picks the steps</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖🤖 Multi-agent<span class="sub">agents coordinate</span></span>
  </div>
  <div class="dcap">Left = predictable & cheap & debuggable. Right = flexible but costly & hard to trace.</div>
</div>

1. **Single call** — one prompt, one response. Predictable, cheap, instant to debug. Use for anything that's one logical step: classify, summarize, extract, answer-from-context.
2. **Workflow (chain)** — *you* wire a fixed sequence of steps in code: call A → parse → call B → if X then C. The LLM does sub-tasks; **the control flow is deterministic because you wrote it.** Use when the task has known, fixed steps. This is the sweet spot for most "complex" AI features and the most under-used option.
3. **Agent** — you give the model a goal and tools, and *it* decides which tool to call, in what order, and when it's done (the reason→act→observe loop). Use when the steps **genuinely can't be known in advance** — the path depends on what it discovers. Cost: it makes extra LLM calls just to *decide*, can loop, and is hard to reproduce.
4. **Multi-agent** — several specialized agents (researcher, coder, reviewer) coordinate. Use only when a task truly splits into parallel specialties or needs separate contexts. Every added agent multiplies cost, latency, and failure surface, and inter-agent communication is a whole new class of bug.

| Option | You control | Reach for it when | Cost/complexity |
|---|---|---|---|
| **Single call** | everything | one logical step | 💲 |
| **Workflow** | the sequence | steps are known & fixed | 💲💲 |
| **Agent** | the goal + tools | the path is dynamic | 💲💲💲 |
| **Multi-agent** | roles + protocol | parallel specialties / separate contexts | 💲💲💲💲 |

**The rule:** if you can draw the flowchart, build a **workflow** — don't make an agent rediscover a path you already know. Reserve agents for when the flowchart genuinely depends on runtime discoveries.

## Worked example: same task, two designs

"Answer a customer's question about their order, escalating to a human if it's a complaint."

- **Workflow (right choice):** classify intent → if "order status", call `get_order(id)` and answer → if "complaint", file ticket + hand to human → else RAG over the FAQ. You know every branch. Deterministic, ~1–2 LLM calls, trivial to test.
- **Agent (wrong choice here):** give it tools and let it figure out the path. It works, but now it makes an extra call *per step just to decide the next step*, sometimes calls the wrong tool, occasionally loops, and every run is different so bugs are hard to reproduce. You paid for flexibility you didn't need — the branches were fixed.

The task only needs an agent if the questions are genuinely open-ended ("help me plan a multi-city trip and rebook everything if a flight's cancelled") where the sequence truly can't be scripted.

## How a company uses this

> **A Dubai e-commerce company's returns assistant.** The vendor proposed a multi-agent system. The team mapped the actual task and found it was ~six fixed branches — a textbook **workflow**. They shipped it as a scripted chain with two tools (order lookup, refund API) and a mid-tier model: p95 ~1.8s, ~2 LLM calls per request, fully reproducible in tests. Later, one genuinely open-ended feature — "resolve any post-purchase problem," where the path really does depend on what the customer says — got a **single agent** with the same tools. Multi-agent never shipped: no part of the job split into independent specialties. The whole cost story hinged on *not* granting autonomy the task didn't require — the workflow ran a fraction of the agent's per-request cost.

## Common mistakes
- **Agent-first.** Building an agent for a task whose steps you could list. If you can flowchart it, it's a workflow.
- **Multi-agent for a single-context job.** Splitting into "agents" that just hand a string back and forth adds coordination bugs for no gain. One agent with several tools usually beats several agents.
- **Single call for genuinely multi-step tasks.** The opposite error — cramming a 4-step task into one giant prompt that then fails silently. Break it into a workflow.
- **Ignoring debuggability.** Agents are non-deterministic; the same input can take different paths. If you can't reproduce a bug, you can't fix it. That alone is a reason to prefer workflows.

## Interview tip
Say: *"I place tasks on an autonomy spectrum: single call, scripted workflow, agent, multi-agent — control trading off against flexibility. My default is the *lowest* one that works: if I can draw the flowchart, it's a workflow, not an agent. I only give the model control of the flow when the path genuinely depends on runtime discoveries, and I only add a second agent when the task splits into real parallel specialties. Autonomy is a cost, not a feature."* This is the exact judgment that signals seniority. Pairs with [climb only when the rung below fails](climb-only-when-the-rung-below-fails.md).
