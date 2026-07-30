# Error-analysis workflow

**What it is:** The discipline of actually *reading your system's failures*, grouping them into buckets, and fixing the biggest bucket first — the loop that tells you *which* accuracy technique to spend effort on.

## Why it matters for an AI Engineer

Every other tile in this node is a *lever*. Error analysis is how you know *which lever to pull*. Without it, you guess — you swap models, tweak prompts, add reranking, all on vibes, and half the effort is wasted on problems you don't actually have. Error analysis replaces guessing with evidence: read 50 real failures, discover that 60% are "retrieval missed the doc" and only 5% are "model reasoned badly," and now you know to fix *retrieval*, not to fine-tune the model. It's the single highest-leverage habit in applied AI, it's cheap (a spreadsheet and an afternoon), and "walk me through how you debug a quality problem" is one of the most common senior AI interview questions.

## The mechanism

A tight, repeatable loop:

1. **Collect failures.** Pull real cases where the system was wrong — from your eval set, thumbs-down feedback, and human [escalations](./escalation-to-human.md). Aim for 30–100; you don't need thousands to see the pattern.

2. **Read them. Actually read them.** Open each one and look at the input, the retrieved context, the output, and the expected answer. This manual reading is non-negotiable — aggregate metrics hide the *why*.

3. **Label a failure category for each.** Assign a short tag: `retrieval_miss`, `wrong_chunk_retrieved`, `ignored_context`, `reasoning_error`, `hallucinated_fact`, `format_error`, `ambiguous_question`. Let categories emerge from the data, don't force a fixed taxonomy.

4. **Count and rank.** Tally the categories. This is a **Pareto chart** — failures are almost never uniform. Usually 2–3 buckets cause 70%+ of errors.

5. **Fix the top bucket → map to a lever.** Each category points at a specific fix:

| Dominant failure | The lever to reach for |
|---|---|
| retrieval miss / wrong chunk | fix chunking, embeddings, or add reranking (upstream RAG) |
| ignored / contradicted context | [grounding & citation-forcing](./grounding-citation-forcing.md) |
| hallucinated when unsure | ["I don't know" calibration](./i-don-t-know-calibration.md) + [abstention](./confidence-abstention.md) |
| reasoning / math error | [self-consistency](./voting-self-consistency.md), [critique-revise](./generate-critique-revise.md) |
| malformed output | [constrained decoding](./constrained-structured-decoding.md) |
| unverifiable but checkable | [verification & validators](./verification-validators.md) |

6. **Re-measure, repeat.** Fix the top bucket, re-run eval, and the *next* bucket is now the priority. Iterate.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📋 collect 50 failures</span>
    <span class="darr">↓<span class="lbl">read + tag each</span></span>
    <span class="dbox orange">🏷️ categorize</span>
    <span class="darr">↓<span class="lbl">count</span></span>
    <span class="dbox">📊 Pareto: retrieval 60% · grounding 25% · reasoning 15%</span>
    <span class="darr">↓<span class="lbl">biggest bucket</span></span>
    <span class="dbox purple">🔧 apply matching lever</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ re-measure → repeat</span>
  </div>
  <div class="dcap">Read failures, cluster them, and fix the biggest bucket first — evidence, not vibes, picks the lever.</div>
</div>

## Concrete example

```python
from collections import Counter

# Each failure hand-labelled after reading it (input, context, output, expected)
failures = [
    {"id": 1, "category": "retrieval_miss"},
    {"id": 2, "category": "retrieval_miss"},
    {"id": 3, "category": "ignored_context"},
    {"id": 4, "category": "retrieval_miss"},
    {"id": 5, "category": "reasoning_error"},
    {"id": 6, "category": "ignored_context"},
    {"id": 7, "category": "retrieval_miss"},
]
pareto = Counter(f["category"] for f in failures)
top, n = pareto.most_common(1)[0]
print(pareto)                       # Counter({'retrieval_miss': 4, 'ignored_context': 2, ...})
print(f"Fix FIRST: {top} ({n}/{len(failures)} = {n/len(failures):.0%} of failures)")
# -> Fix FIRST: retrieval_miss (4/7 = 57% of failures)  -> fix RAG retrieval, not the model
```

The `most_common` line is the whole point: it names your next task with evidence, so you don't fine-tune a model when the real bug is retrieval.

## How a company uses this

A Dubai e-commerce support bot was "just wrong too often" — the team's instinct was to upgrade to a bigger model. Instead they ran error analysis on 80 thumbs-down conversations. The Pareto was blunt: **55% retrieval_miss** (the right help-doc simply wasn't retrieved), 20% ignored_context, 15% ambiguous questions, 10% reasoning. A bigger model would have barely touched the top 55%. They fixed retrieval first (better chunking + a reranker), which erased most failures for a fraction of the cost of a model upgrade, then re-ran analysis and tackled grounding for the now-dominant ignored_context bucket. Two focused cycles beat months of guessing — and it's now a standing weekly ritual, with the failure Pareto reviewed like any other product metric.

## Common mistakes

- **Skipping the manual read.** Aggregate scores tell you *that* it's failing, never *why*. You must open individual cases.
- **Fixing the loudest anecdote, not the biggest bucket.** One dramatic failure grabs attention while a boring bucket causes 5x more errors. Rank by count.
- **Too rigid a taxonomy.** Let categories emerge from the data; a fixed checklist misses the failure mode you didn't anticipate.
- **Doing it once.** Failure distributions shift as you fix things and as usage changes. Make it a recurring ritual, not a one-off.

## Interview tip
Say: *"When quality is bad I don't guess — I run error analysis. I pull 50–100 real failures, read each one, tag a failure category, and build a Pareto. It's almost never uniform: usually two or three buckets cause most errors. That tells me which lever to pull — if it's retrieval-miss I fix chunking and reranking, if it's hallucination-when-unsure I add abstention, if it's malformed output I add constrained decoding. Then I re-measure and repeat. It's the cheapest, highest-leverage habit in applied AI."* This answer — evidence over vibes, Pareto over anecdote — is exactly what separates a systematic engineer from a prompt-tweaker, and it ties every other technique in this node together.
