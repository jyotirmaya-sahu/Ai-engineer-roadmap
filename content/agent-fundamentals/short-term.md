# Short-term Memory

**What it is:** The agent's working memory for the *current* task — everything held in the model's context window right now: the conversation so far, tool results, and the scratchpad it's reasoning over.

## Why it matters for an AI Engineer

Short-term memory is the memory every agent uses on every single turn, and it's the one you'll spend the most engineering effort on — because it lives inside the finite, expensive context window. The [agent loop](agent-loop.md) *only works* because each iteration's result is written into short-term memory so the next iteration can see it. Manage it well and the agent stays coherent and cheap; manage it badly and you get context overflow, ballooning token bills, and an agent that "forgets" what it did three steps ago because the important part scrolled out of the window. This is the difference between a demo agent and one that survives a 40-step task.

## The mechanism: how it works

Short-term memory *is* the context window. Concretely it's the list of messages you send to the model each turn:

- The **system prompt** (role, tools, rules).
- The **running conversation** — user turns, the model's thoughts, and every tool call + observation appended by the loop.
- Any **scratchpad** the model writes to reason.

The catch: the context window is a fixed budget (e.g. 200K tokens), and every token costs money and adds latency. As a long task runs, short-term memory grows until it either overflows the window or gets uncomfortably expensive. So "managing short-term memory" means deciding **what to keep in-window and what to drop or compress**:

- **Full history** — keep everything. Simplest; fine for short tasks; blows up on long ones.
- **Sliding window** — keep only the last N messages. Cheap, but the agent forgets early context.
- **Summarisation / compaction** — periodically replace old turns with a short summary, freeing tokens while preserving the gist. The standard technique for long-running agents.

Short-term memory is *volatile*: when the task ends, it's gone. Anything that must survive to the next session has to be copied into [long-term memory](long-term.md).

<div class="diagram">
  <div class="dstack">
    <span class="dbox gray">⚙️ System prompt</span>
    <span class="dbox blue">💬 User + assistant turns</span>
    <span class="dbox orange">🔧 Tool call → 👀 observation</span>
    <span class="dbox orange">🔧 Tool call → 👀 observation</span>
    <span class="dbox purple">🧠 Scratchpad reasoning</span>
  </div>
  <div class="dcap">Short-term memory = the message list in the context window — volatile, finite, and it grows every turn.</div>
</div>

## Concrete example

Short-term memory is just the `messages` list you carry through the loop — and here's the compaction technique that keeps it from overflowing:

```python
def maybe_compact(messages, client, max_msgs=20):
    """When history gets long, summarise the old middle and keep it short."""
    if len(messages) <= max_msgs:
        return messages
    system, recent = messages[0], messages[-6:]      # keep system + last 6
    old = messages[1:-6]
    summary = client.chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "user",
            "content": "Summarise this agent history in 5 bullet points, "
                       "keeping decisions, facts learned, and open tasks:\n"
                       + "\n".join(str(m) for m in old)}]
    ).choices[0].message.content
    return [system,
            {"role": "assistant", "content": f"[summary of earlier steps]\n{summary}"},
            *recent]
```

Call `maybe_compact` inside the loop each turn. It keeps the system prompt and the most recent messages verbatim (where detail matters most) and collapses the older middle into a summary — the same idea Claude Code and other production agents use to survive long sessions.

## How a company uses this

A coding-assistant startup with Dubai clients runs agents that make multi-file changes over 30–60 loop steps. Naively keeping full history, a single session hit **180K tokens and ~$3 per run** and sometimes overflowed the window mid-task, corrupting the agent. They added **compaction at 25K-token checkpoints** — summarising completed sub-tasks while keeping the current file and recent diffs verbatim. Result: average session dropped to **~40K tokens (~$0.70)**, no more overflow crashes, and *better* accuracy, because the model wasn't distracted by 150K tokens of stale context. Short-term-memory management was the single highest-ROI change they made.

## Common mistakes

- **Assuming infinite context.** Even 200K windows fill up on long agent runs — and cost/latency scale with what you keep.
- **Dumping raw tool outputs in full.** A 10,000-row API response doesn't belong verbatim in context. Trim or summarise tool results before appending.
- **Confusing it with long-term memory.** Short-term is wiped when the session ends. If it must persist, write it to [long-term memory](long-term.md).
- **Compacting too aggressively.** Summarise away a key fact and the agent makes a mistake. Keep recent and safety-critical detail verbatim.

## Interview tip
Say: *"Short-term memory is the working context — the message list in the window: conversation, tool results, scratchpad. It's volatile and lives in a finite, paid budget, so on long runs I manage it with compaction: keep the system prompt and recent turns verbatim, summarise the older middle. Overflow and cost blow-ups are short-term-memory problems."* Naming compaction as your go-to technique signals real agent experience.

See also: [Long-term memory](long-term.md) (what persists across sessions), [Memory eviction / forgetting](memory-eviction-forgetting.md) (deciding what to drop), [State management](state-management.md) (how it's carried through the loop).
