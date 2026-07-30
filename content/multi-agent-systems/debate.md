# Debate

**What it is:** a collaboration pattern where two or more agents argue *opposing* positions on a question over several rounds, and a judge (or the agents themselves) converges on the best-supported answer.

## Why it matters for an AI Engineer

A single LLM answers confidently even when it's wrong — it has no adversary. Debate manufactures one. By forcing agents to attack each other's reasoning, you surface flaws a lone agent would glide past, which measurably improves accuracy on hard reasoning and factual questions. For an AI Engineer, debate is a tool for the *high-stakes, ambiguous* questions where being confidently wrong is expensive — and it's a named research technique (multi-agent debate) that signals you know accuracy techniques beyond "use a bigger model."

## The mechanism / how it works

The loop:

1. **Assign stances.** Agent A argues for a position, agent B against (or each proposes its own independent answer).
2. **Round of arguments.** Each agent states its case *with reasoning*.
3. **Rebuttal rounds.** Each agent sees the other's argument and must respond to it — defending, conceding, or attacking specific points. This is the engine: an agent forced to *rebut* a concrete claim can't hand-wave.
4. **Judgment.** After N rounds, a separate **judge agent** (kept impartial, no stake in either side) weighs the arguments and picks the winner, or the debaters converge.

Why it works: errors are often *asymmetric* — a wrong claim is usually easier to attack than a right one to defend. Over rounds, indefensible positions crumble under rebuttal, and the surviving answer tends to be the better-grounded one. It's the same reason adversarial review beats a single reviewer.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🅰️ Argues FOR</span>
    <span class="darr">↔<span class="lbl">rebut × N rounds</span></span>
    <span class="dbox purple">🅱️ Argues AGAINST</span>
    <span class="darr">→</span>
    <span class="dbox orange">⚖️ Judge</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Best-supported answer</span>
  </div>
  <div class="dcap">Agents attack each other's reasoning over rounds; an impartial judge picks the answer that survives.</div>
</div>

## A concrete example

A minimal two-agent debate with a judge:

```python
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o", temperature=0.7)  # some temp so sides differ

def argue(stance, question, history):
    return model.invoke(
        f"You argue the {stance} position on: {question}\n"
        f"Debate so far:\n{history}\nGive your strongest argument, rebutting the other side."
    ).content

def debate(question, rounds=2):
    history = ""
    for _ in range(rounds):                       # bounded rounds — never open-ended
        for stance in ("YES", "NO"):
            arg = argue(stance, question, history)
            history += f"\n[{stance}] {arg}"
    verdict = model.invoke(                        # impartial judge, separate call
        f"Question: {question}\nDebate:\n{history}\n"
        f"As a neutral judge, which side is better supported? Give the final answer."
    ).content
    return verdict

print(debate("Should this loan application be approved given the risk profile?"))
```

The bounded `rounds` matters — without a cap, debates can drag on burning tokens for diminishing gains.

## How a company uses this

A Dubai investment firm uses a debate setup for contested "invest / pass" decisions on early-stage deals. A "bull" agent argues the upside, a "bear" agent argues the risks, each rebutting the other over two rounds, and a judge agent synthesizes a recommendation with the strongest points from both sides. The value isn't just the verdict — it's that analysts get a *balanced brief* surfacing risks a single optimistic summary would bury. They reserve it for borderline deals only: at ~4× the token cost of a single analysis, debating every routine deal would be wasteful, so a [router](routing.md) sends only high-uncertainty cases to the debate pipeline.

## Common mistakes / misconceptions

- **Using it everywhere.** Debate is 3–5× the cost of one call. Reserve it for genuinely hard or high-stakes questions; route easy ones to a single agent.
- **Biased judge.** If the judge also argued a side, it favors itself. Keep the judge a separate, impartial agent.
- **Unbounded rounds.** Debates don't self-terminate usefully — cap rounds, or costs balloon for tiny accuracy gains (see [cost-explosion.md](cost-explosion.md)).
- **Both agents agreeing immediately.** With no stance assignment or too-low temperature, "debaters" just echo each other. Assign opposing positions.

## Interview tip
Say: *"Multi-agent debate has agents argue opposing sides over bounded rounds with an impartial judge — errors are easier to attack than defend, so weak positions collapse under rebuttal and accuracy on hard questions goes up. It costs several times a single call, so I route only high-stakes or ambiguous cases to it."* That shows you know an accuracy technique *and* its cost discipline.
