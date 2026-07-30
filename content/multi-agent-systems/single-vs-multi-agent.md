# Single vs Multi-Agent

**What it is:** the very first design decision — do you solve the task with *one* LLM loop that has all the tools, or *several* focused agents coordinated as a team?

## Why it matters for an AI Engineer

This is the decision interviewers probe hardest, because getting it wrong is expensive in both directions. Reach for multi-agent too early and you 10× your token bill and your failure modes for no accuracy gain. Stay single-agent on a task that genuinely has separable sub-jobs and your one prompt becomes an unmaintainable 3-page mess that picks the wrong tool half the time. The senior signal is knowing that **multi-agent is not an upgrade — it's a trade**: you buy modularity and specialization, and you pay with coordination, cost, and debugging pain.

## The mechanism / how it works

A **single agent** is one LLM in a loop: it sees the task, all available tools, and the running history; it decides the next action, executes it, observes the result, and repeats until done. Everything lives in one context window and one prompt. Simple, cheap, easy to trace.

The pressure that breaks it: as you pile on tools and instructions, the model's attention spreads thin. With 20 tools and rules for each, it confuses similar tools, forgets earlier constraints, and its reasoning degrades. One context window is now juggling five unrelated jobs.

A **multi-agent system** splits that load. Each agent gets a *narrow* role (one job), its *own* short prompt, and *only* the tools it needs. A researcher agent has search tools; a writer has none; a critic just reads and judges. A coordinating layer (see [supervisor-orchestrator.md](supervisor-orchestrator.md)) routes work between them. Short focused prompts = sharper behavior, plus you can unit-test each agent and mix model tiers.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple wide">🤖 One agent<span class="sub">20 tools, 3-page prompt</span></span>
    <span class="darr">→<span class="lbl">split when jobs separate</span></span>
    <span class="dbox blue">🔎 Researcher</span>
    <span class="dbox blue">✍️ Writer</span>
    <span class="dbox blue">🕵️ Critic</span>
  </div>
  <div class="dcap">One overloaded agent becomes several focused ones — only worth it when the sub-jobs are genuinely distinct.</div>
</div>

**The decision rule:** go multi-agent only when the task has *clearly separable roles that need different tools, prompts, or models*, or when sub-tasks can run in parallel to cut latency. If a single well-prompted agent handles it, keep it single.

## A concrete example

Same task — "write a fact-checked market summary" — two shapes:

```python
# Single agent: one loop, all tools, one prompt.
agent = Agent(model="gpt-4o", tools=[web_search, write_doc],
    system="Research the topic, write a summary, verify every claim.")
agent.run("Summarize this week's UAE fintech news.")

# Multi-agent: three narrow agents + a supervisor that routes.
researcher = Agent(tools=[web_search], system="Gather sources. Return facts + links.")
writer     = Agent(tools=[],           system="Turn the facts into a tight summary.")
critic     = Agent(tools=[web_search], system="Verify each claim. Flag unsupported ones.")
# supervisor calls researcher -> writer -> critic, loops critic->writer until clean
```

Both work on a good day. Under load, the single agent forgets to verify claims it wrote paragraphs ago; the split version *can't* skip verification because a dedicated agent owns it.

## How a company uses this

A Dubai marketing agency started every content tool as a single agent. It worked for "write one caption." When the job grew to "research a brand, draft a campaign, and legal-check it," the single agent kept skipping the legal check under long contexts — a compliance risk. They split it: the compliance step became its own agent that *must* run, a hard gate the business required. Cost roughly tripled (three agents, extra turns) but the failure they actually cared about — unchecked claims shipping — went to zero. That trade was worth it; for the caption tool it would not have been.

## Common mistakes / misconceptions

- **"Multi-agent is more advanced, so it's better."** It's more *machinery*, not more *accurate* by default. Most tasks don't need it.
- **Splitting by topic instead of by job.** "Finance agent" vs "sports agent" is usually just routing; real multi-agent splits by *role* (research vs write vs check).
- **Forgetting the cost multiplier.** N agents × multiple turns each can be 10–20× a single call — see [cost-explosion.md](cost-explosion.md).

## Interview tip
Say: *"I default to a single well-prompted agent and only split into multiple agents when the task has clearly separable roles needing different tools or models, or when parallelism cuts latency — because multi-agent multiplies cost and failure modes. It's a trade, not an upgrade."* That one sentence sorts people who've shipped agents from people who've watched demos.
