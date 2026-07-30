# Confidence & abstention

**What it is:** Attaching a *confidence score* to each answer and only surfacing the answer when that score clears a threshold — otherwise the system abstains rather than risk a wrong answer.

## Why it matters for an AI Engineer

Not all questions are equally answerable, and not all wrong answers cost the same. A system that answers everything is a system that's confidently wrong sometimes. Confidence-and-abstention gives you a **dial**: turn it up and you answer fewer questions but get more of them right; turn it down and you cover more but risk more errors. Being able to *set that dial deliberately* — "for a medical assistant I want 99.5% precision even if I abstain on 20%" — is exactly the risk-management thinking that separates a production AI Engineer from someone who ships a demo that answers everything.

## The mechanism

The core is **precision vs. coverage**:
- **Coverage** = fraction of questions you answer.
- **Precision** = fraction of *answered* questions you get right.

Raising the confidence threshold raises precision and lowers coverage. You pick the point that matches the *cost of a wrong answer* in your domain. The whole game is getting a confidence score that's actually *calibrated* — i.e. "0.9 confidence" really means right ~90% of the time. Sources, best combined:

1. **Retrieval score** (RAG): low top-chunk similarity → low confidence. Cheap and strong.
2. **Sample agreement** ([self-consistency](./voting-self-consistency.md)): 5/5 agree = high confidence, 2/2/1 = low. Best calibrated signal you'll get for free.
3. **Token log-probabilities**: the model's own probability on its answer tokens. Available from many APIs; useful but the model is often overconfident.
4. **Self-reported confidence**: ask the model 0–1. Weakest alone; use only as a tiebreaker.
5. **Verifier pass/fail** ([validators](./verification-validators.md)): a binary hard signal — failed the check = don't surface it.

You then **calibrate the threshold on a labelled set**: run a few hundred graded examples, plot precision at each threshold, and pick the cutoff that hits your target precision. This is empirical, not guessed.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🔍 retrieval score</span>
    <span class="dbox purple">🗳️ sample agreement</span>
    <span class="dbox orange">🧪 verifier pass</span>
    <span class="darr">→<span class="lbl">combine</span></span>
    <span class="dbox">📊 confidence 0–1</span>
    <span class="darr">→<span class="lbl">≥ τ?</span></span>
    <span class="dbox green">✅ answer</span>
    <span class="darr">→<span class="lbl">&lt; τ</span></span>
    <span class="dbox yellow">🙋 abstain</span>
  </div>
  <div class="dcap">Fuse several signals into one score; a calibrated threshold τ trades coverage for precision.</div>
</div>

## Concrete example

```python
def confidence(retrieval_top, agreement_ratio, verifier_ok):
    """Fuse signals into 0..1. Verifier failure is a hard veto."""
    if not verifier_ok:
        return 0.0
    return 0.5 * min(retrieval_top, 1.0) + 0.5 * agreement_ratio

def respond(retrieval_top, agreement_ratio, verifier_ok, answer, tau=0.6):
    conf = confidence(retrieval_top, agreement_ratio, verifier_ok)
    if conf >= tau:
        return {"answer": answer, "confidence": round(conf, 2)}
    return {"answer": "I'm not confident enough to answer — routing to a specialist.",
            "confidence": round(conf, 2), "abstained": True}

# strong retrieval + unanimous samples + passed check -> answer
assert respond(0.82, 1.0, True, "30 days")["confidence"] >= 0.6
# thin retrieval + split vote -> abstain
assert respond(0.20, 0.4, True, "?")["abstained"]
```

`tau` is what you calibrate on labelled data — everything else is just producing the score.

## How a company uses this

A Dubai teleradiology assistant drafts findings from scans for a radiologist to confirm. A wrong-but-confident draft is dangerous (anchoring bias), so they fused retrieval similarity, 5-sample agreement, and a rules validator into one confidence score, then calibrated the threshold on 1,000 graded cases to hit **99.5% precision on surfaced drafts**, accepting ~22% abstention. The abstained fifth of cases show the radiologist a blank draft with "low confidence — review from scratch" instead of a misleading suggestion. They monitor precision and coverage on a live dashboard: if precision dips, they raise `tau` (fewer, safer answers) until they can fix the root cause. Coverage is a product metric; precision is a safety metric; the threshold is how they trade between them in real time.

## Common mistakes

- **Using an uncalibrated score.** "confidence 0.9" is meaningless unless you've checked it's right ~90% of the time on real data. Calibrate on a labelled set.
- **Relying on self-reported confidence alone.** Models are systematically overconfident; anchor the score in retrieval and sample-agreement instead.
- **A fixed threshold across all question types.** Different query classes have different base difficulty; consider per-category thresholds.
- **Treating abstention as failure.** An abstain routed to a human is a *success* — it prevented a wrong answer. Track it as coverage, not as an error.

## Interview tip
Say: *"I don't want a system that answers everything — I want one with a tunable precision/coverage trade-off. I build a calibrated confidence score by fusing retrieval similarity, self-consistency agreement, and verifier results, then set the abstention threshold empirically on a labelled set to hit the precision my domain needs — 99.5% for medical, looser for a FAQ bot. Abstained cases route to a human, and I monitor precision and coverage live so I can tighten the dial if quality slips."* That's the language of someone who manages model risk, which is precisely what senior AI interviews probe. Pairs with [Escalation to human](./escalation-to-human.md).
