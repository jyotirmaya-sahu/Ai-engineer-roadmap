# Top-P (Nucleus Sampling)

**The one-line idea:** keep the *smallest* set of top tokens whose probabilities **sum to P**, renormalize, and sample — so the candidate pool shrinks automatically when the model is confident and expands when it is uncertain.

> **Coming from Top-K.** The previous tile showed that Top-K keeps a **fixed count** of candidates no matter what. That worked, but it has a blind spot: the model's confidence varies wildly step to step. Sometimes one token has 93% probability and a K=40 fence still lets in 39 near-zero stragglers. Sometimes 200 tokens each hold 0.3% probability and a K=40 fence arbitrarily cuts 160 legitimate candidates. Top-P (nucleus sampling) fixes exactly that: instead of a fixed *count*, it keeps a fixed *probability mass* — and the count adapts on its own.

## Why it matters for an AI Engineer

Top-P is the default cutoff on every major commercial API: OpenAI (`top_p`), Anthropic (`top_p`), Google Gemini (`top_p`). Temperature controls *how edgy* the distribution is; Top-P controls *how wide a probability mass* you're willing to draw from. Together, "temperature + top_p" is the standard production pair you'll tune on every LLM call.

Getting Top-P wrong causes real problems at scale:

- **Too low (e.g. 0.3):** the model sounds repetitive and robotic — you've strapped temperature *and* top-p both tight, and they compound.
- **Left at 1.0 while temperature is high:** the full vocabulary is in play; the garbage tail is live. Fine for creativity, wrong for a policy-answering support bot.
- **Both top-k and top-p set together and misunderstood:** they interact in ways that confuse even experienced engineers (more on this in Common Mistakes).

For the HelpDesk capstone, Top-P is the knob that keeps the support assistant's phrasing natural without letting it drift into hallucinated policy details.

## The mechanism / how it works

### Step 1 — start from a sorted probability list

Recall from the LLM Internals node: at each generation step the model produces a raw score (a **logit**) for every token in its vocabulary. Softmax converts those into probabilities — non-negative numbers that sum to 1. (Temperature, if set, divides the logits *before* softmax, reshaping the spread. See the Temperature tile.)

After softmax you have something like:

```
Token       Prob
─────────────────
"mat"       0.55
"floor"     0.20
"roof"      0.10
"ceiling"   0.06
"wall"      0.04
"tiles"     0.02
"thing"     0.01
… 99,993 more tokens share the remaining 0.02
```

### Step 2 — walk down the sorted list, summing as you go

Nucleus sampling adds one column: a **cumulative sum**. You walk from the top, adding each probability to a running total, and stop the moment that total crosses P.

With **P = 0.90**:

```
Token       Prob    Cumulative sum    Include?
──────────────────────────────────────────────
"mat"       0.55    0.55              ✓  (0.55 < 0.90)
"floor"     0.20    0.75              ✓  (0.75 < 0.90)
"roof"      0.10    0.85              ✓  (0.85 < 0.90)
"ceiling"   0.06    0.91              ✓  crossed 0.90 → STOP
"wall"      0.04    —                 ✗  zeroed
"tiles"     0.02    —                 ✗  zeroed
… all others                          ✗  zeroed
```

The **nucleus** is `{mat, floor, roof, ceiling}` — the *smallest* prefix of the sorted list whose cumulative probability reaches P.

### Step 3 — renormalize and sample

The four survivors sum to `0.55 + 0.20 + 0.10 + 0.06 = 0.91`. They don't sum to 1 anymore, so you renormalize — divide each by 0.91:

```
"mat"      0.55 / 0.91 ≈ 0.604   (60%)
"floor"    0.20 / 0.91 ≈ 0.220   (22%)
"roof"     0.10 / 0.91 ≈ 0.110   (11%)
"ceiling"  0.06 / 0.91 ≈ 0.066   ( 7%)
                          ─────────────
                          1.000   ✓
```

Now sample. `wall`, `tiles`, `thing`, and the entire 99,993-token tail can never be chosen this step.

### Step 4 — watch it *adapt*

This is the payoff. **The same P value produces a different candidate count at every step**, automatically matched to the model's confidence:

- **Confident step:** `mat` has 0.93 probability. The cumulative sum crosses 0.90 after the very first token. Nucleus = `{mat}` — effectively deterministic.
- **Normal step:** as above, nucleus = 4 tokens.
- **Uncertain step:** 50 tokens each hold ~0.02 probability. To reach 0.90 you need ~45 of them. Nucleus = 45 tokens — the algorithm opens the floor to real diversity.

A fixed K of, say, 5 would behave wrongly in both the confident case (letting in 4 near-zero stragglers) and the uncertain case (cutting off 40 legitimate candidates). Top-P reads the room.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue wide">🎯 Confident step — mat 0.93<span class="sub">cumsum crosses P=0.90 at token 1 → nucleus = {mat}</span></span>
    <span class="darr">↓<span class="lbl">same P = 0.90</span></span>
    <span class="dbox orange wide">🔢 Normal step — .55 / .20 / .10 / .06<span class="sub">cumsum crosses P at token 4 → nucleus = 4 tokens</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple wide">🌊 Uncertain step — 50 tokens ~0.02 each<span class="sub">cumsum crosses P at token ~45 → nucleus = 45 tokens</span></span>
  </div>
  <div class="dcap">Same P=0.90, three different steps. The nucleus auto-sizes to match how spread-out the model's distribution actually is.</div>
</div>

## Concrete example — runnable code

### OpenAI (`top_p` is a first-class parameter)

```python
# pip install openai
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "Write one vivid sentence about the Dubai skyline at dusk."}],
    temperature=0.9,
    top_p=0.9,       # nucleus: keep tokens summing to 90% probability mass
    max_tokens=60,
)
print(response.choices[0].message.content)
```

This is the `create()` call you learned in the Working with LLM APIs node — `top_p` is just another keyword argument alongside `temperature` and `max_tokens`. Run it several times; the output varies. Change `top_p` to `0.3` and rerun — you'll notice sentences converge toward safer, more predictable phrasing because only the very-highest-probability tokens survive each step.

### Anthropic (also `top_p`)

```python
# pip install anthropic
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=60,
    temperature=0.9,
    top_p=0.9,
    messages=[{"role": "user", "content": "Write one vivid sentence about the Dubai skyline at dusk."}],
)
print(response.content[0].text)
```

Both APIs accept `top_p` in exactly the same position. The underlying nucleus algorithm is identical.

### Implementing nucleus filtering yourself in NumPy

Understanding the algorithm is table-stakes. Here is the minimal implementation so you can trace every step:

```python
# pip install numpy
import numpy as np

def nucleus_filter(probs: np.ndarray, p: float) -> np.ndarray:
    """
    Given a probability array (must sum to ~1, sorted descending),
    zero out everything below the nucleus threshold and renormalize.
    Returns the filtered, renormalized array.
    """
    assert abs(probs.sum() - 1.0) < 1e-4, "probs must sum to 1"
    assert 0.0 < p <= 1.0, "p must be in (0, 1]"

    cumsum = np.cumsum(probs)
    # Find the first index where cumulative sum reaches p
    cutoff = np.searchsorted(cumsum, p, side="left")
    # Keep tokens up to and including cutoff (the token that crossed p)
    mask = np.zeros_like(probs)
    mask[: cutoff + 1] = 1.0
    filtered = probs * mask

    total = filtered.sum()
    if total == 0:
        raise ValueError("All probabilities zeroed — p is too small for this distribution.")
    return filtered / total  # renormalize


# --- demo with the worked example from above ---
tokens = ["mat", "floor", "roof", "ceiling", "wall", "tiles", "thing"]
probs  = np.array([0.55, 0.20, 0.10, 0.06, 0.04, 0.02, 0.01, 0.02])
# Pad to sum to 1 (the tail)
probs  = np.array([0.55, 0.20, 0.10, 0.06, 0.04, 0.02, 0.01, 0.02])
probs  = probs / probs.sum()   # normalize the example to exactly 1.0

filtered = nucleus_filter(probs, p=0.90)
for tok, orig, filt in zip(tokens, probs, filtered):
    status = f"{filt:.3f}" if filt > 0 else "— zeroed"
    print(f"{tok:10s}  orig={orig:.3f}  filtered={status}")

# Sample
chosen_idx = np.random.choice(len(tokens), p=filtered)
print(f"\nSampled: {tokens[chosen_idx]}")
```

Expected output (probabilities):
```
mat         orig=0.550  filtered=0.604
floor       orig=0.200  filtered=0.220
roof        orig=0.100  filtered=0.110
ceiling     orig=0.060  filtered=0.066
wall        orig=0.040  filtered=— zeroed
tiles       orig=0.020  filtered=— zeroed
thing       orig=0.010  filtered=— zeroed
```

The `searchsorted` call is the core: it finds the index where the cumulative sum first reaches `p`, and everything at or before that index is the nucleus.

## How a company uses this

**Back to HelpDesk.** Imagine you've shipped HelpDesk to a Dubai e-commerce company. Two workflows share the same `gpt-5.4-mini` model:

1. **Support replies** — factual, on-policy answers to customer questions about shipping, refunds, and warranties. Settings: `temperature=0.2, top_p=1.0`. Low temperature already sharpens the distribution so the nucleus is naturally small; leaving `top_p=1.0` doesn't add filtering but also doesn't hurt. The answers are consistent across agents.

2. **Marketing copy generator** — fresh product descriptions for social posts. Settings: `temperature=0.9, top_p=0.92`. High temperature opens up variety; `top_p=0.92` quietly drops the bottom few percent of the distribution (random punctuation sequences, stray non-English tokens) so copy never goes off the rails.

Same model. Same API. Opposite dials. The settings *are* the product difference.

At production scale — millions of API calls per day — these settings also have a cost angle: `max_tokens` caps length (see the Max Tokens tile), but `top_p` affects *quality* per token. A support bot with a bad `top_p` setting that occasionally generates longer, confused answers doesn't just hurt quality — it increases token spend. Quality and cost are coupled.

## Common mistakes / misconceptions

- **Lowering both temperature and top_p hard at the same time.** They compound. `temperature=0.1, top_p=0.3` on a factual prompt will loop or hallucinate a single phrase endlessly. Change one meaningfully, keep the other near its default.
- **"top_p=0.9 means 90% of tokens survive."** No — it means the *fewest tokens whose probabilities sum to 0.90*. On a confident step that's often just 1–3 tokens out of 100,000.
- **"top_p=1.0 applies no cutoff."** Correct — `1.0` is the neutral setting. The full distribution is eligible; only temperature (and possibly top_k, if set) is shaping things.
- **Setting top_k and top_p together without understanding which runs first.** Most implementations apply top_k first, then top_p on the survivors. That means a tight top_k can have already discarded tokens that top_p would have kept. Anthropic's API applies both if you supply both; OpenAI's API doesn't expose top_k at all. Pick one cutoff method.
- **Forgetting to renormalize.** If you implement this yourself and zero out the tail but forget to divide by the survivors' sum, your sampling weights are wrong. The zeroed tokens effectively donate their probability mass to nothing, skewing the draw toward the top-ranked token.

## Interview tip

Say: *"Top-P, or nucleus sampling, sorts the vocabulary by probability, walks down the list keeping a cumulative sum, and stops the moment it reaches P. The key insight over Top-K is that the candidate count adapts automatically — a confident step may include only 1 token at P=0.9, an uncertain step might include 40+. In production I use temperature as my primary creativity dial and set top_p to 0.9–0.95 for open-ended generation or leave it at 1.0 when temperature is already low. I never clamp both hard simultaneously."*

Mentioning "cumulative sum" and "adapts to confidence" is what separates a textbook answer from a production answer.

---

> **Next up — [Repetition Penalty](repetition-penalty.md).** You've now mastered how to shape *which tokens can be chosen* at each step (temperature, top-k, top-p). But none of those knobs care what tokens have already been generated — the model is still free to repeat a phrase endlessly. The next tile introduces **repetition penalty**: a multiplicative down-weight applied to tokens the model has recently used, so outputs stay fresh without you manually filtering duplicates.
