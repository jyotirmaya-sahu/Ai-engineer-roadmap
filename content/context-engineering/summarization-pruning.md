# Summarization / Pruning

**The one-line idea:** free up window space by either *condensing* text into a shorter version (summarization) or *dropping* the least-useful tokens entirely (pruning) — the two levers for shrinking context without losing the thread.

## Why it matters for an AI Engineer

Every long-running LLM app eventually runs low on budget: the conversation grows, tool results pile up, retrieved docs stack. You have exactly two ways to make room — say the same thing in fewer words (summarize) or throw some of it away (prune). Knowing *which* to use, and *what* is safe to cut, is a core context-engineering skill. Do it well and a 50-turn chat stays cheap and coherent; do it badly and the model forgets the user's name or the constraint it agreed to three turns ago. This underpins [context compaction](context-compaction.md) (which is summarization applied to whole agent histories) and is the everyday tool for keeping chat memory bounded.

## The mechanism / how it works

**Summarization** is *lossy compression by an LLM.* You take a block of context — old turns, a long document, a verbose tool result — and ask a model to rewrite it densely: "Summarize the conversation so far, preserving the user's name, their request, and any decisions." The summary replaces the original block. Sizes typically shrink 5–20×. The art is telling the summarizer *what must survive* so it doesn't drop the load-bearing detail.

**Pruning** is *deletion, no rewrite.* You remove whole messages or tokens by a rule:

- **Recency / sliding window:** keep the last N turns, drop older ones.
- **Relevance:** score each item against the current query, drop low scorers (this shades into [contextual compression](../retrieval.md) in RAG).
- **Redundancy:** drop duplicate or superseded info (an old tool result replaced by a newer one).

A **rolling-summary buffer** combines both, and it's the standard chat-memory design: keep recent turns verbatim, and maintain one running summary of everything older. Each time you prune an old turn out of the window, you first fold it into the summary — so nothing is truly forgotten, just compressed.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">📜 old turns 1–30</span>
    <span class="darr">→<span class="lbl">summarize (lossy)</span></span>
    <span class="dbox blue">📋 running summary</span>
    <span class="darr">→</span>
    <span class="dbox green">summary + verbatim turns 31–35</span>
  </div>
  <div class="dcap">Rolling buffer: recent turns kept raw, older ones folded into one running summary before being pruned.</div>
</div>

## Concrete example

```python
# Rolling-summary chat memory: prune old turns into a running summary.
def trim(messages, keep=6):
    if len(messages) <= keep + 1:                 # +1 for system
        return messages
    system, old, recent = messages[0], messages[1:-keep], messages[-keep:]
    summary = client.chat.completions.create(model="gpt-4.1-mini", messages=[
        {"role": "system", "content": "Update the running summary. MUST preserve: user's "
         "name, their goal, and any commitments made. Be concise."},
        {"role": "user", "content": render(old)}]).choices[0].message.content
    return [system, {"role": "system", "content": f"[Conversation summary]\n{summary}"}, *recent]
```

Using a cheaper model (`gpt-4.1-mini`) for the summary keeps this near-free relative to the main calls.

## How a company uses this

A Dubai telco's WhatsApp support bot handles chats that can run 60+ messages. It keeps the last 6 turns verbatim and a rolling summary of the rest, updated by a cheap mini-model. That holds context around ~3K tokens no matter how long the chat runs — flat cost and latency instead of the linear blow-up of appending everything. The failure they engineered against: the summarizer once dropped the user's account number mentioned in turn 2, so the bot re-asked it at turn 40 (an infuriating UX bug). Fix: the summary prompt explicitly pins identity/entities as must-keep fields. That "tell the summarizer what's load-bearing" lesson is the whole game.

## Common mistakes / misconceptions

- **Summarizing without a keep-list.** The model drops exactly the detail you needed. Name the must-survive fields.
- **Pruning by recency alone.** The oldest turn might hold the key constraint. Fold it into a summary before dropping it, or prune by relevance.
- **Re-summarizing the summary repeatedly.** Each pass is lossy; summarize *fresh old turns* into the running summary, don't keep re-compressing the summary itself into mush.
- **Using an expensive model to summarize.** It's a compression job — a small, cheap model usually suffices and keeps the overhead negligible.

## Interview tip

Say: *"To bound context I summarize or prune. My default chat memory is a rolling-summary buffer: recent turns verbatim, everything older folded into one running summary before it's pruned — so cost stays flat as the chat grows. The critical detail is telling the summarizer what's load-bearing (identities, goals, commitments) so lossy compression doesn't drop it, and I run the summarizer on a cheap model."* Distinguishing summarization (condense) from pruning (delete) and naming the keep-list is the precise, senior answer.
