# Online evaluation

**What it is:** automatically *scoring the quality* of real production traffic as it happens — as opposed to offline evaluation, which scores a fixed test set before you ship.

## Why it matters for an AI Engineer

Your offline test set has maybe 200 curated questions. Production has a million *real* questions you never imagined — weird phrasings, edge cases, adversarial users. A model that aced the test set can still fail in the wild. Online evaluation is how you measure quality on the traffic that actually matters, continuously, without waiting for users to complain. It's the metric that catches a silent prompt regression that [monitoring](/llmops-observability/monitoring-logging) (latency/errors) never would — because the app is fast and error-free while giving worse answers. For an AI Engineer, "how did you know quality in prod?" is a near-guaranteed interview question, and *online eval* is the answer.

## The mechanism — how it works

You can't have a human grade a million responses, so online eval uses **automatic scorers** attached to production traces. Three families:

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 production response</span>
    <span class="darr">↓<span class="lbl">score with</span></span>
    <div class="dstack">
      <span class="dbox blue">1️⃣ LLM-as-judge<span class="sub">"is this grounded / relevant / safe?" → 0–1</span></span>
      <span class="dbox blue">2️⃣ programmatic checks<span class="sub">valid JSON? contains citation? length ok?</span></span>
      <span class="dbox blue">3️⃣ reference-free signals<span class="sub">retrieval score, refusal rate, toxicity</span></span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">📊 quality score on the trace → dashboard + alert</span>
  </div>
  <div class="dcap">Because there's no ground-truth answer in prod, scoring uses judges and heuristics, not exact-match.</div>
</div>

**LLM-as-judge** is the workhorse: a second, often cheaper, model reads the (question, retrieved context, answer) and returns a score for *faithfulness* (is the answer supported by the context — i.e. not hallucinated?), *relevance*, *helpfulness*, or *safety*. In RAG the two killer metrics are **groundedness/faithfulness** (answer sticks to retrieved docs) and **context relevance** (did retrieval even find the right docs). Because judging every request costs money, you **sample** — score 100% of thumbs-down traffic and, say, 5% of the rest.

Scores get **attached to the trace** (Langfuse's `score` API), so you can filter to low-scoring traces to debug, chart average faithfulness over time, and alert when it drops.

## Concrete example

```python
# LLM-as-judge faithfulness score attached to a production trace
from langfuse import get_client
lf = get_client()

JUDGE = """Given CONTEXT and ANSWER, is the ANSWER fully supported by the CONTEXT?
Reply ONLY a number 0.0-1.0 (1=fully grounded, 0=hallucinated).
CONTEXT: {ctx}
ANSWER: {ans}"""

def score_faithfulness(trace_id, context, answer):
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":JUDGE.format(ctx=context, ans=answer)}],
    )
    score = float(r.choices[0].message.content.strip())
    lf.create_score(trace_id=trace_id, name="faithfulness", value=score)
    return score

# call on a sampled fraction of live traffic, async, off the request path
```

Run it as a background job over sampled traces; the score shows up in Langfuse where you filter `faithfulness < 0.5` to find hallucinations and chart the daily average.

## How a company uses this

A Dubai insurance chatbot answers policy questions where a hallucinated coverage claim is a legal problem. They run LLM-as-judge **faithfulness** on 100% of traffic (worth the ~$0.0003/eval given the risk) plus a programmatic check that every answer cites a policy section. When a vendor model update dropped average faithfulness from **0.94 to 0.87 overnight**, the online-eval dashboard flagged it the same day — long before a customer disputed an answer. They also validate the judge itself: periodically a human grades a sample and they confirm the judge agrees ~90% of the time, so they trust the automated number. That human-check is the part beginners skip.

## Common mistakes
- **Trusting the LLM judge blindly.** Judges have biases (favor longer answers, their own style). Calibrate against human labels on a sample.
- **Scoring 100% of everything** — cost explodes. Sample, but keep all the negative-feedback traffic.
- **Only online eval, no offline gate.** Online catches problems *after* they ship; pair with [automated eval gates](/llmops-observability/automated-eval-gates) to catch them *before*.
- **Vague metrics.** "Quality" isn't a metric. Define faithfulness, relevance, safety as separate scores with clear rubrics.

## Interview tip
Say: *"Offline eval scores a fixed test set before release; online eval scores real production traffic continuously — mostly with LLM-as-judge for faithfulness and relevance, plus programmatic checks. I sample to control cost but keep 100% of thumbs-down traffic, attach scores to Langfuse traces so I can debug and alert on quality drops, and I calibrate the judge against human labels so the number is trustworthy."* Connect it to [feedback loops](/llmops-observability/feedback-loops) (human signal) and [drift detection](/llmops-observability/drift-detection) (quality trending down).
