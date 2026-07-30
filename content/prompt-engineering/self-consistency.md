# Self-consistency

**What it is:** Self-consistency is running the *same* reasoning prompt several times with some randomness, then taking the **majority answer** — a vote across independent attempts instead of trusting one shot.

## Why it matters for an AI Engineer
A single [Chain-of-Thought](./chain-of-thought.md) run can wander down one wrong path and confidently land on a wrong answer. But if you let the model try the problem five times, the *correct* answer tends to show up more often than any single wrong one — because there are many ways to be wrong but the right reasoning converges. For an AI Engineer this is a dial you can turn to buy accuracy on high-stakes reasoning (a medical triage, a financial rule, a hard extraction) by spending more compute. Knowing this tradeoff — accuracy for cost — is exactly the kind of judgment interviews test.

## The mechanism
The recipe:

1. Take a reasoning prompt (usually CoT).
2. Sample it **N times with `temperature > 0`** (e.g. 0.7) so each run explores a slightly different reasoning path.
3. Extract the final answer from each run.
4. **Take the majority vote** (mode) as the final answer.

Why it works: temperature makes each run diverge in *how* it reasons. Wrong runs scatter across different wrong answers; correct runs cluster on the same right answer. So the mode of the distribution is a much stronger signal than any single draw. It's an ensemble method — the same idea as averaging many weak predictors — applied to reasoning.

The cost is linear in N: 5 samples ≈ 5× the tokens and cost of one call. So you reserve it for questions where correctness is worth it, and you keep N small (3–7 is typical; gains flatten fast). It only helps tasks with a **discrete, comparable answer** (a number, a label, a yes/no) — you can't "majority vote" a free-form essay.

## Concrete example
```python
from collections import Counter
from openai import OpenAI
client = OpenAI()

q = """A tank fills at 3 L/min and drains at 1 L/min. It starts empty.
After 12 minutes, then the drain closes and it fills 5 more minutes.
How many litres? Think step by step, end with 'Final: <number>'."""

answers = []
for _ in range(5):                       # sample 5 independent runs
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": q}],
        temperature=0.7,                 # randomness drives diverse paths
    )
    text = r.choices[0].message.content
    answers.append(text.split("Final:")[-1].strip().split()[0])

print(answers)                           # e.g. ['39', '39', '39', '35', '39']
print("Majority:", Counter(answers).most_common(1)[0][0])  # -> 39
```

One run happened to mishandle the drain (got 35), but 4 of 5 agreed on 39 — the vote rescues the answer.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">→<span class="lbl">temp 0.7 ×5</span></span>
    <span class="dbox orange">🧠 39</span>
    <span class="dbox orange">🧠 39</span>
    <span class="dbox orange">🧠 35</span>
    <span class="dbox orange">🧠 39</span>
    <span class="darr">→<span class="lbl">vote</span></span>
    <span class="dbox green">✅ 39</span>
  </div>
  <div class="dcap">Wrong runs scatter; correct runs agree. The majority wins.</div>
</div>

## How a company uses this
A Dubai healthtech triage assistant maps described symptoms to an urgency level (self-care / GP / ER). A single CoT run occasionally under-triaged a serious case — unacceptable. They run self-consistency with N=5 and, critically, a **conservative tiebreak**: if the vote is split, escalate to the more urgent level and flag for a human. This costs 5× per query, but at their volume (a few thousand triages/day) the extra cost is trivial next to the liability of one missed emergency. For routine, low-risk queries they drop back to a single call — N is a per-request risk dial, not a global setting.

## Common mistakes
- **Using it with `temperature=0`.** No randomness → five identical runs → no ensemble benefit. You need `temp > 0`.
- **Applying it to open-ended output.** You can't majority-vote a paragraph; it only works for discrete answers.
- **Setting N too high.** Gains flatten after ~5–7; N=20 is mostly wasted money.
- **Ignoring the tie case.** Define what happens on a split vote (safest option, or human review) — don't let it pick arbitrarily.

## Interview tip
Say: *"Self-consistency samples a CoT prompt several times at non-zero temperature and takes the majority answer — an ensemble that fixes single-run reasoning errors. It's N× the cost, so I gate it to high-stakes queries with discrete answers and define a safe tiebreak rule."* That shows you see it as a cost-controlled reliability tool, not a default. See [Tree-of-Thought](./tree-of-thought.md) for exploring reasoning paths more deliberately.
