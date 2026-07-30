# Voting / self-consistency

**What it is:** Instead of trusting one answer, sample the *same* question several times at nonzero temperature and take the majority vote — the answer the model lands on most often is far more likely to be right.

## Why it matters for an AI Engineer

On reasoning tasks (math, logic, multi-step deduction) a single sample is a coin-flip on the hard cases: the model can reason its way down a wrong path and commit to it. But the *wrong* paths tend to disagree with each other, while the *right* path is a stable attractor — many independent reasoning chains converge on it. Self-consistency exploits that: it trades N× the tokens for a reliable accuracy bump, no retraining, no extra infra. For an AI Engineer it's the standard lever when a task is reasoning-heavy and a wrong answer is costly enough to justify the extra cost. As a bonus, *how much the samples disagree* is a free, well-calibrated uncertainty signal.

## The mechanism

1. **Sample N times with temperature > 0.** Temperature 0 gives one deterministic chain; raising it (~0.5–0.8) makes each run explore a slightly different reasoning path. You typically use chain-of-thought so each sample reasons independently.
2. **Extract the final answer from each** (the number, the label, the choice) — ignore the reasoning, keep the conclusion.
3. **Majority-vote.** The most frequent final answer wins. For free-form answers you cluster semantically equivalent ones first.

Why it beats one shot: think of each sample as a noisy voter. Errors are scattered across many different wrong answers; the correct answer is the single point many voters agree on. Aggregating cancels the noise — the same reason averaging many measurements beats one.

**The disagreement signal is the hidden gem.** If 5/5 samples agree, the model is confident and probably right → answer. If it's 2/2/1, the model is *guessing* → that's a strong cue to [abstain](./i-don-t-know-calibration.md) or [escalate](./escalation-to-human.md). This is a far better calibrated uncertainty measure than asking the model "how confident are you?"

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ question (×5, temp 0.7)</span>
    <span class="darr">↓</span>
    <span class="dstack">
      <span class="dbox purple">🤖 chain 1 → 42</span>
      <span class="dbox purple">🤖 chain 2 → 42</span>
      <span class="dbox purple">🤖 chain 3 → 37</span>
      <span class="dbox purple">🤖 chain 4 → 42</span>
      <span class="dbox purple">🤖 chain 5 → 42</span>
    </span>
    <span class="darr">↓<span class="lbl">majority</span></span>
    <span class="dbox green">✅ 42 (4/5 agree → confident)</span>
  </div>
  <div class="dcap">Independent reasoning chains scatter their errors; the correct answer is where they converge. Agreement = confidence.</div>
</div>

## Concrete example

```python
from collections import Counter
from anthropic import Anthropic
import re
c = Anthropic()

def sample_answer(q):
    r = c.messages.create(model="claude-sonnet-4-6", max_tokens=400, temperature=0.7,
        messages=[{"role": "user",
                   "content": f"{q}\nThink step by step, then end with 'ANSWER: <n>'."}])
    m = re.search(r"ANSWER:\s*(-?\d+)", r.content[0].text)
    return m.group(1) if m else None

q = "A shop had 15 boxes of 24 apples. It sold 260 apples. How many are left?"
votes = Counter(sample_answer(q) for _ in range(5))
answer, count = votes.most_common(1)[0]
confident = count >= 4                     # 4/5 agree
print(votes, "->", answer, "confident" if confident else "ABSTAIN/escalate")
# Counter({'100': 5}) -> 100 confident
```

The `count >= 4` gate turns voting into an abstention signal for free.

## How a company uses this

A Dubai trading firm runs an LLM to extract and compute figures from financial filings — tasks where one wrong number is expensive. For high-value calculations they sample 5×, majority-vote the result, and use the agreement ratio as a routing signal: **5/5 auto-accept, 3–4/5 flag for a quick analyst check, <3 agreement → full human review** ([escalation](./escalation-to-human.md)). This costs ~5x tokens on those queries, but tokens are pennies and a mispriced trade is not — and crucially, the disagreement signal means humans only look at the genuinely ambiguous ~10%, not everything. They reserve voting for the reasoning-heavy queries; simple lookups run single-shot to keep cost down.

## Common mistakes

- **Using it on non-reasoning tasks.** Voting helps when there's a *convergent correct answer*. For creative or open-ended generation there's no "majority right answer" to find — it just costs 5x.
- **Temperature 0.** Identical samples aren't independent voters; you need temperature > 0 for diverse chains.
- **Naïve string voting on free-form output.** "42 apples" vs "forty-two" split the vote. Normalize/extract the final answer, or cluster semantically, before counting.
- **Ignoring the disagreement signal.** The agreement *ratio* is the most valuable byproduct — throwing it away wastes the best calibrated confidence measure you'll get.

## Interview tip
Say: *"For reasoning-heavy tasks I use self-consistency — sample five chains at temperature ~0.7 and majority-vote, since errors scatter but the right answer converges. The real value is the agreement ratio: it's a better-calibrated confidence signal than asking the model, so I route 5/5 to auto-accept and low-agreement cases to human review. I only spend the 5x cost on reasoning queries where a wrong answer is expensive, not on simple lookups."* Framing the disagreement ratio as a routing/confidence signal shows you'd deploy it, not just benchmark it.
