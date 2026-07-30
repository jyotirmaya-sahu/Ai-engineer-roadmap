# Delegation & Handoffs

**What it is:** the actual mechanism of passing control (and context) from one agent to another — how "you take it from here" happens in code.

## Why it matters for an AI Engineer

Architectures describe the *shape* of a team; delegation is the *verb* that makes it move. Every routing decision, every supervisor dispatch, every peer-to-peer pass is ultimately a handoff. Get it wrong and agents receive the wrong context, lose the task history, or duplicate work. For an AI Engineer, understanding handoffs precisely — what state transfers, who controls the conversation next — is what lets you debug "why did the writer agent have no idea what the researcher found?" It's the plumbing under every multi-agent pattern.

## The mechanism / how it works

A handoff has two things to get right: **control** and **context**.

**Control** — who acts next. In the modern pattern (OpenAI Agents SDK, LangGraph), a handoff is exposed to the LLM as a **tool**. The current agent has tools like `transfer_to_writer`; when it calls one, the runtime switches the active agent to the writer. The LLM *chooses* to delegate, in natural language reasoning, by picking a handoff tool — so delegation is just tool-calling with a special effect.

**Context** — what the next agent sees. This is the subtle part. Two styles:

- **Full-history handoff:** the receiving agent inherits the entire conversation. It has all context but also all the *noise* — and pays for every token of it.
- **Task handoff:** the delegating agent writes a clean, focused instruction ("Write a 200-word summary of these three facts: …") and the receiver starts fresh. Less context bleed, cheaper, but you must include everything the receiver needs.

Task handoff is usually better in production: it keeps each agent's context small (see [sub-agent isolation](../agent-cost-context-control/sub-agent-context-isolation.md)) and its behavior predictable.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 Researcher</span>
    <span class="darr">→<span class="lbl">transfer_to_writer(task="...")</span></span>
    <span class="dbox blue">✍️ Writer<span class="sub">gets clean instruction</span></span>
  </div>
  <div class="dcap">A handoff is a tool call that switches the active agent — and decides how much context travels with it.</div>
</div>

## A concrete example

OpenAI Agents SDK, where handoffs are first-class (2026-current):

```python
from agents import Agent, Runner

writer = Agent(
    name="Writer",
    instructions="Write a tight summary from the facts you're given.",
)

researcher = Agent(
    name="Researcher",
    instructions=("Gather facts on the topic. When you have them, hand off "
                  "to the Writer with a clear summarization task."),
    handoffs=[writer],   # <-- this creates a transfer_to_writer tool automatically
)

result = Runner.run_sync(researcher, "Summarize UAE fintech news this week.")
print(result.final_output)
```

Listing `writer` in `handoffs` auto-generates the transfer tool. The researcher decides *when* to hand off; the SDK moves control to the writer.

## How a company uses this

A Dubai bank's support assistant starts every chat with a general triage agent. When a user asks about a disputed transaction, triage *hands off* to a specialized fraud agent — passing a clean task summary ("customer disputes AED 4,200 charge on 12 Jan, card ending 8891") rather than the whole rambling chat. This task-style handoff keeps the fraud agent's context tight and PII-scoped, which matters for both cost and compliance auditing. When they briefly used full-history handoffs, the fraud agent occasionally acted on unrelated earlier chit-chat and the per-conversation token cost jumped ~2×. Switching to task handoffs fixed both.

## Common mistakes / misconceptions

- **Dropping context on handoff.** If the receiver needs a fact and you didn't pass it, it hallucinates one. Task handoffs demand a *complete* instruction.
- **Passing the entire history by default.** Convenient but expensive and noisy; the receiver may latch onto irrelevant earlier turns.
- **No handoff logging.** You can't debug a multi-agent flow if you can't see who handed what to whom — log every transfer.
- **Handoff ping-pong.** Two agents transferring back and forth is an [infinite loop](infinite-loops.md); cap total handoffs.

## Interview tip
Say: *"A handoff is just a tool call that switches the active agent. The design choice that matters is context: I prefer task-style handoffs — pass a clean, complete instruction rather than the full history — to keep each agent's context small, cheap, and PII-scoped, and I log every transfer for debugging."* That shows you think about the plumbing, not just the diagram.
