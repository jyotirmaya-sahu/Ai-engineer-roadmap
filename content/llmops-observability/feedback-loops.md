# Feedback loops

**What it is:** capturing signals from real users (thumbs up/down, edits, corrections, whether they retried) and routing them back to *improve* the system — the "flywheel" that makes an LLM product get better the more it's used.

## Why it matters for an AI Engineer

An LLM judge ([online evaluation](/llmops-observability/online-evaluation)) is a good proxy for quality, but a real user clicking thumbs-down is *ground truth*. That signal is gold: it tells you exactly which answers failed, and — collected over time — it becomes a labeled dataset you can use to build a better eval set, pick few-shot examples, or fine-tune. Companies that win in AI aren't the ones with the best initial model; they're the ones with the tightest feedback loop, because their product compounds. For an AI Engineer, designing this loop — capture, store, act — is a product-thinking skill that separates senior from junior, and it's a favorite interview topic ("how does your system improve over time?").

## The mechanism — how it works

A feedback loop has three stages, and most teams only build the first:

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">1️⃣ CAPTURE<span class="sub">👍👎 edit · retry · dwell</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">2️⃣ STORE<span class="sub">attach to the trace as a score</span></span>
    <span class="darr">→</span>
    <span class="dbox green">3️⃣ ACT<span class="sub">eval set · few-shot · fine-tune · fix prompt</span></span>
  </div>
  <div class="dcap">Feedback is only valuable if it closes — capture is easy, ACT is where the flywheel actually turns.</div>
</div>

**Capture** comes in two flavors. *Explicit*: a thumbs button, a star rating, a "report" link. *Implicit* (often more honest, since most users never click): did they copy the answer? edit it? immediately rephrase and ask again (a retry = a failure signal)? abandon? A user who edits the AI's draft just handed you a perfect (bad → good) training pair.

**Store**: attach the signal to the *exact trace* that produced the answer, as a score (Langfuse `create_score` with `name="user_feedback"`). Now a thumbs-down is linked to the retrieved chunks and the prompt that caused it — instantly debuggable.

**Act** — the stage that makes it a *loop*: mine thumbs-down traces for recurring failure patterns → fix the prompt; promote good corrected answers into your golden **eval set** or few-shot examples; if you have thousands of high-quality (input, corrected-output) pairs, use them to [fine-tune](/fine-tuning). This is the "data flywheel": usage → feedback → better product → more usage.

## Concrete example

```python
# Frontend sends the trace_id back with the user's rating
from langfuse import get_client
lf = get_client()

@app.post("/feedback")
def feedback(trace_id: str, rating: int, edited_text: str | None = None):
    # explicit signal, linked to the exact trace that produced the answer
    lf.create_score(trace_id=trace_id, name="user_feedback",
                    value=1 if rating > 0 else 0, comment=edited_text)
    if edited_text:          # user fixed our answer → a labeled improvement pair
        save_correction_pair(trace_id, edited_text)   # feeds the eval set / fine-tune

# The KEY: your response must return its trace_id so the client can send it back.
```

The non-obvious requirement: your API must return the `trace_id` with each answer so the client can attach feedback to the right trace later.

## How a company uses this

A Dubai real-estate portal's property-search assistant added a thumbs button *and* logged when users re-typed a query within 30 seconds (implicit failure). Weekly they pull thumbs-down + retry traces into a review queue; a pattern emerged — Arabic-language queries scored badly — which led to a prompt/retrieval fix and a new Arabic eval set. Over three months the corrected-answer pairs (a few thousand) seeded a fine-tune that lifted satisfaction. **Numbers that matter:** explicit feedback rates are low (often 1–5% of users click anything), so implicit signals do the heavy lifting; and every corrected answer is worth far more than a raw one because it's *labeled*.

## Common mistakes
- **Capturing feedback but never acting on it** — a dashboard of thumbs-down that no one mines is not a loop, it's decoration.
- **Not linking feedback to the trace.** A rating with no trace_id is unactionable — you can't see *what* it rated.
- **Relying only on explicit feedback.** 95%+ of users never click; implicit signals (edits, retries, abandonment) are where the volume is.
- **Ignoring feedback bias** — angry users rate more than happy ones, so raw thumbs-down rate overstates failure. Use it directionally, calibrate with sampled review.

## Interview tip
Say: *"The data flywheel is capture → store → act. I capture explicit thumbs plus implicit signals like edits and retries, attach each to the exact trace as a score so it's debuggable, then act: mine thumbs-down for prompt fixes, promote corrected answers into the golden eval set and few-shot pool, and once there's enough labeled data, fine-tune. The trick is closing the loop — most teams capture and never act."* Pairs directly with [online evaluation](/llmops-observability/online-evaluation) (automated scoring) and feeds [automated eval gates](/llmops-observability/automated-eval-gates).
