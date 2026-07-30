# Rubric scoring

**The one-line idea:** Rubric scoring breaks "is this answer good?" into several explicit, independently-graded criteria — correctness, groundedness, tone, completeness — so you get a diagnostic breakdown instead of one fuzzy number.

## Why it matters for an AI Engineer

A single "quality: 7/10" tells you nothing actionable — *why* is it a 7? Rubric scoring turns evaluation into a **diagnosis**: it says "correctness 5/5 but tone 2/5," which tells you exactly what to fix. It also makes LLM-as-judge far more reliable (the judge grades one narrow thing at a time) and matches how real product teams define "good" (multiple stakeholders each care about a different axis). This is the professional way to structure any LLM-as-judge eval.

## The mechanism — how it works

You define a set of **criteria**, each with its own scale and clear definitions, and the judge scores every criterion separately:

1. **Decompose "good" into axes.** For a support bot: *Correctness* (is the fact right?), *Groundedness* (is it supported by the retrieved context?), *Completeness* (did it answer the whole question?), *Tone* (on-brand, polite?), *Safety* (no harmful/off-limits content?).
2. **Define each level.** For every criterion, spell out what a 1 vs a 3 vs a 5 looks like. Precision here is what makes scores repeatable across runs and reviewers.
3. **Score independently.** The judge (or human) rates each axis on its own — critically, a great tone shouldn't inflate the correctness score. Asking for per-criterion reasoning before the number improves consistency.
4. **Aggregate deliberately.** Sometimes a weighted average; often *not* — many criteria are **gates** (safety must be ≥4 or the answer fails outright, regardless of other scores). Decide which axes are averaged and which are hard gates.

<div class="diagram">
  <div class="dstack">
    <span class="dbox orange">correctness&nbsp;&nbsp; 5/5</span>
    <span class="dbox orange">groundedness 4/5</span>
    <span class="dbox orange">completeness 3/5</span>
    <span class="dbox yellow">tone&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 2/5 ⚠️</span>
    <span class="dbox purple">safety&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; GATE ✅</span>
  </div>
  <div class="dcap">Each axis scored on its own → you see exactly which dimension to fix (here: tone).</div>
</div>

## Concrete example

```python
from openai import OpenAI
import json
client = OpenAI()

RUBRIC = """Grade the ANSWER on each criterion 1-5 using the CONTEXT.
- correctness: is the information factually right?
- groundedness: is every claim supported by the CONTEXT?
- completeness: does it fully answer the QUESTION?
- tone: professional and polite for a bank customer?
Return JSON: {{"correctness":int,"groundedness":int,
"completeness":int,"tone":int,"notes":str}}.

QUESTION: {q}\nCONTEXT: {ctx}\nANSWER: {a}"""

def rubric_score(q, ctx, a):
    r = client.chat.completions.create(
        model="gpt-4o", temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role":"user","content":RUBRIC.format(q=q,ctx=ctx,a=a)}])
    s = json.loads(r.choices[0].message.content)
    s["pass"] = s["correctness"] >= 4 and s["groundedness"] >= 4  # gates
    return s

print(rubric_score("What's the notice period?",
    "Savings accounts need 30 days notice.",
    "Just close it whenever, no notice needed."))
# groundedness/correctness low → pass=False, notes explain why
```

## How a company uses this

A **Dubai bank** graded its assistant on five axes — correctness, groundedness, completeness, tone, and compliance — with **compliance and groundedness as hard gates** (any answer failing either was auto-rejected regardless of a lovely tone). This breakdown was the difference between a useless "score dropped" alert and an actionable one: when a release regressed, the dashboard showed *groundedness* fell while other axes held, pointing engineers straight at a retrieval bug rather than a prompt-tone tweak. The per-axis history also let each stakeholder (legal, brand, product) watch the metric they owned.

## Common mistakes / misconceptions

- **Too many criteria.** Ten axes overwhelm the judge and dilute signal. 3–5 well-chosen ones is the sweet spot.
- **Overlapping/vague criteria.** "Quality" and "helpfulness" measure the same thing → redundant. Make axes distinct and defined.
- **Averaging when you should gate.** Blending safety into an average lets a charming, unsafe answer pass. Safety/compliance are pass/fail gates, not contributors to a mean.
- **Grading all axes in one blurred judgment.** Ask for each score (with reasoning) separately so a strong axis doesn't halo the others.

## Interview tip
Say: *"I don't score answers with one number — I use a rubric of 3–5 defined criteria like correctness, groundedness, completeness and tone, each graded independently by the judge. Some axes are hard gates, not averaged — safety and compliance must pass regardless of the rest. That gives a diagnostic breakdown, so a regression tells me *which* dimension broke."* The gates-vs-average distinction shows product maturity.

See also: [LLM-as-judge](./llm-as-judge.md) (the engine rubric scoring runs on), [Pairwise](./pairwise.md) (comparison alternative), and [Faithfulness](./faithfulness.md) (the groundedness axis, measured RAG-style).
