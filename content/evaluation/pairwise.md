# Pairwise

**The one-line idea:** Pairwise evaluation asks "which of these two answers is better, A or B?" instead of "score this one" — because judges (LLM or human) are far more reliable at *comparing* than at handing out absolute scores.

## Why it matters for an AI Engineer

When you're deciding between two prompts, two models, or two RAG configs, pairwise is the sharpest tool you have. Humans and LLMs both struggle to give a consistent absolute "7/10," but they're excellent at "B is clearly better." Pairwise underpins how models are actually ranked in the wild (LMArena/Chatbot Arena is one giant pairwise experiment) and how RLHF preference data is collected. As an engineer, pairwise is your A/B decision procedure: *did the new version actually win?*

## The mechanism — how it works

Instead of scoring on a scale, you present **two outputs for the same input** and ask the judge to pick a winner (or "tie"):

1. **Same input, two candidates.** Generate answer A (old prompt) and answer B (new prompt) for each test question.
2. **Judge picks a winner.** An LLM-judge (or human) reads both and returns `A`, `B`, or `tie`, ideally with reasoning.
3. **Aggregate into a win rate.** Over 200 questions, "new prompt won 62%, tied 20%, lost 18%" is a clear, defensible verdict — much more trustworthy than "average score went from 4.1 to 4.3."
4. **Kill position bias.** Judges favor whichever answer is shown *first*. The fix is to **run each pair twice with the order swapped** and only count a win if the same side wins both times (otherwise call it a tie). This alone removes the biggest source of noise.

For many candidates you convert pairwise results into a ranking with an **Elo/Bradley-Terry** rating, the same math chess uses.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">answer A</span>
    <span class="dbox orange">answer B</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧑‍⚖️ judge<span class="sub">swap order, run twice</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ win rate / Elo</span>
  </div>
  <div class="dcap">Compare two outputs head-to-head, swap order to cancel position bias, aggregate into a win rate.</div>
</div>

## Concrete example

```python
from openai import OpenAI
import json
client = OpenAI()

def compare(question, a, b):
    prompt = f"""Which answer is better for the question? Reply JSON
{{"winner": "A"|"B"|"tie", "reason": str}}.
Q: {question}\nA: {a}\nB: {b}"""
    r = client.chat.completions.create(
        model="gpt-4o", temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}])
    return json.loads(r.choices[0].message.content)["winner"]

def robust_compare(q, a, b):          # swap order to cancel position bias
    first  = compare(q, a, b)          # A shown first
    second = compare(q, b, a)          # B shown first
    if first == "A" and second == "B": return "A wins"
    if first == "B" and second == "A": return "B wins"
    return "tie"

print(robust_compare("What's the notice period?",
                     "30 days.", "You must give thirty days' written notice."))
```

## How a company uses this

A **Dubai e-commerce team** rewriting their product-description generator ran the old vs new prompt pairwise over **500 real products**, order-swapped, judged by GPT-4o. The result — "new prompt wins 58%, ties 27%, loses 15%" — was concrete enough to green-light the rollout to their VP, where an ambiguous "average quality rose 0.2" would have stalled in debate. They spot-checked 40 of the pairwise verdicts against human reviewers to confirm the judge's preferences matched the business's taste before shipping. Pairwise is also how they later ran a live champion/challenger test between two models.

## Common mistakes / misconceptions

- **Not swapping order.** Position bias can flip 10–20% of verdicts. Always run both orders.
- **No "tie" option.** Forcing a winner on genuinely-equal answers manufactures noise. Allow ties.
- **Reading win rate as absolute quality.** Pairwise tells you *B beats A*, not *B is good*. Both could be bad. Pair it with an absolute check (LLM-as-judge score) if you need a floor.
- **Too few comparisons.** A 55% win rate over 30 items isn't significant. Use enough examples (hundreds) for the margin to mean something.

## Interview tip
Say: *"For choosing between two prompts or models I prefer pairwise over absolute scoring — judges compare more reliably than they grade. I always swap the order and require a consistent win to cancel position bias, allow ties, and report a win rate over a few hundred examples, converting to Elo when ranking many candidates."* The order-swap detail is the tell that you've actually run these and hit the bias.

See also: [LLM-as-judge](./llm-as-judge.md) (the absolute-scoring sibling), [Rubric scoring](./rubric-scoring.md) (structured criteria), and [Regression / CI eval](./regression-ci-eval.md) (where win rates gate a deploy).
