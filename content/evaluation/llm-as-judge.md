# LLM-as-judge

**The one-line idea:** LLM-as-judge uses a strong LLM to *grade* another model's output against your criteria — the go-to way to score open-ended answers where no single "correct" reference string exists.

## Why it matters for an AI Engineer

Most real LLM outputs — chatbot replies, RAG answers, summaries, generated emails — have no gold reference to overlap against, so ROUGE/BLEU are useless. LLM-as-judge is what fills that gap, and it's now the *dominant* evaluation method for production LLM apps. It scales (grade thousands of answers automatically), it's flexible (define any rubric in plain English), and it correlates surprisingly well with human ratings. "How do you evaluate open-ended answers?" → "LLM-as-judge" is table stakes; the depth is in knowing its failure modes.

## The mechanism — how it works

You send the judge model a **prompt containing: the task, the criteria, the input, and the output to grade**, and ask it to return a structured score. Three ingredients make it reliable:

1. **A clear rubric.** Vague ("is this good?") gives noisy scores. Specific ("Score 1–5. 5 = fully answers the question and is grounded in the context; 1 = off-topic or contradicts the context") is repeatable.
2. **Structured output + reasoning.** Ask for JSON `{score, reasoning}` and have it explain *before* the number (chain-of-thought), which improves accuracy and gives you an audit trail.
3. **A capable judge.** Use a strong model (GPT-4-class or better) as judge — ideally *different from or stronger than* the model being graded, to avoid rubber-stamping.

There are three flavors: **direct scoring** (grade one output on a scale — this tile), **pairwise** (which of two is better — see sibling), and **reference-based** (grade against a gold answer). Direct scoring is the workhorse.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 input + output</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧑‍⚖️ judge LLM<span class="sub">rubric in prompt</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ {score, reasoning}</span>
  </div>
  <div class="dcap">A strong LLM reads your rubric and the output, then returns a structured score with justification.</div>
</div>

## Concrete example

```python
from openai import OpenAI
import json
client = OpenAI()

JUDGE = """You are a strict grader. Score the ANSWER 1-5 on how well it
answers the QUESTION using ONLY the CONTEXT.
5 = complete and fully grounded; 1 = wrong or unsupported.
Return JSON: {{"score": int, "reasoning": str}}.

QUESTION: {q}
CONTEXT: {ctx}
ANSWER: {a}"""

def judge(q, ctx, a):
    r = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": JUDGE.format(q=q, ctx=ctx, a=a)}],
        response_format={"type": "json_object"},
        temperature=0,           # deterministic grading
    )
    return json.loads(r.choices[0].message.content)

print(judge(
    "What is the notice period?",
    "Savings accounts require 30 days notice to close.",
    "You need to give 30 days' notice."))
# {'score': 5, 'reasoning': 'Correct and grounded in the context.'}
```

`temperature=0` and a rigid JSON schema are what make scores stable enough to trend over time.

## How a company uses this

A **Dubai bank's** RAG assistant runs an LLM-judge over **every release** across a 300-question golden set, scoring each answer 1–5 for correctness and groundedness. It costs roughly **$0.01–0.03 per graded answer** (~$5–9 per full run) and finishes in a few minutes — cheap enough for CI, where a human panel would cost hundreds of dollars and days. They **calibrated the judge** by having humans grade 50 answers and checking the judge agreed ~90% of the time before trusting it unsupervised, and they re-check that agreement whenever they change the judge model. A drop in the average judge score blocks the deploy.

## Common mistakes / misconceptions

- **Vague rubrics.** "Rate quality 1–10" gives noise. Define what each level means and what to check.
- **Position/verbosity/self bias.** Judges favor the first option, longer answers, and outputs from their own model family. Use temperature 0, randomize order in pairwise, and prefer a judge from a different family than the graded model.
- **Never validating the judge.** An unchecked judge can be confidently wrong. Always spot-check agreement against humans on a sample.
- **Judging on the same model you're grading.** It rubber-stamps its own style. Use an equal or stronger, ideally different, judge.

## Interview tip
Say: *"For open-ended answers I use LLM-as-judge — a strong model grading against an explicit rubric, temperature 0, structured JSON with reasoning. The catch is judge bias — position, verbosity, self-preference — so I randomize order, keep the rubric tight, and validate the judge against ~50 human labels before trusting it in CI."* Volunteering the bias mitigations is what separates a real practitioner from someone who read a blog post.

See also: [Pairwise](./pairwise.md) (A/B comparison variant), [Rubric scoring](./rubric-scoring.md) (structured multi-criterion grading), and [Human-in-the-loop](./human-in-the-loop.md) (for calibrating the judge).
