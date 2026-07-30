# Compaction & summary checkpoints

**What it is:** Periodically replacing a big chunk of old agent history with a short LLM-written summary, so the run can keep going without the context window filling up.

## Why it matters for an AI Engineer

Compaction is what lets an agent run for hundreds of steps without [overflowing](context-window-overflow-on-long-runs.md). It's the single most important technique for long-running agents — coding agents, research agents, multi-hour workflows all depend on it. Done well, it keeps context (and therefore cost) roughly flat instead of climbing. Done badly, it throws away the one fact the agent needed and the run quietly goes off the rails. Knowing *what* to keep versus summarize is a real engineering skill interviewers probe.

## The mechanism — how compaction works

Recall that context is cumulative and re-sent every step. Compaction breaks that growth by folding the old part of the history into a summary:

1. **Watch a threshold.** When total tokens cross, say, 70% of the window, trigger compaction.
2. **Split the history.** Keep the pinned parts verbatim — the system prompt, the original task, and the *most recent* few steps (the agent needs its immediate working memory). Take everything in the middle (old tool results, resolved sub-steps) as the "compactable" region.
3. **Summarize the middle.** Send that region to the LLM with a prompt like *"Summarize what has happened so far: decisions made, facts discovered, files changed, and what's left to do."*
4. **Rebuild the history** as: system prompt + task + summary + recent steps. This is a **checkpoint**. The run continues from a much smaller context.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📌 system + task</span>
      <span class="dbox blue">old step</span>
      <span class="dbox blue">old step</span>
      <span class="dbox blue">old step</span>
      <span class="dbox orange">recent steps</span>
      <span class="darr">→<span class="lbl">180K, near limit</span></span>
    </div>
    <span class="darr">↓<span class="lbl">compact</span></span>
    <div class="flow">
      <span class="dbox gray">📌 system + task</span>
      <span class="dbox green">📝 summary of old steps</span>
      <span class="dbox orange">recent steps</span>
      <span class="darr">→<span class="lbl">40K, room to run</span></span>
    </div>
  </div>
  <div class="dcap">Compaction collapses the middle of the history into a summary, keeping pinned context and recent working memory intact.</div>
</div>

**What to keep verbatim vs summarize** is the whole game:
- **Never summarize:** the original task/goal, hard constraints, IDs and paths the agent still needs (file names, ticket numbers, URLs it must revisit).
- **Safe to summarize:** verbose tool outputs already acted on, exploratory dead-ends, resolved reasoning.

## Concrete example

A minimal compaction step in pseudo-Python (framework-agnostic):

```python
def maybe_compact(history, client, limit=200_000, trigger=0.7):
    if count_tokens(history) < limit * trigger:
        return history                      # not time yet

    pinned  = history[:2]                   # system + task
    recent  = history[-6:]                  # last 3 steps of working memory
    middle  = history[2:-6]                 # everything else

    summary = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content":
            "Summarize this agent transcript: decisions made, facts found, "
            "files/IDs touched, and remaining TODOs. Be specific.\n\n"
            + render(middle)}],
    ).content[0].text

    return pinned + [{"role": "user", "content": f"[SUMMARY]\n{summary}"}] + recent
```

Call `maybe_compact` at the top of every agent loop iteration. This is essentially what production coding agents (Claude Code, Cursor) do under the hood.

## How a company uses this

A Dubai media firm's research agent summarizes 40+ scraped articles into a briefing. Before compaction it overflowed at ~15 articles. With a checkpoint every time context hit **140 K / 200 K**, it now handles 60+ articles per run. Cost stayed near-flat: instead of the history growing to 200 K and each step costing ~$0.60 in input, it oscillates between 40 K and 140 K, holding **average step cost around $0.20**. The one production incident: an early version summarized away a source URL the agent needed to cite, producing an unsourced claim — fixed by pinning all discovered URLs in a structured "facts" block that's never summarized.

## Common mistakes
- **Summarizing too aggressively / too early**, losing detail the agent still needs.
- **Not pinning identifiers** — dropping file paths, IDs, or the original goal. Keep a structured "durable facts" section outside the summary.
- **Compacting on a fixed step count instead of a token threshold** — token count is what actually matters.
- **Trusting the summary blindly** — log the pre-compaction history (see [replayable trajectories](replayable-debuggable-trajectories.md)) so you can debug when a summary drops something.

## Interview tip
Say: *"Compaction keeps a long agent run under the context limit by replacing old history with an LLM summary at a token threshold, while pinning the goal, constraints, and key IDs verbatim. It holds cost roughly flat instead of letting it grow quadratically. The main risk is summarizing away a fact the agent still needs, so I keep durable identifiers in a structured block that's never summarized."* Naming the keep-vs-summarize decision shows real depth.
