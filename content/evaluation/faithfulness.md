# Faithfulness

**The one-line idea:** Faithfulness measures whether every claim in a RAG answer is actually *supported by the retrieved context* — it's the direct, numeric detector for the RAG failure everyone fears: making things up.

## Why it matters for an AI Engineer

Faithfulness is the single most important RAG metric, because a *plausible but unsupported* answer is worse than no answer — it's a confident lie. The entire promise of RAG is "grounded in your documents," and faithfulness is how you prove that promise held. In trust-critical domains (a Dubai bank, a law firm, a hospital) a low faithfulness score is a blocker, full stop. When an interviewer asks "how do you stop hallucination in RAG?", faithfulness is the metric half of the answer.

## The mechanism — how it works

Faithfulness (a core **RAGAS** metric) checks each claim against the context in two steps:

1. **Decompose the answer into atomic claims.** An LLM breaks the answer into individual factual statements. "The notice period is 30 days and there's no fee" → claim 1: *notice period is 30 days*; claim 2: *there is no fee*.
2. **Verify each claim against the retrieved context.** For each claim, an LLM checks: can this be inferred from the context? Yes/No.
3. **Score = supported claims / total claims.** If 4 of 5 claims are backed by the context, faithfulness = 0.8. A score of 1.0 means the answer invented nothing.

The crucial insight: **faithfulness ignores whether the answer is *true in the real world* — only whether it's supported by *what was retrieved*.** An answer can be factually correct yet unfaithful (the model knew it from pretraining, not from your docs), which is still a bug in RAG because it means retrieval wasn't actually driving the answer.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 answer</span>
    <span class="darr">↓<span class="lbl">decompose</span></span>
    <span class="dbox orange">claim 1 · claim 2 · claim 3</span>
    <span class="darr">↓<span class="lbl">check vs retrieved context</span></span>
    <span class="dbox blue">🗄️ supported? ✅✅❌</span>
    <span class="darr">↓</span>
    <span class="dbox green">faithfulness = 2/3</span>
  </div>
  <div class="dcap">Break the answer into claims, verify each against the context, score the supported fraction.</div>
</div>

## Concrete example

```python
# pip install ragas
from ragas import evaluate
from ragas.metrics import faithfulness
from datasets import Dataset

data = Dataset.from_dict({
    "question": ["What is the notice period to close a savings account?"],
    "answer":   ["You must give 30 days notice, and there is a 50 AED fee."],
    "contexts": [["Closing a savings account requires 30 days written notice."]],
})   # note: context says nothing about a fee

result = evaluate(data, metrics=[faithfulness])
print(result)   # faithfulness ≈ 0.5 — the "50 AED fee" claim is unsupported (hallucinated)
```

The "50 AED fee" was never in the context, so it's an unsupported claim and faithfulness drops — exactly the hallucination you want caught automatically.

## How a company uses this

A **Dubai bank** set a **hard CI gate: mean faithfulness ≥ 0.90** across its 300-question golden set; any release below that fails the build and can't deploy. This directly prevents the incident that motivated it — a "friendlier tone" prompt tweak that had started inventing fees. Because faithfulness is per-claim, their dashboard also surfaces *which* answers hallucinated, so reviewers jump straight to the offending responses. At production scale they sample live traffic (say 2% of answers) through the same faithfulness check via Langfuse, catching real-world drift that the fixed test set misses. Each check costs a few LLM calls — a fraction of a cent — cheap insurance against a compliance headline.

## Common mistakes / misconceptions

- **Confusing faithfulness with correctness.** Faithful = supported by context. Correct = true in reality. You need both — a wrong context yields a faithful-but-wrong answer, so also check context quality (see context precision/recall).
- **Blaming the LLM for low faithfulness.** Often the real cause is retrieval: if the context lacked the answer, the model *had* to guess. Check context recall before touching the prompt.
- **Testing on one example.** Faithfulness varies by question type. Score a representative golden set, not a happy-path demo.
- **Ignoring "I don't know."** A well-behaved RAG that refuses when context is missing should score *high* faithfulness — don't penalize honest abstention.

## Interview tip
Say: *"Faithfulness — a RAGAS metric — decomposes the answer into atomic claims and checks each against the retrieved context, scoring the supported fraction. It's my primary hallucination gate, but it measures grounding, not truth, so I pair it with context recall to make sure the *right* docs were even retrieved. In production I gate CI at ~0.9 and sample live traffic through the same check."* Distinguishing grounded-vs-true and pointing at retrieval as the root cause is the senior answer.

See also: [Hallucination rate](./hallucination-rate.md) (the flip side), [Context recall](./context-recall.md) and [Context precision](./context-precision.md) (retrieval quality that drives faithfulness), and [Answer relevancy](./answer-relevancy.md).
