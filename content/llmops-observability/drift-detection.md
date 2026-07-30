# Drift detection

**What it is:** noticing when the world has changed under your app — the *inputs* users send, or the *quality* of your answers, has shifted away from what you built and tested for — before it becomes a visible failure.

## Why it matters for an AI Engineer

You ship an app tuned for today's traffic. Then reality moves: users start asking about a new product you have no docs for, a vendor silently updates the base model, your knowledge base goes stale, seasonality changes the questions. Nothing throws an error — the app just gets quietly worse. Drift detection is the smoke alarm. Without it, you find out from a churn report three months later; with it, an alert fires the week the shift starts. In LLM apps drift is *more* dangerous than in classic ML because the model is a black box you don't control and can change beneath you. Being able to say "I monitor for drift and here's how" is a strong senior signal in an interview.

## The mechanism — how it works

Two kinds of drift, detected differently:

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">📥 DATA / INPUT DRIFT<span class="sub">the questions users ask change</span></span>
    <span class="darr">↓<span class="lbl">detect by</span></span>
    <span class="dbox orange">embed queries → watch cluster/topic mix · new-topic rate · out-of-KB rate · avg retrieval score</span>
    <span class="dbox purple">📉 QUALITY / CONCEPT DRIFT<span class="sub">same questions, worse answers</span></span>
    <span class="darr">↓<span class="lbl">detect by</span></span>
    <span class="dbox orange">watch online-eval faithfulness · thumbs-down rate · refusal rate over a rolling window</span>
  </div>
  <div class="dcap">Input drift = your users changed. Quality drift = your answers changed. Different signals, both silent.</div>
</div>

**Input drift** — the distribution of incoming requests moves. Detect it by embedding queries and watching the topic mix, tracking the **rate of low-retrieval-score queries** (a proxy for "we have no docs on this"), or the share of new/unseen topics. A rising "no good chunk found" rate means users are asking things your knowledge base doesn't cover.

**Quality/concept drift** — the mapping from question to *good answer* degrades. You can't see it in latency or errors; you see it in your [online evaluation](/llmops-observability/online-evaluation) scores and [user feedback](/llmops-observability/feedback-loops) trending down over a rolling window. The classic cause: a provider updates `gpt-4o` and behavior shifts overnight.

The mechanism is always **compare a recent window to a baseline**: baseline = the distribution/score when things were good; if the recent window deviates past a threshold, alert. For distributions you use a statistical distance (e.g. population stability index / KL divergence); for a single quality metric, a simple rolling-average threshold with a minimum sample size works.

## Concrete example

```python
# Quality-drift alarm: rolling faithfulness vs a healthy baseline
BASELINE = 0.93          # avg faithfulness when the app was known-good
WINDOW, THRESH, MIN_N = "last_24h", 0.05, 200

def check_quality_drift(scores):           # scores from online-eval, last 24h
    if len(scores) < MIN_N:
        return None                        # not enough data → don't cry wolf
    recent = sum(scores) / len(scores)
    if BASELINE - recent > THRESH:         # dropped >5 pts
        alert(f"Quality drift: faithfulness {recent:.2f} vs {BASELINE:.2f} baseline")
    return recent

# Input drift: same idea on % of queries with max_retrieval_score < 0.3
```

Run it on a schedule over Langfuse scores; the `MIN_N` guard stops noise from firing false alarms on thin traffic.

## How a company uses this

A Dubai bank's internal policy assistant tracks two drift signals nightly: (1) share of queries where top retrieval score < 0.3 (— users asking about topics the KB lacks), and (2) rolling LLM-judge faithfulness. When the bank launched a new account type, signal (1) **jumped from 4% to 18%** within days — the drift alert told them to add docs *before* employees lost trust. Separately, a silent OpenAI model update dropped faithfulness 6 points; signal (2) caught it and they pinned the model version and re-tuned the prompt. Best practice they follow: **pin model versions** so quality drift from vendor updates is opt-in, not surprise.

## Common mistakes
- **Confusing input drift with quality drift** — new topics need *more docs*; a model regression needs a *prompt/model fix*. Different alarms, different fixes.
- **No baseline or no minimum sample size** — you either can't tell you drifted, or you fire false alarms on 10 requests.
- **Not pinning the model version**, then blaming your prompt when the vendor silently changed the model underneath you.
- **Alerting with no action plan.** A drift alert should map to a runbook: add docs, roll back the prompt, or pin the model.

## Interview tip
Say: *"I watch two kinds of drift. Input drift — I embed queries and track the rate of low-retrieval-score questions to catch users asking about things my KB doesn't cover. Quality drift — I watch rolling online-eval faithfulness and thumbs-down against a baseline, with a minimum sample size to avoid false alarms, because a vendor model update can silently drop quality with no error. And I pin model versions so those updates are opt-in."* Ties [online evaluation](/llmops-observability/online-evaluation) and [feedback loops](/llmops-observability/feedback-loops) into an early-warning system.
