# Automated eval gates

**What it is:** a stage in your [CI/CD](/llmops-observability/ci-cd) pipeline that runs a quality evaluation suite and **blocks the deploy** if the score falls below a threshold — a unit-test-style guardrail, but for *answer quality* instead of code correctness.

## Why it matters for an AI Engineer

You can change a prompt, swap a model, or tweak retrieval, and every unit test still passes — because the code is fine; only the *quality* got worse. Classic CI can't catch that. An eval gate can: it's the automated reviewer that says "this version answers worse than the last one — you're not shipping it." Without it, every prompt tweak is a gamble you only lose in production (via angry users). With it, regressions die in the pipeline. This is *the* distinctive LLMOps delivery practice, and "how do you stop a prompt change from regressing quality?" is a question you should be able to answer instantly. It's the *before-it-ships* complement to [online evaluation](/llmops-observability/online-evaluation)'s *after-it-ships* scoring.

## The mechanism — how it works

An eval gate needs three things: a **golden dataset**, a **scorer**, and a **threshold**.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">📋 golden set<span class="sub">~100–300 (input, expected) cases</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 run new version on all</span>
    <span class="darr">→</span>
    <span class="dbox orange">📊 score each<span class="sub">judge / exact / semantic</span></span>
    <span class="darr">→</span>
    <span class="dbox yellow">avg 0.83 &lt; 0.85?</span>
    <span class="darr">→</span>
    <span class="dbox gray">🛑 FAIL build</span>
  </div>
  <div class="dcap">Run the candidate on a fixed test set, score it, and fail the deploy if it's worse than the bar.</div>
</div>

- **Golden dataset** — a curated set of representative (and hard, and edge-case) inputs with known-good expected outputs or rubrics. Best source: real failures mined from [feedback loops](/llmops-observability/feedback-loops) — every past bug becomes a permanent regression test.
- **Scorer** — how you grade each case: exact/keyword match for structured output, semantic similarity for freeform, or [LLM-as-judge](/llmops-observability/online-evaluation) for faithfulness/helpfulness. Often several metrics.
- **Threshold** — the pass bar. Two flavors: *absolute* ("avg faithfulness ≥ 0.85") and *relative* ("no more than 2% worse than current production"). Relative gates catch slow erosion.

The gate runs the candidate version over every case, aggregates the scores, and exits non-zero (failing CI) if below threshold — so the deploy simply never proceeds. Frameworks: promptfoo, DeepEval, Langfuse datasets + a runner, or a plain script.

## Concrete example

```python
# eval/run_suite.py — invoked in CI; exit code 1 blocks the deploy
import sys, json
cases = json.load(open("eval/golden.json"))   # [{"input":..., "expected":...}, ...]

def judge(answer, expected) -> float:          # LLM-as-judge, 0..1
    r = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role":"user",
        "content": f"Does ANSWER match EXPECTED intent? 0.0-1.0 only.\nEXPECTED:{expected}\nANSWER:{answer}"}])
    return float(r.choices[0].message.content.strip())

scores = [judge(run_app(c["input"]), c["expected"]) for c in cases]
avg = sum(scores) / len(scores)
MIN = float(sys.argv[sys.argv.index("--min-score")+1])
print(f"avg={avg:.3f}  passed={sum(s>=0.5 for s in scores)}/{len(scores)}")
sys.exit(0 if avg >= MIN else 1)   # <-- non-zero fails the CI job → no deploy
```

## How a company uses this

A Dubai healthcare startup's symptom-triage assistant *cannot* ship a regression — a wrong triage is a safety issue. Their eval gate runs **250 clinician-reviewed cases** on every PR, scoring both faithfulness and a hard "never downgrade an urgent case" rule; a prompt edit that improved wording but misclassified 3 urgent cases **failed the gate and was blocked**. Every production incident becomes a new golden case, so the suite grows and the same bug can never ship twice. Cost is real — 250 judge calls ≈ $0.10 and ~2 minutes per run — trivially worth it. They run the full clinical suite on PRs and a fast 30-case smoke gate on every commit to keep feedback tight.

## Common mistakes
- **No eval gate at all** — relying on unit tests that pass while quality silently regresses.
- **A tiny or unrepresentative golden set** — 10 easy cases give false confidence; you need hard and edge cases, ideally mined from real failures.
- **Only absolute thresholds** — miss slow erosion. Add a relative "don't get worse than prod" check.
- **A flaky/biased judge** with no calibration — the gate blocks good changes or waves through bad ones. Validate the judge against human labels.
- **Never growing the set** — if past bugs don't become test cases, you'll re-ship them.

## Interview tip
Say: *"An eval gate is a CI stage that runs the candidate over a golden dataset — ideally built from real past failures — scores it with LLM-as-judge plus hard rules, and fails the build if it's below an absolute bar or worse than current production. It's what stops a prompt or model change from regressing quality before users ever see it, and every incident becomes a new regression case so the same bug can't ship twice."* This is the delivery-side twin of [online evaluation](/llmops-observability/online-evaluation) and sits inside [CI/CD](/llmops-observability/ci-cd).
