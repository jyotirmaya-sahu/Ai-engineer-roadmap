# Logprobs

**The one-line idea:** ask the API to hand back not just the chosen token but the model's *confidence* in it — the log-probability — plus the runner-up tokens it considered. It's a window into the numbers the model was working with before it picked a word.

## Why it matters for an AI Engineer

Everything else in this node *sets* the sampling behavior; logprobs let you *read it back*. That turns an LLM from a black box into something you can score, threshold, and debug. Want a confidence number for a classification? Want to detect when the model was guessing? Want to build cheaper structured extraction? Logprobs are the mechanism. It's the most "advanced" knob here (marked `full` on the roadmap for a reason) and a strong interview signal — most candidates never move past temperature, so knowing logprobs marks you as someone who's built real evaluation and confidence tooling.

## The mechanism / how it works

For each generated token the model computed a probability. A **log-probability** is just the natural log of that probability — always ≤ 0, where **0 means 100% certain** and more negative means less likely (log 0.5 ≈ −0.69, log 0.1 ≈ −2.30). APIs return logs instead of raw probabilities because probabilities get vanishingly small and logs are numerically friendlier; to get a human probability back, exponentiate: `prob = exp(logprob)`.

Turn on logprobs (OpenAI: `logprobs=True`, plus `top_logprobs=N` for the top N alternatives at each position) and each token in the response carries:

- the chosen token and its logprob,
- optionally the **top-N alternative tokens** it *almost* picked, each with their own logprobs.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 step: after "The answer is"</span>
    <span class="darr">↓<span class="lbl">top_logprobs=3</span></span>
    <span class="dstack">
      <span class="dbox green">"Yes" logprob −0.02 → 98%</span>
      <span class="dbox orange">"No" logprob −4.1 → 1.6%</span>
      <span class="dbox gray">"Maybe" logprob −6.0 → 0.2%</span>
    </span>
  </div>
  <div class="dcap">Logprobs expose the model's confidence and its near-misses, not just the final word.</div>
</div>

**The killer use — confidence scoring.** For a yes/no or category answer, read the logprob of the answer token and `exp()` it: a 98% "Yes" is a confident classification; a 55% "Yes" over a 45% "No" is a coin-flip you should route to review. You get a calibrated-ish confidence for *free*, on the same call.

## Concrete example

```python
from openai import OpenAI
import math
client = OpenAI()

r = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content":
        "Is this review positive? Answer only Yes or No.\nReview: 'Fast delivery, loved it.'"}],
    logprobs=True,
    top_logprobs=3,     # also return the top 3 alternatives per token
    max_tokens=1,
)
tok = r.choices[0].logprobs.content[0]
print(tok.token, f"{math.exp(tok.logprob):.1%} confident")   # e.g. "Yes 99.2% confident"
for alt in tok.top_logprobs:
    print("  alt:", alt.token, f"{math.exp(alt.logprob):.2%}")
```

## How a company uses this

A Dubai bank classifying incoming support tickets into 12 categories reads the logprob of the predicted category token, converts it to a probability, and **auto-routes anything below 85% confidence to a human agent** — cutting misroutes without adding a second model. A content-moderation team uses logprobs to *debug*: when the model wrongly flags a post, they inspect the `top_logprobs` and see the correct label was a close #2 at 40%, telling them the prompt is ambiguous rather than the model being broken. At scale this is far cheaper than running an ensemble — one call yields both the answer *and* a confidence signal, so the expensive human review budget goes only where the model is genuinely unsure.

## Common mistakes / misconceptions

- **Treating logprob-confidence as perfectly calibrated truth.** It's a strong signal, not a guarantee — LLMs can be *confidently wrong*. Use it as a routing/triage threshold, validated against real data, not gospel.
- **Forgetting to exponentiate.** A raw logprob of −0.02 isn't "−2%"; `exp(−0.02) ≈ 98%`. Always convert for human-readable confidence.
- **Expecting them from every endpoint.** Support varies by provider and model; some (and many reasoning models) restrict or omit logprobs. Check availability.
- **Requesting huge `top_logprobs`** on long outputs — it inflates the response payload; ask only for what you'll use (often just the answer token).

## Interview tip

Say: *"Logprobs return the model's confidence per token — the natural log of each token's probability, plus the top alternatives. I exponentiate the answer token's logprob to get a confidence score and route low-confidence classifications to human review, all in a single call instead of an ensemble. The caveat is calibration: models can be confidently wrong, so I threshold against real data."* Turning logprobs into a *confidence-routing* story is exactly the production-minded answer interviewers want.
