# Golden datasets

**The one-line idea:** A golden dataset is your curated, versioned set of test questions with known-good answers — the fixed yardstick every metric is measured against, so "did this change help?" has a real answer.

## Why it matters for an AI Engineer

Every metric in this node — ROUGE, faithfulness, LLM-as-judge — needs *something to run against*. That something is the golden dataset. It's the foundation the whole eval stack sits on: without it you're comparing today's vibes to yesterday's memory. A good golden set is what lets you iterate confidently (change a prompt, re-run, read the delta), gate deploys, and prove quality to stakeholders. Building and maintaining one is unglamorous but is *the* highest-leverage eval work — and interviewers know teams that skip it are flying blind.

## The mechanism — how it works

A golden dataset is a collection of **test cases**, each typically containing: the **input** (question), the **expected/reference answer** (ground truth), and for RAG the **relevant source(s)**. Building a good one:

1. **Cover the real distribution.** Sample from actual user queries (or realistic ones): common questions, edge cases, multi-part questions, out-of-scope questions the bot *should refuse*, and adversarial ones. A set of only easy questions produces flattering, useless scores.
2. **Write trustworthy ground truth.** Have domain experts author or verify the correct answers. This is the expensive part and the part that makes the set "golden" — noisy labels poison every metric downstream.
3. **Version it.** Store it in git (or a dataset tool) with a version tag. When you change the set, you change the baseline, so comparisons must state which version they used.
4. **Grow it from failures.** Every production bug becomes a new test case — this is how the set stays representative as the world shifts (regression-test discipline).

Size: even **50–200 well-chosen examples** beats 10,000 sloppy ones. Quality and coverage over raw count.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👥 real user queries</span>
    <span class="darr">→<span class="lbl">sample + expert labels</span></span>
    <span class="dbox blue">📋 golden set v3<span class="sub">Q · truth · sources</span></span>
    <span class="darr">→<span class="lbl">every metric runs here</span></span>
    <span class="dbox green">✅ comparable scores</span>
  </div>
  <div class="dcap">A versioned, expert-labeled test set — the fixed yardstick all metrics are measured against.</div>
</div>

## Concrete example

```python
# golden_set.jsonl — version-controlled, one test case per line
{"id": "q001", "question": "What is the notice period to close a savings account?",
 "ground_truth": "30 days written notice.",
 "relevant_docs": ["policy_savings_v4.pdf#p3"], "category": "common"}
{"id": "q002", "question": "Can I close my account from another country?",
 "ground_truth": "The documents do not cover cross-border closure; escalate to a human.",
 "relevant_docs": [], "category": "out_of_scope"}   # tests correct refusal

import json
golden = [json.loads(l) for l in open("golden_set.jsonl")]
# run your RAG system over each, then score with RAGAS / LLM-judge against ground_truth
```

Note the out-of-scope case with empty `relevant_docs` — it tests that the system *refuses* rather than hallucinates, which a happy-path-only set would never catch.

## How a company uses this

A **Dubai bank** built a 300-question golden set: ~180 common questions, ~60 edge cases, ~40 out-of-scope (must-refuse), and ~20 adversarial — each answer verified by a compliance expert, versioned in git. **Every metric in their pipeline runs against this one set**, so faithfulness, relevancy, and hallucination-rate numbers are comparable release-to-release. When a customer hits a new failure, that exact question — with an expert answer — is added to the set, so the same bug can never silently return. Rebuilding trust after their fee-hallucination incident started here: no golden set, no measurable quality, no approval to operate.

## Common mistakes / misconceptions

- **Only happy-path examples.** Flattering scores, false confidence. Deliberately include edge, out-of-scope, and adversarial cases.
- **Unversioned set.** Silently editing the test set makes old and new scores incomparable. Version it like code.
- **Chasing size over quality.** 10,000 auto-generated Q&As with noisy labels are worse than 100 expert-verified ones. Curate.
- **Letting it rot.** User needs and documents drift; a stale golden set measures the wrong thing. Grow it continuously from real failures.

## Interview tip
Say: *"Everything starts with a versioned golden dataset — a few hundred expert-verified question/answer/source triples that deliberately span common, edge, out-of-scope, and adversarial cases. Every metric runs against it so scores are comparable release to release, and every production bug becomes a new test case. Quality and coverage beat raw size."* Mentioning must-refuse and adversarial coverage, plus versioning, is what signals real experience.

See also: [Regression / CI eval](./regression-ci-eval.md) (runs the golden set on every commit), [Human-in-the-loop](./human-in-the-loop.md) (produces the ground-truth labels), and [Hallucination rate](./hallucination-rate.md) (measured over this set).
