# Reasoning + Acting

**What it is:** The core principle behind agents — that *combining* reasoning (thinking through a problem) with *acting* (calling tools to touch the real world) beats doing either one alone.

## Why it matters for an AI Engineer

This is the "why" under [ReAct](react.md). Understanding it stops you from making two classic mistakes: building an agent that just "thinks harder" (chain-of-thought with no tools) and wonders why it hallucinates facts, or building one that just "calls more tools" with no reasoning and wonders why it picks the wrong ones. Interviewers love this topic because it separates people who *use* agent frameworks from people who understand *why* they're shaped the way they are. Once you get it, every design pattern — reflection, planning, multi-agent — reads as a variation on "how do I arrange reasoning and acting?"

## The mechanism: how it works

Think of two failure modes of a lone LLM:

**Reasoning without acting** = a brilliant strategist locked in a room. Chain-of-thought prompting lets a model reason step by step, which genuinely improves logic and math. But its reasoning is only as good as what's already in its head. Ask it today's flight price and it *reasons its way to a confident, wrong number*, because it has no way to check reality. It can plan beautifully and still be completely detached from facts.

**Acting without reasoning** = a worker with no plan. Give a model tools but no space to think and it fires off tool calls reactively — wrong tool, wrong arguments, no recovery when a call fails, no sense of the overall goal. It's grounded in reality but aimless.

**Reasoning + acting** fuses them into a virtuous cycle:

- *Reasoning guides acting:* the model thinks about which tool it needs and why, so it picks the right one with the right arguments.
- *Acting grounds reasoning:* each tool result injects a real fact back into the model's context, so the next reasoning step is anchored to reality instead of drifting into hallucination.

Each observation corrects the model's world-model; each thought directs the next action. That feedback loop is why an agent can finish a task a one-shot prompt never could.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Reason only<span class="sub">smart but hallucinates</span></span>
    <span class="dbox orange">🔧 Act only<span class="sub">grounded but aimless</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🔁 Reason + Act<span class="sub">think → ground → think</span></span>
  </div>
  <div class="dcap">Reasoning guides which action to take; acting feeds real facts back to correct the reasoning.</div>
</div>

## Concrete example (worked, no code)

Task: *"Is it cheaper to fly Emirates or flydubai to Riyadh next Friday?"*

- **Reason-only agent:** "Emirates is usually pricier than flydubai, so flydubai is cheaper." Confident, plausible, and possibly wrong — it never checked. This is a hallucination dressed as logic.
- **Act-only agent:** blindly calls `search_flights()` with no dates, gets 400 results for the wrong day, and returns noise because it never reasoned about *what* to search.
- **Reason + act agent:**
  1. *Thought:* "I need next Friday's date and both airlines' prices." → *Action:* resolve the date → *Observation:* "2026-08-07".
  2. *Thought:* "Now query each airline for that date." → *Action:* `search_flights("Emirates", "2026-08-07")` → *Observation:* "1,450 AED".
  3. *Action:* `search_flights("flydubai", "2026-08-07")` → *Observation:* "980 AED".
  4. *Thought:* "980 < 1,450." → *Answer:* "flydubai, at 980 AED."

Same model, same task — only the reason-and-act *arrangement* produces a grounded, correct answer.

## How a company uses this

An insurance firm in Dubai learned this concretely. Their first claims-triage bot was reason-only: it "reasoned" about policy coverage from memory and gave wrong coverage answers ~20% of the time because policy details weren't reliably in the model's weights. Adding *acting* — a tool that fetches the exact policy document — cut errors sharply, but a pure act-only version then over-fetched and made poor judgement calls. The production system is deliberately **reason + act**: it reasons about *which* policy clause is relevant, fetches it, then reasons over the retrieved text. Accuracy on coverage questions went from ~80% to ~97%, and every answer is now traceable to a real document, which their compliance team requires.

## Common mistakes

- **Believing more reasoning fixes hallucination.** It doesn't — ungrounded reasoning just produces more elaborate wrong answers. You need *acting* to inject real facts.
- **Believing more tools fix bad decisions.** Without reasoning the agent misuses the tools. You need *reasoning* to choose well.
- **Treating them as separate stages instead of a loop.** The power is the *interleaving* — think, ground, think again — not "reason once then act once."

## Interview tip
Say: *"Reasoning alone hallucinates because it can't check reality; acting alone is aimless because it can't plan. Agents work by interleaving them — reasoning picks the action, the action's result grounds the next reasoning step. That feedback loop is the whole reason an agent can do things a single prompt can't."* This is the concept that proves you understand agents at the principle level, not just the API level.

See also: [ReAct](react.md) (the concrete pattern that implements this), [Agent loop](agent-loop.md) (the machinery that runs it).
