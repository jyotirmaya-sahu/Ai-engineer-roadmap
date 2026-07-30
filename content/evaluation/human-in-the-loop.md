# Human-in-the-loop

**The one-line idea:** Human-in-the-loop evaluation keeps real people in the grading process — the ground-truth source that automated metrics are *calibrated against* and the safety net for the cases machines can't judge.

## Why it matters for an AI Engineer

Every automated metric is ultimately an *approximation of human judgment*. LLM-as-judge is only trustworthy if it agrees with humans; ROUGE only matters if it tracks what people consider good. Humans are the anchor. But humans are slow and expensive, so the real skill is **using them surgically**: to create ground truth, to calibrate the automated judges, and to review the hard/high-stakes cases — while automation handles volume. Knowing *where* humans belong in the eval loop (not everywhere, not nowhere) is a mark of a mature AI Engineer.

## The mechanism — how it works

Humans plug into evaluation at four points:

1. **Creating ground truth.** Experts write or verify the correct answers in your golden dataset. This is irreplaceable — the labels' quality caps every metric's quality.
2. **Calibrating automated judges.** Have humans grade a sample (say 50 answers), then measure how often your LLM-judge agrees. If agreement is ~90%, trust the judge to scale; if it's 60%, fix the rubric before relying on it. Re-check whenever you change the judge model.
3. **Reviewing flagged cases.** Automation handles the bulk; humans review only the *uncertain* or *high-stakes* ones — low-confidence answers, disagreements, safety-flagged outputs, or a random audit sample. This is the practical hybrid: cheap automation + expensive human eyes exactly where they pay off.
4. **Continuous feedback (thumbs up/down).** Real users' ratings in production are a free, always-on human signal — noisy, but great for spotting drift and mining new golden-set cases.

The design principle: **automation for coverage, humans for calibration and the tail.** Sampling and confidence thresholds decide what escalates.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 auto-eval<span class="sub">all traffic</span></span>
    <span class="darr">→<span class="lbl">low-confidence /<br>high-stakes / sample</span></span>
    <span class="dbox orange">🧑 human review</span>
    <span class="darr">→<span class="lbl">labels + calibration</span></span>
    <span class="dbox green">✅ trusted metrics</span>
  </div>
  <div class="dcap">Machines grade everything cheaply; humans grade the tail and calibrate the machines.</div>
</div>

## Concrete example

```python
import pandas as pd

# df has model answers scored by both an LLM-judge and (for a sample) humans
sample = df.sample(50, random_state=0)      # human-labeled calibration sample

# agreement: does the LLM-judge's pass/fail match the human's?
agreement = (sample["llm_pass"] == sample["human_pass"]).mean()
print(f"judge–human agreement = {agreement:.0%}")   # want ≥ ~90% to trust at scale

# route only low-confidence answers to humans in production
def needs_human(row):
    return row["judge_confidence"] < 0.7 or row["safety_flag"] or row["user_thumbs_down"]

to_review = df[df.apply(needs_human, axis=1)]        # e.g. ~5% of traffic
```

## How a company uses this

A **Dubai bank** couldn't manually review thousands of daily answers, so it built the hybrid: an LLM-judge scored every answer, **calibrated monthly against 50 compliance-expert grades** (they required ≥90% agreement before trusting it). Only answers that were low-confidence, safety-flagged, or thumbs-downed by users — about **5% of traffic** — went to a human queue. Experts' verdicts on those became new golden-set entries, continuously sharpening both the test set and the judge. This kept human cost bounded while ensuring the automated numbers stayed anchored to real expert judgment — the thing regulators actually trust.

## Common mistakes / misconceptions

- **Trusting an LLM-judge without ever validating it against humans.** An uncalibrated judge can be confidently wrong at scale. Always measure agreement first, and re-check after judge changes.
- **Human-reviewing everything.** Doesn't scale and burns experts on easy cases. Route only the tail (low-confidence, high-stakes, sampled).
- **Ignoring inter-annotator disagreement.** If two humans disagree on the "right" answer, your task is under-specified — fix the rubric, don't average the noise.
- **Treating thumbs-up/down as precise truth.** User feedback is biased and sparse (angry users click more). Great for drift signals and mining cases, weak as a primary metric.

## Interview tip
Say: *"Humans are the ground truth automated metrics approximate, so I use them surgically — to author golden labels, to calibrate my LLM-judge against a ~50-example sample until agreement is high, and to review only the tail: low-confidence, high-stakes, and thumbs-down cases, maybe 5% of traffic. Their verdicts feed back into the golden set. Automation for coverage, humans for calibration and the hard cases."* The calibration-and-routing framing is the senior signal.

See also: [LLM-as-judge](./llm-as-judge.md) (what humans calibrate), [Golden datasets](./golden-datasets.md) (built from human labels), and [Bias & red-teaming](./bias-red-teaming.md) (human-driven adversarial testing).
