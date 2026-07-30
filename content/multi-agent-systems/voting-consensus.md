# Voting / Consensus

**What it is:** run the *same* question through several agents (or the same agent several times) independently, then take the majority answer — the wisdom-of-crowds trick applied to LLMs.

## Why it matters for an AI Engineer

LLMs are stochastic — ask the same hard question twice and you can get two different answers, one right, one wrong. Voting exploits this: if the *right* answer is even slightly more likely than any single wrong one, aggregating many independent tries makes the majority converge on correct. It's the simplest, most reliable accuracy booster after "use a better prompt," and it needs no coordination between agents. For an AI Engineer, this is the technique (also called **self-consistency**) you reach for when a task has a *checkable, discrete* answer and correctness matters more than cost.

## The mechanism / how it works

1. **Sample N times.** Run the question through N independent agents — either N different models, or the *same* model N times with a non-zero temperature so the reasoning paths differ.
2. **Independence is essential.** The samples must not see each other, or they'd just copy one answer. This is the opposite of [debate](debate.md): there, agents interact; here, they're isolated.
3. **Aggregate.** Take the mode (most common answer) for discrete outputs. For free-form text, either a judge agent picks the best or you cluster answers and take the largest cluster.

The math is Condorcet's jury theorem: if each independent voter is *better than chance*, majority accuracy rises with N and approaches 1. The catch — voters must be better than chance and reasonably independent. If they all share the same blind spot, they vote wrong *together*, and voting gives you false confidence.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">↓<span class="lbl">ask N times, independently</span></span>
  </div>
  <div class="flow">
    <span class="dbox blue">🤖 → 42</span>
    <span class="dbox blue">🤖 → 42</span>
    <span class="dbox blue">🤖 → 41</span>
    <span class="dbox blue">🤖 → 42</span>
  </div>
  <div class="flow v">
    <span class="darr">↓<span class="lbl">majority vote</span></span>
    <span class="dbox green">✅ 42 (3 of 4)</span>
  </div>
  <div class="dcap">Independent samples, then take the mode — the right answer wins if it's even slightly more likely than any wrong one.</div>
</div>

## A concrete example

Self-consistency voting, run in [parallel](concurrent-parallel.md) for speed:

```python
import asyncio
from collections import Counter
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o", temperature=0.8)  # temp>0 so paths diverge

async def answer(q):
    r = await model.ainvoke(f"{q}\nThink step by step, end with 'ANSWER: <value>'.")
    return r.content.split("ANSWER:")[-1].strip()

async def vote(q, n=5):
    results = await asyncio.gather(*(answer(q) for _ in range(n)))  # n independent tries
    winner, count = Counter(results).most_common(1)[0]
    return winner, count / n            # answer + confidence (fraction agreeing)

ans, conf = asyncio.run(vote("A widget costs 7 AED. How much for 23 widgets?"))
print(ans, f"(confidence {conf:.0%})")
```

Bonus: the agreement fraction is a cheap **confidence signal** — 5/5 agreeing is far more trustworthy than 2/5, and you can abstain or escalate when confidence is low.

## How a company uses this

A Dubai accounting-automation startup extracts totals from scanned invoices. A single LLM pass misread ~6% of totals — unacceptable for financial data. They switched to voting: three independent passes, and only when all three agree does the value auto-post; disagreement routes to a human. This cut auto-posted errors to well under 1% while still auto-handling ~90% of invoices (the ones where all three agree). The extra two LLM calls per invoice cost pennies against the price of a wrong financial entry — a clear win because the answer is *discrete and checkable*, exactly where voting shines.

## Common mistakes / misconceptions

- **Voting on free-form text.** Two correct summaries phrased differently "disagree," breaking the vote. Voting works cleanly on discrete/structured answers; for text, use a judge instead.
- **Temperature 0 on the same model.** Identical inputs give identical outputs — no diversity, no benefit. Use temperature or different models.
- **Correlated voters.** N copies of the same model with the same blind spot vote wrong together. Diversity (different models/prompts) helps.
- **Ignoring cost.** N× the calls. Reserve high N for high-stakes, checkable answers.

## Interview tip
Say: *"Voting / self-consistency runs a question through N *independent* agents and takes the majority — accuracy rises as long as each voter beats chance and they're reasonably independent. I use it for discrete, checkable answers, and the agreement fraction doubles as a confidence signal for abstaining or escalating. Unlike debate, the voters never see each other."* Naming the independence requirement and the confidence trick is the depth signal.
