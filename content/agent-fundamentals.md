# Agent Fundamentals

**The one-line idea:** An *agent* is an LLM put inside a loop — it thinks, calls a tool, reads the result, and decides what to do next — plus a memory so it doesn't forget everything between turns.

## Why we even need it

A raw LLM call is a one-shot function: text in, text out, done. That's enough to summarise an email or answer a question. But real tasks aren't one-shot. "Book me the cheapest flight to Dubai next Tuesday and add it to my calendar" requires searching, comparing, deciding, then acting — and each step depends on what the previous step returned. A single prompt can't do that, because the model doesn't yet know the flight prices when you ask.

Two capabilities turn a chatbot into an agent:

1. **A reasoning loop** — instead of answering once, the model runs again and again. Each turn it can call a tool (search, API, calculator, code), see the real result, and use it to decide the next move. The loop is what lets an LLM *act on the world* and course-correct, instead of guessing in one shot.
2. **Memory** — the loop needs state. Short-term memory holds the current task's scratchpad; long-term memory remembers facts and past interactions across sessions. Without memory, every turn starts from zero and the agent goes in circles.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🧑 Goal</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Think</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔧 Act (tool)</span>
    <span class="darr">→</span>
    <span class="dbox blue">👀 Observe</span>
    <span class="darr">→<span class="lbl">loop</span></span>
    <span class="dbox green">✅ Done</span>
  </div>
  <div class="dcap">An agent = LLM + loop (think → act → observe → repeat) + memory to hold state across turns.</div>
</div>

## Why it matters for an AI Engineer

"Agentic" is the single biggest theme in 2026 AI job postings. Every serious LLM product — coding assistants, customer-support automations, research tools — is an agent under the hood. But agents are also where projects *fail*: a loop with no memory repeats itself, a loop with no stopping condition burns thousands of dollars, and the wrong memory design makes the agent forgetful or confidently wrong. Understanding the loop and the memory types is what separates "I called the OpenAI function-calling API once" from "I can design an agent that finishes real multi-step tasks reliably."

This node teaches the two irreducible primitives. Everything later — design patterns, multi-agent teams, MCP tools, reliability — builds on top of *loop + memory*.

## The pieces you'll learn (and when to reach for each)

| Tile | Core idea | When it matters |
|---|---|---|
| [Agent loop](agent-fundamentals/agent-loop.md) | the think→act→observe cycle itself | the foundation of every agent |
| [ReAct](agent-fundamentals/react.md) | interleave *reasoning* traces with *actions* | the default single-agent pattern |
| [Planning](agent-fundamentals/planning.md) | lay out the whole plan up front, then execute | multi-step tasks with clear sub-goals |
| [Reasoning + acting](agent-fundamentals/reasoning-acting.md) | why combining thought + action beats either alone | understanding *why* ReAct works |
| [Short-term](agent-fundamentals/short-term.md) | the in-context scratchpad for the current task | every agent, every turn |
| [Long-term](agent-fundamentals/long-term.md) | persistent memory across sessions | personalisation, multi-session assistants |
| [Episodic](agent-fundamentals/episodic.md) | remembering specific past events/interactions | "last time you asked me…" |
| [Semantic memory](agent-fundamentals/semantic-memory.md) | remembering facts and general knowledge | user preferences, domain facts |
| [Procedural memory](agent-fundamentals/procedural-memory.md) | remembering *how* to do things (skills) | reusable workflows, learned tool routines |
| [Vector memory](agent-fundamentals/vector-memory.md) | store memories as embeddings, retrieve by similarity | scalable recall over lots of history |
| [Which memory type when](agent-fundamentals/which-memory-type-when.md) | picking the right memory for the job | designing a real agent |
| [Memory eviction / forgetting](agent-fundamentals/memory-eviction-forgetting.md) | deciding what to drop as memory grows | long-running agents, cost control |
| [State management](agent-fundamentals/state-management.md) | the plumbing that carries state through the loop | production-grade agents |

## Real world: how a company uses this

> **A Dubai bank** builds an internal "ops agent" that resolves customer disputes. The **agent loop** lets it read a ticket, call the transactions API, check policy, and draft a resolution — over several turns, not one. **Short-term memory** holds the ticket and intermediate findings; **long-term semantic memory** remembers this customer's history and preferences so it doesn't re-ask; **procedural memory** stores the firm's standard dispute-handling steps so every agent follows compliance. Take away the loop and it can't gather evidence; take away memory and it repeats questions and forgets the policy. Both primitives are load-bearing.

## Interview tip
Say: *"An agent is an LLM in a loop — reason, act with a tool, observe the result, repeat until done — backed by memory. The loop gives it the ability to act and self-correct; memory (short-term scratchpad plus long-term semantic/episodic/procedural stores) gives it state. Most agent failures are loop failures (no stopping condition) or memory failures (wrong type, or no eviction), not model failures."* That shows you think about agents as systems, not as a single API call.

---

*Below: deep-dive articles on each agent fundamental.*
