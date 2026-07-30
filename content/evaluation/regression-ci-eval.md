# Regression / CI eval

**The one-line idea:** Regression / CI eval runs your whole evaluation suite automatically on every change — so a prompt tweak, model swap, or dependency bump that quietly breaks quality fails the build *before* it reaches users.

## Why it matters for an AI Engineer

This is what turns evaluation from a one-time science project into an engineering safety net. LLM systems are terrifyingly easy to regress: a "harmless" prompt edit, a model-version auto-upgrade, or a new document batch can silently drop quality on 5% of queries — with no error, no crash. Regression/CI eval is the equivalent of unit tests for non-deterministic systems: it catches these silently, on every commit, so you never ship a regression you didn't measure. Teams that have this ship fast *and* safely; teams that don't ship bugs confidently.

## The mechanism — how it works

You wire your golden dataset + metrics into the same CI pipeline that runs your unit tests:

1. **On every PR / commit, run the system over the golden set.** Generate answers, then score them (faithfulness, relevancy, LLM-judge, hallucination rate — whatever you gate on).
2. **Compare against thresholds or a baseline.** Either absolute gates ("faithfulness ≥ 0.9, hallucination rate ≤ 2%") or a delta vs the last known-good run ("no metric may drop more than 3 points").
3. **Pass/fail the build.** If a metric breaches its gate, CI fails and the PR can't merge — exactly like a failing test.
4. **Handle non-determinism.** LLM outputs vary run to run, so gate on *aggregate* metrics over many examples (which are stable), not on exact string matches. Set temperature 0 where possible and use thresholds with a little tolerance so normal noise doesn't flake the build.

The mindset shift: you're not asserting `output == "expected"` (impossible with LLMs) — you're asserting `metric_over_200_examples >= threshold`, which *is* stable.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🔀 pull request</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 run over golden set</span>
    <span class="darr">→</span>
    <span class="dbox orange">📊 metrics vs gates</span>
    <span class="darr">→<span class="lbl">pass / fail</span></span>
    <span class="dbox green">✅ merge · ❌ block</span>
  </div>
  <div class="dcap">Eval runs in CI like unit tests — a quality regression fails the build before merge.</div>
</div>

## Concrete example

```python
# test_eval.py — runs in CI (pytest) on every PR
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
from my_rag import run_over_golden_set   # generates answers for the golden dataset

def test_no_quality_regression():
    dataset = run_over_golden_set()                     # ~200 examples
    scores = evaluate(dataset, metrics=[faithfulness, answer_relevancy])

    assert scores["faithfulness"]     >= 0.90, f"faithfulness {scores['faithfulness']:.2f}"
    assert scores["answer_relevancy"] >= 0.85, f"relevancy {scores['answer_relevancy']:.2f}"
```

```yaml
# .github/workflows/eval.yml
- run: pytest test_eval.py          # blocks the merge if a gate fails
```

Gating on aggregate scores over 200 examples (not exact outputs) is what makes this robust to LLM non-determinism.

## How a company uses this

A **Dubai bank** wired faithfulness, answer relevancy, and hallucination-rate gates into GitHub Actions after their fee-hallucination incident. Now a PR that regresses faithfulness below 0.9 **cannot merge** — the exact "friendlier tone" change that caused the original incident would be caught automatically today. A full run over their 300-question set costs a few dollars in LLM-judge calls and finishes in a few minutes — trivial next to the cost of a customer-facing hallucination. They run the cheap deterministic metrics (ROUGE/ranking) on every commit and the expensive LLM-judge suite on PRs to main, balancing speed against thoroughness.

## Common mistakes / misconceptions

- **Asserting exact-match outputs.** LLMs won't reproduce a string; the test flakes forever. Gate on aggregate metrics over many examples instead.
- **No baseline / too-tight thresholds.** Gates that are too strict flake on normal noise and get disabled. Allow small tolerance; gate on trends.
- **Running only expensive metrics on every commit.** Slow, costly, developers route around it. Tier it: cheap metrics per commit, full suite on PRs to main.
- **Never updating gates.** As you genuinely improve, ratchet thresholds up so you can't silently backslide to old quality.

## Interview tip
Say: *"I treat eval like unit tests — the golden set and metrics run in CI on every PR, and a faithfulness or hallucination-rate gate fails the build before merge. The trick with non-deterministic models is to assert on aggregate metrics over a couple hundred examples, not exact outputs, so it's stable. Cheap metrics per commit, the full LLM-judge suite on PRs to main."* The 'aggregate not exact-match' insight is exactly what interviewers are checking you understand.

See also: [Golden datasets](./golden-datasets.md) (what CI runs against), [LangSmith / Langfuse](./langsmith-langfuse.md) (tooling that hosts CI eval + production monitoring), and [Hallucination rate](./hallucination-rate.md) (a common gate).
