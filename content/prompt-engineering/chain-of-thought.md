# Chain-of-Thought

**What it is:** Chain-of-Thought (CoT) prompting is asking the model to *think step by step* and write out its reasoning before giving the final answer — turning one hard leap into a chain of small, checkable steps.

## Why it matters for an AI Engineer
LLMs answer by predicting tokens left to right. If you demand the final answer immediately, the model has to compute a multi-step problem in a *single* forward pass — and it often gets arithmetic, logic, and multi-hop questions wrong. CoT lets the model spend tokens "thinking on paper" first, which dramatically improves accuracy on reasoning tasks. For an AI Engineer this is the single highest-leverage trick for correctness on anything involving math, rules, planning, or multi-step deduction — the difference between a wrong answer and a right one is often the phrase "think step by step."

## The mechanism
Each token the model generates becomes part of the context for the *next* token. When the model writes out intermediate steps, those steps are now visible input it can build on — it's effectively using its own output as a scratchpad / working memory. A hard problem that has low probability of a correct one-shot answer becomes a sequence of easy next-steps, each high-probability given the last.

Two flavours:

- **Zero-shot CoT**: just append "Let's think step by step." The model generates its own reasoning. Cheapest, works surprisingly well.
- **Few-shot CoT**: show examples that *include* the reasoning, so the model imitates a specific reasoning style.

A crucial production detail: raw CoT output is verbose and ends with the answer buried in prose. So you either (a) ask it to end with a clearly delimited final answer (`Final answer: X`) that you parse, or (b) use CoT to reason then make a **second** call / structured field for the clean answer. Note also **reasoning models** (OpenAI o-series, DeepSeek-R1, Claude with extended thinking) do CoT *internally* — you often don't need to prompt for it, and shouldn't pay for visible reasoning tokens you'll throw away.

## Concrete example
```python
from openai import OpenAI
client = OpenAI()

q = ("A shop sells pens at 3 AED each. A customer buys 4 pens and pays "
     "with a 20 AED note. Then buys 2 more and pays with the change. "
     "How much money does the customer have left?")

prompt = f"""{q}

Think step by step, then end with exactly: 'Final answer: <number> AED'."""

r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": prompt}],
    temperature=0,
)
print(r.choices[0].message.content)
# Step 1: 4 pens = 12 AED. Change from 20 = 8 AED.
# Step 2: 2 pens = 6 AED, paid from 8 -> 2 AED left.
# Final answer: 2 AED
```

Without the "step by step" cue, small models frequently answer 14 or 8 — they skip a step. With it, the arithmetic is laid out and checkable.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Multi-step question</span>
    <span class="darr">↓<span class="lbl">"think step by step"</span></span>
    <span class="dbox orange">1️⃣ step → 2️⃣ step → 3️⃣ step</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Final answer (parseable)</span>
  </div>
  <div class="dcap">The model uses its own written steps as a scratchpad, so each step is an easy prediction.</div>
</div>

## How a company uses this
A Dubai insurance firm auto-checks whether a claim is covered under a policy — a task with nested conditions (waiting periods, exclusions, sub-limits). A direct yes/no was wrong ~18% of the time. Adding CoT ("walk through each policy condition against the claim, then decide") dropped errors below 5% and, as a bonus, produced an audit trail a human adjuster could review — regulators liked that. Cost tradeoff: CoT roughly tripled output tokens per claim, so they route only *borderline* claims (flagged by a cheap first pass) through the expensive CoT path. That kept the average cost per claim flat while fixing the hard cases.

## Common mistakes
- **Using CoT everywhere.** It costs 2–4× output tokens and latency. For simple classification it's pure waste.
- **Not parsing the final answer cleanly.** Reasoning is prose; without a delimited `Final answer:` you can't extract it reliably. Pair with [structured output](./structured-output.md).
- **Prompting CoT on a reasoning model.** o-series / R1 already reason internally; adding "think step by step" is redundant and can even hurt.
- **Trusting the reasoning as truth.** The written steps are a *rationalization*, not a guaranteed faithful trace — a right-looking chain can still reach a wrong answer.

## Interview tip
Say: *"Chain-of-thought trades tokens for accuracy on multi-step reasoning by letting the model write a scratchpad it builds on. I gate it — cheap direct pass first, CoT only on hard cases — and I always parse a delimited final answer. On reasoning models I skip it since they reason internally."* Mentioning the cost gate and reasoning models shows current, production-level judgment. See also [self-consistency](./self-consistency.md), which samples several CoT runs and votes.
