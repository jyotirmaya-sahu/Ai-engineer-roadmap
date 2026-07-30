# NeMo Guardrails

**What it is:** NVIDIA's open-source **rail engine** — a toolkit that sits around your LLM and controls the *conversation itself*: what topics are allowed, what the bot must/mustn't say, and which actions it may take, defined as programmable "rails."

## Why it matters for an AI Engineer

[Llama Guard](llama-guard.md) classifies content; NeMo Guardrails controls *dialogue and flow*. It's the tool you reach for when the requirement isn't just "block unsafe text" but "keep this bot strictly on our topic, make it follow a required script for certain intents, and gate tool calls behind checks." That's exactly what enterprise and government chatbots in Dubai demand: a banking assistant that will only ever talk about banking, refuses to discuss politics or give investment advice, and never fires a sensitive tool without a check. Naming NeMo Guardrails and explaining rails vs. a content classifier shows you can match the right guardrail tool to the requirement.

## The mechanism

NeMo Guardrails wraps your app and runs **rails** at defined points:

- **Input rails** — run on the user message (e.g. detect [jailbreak](jailbreaks.md)/injection, off-topic, PII) and can block or transform before the LLM sees it.
- **Dialog rails** — the distinctive part. You define **canonical forms** (named user intents like `ask about politics`) and **flows** (what the bot should do for each). This lets you *force* the conversation down approved paths and refuse anything outside them.
- **Retrieval rails** — check/filter retrieved chunks (e.g. drop unauthorized docs) before they enter the prompt.
- **Output rails** — run on the model's answer (safety, fact-checking, self-check for hallucination) before it reaches the user.
- **Execution rails** — gate **actions/tool calls**, so an action only runs if conditions are met.

Rails are configured in YAML plus **Colang**, a small purpose-built language for describing conversational flows. Under the hood some rails use embeddings/LLM calls to match user messages to your defined intents.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 user message</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🛡️ input rail<span class="sub">jailbreak / off-topic</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧭 dialog rail<span class="sub">match intent → approved flow</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 LLM + 🔧 execution rail<span class="sub">gate tool calls</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">🛡️ output rail<span class="sub">safety / self-check</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ on-policy reply</span>
  </div>
  <div class="dcap">Rails run at each stage; dialog rails steer the conversation onto approved flows.</div>
</div>

## Concrete example

A tiny config that keeps a bot on-topic — refusing politics with a fixed answer via a dialog rail:

```yaml
# config.yml
models:
  - type: main
    engine: openai
    model: gpt-4.1-mini
rails:
  input:
    flows: [self check input]     # built-in jailbreak/safety check on the user turn
```

```colang
# topics.co  — dialog rail
define user ask about politics
  "what do you think of the government"
  "who should I vote for"
  "your opinion on the election"

define bot refuse politics
  "I'm a banking assistant and can only help with account and service questions."

define flow
  user ask about politics
  bot refuse politics          # force this response for any political intent
```

```python
from nemoguardrails import LLMRails, RailsConfig
rails = LLMRails(RailsConfig.from_path("./config"))
print(rails.generate(messages=[{"role": "user", "content": "who should I vote for?"}]))
# → the fixed "I'm a banking assistant…" refusal, never the model's own opinion
```

The `ask about politics` intent matches *semantically* (via embeddings), so paraphrases are caught too — not just the exact example lines.

## How a company uses this

**A Dubai bank's** virtual assistant uses NeMo Guardrails to enforce a hard scope. Dialog rails define the allowed intents (balance, cards, transfers, branch info) and a catch-all flow that politely declines anything else — politics, medical advice, competitor comparisons, "give me investment tips." An execution rail wraps the `transfer_money` action so it only runs after an identity check and under the amount limit ([excessive agency](excessive-agency.md) in practice). An output rail runs a self-check asking "is this answer grounded in the retrieved policy docs?" and, if not, replaces it with a handoff to a human agent. The compliance value is that scope is *declared and auditable* in the rails config rather than hoped-for in a prompt — the bank could hand regulators the topic list the bot is provably confined to.

## Common mistakes

- **Using it where a content classifier suffices.** If you only need safe/unsafe filtering, Llama Guard is simpler; NeMo shines for *flow/topic/action* control.
- **Under-specifying dialog intents.** Too few example utterances → paraphrased off-topic messages slip through. Give several per intent.
- **Ignoring latency.** Rails add LLM/embedding calls; measure and trim rails you don't need.
- **Assuming rails replace least privilege.** Execution rails gate calls, but tools must *still* be scoped — defense in depth.

## Interview tip
Say: *"NeMo Guardrails is a rail engine — I use it when I need conversation-flow control, not just content filtering: input/output rails plus dialog rails that confine the bot to approved intents and execution rails that gate tool calls. For a bank bot I'd declare the allowed topics as flows so scope is auditable, and pair it with Llama Guard for content safety and least-privilege tools for actions."* Contrasting it with a pure classifier and naming dialog/execution rails is the tell that you understand what it's *for*.
