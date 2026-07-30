# Context Engineering

**The one-line idea:** Context engineering is the discipline of deciding *exactly what text goes into the model's context window on each call* — the instructions, the memory, the retrieved documents, the tool outputs — so the model has what it needs and nothing that distracts it.

## Why we even need it

An LLM has no memory and no knowledge of your world between calls. Everything it "knows" for a given response is whatever you put in the context window *this time*. That window is a fixed budget — 128K, 200K, sometimes a million tokens — and it is the single most important lever you control. Two hard facts force you to engineer it, not just fill it:

1. **More context is not better context.** Models degrade when the window is stuffed. Relevant facts buried in the middle of 100K tokens get ignored ("lost in the middle"), contradictory snippets confuse the model, and irrelevant text pulls the answer off-topic. A tight, well-ordered 4K-token prompt routinely beats a bloated 80K-token one.
2. **Tokens cost money and time.** You pay per input token on every single call, and latency climbs with context size. An agent that carelessly re-sends its entire history on every step can cost 20× what a compacted one costs — for a *worse* answer.

So context engineering is the bridge between "I have a lot of potentially useful information" and "the model sees the right slice of it, in the right order, within budget."

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🧠 System instructions</span>
    <span class="dbox gray">💾 Memory</span>
    <span class="dbox gray">🔍 Retrieved docs</span>
    <span class="dbox gray">🔧 Tool results</span>
    <span class="darr">→<span class="lbl">assemble + trim</span></span>
    <span class="dbox purple">🤖 Context window</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer</span>
  </div>
  <div class="dcap">Context engineering assembles many sources into one budgeted window — then manages that window over a long session.</div>
</div>

## Why it's the core AI Engineer skill of 2025–26

Prompt engineering was about wording one message. Context engineering is the bigger, harder job: **managing everything the model sees across a whole multi-turn, tool-using session.** As agents got popular, the bottleneck moved from "write a clever prompt" to "keep a 30-step agent's context coherent, cheap, and under the token limit." That is now the skill that separates a demo from a system that survives real users. Every failure mode you'll debug in production — the agent forgetting an instruction, hallucinating over stale data, blowing the budget, slowing to a crawl — is a context-engineering problem.

## The skills you'll learn (and when to reach for each)

The topic splits into two halves: **where context comes from**, and **how you manage the finite window it all has to fit in**.

| Sub-skill | Core idea | Reach for it when |
|---|---|---|
| [System instructions](context-engineering/system-instructions.md) | the persistent rules/persona at the top of context | you need consistent behavior every turn |
| [External memory](context-engineering/external-memory.md) | store facts outside the window, load on demand | the session outlives the context window |
| [RAG & dynamic filters](context-engineering/rag-dynamic-filters.md) | inject only the retrieved, filtered docs that matter now | answers must be grounded in your data |
| [Tool results as context](context-engineering/tool-results-as-context.md) | feed function/API outputs back into the window | the model acts, then reasons over what it got |
| [Long-context handling](context-engineering/long-context-handling.md) | order and place info so big windows still work | you genuinely need 50K+ tokens in one call |
| [Context compaction](context-engineering/context-compaction.md) | rewrite history into a shorter equivalent | a long agent run is filling up the window |
| [Context isolation](context-engineering/context-isolation.md) | give sub-tasks their own clean windows | one giant context is doing too many jobs |
| [Summarization / pruning](context-engineering/summarization-pruning.md) | drop or condense the least-useful tokens | you must free budget without losing the thread |
| [Prompt & KV caching](context-engineering/prompt-kv-caching.md) | reuse computed context to cut cost/latency | a big stable prefix repeats across calls |

## Real world: how a company uses this

> **A Dubai bank's customer-support agent** handles multi-turn chats where a user asks about a transaction, then a card, then a loan. Early on, engineers appended everything — full policy PDFs, every tool call, the whole chat — into each turn. By turn 15 the context hit 90K tokens, latency crossed 8 seconds, cost per conversation ballooned, and the agent started ignoring its own compliance instructions buried mid-context. The fix was pure context engineering: pin system instructions and compliance rules at the top, retrieve only the *relevant* policy chunk per question, summarize old turns into a running memory, cache the stable system prefix, and isolate the "verify identity" sub-task into its own window. Same model — the conversation dropped to ~6K tokens per turn, latency under 2 seconds, and instructions stopped getting lost.

## Interview tip

Say: *"Context engineering is deciding what the model sees on each call — I treat the context window as a scarce budget, not a bucket. I pin durable instructions, retrieve only relevant grounding, feed tool results back cleanly, and for long agent sessions I compact, summarize, and isolate sub-tasks so the window stays small and coherent. I cache the stable prefix to cut cost and latency. Most agent bugs — forgotten instructions, lost-in-the-middle, runaway cost — are context-engineering failures, not model failures."* That framing signals you've run agents in production, not just prompted a chatbot.

---

*Below: deep-dive articles on each context-engineering sub-skill.*
