# OpenAI Agents SDK / Swarm

**What it is:** OpenAI's lightweight, production framework for multi-agent systems built around **handoffs** — the successor to the *experimental Swarm* project, which is archived. If you take one thing from this tile: cite the **Agents SDK**, not Swarm.

## Why it matters for an AI Engineer

Swarm was OpenAI's 2024 *experiment* to demonstrate handoff-based agent coordination — explicitly "not for production." Interviewers use it as a trap: mention Swarm as a current tool and you signal out-of-date knowledge. The production successor, the **OpenAI Agents SDK** (2025+), took Swarm's clean handoff model and made it real. For an AI Engineer, knowing this lineage — and that the SDK is the minimal, OpenAI-native choice when you don't need LangGraph's heavyweight machinery — is both a correctness check and a practical framework pick.

## The mechanism / how it works

The Agents SDK is deliberately small — a few primitives:

1. **Agents** — an LLM with `instructions`, `tools`, and a list of `handoffs` (other agents it can transfer to).
2. **Handoffs** — the core coordination primitive. Listing another agent in `handoffs` auto-creates a transfer tool; when the agent calls it, control passes to that agent (see [delegation-handoffs.md](delegation-handoffs.md)). This is a decentralized, [network](network-peer-to-peer.md)-style model — agents hand off to each other, no central supervisor required.
3. **Guardrails** — input/output validation that can halt a run (e.g. reject off-topic or unsafe requests).
4. **Sessions** — automatic conversation history management across turns.
5. **Runner** — executes the agent loop and orchestrates handoffs.

It also ships built-in **tracing** for debugging multi-agent runs. The philosophy is "just enough" — Python-first, few abstractions, easy to read — positioned as the lightweight choice against LangGraph's fuller feature set.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💬 Request</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧭 Triage agent</span>
    <span class="darr">→<span class="lbl">handoff tool</span></span>
    <span class="dbox blue">💳 Billing agent</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer</span>
  </div>
  <div class="dcap">Agents SDK: coordination via auto-generated handoff tools — lightweight, OpenAI-native, decentralized.</div>
</div>

## A concrete example

Triage agent handing off to specialists (OpenAI Agents SDK, 2026):

```python
from agents import Agent, Runner, GuardrailFunctionOutput, input_guardrail

billing = Agent(name="Billing", instructions="Handle billing questions.")
tech = Agent(name="Tech", instructions="Handle technical support.")

triage = Agent(
    name="Triage",
    instructions="Route the user to the right specialist.",
    handoffs=[billing, tech],          # auto-creates transfer_to_billing / transfer_to_tech
)

result = Runner.run_sync(triage, "I was charged twice this month.")
print(result.final_output)             # triage hands off to Billing automatically
```

Note how little code coordinates two specialists — that minimalism is the SDK's selling point versus a full state graph.

## How a company uses this

A Dubai SaaS company, already all-in on OpenAI models, built its support assistant on the Agents SDK rather than LangGraph — they wanted OpenAI-native tooling, built-in tracing, and the least code possible. A triage agent hands off to billing, technical, and account specialists; guardrails block prompt-injection and off-topic requests before they reach a specialist. The built-in tracing gave their small team enough debuggability without standing up extra observability infrastructure. When they later needed durable checkpointing and human-approval interrupts for a money-moving flow, *that* piece went to LangGraph — the SDK's lightness is a feature until you need heavier production guarantees.

## Common mistakes / misconceptions

- **Citing Swarm as current.** It's archived and experimental. The production tool is the **Agents SDK** — naming the wrong one is a red flag in interviews.
- **Expecting LangGraph-level features.** No built-in durable checkpointing or time-travel; it's intentionally lightweight. Reach for [LangGraph](langgraph-multi-agent.md) when you need those.
- **Skipping guardrails.** They're a first-class feature for a reason — validate inputs/outputs, especially with handoff-driven routing.
- **Assuming it's OpenAI-only forever.** It centers OpenAI models but the ecosystem increasingly supports others; still, it's most natural in an OpenAI stack.

## Interview tip
Say: *"The OpenAI Agents SDK is the production successor to the experimental, now-archived Swarm — I'd never cite Swarm as current. It's a lightweight, handoff-based framework with built-in guardrails, sessions, and tracing, ideal in an OpenAI-native stack when I don't need LangGraph's checkpointing and interrupts."* Correcting the Swarm trap and drawing the LangGraph line is exactly the signal interviewers want.
