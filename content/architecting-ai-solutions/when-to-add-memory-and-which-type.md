# When to add memory, and which type

**What it is:** the decision of whether your AI system should *remember* anything across turns or sessions — and if so, which of the three kinds of memory to use.

## Why it matters for an AI Engineer

LLMs are stateless — each API call is a blank slate; the model remembers nothing from the last one. "Memory" is *you* choosing what past information to feed back in. Add too little and your chatbot forgets the user's name mid-conversation; add too much and you blow the token budget re-sending the entire history on every turn, or you build a vector-memory system for an app that only needs the last three messages. Knowing *whether* to add memory and *which type* keeps systems both coherent and cheap — a very common source of both bugs and runaway costs.

## The mechanism: three kinds of memory

Because the model is stateless, memory is just "what context you re-inject." There are three types, and they answer different questions:

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">💬 Short-term<span class="sub">this conversation</span></span>
    <span class="dbox purple">👤 Long-term<span class="sub">across sessions</span></span>
    <span class="dbox orange">🔄 Working<span class="sub">this task's scratchpad</span></span>
  </div>
  <div class="dcap">Three memories: the chat so far, facts about the user forever, and the agent's in-task notes.</div>
</div>

1. **Short-term (conversational) memory** — the current chat history. You re-send recent turns so the model knows what "it" refers to. The catch: history grows unbounded and eventually overflows the window / bill. Strategies:
   - **Full history** — send everything. Fine for short chats.
   - **Sliding window** — send only the last N turns. Simple, cheap, but forgets early context.
   - **Summarization** — periodically compress old turns into a running summary, keep recent turns verbatim. The production default for long chats.

2. **Long-term memory** — facts that persist *across* sessions ("user prefers Arabic," "they're a premium customer," "last order was #4432"). Stored outside the conversation — usually in a **vector DB** (retrieve relevant memories per query) or a plain key-value/SQL store for structured facts. This is what makes an assistant feel like it *knows you* on day 30.

3. **Working memory** — an agent's scratchpad *within a single task*: intermediate results, a to-do list, files it's written. Lives only for the task's duration. This is what stops a multi-step agent from re-doing work or losing its plan halfway through.

The decision:

| Need | Use | Don't over-build |
|---|---|---|
| Coherent multi-turn chat | short-term (window or summary) | vector memory for a 5-turn chat |
| Personalization across sessions | long-term (vector or SQL) | — |
| Agent keeping track mid-task | working memory | persisting a scratchpad that's throwaway |
| One-shot Q&A, no follow-ups | **none** | any memory at all |

**The first question is always "do I need memory at all?"** A stateless classifier or a single-shot RAG query needs *zero* memory — adding it is pure cost and complexity.

## Worked example: taming a growing chat

A support chat where each turn re-sends full history:

```python
# Naive: cost grows every turn — turn 20 re-sends 19 turns of tokens
messages = history + [{"role": "user", "content": new_msg}]

# Better: sliding window + a running summary
def build_context(history, summary, new_msg, keep=6):
    recent = history[-keep:]                       # last 6 turns verbatim
    msgs = []
    if summary:
        msgs.append({"role": "system", "content": f"Conversation so far: {summary}"})
    msgs += recent + [{"role": "user", "content": new_msg}]
    return msgs
# Every ~10 turns, summarize the dropped-off turns into `summary` with a cheap model.
```

Cost now stays roughly *flat* per turn instead of growing linearly — the difference between a chat that costs pennies and one that costs dollars by message 50.

## How a company uses this

> **A Dubai telecom's customer-service agent** uses all three, deliberately scoped. **Short-term:** sliding window of the last 8 turns + a summary, so a 40-message troubleshooting chat stays coherent without re-sending 40 turns (that alone cut their token spend ~60%). **Long-term:** a per-customer vector store of past issues and preferences, so a returning user doesn't re-explain their setup — retrieved only when relevant, not dumped into every prompt. **Working:** when the agent runs a multi-step "check line → run diagnostic → file ticket" task, a scratchpad holds intermediate results so a failed step can retry without restarting. The senior decision was *scoping* — long-term memory is retrieved on demand, never pasted wholesale, or it would balloon the context every turn.

## Common mistakes
- **Adding memory when none is needed.** A one-shot tool doesn't need to remember anything. Ask first.
- **Full history forever.** Re-sending the entire chat every turn — costs and latency grow linearly until you hit the window limit and it crashes.
- **Vector memory for short chats.** A five-turn conversation needs a list, not a semantic-search database. Reserve vector memory for *cross-session* recall.
- **Dumping all long-term memory into the prompt.** Long-term memory should be *retrieved* (like RAG) per query, not pasted in full — otherwise it defeats the point and bloats context.
- **No working memory in agents.** Multi-step agents without a scratchpad repeat work and lose the plot.

## Interview tip
Say: *"I ask whether the system needs state at all — a one-shot query doesn't. If it's conversational, I start with a sliding window, add summarization when chats get long. Persistence across sessions is long-term memory, usually a vector store retrieved on demand — never pasted wholesale. And agents get a task-scoped working scratchpad. The mistake I avoid is building cross-session vector memory for what's really a five-turn chat."* This shows you treat memory as a scoped cost decision, not a feature you bolt on by default. See also [single call vs workflow vs agent vs multi-agent](single-call-vs-workflow-vs-agent-vs-multi-agent.md) for where working memory fits.
