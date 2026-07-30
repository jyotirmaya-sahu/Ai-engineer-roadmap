# "I don't know" calibration

**What it is:** Teaching the model to *refuse* when it doesn't actually have the answer, instead of confidently making one up.

## Why it matters for an AI Engineer

The default failure mode of every LLM is answering questions it can't. Ask about a policy that isn't in the retrieved context, and it fills the gap with a fluent guess — same confident tone as a correct answer. In a consumer chatbot that's annoying; in a Dubai insurance or medical assistant it's a wrong "yes, that's covered" that becomes a legal dispute. A well-calibrated "I don't know" converts a *silent wrong answer* (worst outcome) into a *known gap* you can route to a human. It's the difference between a system that's occasionally catastrophically wrong and one that's honest about its limits.

## The mechanism

"Calibration" means the model's willingness to answer matches its actual chance of being right. There are three layers, from cheapest to most robust:

1. **Prompt-level permission.** The single biggest win: explicitly *allow* refusal. Base models are trained to be helpful, which they read as "always answer." A system prompt like *"If the context does not contain the answer, reply exactly: I don't know based on the provided documents. Do not guess."* gives the model a legitimate exit. Give it an exact refusal string so downstream code can detect it.

2. **Retrieval-signal gating.** In RAG, don't trust the model to judge sufficiency alone — check the *retrieval scores*. If the top retrieved chunk's similarity is below a threshold, the context is probably irrelevant, so force refusal *before* generation. This catches "the model was confident but retrieval found nothing relevant."

3. **Self-reported confidence + threshold.** Ask the model to rate its own confidence (0–1) or produce it, then only surface answers above a cutoff. This is weakly calibrated on its own (models are overconfident), so it's best combined with retrieval gating and [voting](./voting-self-consistency.md), where disagreement across samples is a strong uncertainty signal.

The engineering goal is a **precision/coverage trade-off you tune deliberately**: a stricter threshold refuses more (lower coverage) but is right more often when it *does* answer (higher precision).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ question</span>
    <span class="darr">↓</span>
    <span class="dbox blue">🔍 top retrieval score</span>
    <span class="darr">↓<span class="lbl">score &lt; 0.35?</span></span>
    <span class="dbox yellow">🙋 "I don't know" → escalate</span>
    <span class="darr">↓<span class="lbl">score OK</span></span>
    <span class="dbox green">✅ answer (grounded)</span>
  </div>
  <div class="dcap">Gate on a retrieval-confidence signal before generating; thin context → honest refusal.</div>
</div>

## Concrete example

```python
def answer_or_abstain(question, retrieved, threshold=0.35):
    """retrieved: list of (chunk_text, similarity) sorted desc."""
    if not retrieved or retrieved[0][1] < threshold:
        return {"answer": "I don't know based on the provided documents.",
                "abstained": True, "reason": "low_retrieval_confidence"}

    context = "\n".join(t for t, _ in retrieved[:4])
    from anthropic import Anthropic
    resp = Anthropic().messages.create(
        model="claude-sonnet-4-6", max_tokens=250,
        system=("Answer ONLY from the context. If it does not contain the "
                "answer, reply exactly: I don't know based on the provided documents."),
        messages=[{"role": "user", "content": f"{context}\n\nQ: {question}"}],
    )
    text = resp.content[0].text
    return {"answer": text,
            "abstained": text.startswith("I don't know"),
            "reason": None}

# sanity check: thin retrieval must abstain
r = answer_or_abstain("What's the CEO's salary?", [("unrelated policy text", 0.11)])
assert r["abstained"] and r["reason"] == "low_retrieval_confidence"
```

## How a company uses this

A Dubai bank's support assistant handles ~50k questions/day. Regulators require it to *never* invent account terms. They tuned the abstention threshold on a 500-example labelled set to hit **≥99% precision on answered questions**, accepting ~12% abstention. Those 12% (about 6,000/day) route to a human queue instead of getting a wrong answer — cheap insurance against a single fabricated fee statement that could trigger a compliance fine far larger than the human-review cost. They monitor the abstention rate as a live metric: a sudden spike means retrieval or an upstream index broke, not that questions got harder.

## Common mistakes

- **Not permitting refusal at all.** Without an explicit "you may say I don't know," the model *always* answers. This one prompt line is the biggest single win.
- **Trusting self-reported confidence alone.** LLMs are systematically overconfident; back the number with retrieval scores and sample-disagreement.
- **A fuzzy refusal string.** "I'm not totally sure but..." can't be detected by code and still leaks a guess. Use an exact, matchable refusal phrase.
- **Ignoring the abstention rate.** It's both a safety knob and a health signal — track it like latency.

## Interview tip
Say: *"I calibrate refusal on three signals: I explicitly permit 'I don't know' in the prompt, I gate on retrieval confidence before generating, and I use sample disagreement from self-consistency as an uncertainty signal. Then I tune the threshold on a labelled set for a precision/coverage trade-off — for a bank I'd take 99% precision and route the abstained 12% to a human."* That frames abstention as a *tunable safety lever*, which is exactly the maturity interviewers probe for. See also [Confidence & abstention](./confidence-abstention.md) and [Escalation to human](./escalation-to-human.md).
