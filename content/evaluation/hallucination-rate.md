# Hallucination rate

**The one-line idea:** Hallucination rate is the single headline number your stakeholders actually care about — the fraction of answers containing at least one claim that's unsupported or fabricated.

## Why it matters for an AI Engineer

Faithfulness gives a per-answer score; hallucination rate rolls it up into the one metric a compliance officer, a VP, or a regulator understands: *"3% of answers contain a made-up claim."* In trust-critical Dubai domains — banking, legal, healthcare, government — this is the go/no-go number that decides whether the system ships. It's also the metric you monitor in production to catch drift. Being able to *define, measure, and drive down* hallucination rate is arguably the most valuable single skill in applied LLM work right now.

## The mechanism — how it works

Hallucination rate is an aggregate built on top of a per-answer hallucination check:

1. **Define hallucination for your system.** Usually: an answer contains ≥1 claim not supported by the retrieved context (for RAG) or contradicting known ground truth. Decide the boundary — does "I don't know" count as a hallucination? (No — abstention is correct behavior.)
2. **Detect per answer.** Reuse faithfulness: decompose the answer into claims, verify each against context. If any claim is unsupported, that answer is flagged as a hallucination (a binary per answer). Alternatively use a dedicated detector or an LLM-judge "does this answer contain unsupported claims? yes/no."
3. **Aggregate.** `hallucination_rate = hallucinated_answers / total_answers`. Report it over your golden set and over a sample of live traffic.

The subtlety: hallucination rate is a **rate over a distribution**, so it's only as meaningful as the test set is representative. A 1% rate on happy-path questions but 15% on edge cases means your test set is lying to you — you need adversarial and long-tail examples in the mix.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 100 answers</span>
    <span class="darr">→<span class="lbl">faithfulness check each</span></span>
    <span class="dbox orange">✅ 96 grounded · ❌ 4 unsupported</span>
    <span class="darr">→</span>
    <span class="dbox green">hallucination rate = 4%</span>
  </div>
  <div class="dcap">Flag any answer with an unsupported claim, then divide by total — one number for stakeholders.</div>
</div>

## Concrete example

```python
from ragas import evaluate
from ragas.metrics import faithfulness
from datasets import Dataset

# eval_set: your golden dataset of {question, answer, contexts}
result = evaluate(eval_set, metrics=[faithfulness])
per_answer = result.to_pandas()["faithfulness"]

THRESHOLD = 0.99                       # an answer with any unsupported claim
hallucinated = (per_answer < THRESHOLD).sum()
rate = hallucinated / len(per_answer)
print(f"hallucination rate = {rate:.1%}")   # e.g. 4.0%
# gate the deploy:
assert rate <= 0.02, f"hallucination rate {rate:.1%} exceeds 2% budget"
```

Treating "faithfulness below near-1.0" as a hallucination turns the continuous score into the binary rate stakeholders track.

## How a company uses this

A **Dubai bank** set an explicit **hallucination budget: ≤ 2%** on a golden set that *deliberately* included adversarial questions (ambiguous policies, questions the docs don't answer, trick multi-part queries) — because a rate measured only on easy questions is vanity. CI blocks any release over budget. In production they sample ~2% of live answers through the same detector via Langfuse and alert if the live rate creeps above 3%, catching drift from new document uploads or a model-version change. When the rate spiked once, per-claim logging pointed straight at a batch of newly-ingested docs that had parsed badly — a data bug, fixed at the source. The rate is reviewed with compliance monthly; it's the number that keeps the assistant *approved to operate*.

## Common mistakes / misconceptions

- **Measuring only on happy-path questions.** The rate looks great and lies. Include adversarial, out-of-scope, and multi-part questions.
- **Counting honest refusals as hallucinations.** "The documents don't cover this" is the *right* answer when context is missing — don't penalize it.
- **Reporting a single rate with no context window.** A rate needs a test set version and a date; it drifts as docs and models change. Version it.
- **Chasing 0%.** Zero is usually unrealistic and often achieved by making the bot uselessly cautious. Set a budget and a fallback (abstain / escalate) instead.

## Interview tip
Say: *"Hallucination rate is the fraction of answers with any unsupported claim — I build it on faithfulness, flag answers below near-1.0, and aggregate over a golden set that includes adversarial and out-of-scope questions, not just easy ones. I set a budget like 2%, gate CI on it, and monitor a live sample for drift. Refusals when context is missing don't count against it."* The adversarial-test-set and abstention points show you've thought past the demo.

See also: [Faithfulness](./faithfulness.md) (the per-answer signal underneath), [Context recall](./context-recall.md) (missing context is a top root cause), and [Bias & red-teaming](./bias-red-teaming.md) (adversarial inputs that spike the rate).
