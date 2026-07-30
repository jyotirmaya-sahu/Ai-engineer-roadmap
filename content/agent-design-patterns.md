# Agent Design Patterns

**The one-line idea:** there are only a handful of proven ways to wire an LLM into a working system — chain the calls, route to the right specialist, run some in parallel, let a coordinator split the work, or let the model loop until it's happy. These are the **agent design patterns**, and almost every real AI product is one of them (or a mix).

## Why we even need it

The moment you go past "one prompt, one answer," you face a design choice: **how do multiple LLM calls fit together?** Beginners reach for the flashiest option — "give the model all the tools and let it figure it out" — and get a system that's slow, expensive, and impossible to debug. The whole industry learned this the hard way, and in late 2024 Anthropic published *Building Effective Agents*, which named the small set of patterns that actually work in production. This node teaches that vocabulary.

The key distinction underneath everything: a **workflow** is a system where *you* wrote the control flow — the LLM fills in steps you laid out in code. An **agent** is a system where *the model* decides the control flow — what to do next, which tool to call, when to stop. Workflows are predictable and cheap; agents are flexible and risky. Knowing which you're building is the single most important architecture decision.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 A task that needs an LLM</span>
    <span class="darr">↓<span class="lbl">is the path fixed?</span></span>
    <div class="flow">
      <span class="dbox blue wide">🧩 WORKFLOW<span class="sub">you code the steps</span></span>
      <span class="dbox purple wide">🤖 AGENT<span class="sub">model codes the steps</span></span>
    </div>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox">⛓️ Chain</span>
      <span class="dbox">🔀 Route</span>
      <span class="dbox">⚡ Parallel</span>
      <span class="dbox">🧭 Orchestrator</span>
      <span class="dbox">♻️ Eval-optimize</span>
      <span class="dbox purple">🪞 Reflect</span>
      <span class="dbox purple">🗺️ Plan</span>
    </div>
  </div>
  <div class="dcap">Every LLM system is a composition of these patterns; the first fork is workflow (fixed path) vs agent (model-chosen path).</div>
</div>

## Why it matters for an AI Engineer

This is the core skill the "AI Engineer" title is built on. Anyone can call an LLM API. The job is knowing **which pattern fits the problem** — because the wrong one either overpays (autonomous agent for a task a simple chain would nail) or underdelivers (rigid chain for a task that genuinely needs the model to decide). In real Dubai job descriptions, "design and build agentic workflows" now shows up as often as "prompt engineering." Interviewers probe this directly: *"walk me through how you'd architect X."* If you answer with these named patterns and their tradeoffs, you sound like someone who has shipped; if you say "I'd use an agent," you sound like someone who has only done demos.

## The patterns you'll learn (and when to reach for each)

| Pattern | Core idea | Reach for it when |
|---|---|---|
| **[Prompt chaining](agent-design-patterns/prompt-chaining.md)** | split a task into fixed sequential steps, each LLM call feeds the next | the task cleanly decomposes into ordered subtasks |
| **[Routing](agent-design-patterns/routing.md)** | classify the input, send it to a specialized handler | inputs fall into distinct categories needing different treatment |
| **[Parallelization](agent-design-patterns/parallelization.md)** | run independent LLM calls at once, then aggregate | subtasks don't depend on each other, or you want multiple votes |
| **[Orchestrator-workers](agent-design-patterns/orchestrator-workers.md)** | a lead LLM dynamically breaks the task into subtasks and delegates | you can't predict the subtasks in advance |
| **[Evaluator-optimizer](agent-design-patterns/evaluator-optimizer.md)** | one LLM produces, another critiques, loop until it passes | quality has clear criteria and iteration measurably helps |
| **[Reflection](agent-design-patterns/reflection.md)** | the model reviews and revises its own output | a single pass is often flawed and self-review catches it |
| **[Planning](agent-design-patterns/planning.md)** | the model writes a multi-step plan, then executes it | the task is open-ended with no fixed sequence |
| **[Workflow vs autonomous agent](agent-design-patterns/workflow-vs-autonomous-agent.md)** | the meta-decision: fixed code path vs model-driven loop | *always* — this choice frames every project |

## Real world: how a company uses this

> **A Dubai fintech** building a customer-support assistant started with a single autonomous agent — "here are 15 tools, help the customer." It was slow (5–8 LLM calls per reply), cost ~$0.40 a conversation, and occasionally looped forever refunding the same charge. They rearchitected around patterns: a cheap **router** first classifies the message (balance query / dispute / general), balance queries go through a **2-step chain** (fetch → format), and only genuine disputes escalate to a bounded **orchestrator** agent. Median cost fell to ~$0.03, latency halved, and the runaway-loop incidents stopped — because 90% of traffic never touches an autonomous loop at all.

## Interview tip
Say: *"I don't reach for an autonomous agent by default — most tasks are workflows in disguise. I start with the simplest pattern that works: a prompt chain if the steps are fixed, routing if inputs vary, parallelization for independent subtasks. I only add autonomy — orchestrator-workers or a planning loop — when I genuinely can't predict the steps, and I always bound it with step caps. That's straight out of Anthropic's *Building Effective Agents*: find the lowest-complexity pattern that solves it."* That framing signals production judgment, not demo enthusiasm.

---

*Below: deep-dive articles on each agent design pattern.*
