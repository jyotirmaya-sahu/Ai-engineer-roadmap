# Logprobs

**The one-line idea:** the API can expose the raw probability the model assigned to every output token — and the runner-up tokens it considered — so you can read confidence, not just text.

> **Bridging from Seed.** You just learned to *pin* the model's random dice with a seed so generation is reproducible. That gave you deterministic output — but you still can't tell *how sure* the model was about its answer. Was it 99% confident or a coin-flip? Logprobs answer that question: they let you read the model's own internal probability scores, not just the token it picked.

## Why it matters for an AI Engineer

Every other knob in this node shapes the output. Logprobs *reveal* it. They turn an LLM from a text box into a **scored, auditable signal** — the foundation for confidence routing, lightweight classification, hallucination triage, and cheaper evaluation. You don't need a second model to know when the first one is guessing. In production, that's the difference between 95% accuracy and 73% accuracy on your classifier — achieved with a single extra parameter in the same `create()` call. Interviewers love logprobs because most candidates stop at temperature; knowing how to use logprobs marks you as someone who's built real eval and triage tooling.

## What a log-probability is (from scratch)

Before any sampling knobs run, the LLM's final layer outputs a **score** for every token in its vocabulary (often 100,000+ tokens). These raw scores are called **logits** — they're just numbers, positive or negative, with no particular scale. The LLM Internals node showed you that the model runs a **softmax** function to convert those logits into a proper probability distribution: every value becomes positive, and they all sum to 1. That distribution is what temperature, top-k, and top-p then sculpt before sampling.

Now: probabilities across 100,000 tokens can get very, very small — `0.0000003` is hard to work with in code and gets catastrophically rounded in floating-point arithmetic. The standard fix is to take the **natural logarithm** of each probability:

```
log(1.0)  =  0.0       (100% certain — the only possible choice)
log(0.98) ≈ −0.02      (very confident)
log(0.50) ≈ −0.69      (coin flip)
log(0.10) ≈ −2.30      (1-in-10 shot)
log(0.01) ≈ −4.61      (1-in-100, rare)
```

That's all a **log-probability (logprob)** is: `ln(probability)`. It's always zero or negative (because probabilities are ≤ 1 and log of anything ≤ 1 is ≤ 0). More negative = less likely. Logs are numerically stable, can be added instead of multiplied (useful when chaining probabilities across many tokens), and are what the model already computes internally — so returning them costs almost nothing.

**To convert back to human-readable percent:** `probability = exp(logprob)`. Always do this before showing a user a number.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🔢 Logits<span class="sub">raw scores, any range</span></span>
    <span class="darr">→<span class="lbl">softmax</span></span>
    <span class="dbox purple">🧠 Probabilities<span class="sub">sum to 1.0</span></span>
    <span class="darr">→<span class="lbl">ln()</span></span>
    <span class="dbox orange">📊 Log-probs<span class="sub">all ≤ 0</span></span>
    <span class="darr">→<span class="lbl">exp() to read</span></span>
    <span class="dbox green">✅ Human %<span class="sub">0–100%</span></span>
  </div>
  <div class="dcap">Logprobs are what the softmax from LLM Internals already computes — logprobs just make that distribution visible to your code.</div>
</div>

This closes a loop that opened in the LLM Internals node: you saw the softmax produce a distribution. Logprobs are that distribution, made accessible through the API.

## The API: how to turn logprobs on

OpenAI's `chat.completions.create()` — the same call you built in the Working with LLM APIs node — takes two extra parameters:

- **`logprobs=True`** — include the logprob for the token that was *actually chosen* at each position.
- **`top_logprobs=N`** — also include the top-N alternative tokens the model considered at each position, with their own logprobs. N can be 0–20.

The result comes back in `response.choices[0].logprobs.content` — a list of objects, one per output token. Each object has:
- `.token` — the text of the chosen token (e.g. `"Yes"`)
- `.logprob` — its log-probability (e.g. `−0.02`)
- `.top_logprobs` — list of `{token, logprob}` alternatives (only if you asked for them)

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 Token position: model just read "The answer is"</span>
    <span class="darr">↓<span class="lbl">top_logprobs=3</span></span>
    <span class="dstack">
      <span class="dbox green">✅ Chosen: "Yes"  logprob −0.02  → exp() = 98.0%</span>
      <span class="dbox orange">Alt 1: "No"    logprob −4.10  → exp() = 1.6%</span>
      <span class="dbox gray">Alt 2: "Maybe" logprob −6.00  → exp() = 0.2%</span>
    </span>
  </div>
  <div class="dcap">top_logprobs shows what the model almost said — a 98% vs 1.6% gap is confident; a 55% vs 45% gap means it's genuinely uncertain.</div>
</div>

## Concrete example — confidence scoring on a classifier

This is the most common use: ask a yes/no or categorical question, then read the answer token's logprob to get a confidence score on the *same call*, with no second model.

```python
import math
from openai import OpenAI

client = OpenAI()

def classify_with_confidence(review: str):
    r = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You classify customer reviews. "
                    "Reply with exactly one word: Positive, Negative, or Neutral."
                ),
            },
            {"role": "user", "content": review},
        ],
        max_tokens=1,       # only need the label token
        logprobs=True,
        top_logprobs=3,     # see the top 3 candidates
    )

    tok = r.choices[0].logprobs.content[0]
    chosen_label = tok.token.strip()
    confidence   = math.exp(tok.logprob)        # convert to 0–1 probability

    print(f"Label: {chosen_label}  ({confidence:.1%} confident)")
    print("Alternatives:")
    for alt in tok.top_logprobs:
        print(f"  {alt.token.strip():<10} {math.exp(alt.logprob):.2%}")

    return chosen_label, confidence

label, conf = classify_with_confidence("Fast delivery, loved it!")
# Label: Positive  (99.1% confident)

label, conf = classify_with_confidence("Arrived okay I guess.")
# Label: Neutral  (58.3% confident)
# Alternatives:
#   Positive   39.1%
#   Negative    2.6%
```

The second example is where logprobs earn their keep: a bare 58% isn't a confident classification — your code can catch it and route to a human, all without any extra API call.

## What you can do with logprobs

**1. Confidence routing.** If `math.exp(logprob) < threshold` (say 0.80), flag it as low-confidence and send to a human or a more expensive model. One call; no ensemble; cheap.

**2. Classification without parsing.** For binary or short-label tasks, `max_tokens=1` + logprobs gives you a *ranked* probability over labels, not just the winner. You can compare logprobs of "Yes" vs "No" directly rather than hoping the model says the exact word you expect.

**3. Detecting hallucination and uncertainty.** Run logprobs across an entire answer. Tokens with very negative logprobs (say below −3, meaning less than ~5% probability) are where the model was guessing. A long factual sentence full of low-logprob tokens is a hallucination risk signal worth flagging or re-prompting.

**4. Debugging classification prompts.** When the model gets a label wrong, `top_logprobs` shows you whether the right label was a close #2 (ambiguous prompt, fixable with better system instructions) or a distant #10 (the model lacks the knowledge). That's a much faster debug loop than reading wrong answers and guessing.

**5. Cheap evaluation.** In a CI suite, you can score answer quality without a second judge-model call: if the expected token has a logprob above a threshold, the answer passed. Not a substitute for full eval, but useful for fast smoke tests.

## How a company uses this — back to HelpDesk

The **HelpDesk capstone** has an intent classifier: it reads a customer ticket and routes it to the right support queue (billing, shipping, returns, technical). The node overview mentioned using logprobs here — here's exactly how.

Add one extra `create()` call at ticket intake. It asks `gpt-5.4-mini` for the intent label, with `max_tokens=1, logprobs=True`. Then:

- **confidence ≥ 85%** → auto-route to the queue; no human involved; costs a fraction of a cent.
- **confidence 60–84%** → route to queue but flag for supervisor spot-check.
- **confidence < 60%** → hold and assign to a senior agent; the model is genuinely unsure.

This single threshold check cuts misroutes dramatically without any additional model or infrastructure. A Dubai bank's support team reduced bad-queue routing from 18% to 4% with exactly this pattern — the same ticket-classification model, one extra parameter, one `exp()` call.

At production scale (say 50,000 tickets/day): the vast majority auto-route at near-zero incremental cost; the small fraction that's genuinely ambiguous gets human attention. That's a 95%+ cost reduction in human triage while actually *improving* accuracy on hard cases, because humans only touch the ones that matter.

## Common mistakes / misconceptions

- **Forgetting to `exp()` the logprob.** A logprob of `−0.02` is *not* "negative 2 percent." `exp(−0.02) ≈ 98%`. Every time you show a number to a human or write a threshold, convert it first.
- **Treating logprob-confidence as perfectly calibrated.** It's a strong signal, not a guarantee — LLMs can be *confidently wrong* (high probability, wrong answer). Always validate your threshold against labelled real-world data before trusting it in production.
- **Requesting `top_logprobs` on every token of a long answer.** The response payload bloats fast. For confidence scoring, use `max_tokens=1` to get just the answer token, not the full generation. Only request top alternatives for the positions you'll actually inspect.
- **Expecting logprobs from every provider and model.** Support varies. OpenAI o-series reasoning models restrict logprobs. Smaller local models may not implement the field. Check before you rely on it.
- **Comparing logprobs across different positions as if they're the same scale.** A logprob of −1.0 at a rare-token position may actually be *confident*; at a common-word position it's shaky. Context matters; compare alternatives at the *same* position, not across positions.

## Interview tip

Say: *"Logprobs expose the model's confidence per token — the natural log of the softmax probability, so I `exp()` it to get a human percentage. I use them for confidence routing: if the answer token's probability is below a threshold I route to a human instead of auto-acting. I also use `top_logprobs` to debug classifiers — if the right label is a close second, the prompt is ambiguous; if it's tenth, the model lacks context. The caveat is that LLMs can be confidently wrong, so I always validate thresholds on labelled data before deploying."*

That answer shows the mechanism (softmax → logprob → exp), a concrete production use (routing), and the calibration caveat — exactly what separates someone who read about it from someone who's shipped it.

---

*That's the last knob in Sampling & Generation. You now know how to set every dial — and how to read the model's internal confidence back. The next node, **LLM APIs — Advanced**, is where the `create()` call grows up: it adds tool-calling (letting the model invoke functions), vision (images as input), and caching (reusing prompt prefixes to cut cost on long system prompts). Same API — more firepower.*
