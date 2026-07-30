# Agent Cost & Context Control

**The one-line idea:** An agent is a loop that keeps calling an LLM until a task is done — and left unsupervised, that loop will overflow its context window, spin forever, or run up a four-figure token bill on a single task. This node is the set of guardrails that keep an agent *cheap, bounded, and correct* over long runs.

## Why we even need it

A single LLM call is easy to reason about: one prompt in, one answer out, a fixed cost you can predict. An **agent** is different. It calls the model, gets back a tool call, runs the tool, feeds the result back into the model, and repeats — 5, 20, sometimes 200 times for one task. Three things go wrong as that loop runs:

1. **Context grows on every step.** Each tool result gets appended to the message history. A web-scrape tool that returns 40 KB of HTML, called eight times, is 320 KB of context — and you *re-send all of it* on every subsequent model call, because LLMs are stateless. Cost per step climbs, and eventually you hit the context-window ceiling and the whole run crashes.
2. **The loop can fail to terminate.** The model gets stuck retrying a broken tool, or two sub-agents ping-pong the same subtask. Without a step cap it runs until it hits the context limit or your credit card declines.
3. **Cost is unbounded by default.** A demo agent that costs $0.03 per run in testing can cost $8 in production when a user gives it a hard task — because input tokens are re-billed every single step. Nobody notices until the invoice.

So "agent cost & context control" is the difference between a cool demo and a system you can actually put in front of paying users.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Task</span>
    <span class="darr">↓</span>
    <div class="dgroup"><span class="dgt">AGENT LOOP (repeats)</span>
      <div class="flow">
        <span class="dbox purple">🧠 LLM call</span>
        <span class="darr">→</span>
        <span class="dbox orange">🔧 tool call</span>
        <span class="darr">→</span>
        <span class="dbox blue">📄 result appended to context</span>
        <span class="darr">→<span class="lbl">context grows every step</span></span>
      </div>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Done — OR 💥 overflow / runaway / $$$</span>
  </div>
  <div class="dcap">The agent loop re-sends its entire growing history on every step. Uncontrolled, that's how context overflow and runaway bills happen.</div>
</div>

## Why it matters for an AI Engineer

This is the node that separates people who *built an agent demo* from people who *shipped an agent*. In interviews and on the job, the hard questions are never "can you call a tool?" — they're "what happens on step 90 of a run that should have ended at step 12?" Every controller here (budgets, step caps, loop detection, compaction, isolation) is a direct answer to a production incident that has actually happened to real teams. Get these wrong and your agent project gets killed after the first surprise invoice or the first infinite loop that pages you at 3am.

## The controls you'll learn (and when to reach for each)

| Control | What it does | Reach for it when |
|---|---|---|
| [Context-window overflow on long runs](agent-cost-context-control/context-window-overflow-on-long-runs.md) | Understand *why* history grows and where it breaks | Any multi-step agent — this is the root cause |
| [Compaction & summary checkpoints](agent-cost-context-control/compaction-summary-checkpoints.md) | Replace old history with a summary to reclaim tokens | Long runs that must survive past the window |
| [Sub-agent context isolation](agent-cost-context-control/sub-agent-context-isolation.md) | Give each sub-task its own clean, small context | Complex tasks decomposed into sub-agents |
| [Tool-result trimming](agent-cost-context-control/tool-result-trimming.md) | Shrink verbose tool outputs before they hit context | Tools that return HTML, logs, big JSON |
| [Per-run token & spend budgets](agent-cost-context-control/per-run-token-spend-budgets.md) | Hard-cap tokens/dollars per task | Anything user-triggered or public-facing |
| [Step caps & kill-switches](agent-cost-context-control/step-caps-kill-switches.md) | Stop the loop after N steps or on a signal | Every agent, always — the seatbelt |
| [Loop detection](agent-cost-context-control/loop-detection.md) | Catch repeated identical actions and break out | Agents that call tools that can fail/retry |
| [Determinism & seeds](agent-cost-context-control/determinism-seeds.md) | Make runs reproducible for testing/debugging | Evals, regression tests, debugging |
| [Permission checks before high-impact tools](agent-cost-context-control/permission-checks-before-high-impact-tools.md) | Gate destructive/costly actions behind approval | Agents with write/spend/delete tools |
| [Replayable / debuggable trajectories](agent-cost-context-control/replayable-debuggable-trajectories.md) | Log every step so you can replay a failed run | Any agent in production — for the postmortem |

Think of it as three layers: **context management** keeps the run from overflowing, **cost control** keeps the run from bankrupting you, and **correctness controls** keep the run trustworthy and debuggable.

## Real world: how a company uses this

> **A Dubai logistics company** built an agent to reconcile shipping invoices against delivery records. In testing it cost ~$0.05 per invoice. In production it hit a supplier whose portal returned a 60 KB HTML error page on every fetch; the agent kept retrying, re-sending the growing page history each step, and one invoice ran **187 steps and cost $11 before hitting the context limit and crashing** — with no result. The fix stacked four controls from this node: a **20-step cap** (kill the loop), **tool-result trimming** (strip the HTML to the 500 bytes that mattered), **loop detection** (three identical failed fetches → abort and flag for a human), and a **$0.50 per-invoice budget** (stop before it hurts). Post-fix: median cost $0.04, worst case $0.50, zero runaway incidents. Same agent, same model — only the guardrails changed.

## Interview tip
Say: *"An agent is a loop that re-sends its whole growing context on every step, so my default guardrails are a step cap and a per-run token/dollar budget as hard kill-switches, tool-result trimming and compaction to keep context bounded, loop detection to catch repeated actions, and permission gates before any destructive tool. I log full trajectories so any runaway is replayable. Most agent projects die from an unbounded loop or a surprise bill — these controls are what make them shippable."* That framing shows you've run agents in production, not just in a notebook.

---

*Below: deep-dive articles on each control.*
