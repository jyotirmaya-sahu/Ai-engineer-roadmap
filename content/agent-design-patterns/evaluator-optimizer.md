# Evaluator-optimizer

**What it is:** a two-role loop where one LLM **produces** an answer and a second LLM **evaluates** it against explicit criteria, sending feedback back so the producer revises — repeating until the evaluator is satisfied (or you hit a cap).

## Why it matters for an AI Engineer

First drafts from an LLM are often *good enough* — but "good enough" fails for high-stakes output: legal clauses, translated marketing copy, code that has to compile. A human writer improves by getting edited; this pattern gives the model the same feedback loop, automatically.

The insight is that **judging is easier than generating.** An LLM often can't write a perfect Arabic marketing tagline in one shot, but it *can* reliably spot that a draft is too formal or mistranslates a phrase. Evaluator-optimizer turns that asymmetry into quality: separate the critic from the author so each does the job it's better at. For an AI Engineer, this is the pattern that lifts output from "demo-acceptable" to "shippable" on tasks where quality is measurable and iteration actually helps.

## The mechanism / how it works

Two roles, one loop:

1. **Optimizer** (producer) generates a draft.
2. **Evaluator** (critic) scores it against clear criteria and returns either "pass" or specific, actionable feedback.
3. If it fails, the feedback goes back to the optimizer, which revises. Loop.
4. Stop when the evaluator passes it **or** you hit a max-iterations cap.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Task</span>
    <span class="darr">↓</span>
    <span class="dbox purple">✍️ Optimizer: draft</span>
    <span class="darr">↓</span>
    <span class="dbox orange">⚖️ Evaluator: score vs criteria</span>
    <div class="flow">
      <span class="dbox green">✅ pass → done</span>
      <span class="dbox yellow">↺ fail → feedback → revise</span>
    </div>
  </div>
  <div class="dcap">A critic LLM grades against explicit criteria; failures loop back with feedback until it passes or a cap is hit.</div>
</div>

Two things make it work. First, the evaluator needs **explicit, checkable criteria** — "is it under 20 words, in Emirati-friendly tone, and does it keep the brand name?" beats "is it good?". Vague criteria give vague feedback that doesn't improve the draft. Second, you **must cap iterations** — otherwise a never-satisfied evaluator loops forever, burning tokens.

Note the difference from [reflection](reflection.md): reflection is one model reviewing *itself*; evaluator-optimizer uses **two separate roles** (often two prompts, sometimes two models), which reduces the "graded my own homework" blind spot.

## A concrete example

An optimizer/evaluator loop for tightening a tagline, capped at three rounds.

```python
from openai import OpenAI
client = OpenAI()

def llm(prompt, temp=0.5):
    return client.chat.completions.create(
        model="gpt-4o", temperature=temp,
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content.strip()

def refine(brief: str, max_rounds: int = 3) -> str:
    draft = llm(f"Write a tagline: {brief}")
    for _ in range(max_rounds):
        verdict = llm(
            f"Criteria: under 8 words, energetic, keeps brand 'NoorPay'.\n"
            f"Tagline: {draft}\n"
            f"Reply 'PASS' or specific fixes.", temp=0)
        if verdict.upper().startswith("PASS"):
            break
        draft = llm(f"Revise using this feedback: {verdict}\nTagline: {draft}")
    return draft

print(refine("A UAE digital wallet for young professionals"))
```

The evaluator uses concrete criteria and temperature 0 for consistent judging; the loop is hard-capped at three rounds so it can't run away.

## How a company uses this

A **Dubai e-commerce company** localizes product descriptions from English to Arabic at scale. A translator LLM drafts; an evaluator LLM checks against fixed criteria (accurate meaning, natural Gulf-Arabic register, correct units in AED, no left-in English). Roughly 35% of drafts fail the first pass and get one revision; ~4% need two. Capping at two revisions, average cost is ~$0.02 per description across ~12,000/day. This replaced a human-review bottleneck that had capped them at ~2,000 listings/day — the evaluator catches the register and unit errors that were the most common human complaints, and only genuinely ambiguous cases now escalate to a human.

## Common mistakes / misconceptions

- **Fuzzy evaluation criteria.** "Make it better" yields feedback the optimizer can't act on. Spell out checkable rules.
- **No iteration cap.** A perfectionist evaluator never says PASS; without a cap the loop and the bill run forever.
- **Same prompt for both roles.** If the critic is as lenient as the author, it rubber-stamps everything. The evaluator prompt must be strict and criteria-driven.
- **Using it where one pass is fine.** The loop multiplies cost and latency. Only apply it where iteration measurably improves a quality metric you care about.

## Interview tip
Say: *"Evaluator-optimizer exploits the fact that judging is easier than generating: one LLM drafts, a separate critic grades it against explicit criteria and returns actionable feedback, and the draft loops back for revision until it passes or hits a cap. The two roles must be separate and the evaluator strict — otherwise it rubber-stamps. It's how I get shippable quality on tasks where correctness is measurable, like translation or code. And I always cap iterations."* That shows you know how to engineer quality, not just hope for it.
