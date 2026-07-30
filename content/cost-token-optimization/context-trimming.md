# Context trimming

**What it is:** Deciding what *not* to send — pruning chat history, retrieved chunks, and stale context down to only what the model needs for this turn, so you stop paying for tokens that don't help.

## Why it matters for an AI Engineer

Two things quietly bloat every real app: **conversation history** (each turn re-sends the whole prior chat) and **RAG context** (retrieve top-20 chunks "to be safe"). Both grow linearly, both are billed on every call, and past a point both *hurt* quality — models suffer "lost in the middle," where facts buried in a huge context get ignored. Trimming is where cost and accuracy improve together. It's distinct from [compression](prompt-compression.md): compression makes kept text smaller; trimming decides what to keep at all.

## The mechanism / how it works

**Trimming chat history.** A 40-turn conversation re-sent verbatim every turn is quadratic cost. Options, often combined:

- **Sliding window** — keep the system prompt + last N turns, drop the rest. Simple, works when only recent context matters.
- **Summarize-and-drop** — periodically replace old turns with a short running summary ("User is a UAE resident, wants a savings account, already rejected option A"). One cheap summarization call replaces thousands of re-sent tokens every turn after.
- **Token-budgeted** — keep adding turns newest-first until you hit a token cap, then stop.

**Trimming RAG context.** Retrieving 20 chunks and pasting all 20 is wasteful and lowers precision. Instead:

- **Rerank then cut** — a reranker scores the retrieved chunks; keep the top 3–5 that clear a relevance threshold, drop the rest.
- **Threshold, not fixed-k** — if only 2 chunks are actually relevant, send 2. Don't pad to a fixed number.
- **Dedup** — near-duplicate chunks from overlapping documents waste the budget; collapse them.

The governing idea is a **token budget per call**: you have a fixed number of tokens you're willing to spend, and you fill it with the highest-value context first (recent turns, top-ranked chunks), then stop. Everything past the budget is dropped or summarized.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">40 turns + 20 chunks<span class="sub">14,000 tok</span></span>
    <span class="darr">↓<span class="lbl">trim to budget</span></span>
    <div class="flow">
      <span class="dbox blue">📝 summary of old turns</span>
      <span class="dbox blue">last 4 turns</span>
      <span class="dbox blue">top-4 chunks</span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ 3,000 tok<span class="sub">only what matters</span></span>
  </div>
  <div class="dcap">Fill a fixed token budget with highest-value context first; drop or summarize the rest.</div>
</div>

## Concrete example

```python
def build_context(system, history, chunks, budget=3000):
    ctx, used = [system], count(system)
    # newest turns first until budget
    for turn in reversed(history):
        t = count(turn)
        if used + t > budget: break
        ctx.insert(1, turn); used += t
    # top reranked chunks over a relevance threshold, fit remaining budget
    for c in rerank(chunks):
        if c.score < 0.5: break
        t = count(c.text)
        if used + t > budget: break
        ctx.append(c.text); used += t
    return ctx
```

Worked numbers: a chat app was re-sending full history (avg 6,000 history tokens by turn 15) plus 20 chunks (5,000 tokens). Switching to summary + last-4-turns (900 tokens) and top-4 reranked chunks (1,300 tokens) cut input from ~11,000 to ~2,200 — an **80% input reduction** — and *raised* answer accuracy because the model stopped drowning in irrelevant context.

## How a company uses this

A bank's onboarding assistant handled long, multi-step chats. Early on, cost climbed the longer a conversation ran — by message 30 each turn cost 5× message 1, because history was re-sent whole. The fix: after every 6 turns, a cheap model compresses the conversation into a structured state summary; only that summary plus the last two turns ride along. Cost per turn went flat instead of linear, and the assistant actually got *more* coherent because key facts were pinned in the summary instead of buried 25 messages back. On the RAG side, a knowledge-base product replaced "top-20 chunks" with "rerank, keep score>0.6, max 5" — median context dropped from 6,500 to 1,800 tokens and citation accuracy went up. Both teams treat the context window as a budget to spend wisely, not a bucket to fill.

## Common mistakes

- **Re-sending full history every turn.** The single most common cost leak in chat apps. Window or summarize.
- **Fixed top-k retrieval.** Pasting 20 chunks when 3 are relevant burns tokens and lowers precision. Rerank and threshold.
- **Dropping the wrong thing.** Naive sliding windows can drop the turn where the user stated their goal. Summaries should *pin* durable facts, not just keep recency.
- **Trimming without a reranker.** Cutting retrieved chunks by raw vector score alone keeps mediocre matches; a reranker makes the cut far more accurate.

## Interview tip
Say: *"I set a token budget per call and fill it highest-value-first. For chat history I use a running summary plus the last few turns so cost stays flat instead of growing every message. For RAG I rerank and keep only chunks above a relevance threshold rather than a fixed top-k. Trimming is the rare lever where cost and quality improve together, because oversized context also causes lost-in-the-middle errors."* It shows you understand context as a managed budget.
