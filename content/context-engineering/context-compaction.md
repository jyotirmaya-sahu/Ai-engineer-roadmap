# Context Compaction

**The one-line idea:** when a long agent run fills the window, rewrite the accumulated history into a shorter, equivalent version — same meaning, far fewer tokens — and continue from that compacted state.

## Why it matters for an AI Engineer

Agents that run many steps have a built-in problem: the context grows every turn (each user message, each model reply, each [tool result](tool-results-as-context.md) is appended) and eventually approaches the token limit. Hit the limit and the API errors; get close and you're paying to re-send a huge history on every step while quality drops from bloat. Compaction is the standard fix — it's what lets a coding agent work for an hour or a support agent handle a 40-turn conversation without falling over. This is a defining feature of production agent frameworks in 2025–26, and "how do you keep a long-running agent under the context limit?" is a very common systems-design interview question. Compaction is the headline answer.

## The mechanism / how it works

Compaction runs when context crosses a threshold (say 70–80% of the window). It replaces a big chunk of history with a compact stand-in that preserves what the agent still needs:

1. **Trigger.** Track token count each turn; when it exceeds a threshold, compact.
2. **Select what to keep verbatim.** The system prompt, the original task/goal, and the *most recent* turns stay intact — you don't want to fuzz the immediate working state.
3. **Compress the rest.** Feed the older middle of the conversation to an LLM with a prompt like "summarize the progress so far: decisions made, facts learned, current state, open items." This yields a dense **progress summary** — often 10× smaller than the raw turns.
4. **Rebuild.** New context = system prompt + progress summary + recent verbatim turns. The agent continues as if nothing happened, but with room to keep going.

The key distinction from plain [summarization/pruning](summarization-pruning.md): compaction is the *whole-history rewrite* strategy specifically for keeping an agent running — it's summarization applied structurally, preserving the goal and recent state, and repeated every time the window fills. It's a loop, not a one-shot trim.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">📜 40 turns ≈ 90K tokens</span>
    <span class="darr">→<span class="lbl">LLM rewrite of old turns</span></span>
    <span class="dbox blue">📋 system + progress summary + last 4 turns ≈ 8K</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ agent keeps going</span>
  </div>
  <div class="dcap">Compaction rewrites bloated history into a compact equivalent when the window fills — then repeats.</div>
</div>

## Concrete example

```python
def maybe_compact(messages, model="gpt-4.1", limit=128_000, thresh=0.75):
    if count_tokens(messages) < limit * thresh:
        return messages                               # not full yet
    system, recent = messages[0], messages[-4:]       # keep goal + latest turns
    old = messages[1:-4]                              # compress the middle
    summary = client.chat.completions.create(model=model, messages=[
        {"role": "system", "content": "Summarize progress: decisions, facts learned, "
         "current state, open tasks. Be dense and complete."},
        {"role": "user", "content": render(old)}]).choices[0].message.content
    return [system,
            {"role": "system", "content": f"[Progress so far]\n{summary}"},
            *recent]                                  # rebuilt, compact context
```

This runs inside the agent loop; each time context nears the limit, history collapses back to a few thousand tokens.

## How a company uses this

A Dubai software firm runs an autonomous coding agent that can execute 100+ steps to implement a feature. Without compaction it hit the 200K limit around step 60 and crashed. With compaction firing at 75%, it summarizes "files changed, tests written, current failing test, next step" every time it fills up — so a 3-hour run stays under ~15K tokens of live context and finishes. The tradeoff they tune: compact too aggressively and the agent forgets a subtle earlier decision (a *lossy* rewrite); compact too late and cost creeps up. They keep the summary prompt explicit about *what must survive* and always retain the original task verbatim so the goal never drifts.

## Common mistakes / misconceptions

- **Losing the goal.** If the original task gets summarized away, the agent drifts. Always keep it verbatim.
- **Over-compacting.** Squeeze too hard and you drop the detail the next step needed — a silent correctness bug. Keep recent turns raw.
- **Compacting too rarely.** Waiting until 99% means you've already paid for many bloated turns. Trigger at ~70–80%.
- **Confusing it with a bigger window.** A larger model window delays the problem; it doesn't remove it. Long-running agents still need compaction.

## Interview tip

Say: *"For long-running agents I compact: when context passes ~75% of the window I have an LLM rewrite the older history into a dense progress summary — decisions, state, open tasks — while keeping the original goal and the last few turns verbatim, then continue. It's the standard way to keep a 100-step agent under the token limit, and I tune the threshold to trade off forgetting versus cost."* Naming the trigger threshold and "keep the goal verbatim" shows you've actually run agents past the point where this bites.
