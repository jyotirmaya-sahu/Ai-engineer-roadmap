# Escalation to human

**What it is:** The safety net — when the system is unsure, or the stakes are too high, it hands the case to a person instead of answering, and learns from what the person decides.

## Why it matters for an AI Engineer

Every accuracy technique has a residual failure rate. Grounding, verification, abstention — they shrink the wrong-answer rate but never zero it. For high-stakes decisions (a loan denial, a medical finding, a large refund) even a 1% error is unacceptable to ship autonomously. Escalation is the acknowledgment that *the right move is sometimes not to answer at all*. Designing this human-in-the-loop path — when to trigger it, how to route it, and how the human's decision flows back to improve the model — is a core AI Engineering responsibility, and it's what makes a regulated Dubai enterprise willing to deploy AI at all.

## The mechanism

Escalation is a **routing decision**, not just "give up." Four design questions:

1. **When to escalate.** Fire on any of: confidence below threshold ([confidence & abstention](./confidence-abstention.md)), sample disagreement ([self-consistency](./voting-self-consistency.md)), a failed [validator](./verification-validators.md), or a *category rule* — some actions escalate *regardless* of confidence because the stakes demand a human (e.g. any transaction over AED 50k, any medical red-flag term). Confidence is not the only trigger; impact is.

2. **What to hand over.** Don't just forward the raw question — give the human the model's draft, its confidence, the retrieved sources, and *why* it escalated. A human deciding in 20 seconds with full context is the goal; a human starting from scratch is a slow, expensive escalation.

3. **How to route.** Tiered: simple uncertain cases → a general agent; specialized ones → a domain expert. Queue with priority so urgent cases don't wait behind routine ones.

4. **How to close the loop.** The human's decision is *labelled training data*. Capture it, feed it into your golden eval set, and use recurring escalation clusters to drive fixes ([error-analysis workflow](./error-analysis-workflow.md)). An escalation path that doesn't feed back is a leak, not a loop.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 answer + confidence</span>
    <span class="darr">→<span class="lbl">low conf OR high-stakes rule</span></span>
    <span class="dbox yellow">🙋 human queue (draft + sources)</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ human decision</span>
    <span class="darr">→<span class="lbl">feed back</span></span>
    <span class="dbox blue">📚 eval set / training</span>
  </div>
  <div class="dcap">Uncertain or high-stakes cases go to a human with full context; their decision loops back to improve the system.</div>
</div>

## Concrete example

```python
HIGH_STAKES_TERMS = {"tumor", "fracture", "fraud"}   # always human, any confidence

def route(question, draft, confidence, sources, amount_aed=0):
    reasons = []
    if confidence < 0.6:
        reasons.append("low_confidence")
    if amount_aed > 50_000:
        reasons.append("high_value")
    if any(t in question.lower() for t in HIGH_STAKES_TERMS):
        reasons.append("high_stakes_term")

    if reasons:
        enqueue_for_human({                      # hand over WITH context
            "question": question, "draft": draft,
            "confidence": confidence, "sources": sources,
            "escalation_reasons": reasons,
        })
        return {"status": "escalated", "reasons": reasons}
    return {"status": "auto_answered", "answer": draft}

# high-value forces escalation even when the model is confident
assert route("approve payout?", "yes", 0.95, [], amount_aed=80_000)["status"] == "escalated"
```

The high-value case escalating *despite* 0.95 confidence is the load-bearing idea: stakes override certainty.

## How a company uses this

A Dubai bank's dispute-resolution assistant auto-resolves small, clear-cut disputes but escalates by rule: **any dispute over AED 20k, any confidence < 0.7, or any fraud-flagged case → a human agent**, regardless of how sure the model is. Roughly 15% escalate. Crucially, the agent sees the model's draft resolution, the transaction history it pulled, and the escalation reason, so they close most in under a minute. Every human decision is logged as labelled data; monthly, the team clusters escalations and finds recurring buckets to automate next (e.g. "duplicate-charge disputes" became reliable enough to auto-resolve). Escalation rate is a tracked KPI — trending down means the system is genuinely improving, not just guessing more.

## Common mistakes

- **Confidence-only triggers.** Some cases must go to a human because of *impact*, not uncertainty. Add category/threshold rules for high-stakes actions.
- **Escalating without context.** Forwarding the bare question makes humans slow and the queue expensive. Hand over the draft, sources, and reason.
- **No feedback loop.** If human decisions vanish into a ticket system, you never improve. Capture them as training/eval data.
- **No capacity planning.** An escalation path that overwhelms the human team collapses. Model the escalation rate and staff for it; monitor it live.

## Interview tip
Say: *"Escalation is my backstop for the residual error every other technique leaves behind. I trigger on low confidence *and* on high-stakes rules — a large transaction escalates even at 95% confidence — and I hand the human the draft, sources, and escalation reason so they decide fast. Then I close the loop: every human decision becomes labelled data, and I cluster recurring escalations to decide what to automate next. Escalation rate is a KPI I want trending down."* Emphasizing stakes-based triggers and the feedback loop shows you think about deploying AI responsibly, not just accurately. See [Error-analysis workflow](./error-analysis-workflow.md) for how the fed-back data drives fixes.
