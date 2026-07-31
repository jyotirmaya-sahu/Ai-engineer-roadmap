# Top-K Sampling

**The one-line idea:** after temperature reshapes the probability distribution, Top-K throws away every token except the **K most likely** ones — then renormalizes and samples from that short list.

> **Coming from Temperature.** The previous tile showed how dividing logits by T *reshapes* the whole distribution — it can sharpen a cautious model or flatten a timid one, but every single token in the vocabulary still has a nonzero shot. Top-K now adds a second layer: a hard fence around the candidates. Even with a wild temperature setting, only the top K tokens make it to the draw. Think of temperature as the dial that controls *how edgy* the probabilities are, and Top-K as the bouncer who checks IDs at the door: no matter what temperature does inside, only K guests get in.

## Why it matters for an AI Engineer

A model's vocabulary has roughly 50,000–100,000 tokens. At any given step, most of those tokens — the weird Unicode symbols, the domain-specific jargon, the random punctuation sequences — have vanishingly small probabilities. But *vanishingly small is not zero*, and if you generate millions of tokens per day (HelpDesk at scale, or any production chatbot), the dice will occasionally land on something bizarre. Top-K is the simplest way to make that impossible.

You'll see Top-K exposed directly in:
- **Anthropic's Messages API** — the `top_k` parameter
- **Open-source inference servers** — vLLM, Hugging Face `transformers`, Ollama
- **Any model you self-host** — Llama, Mistral, Phi, Gemma

OpenAI's chat completions API **does not expose `top_k`** as a parameter (they favor `top_p`). But you can implement it yourself using `logprobs` — we'll do exactly that below.

## The mechanism / how it works

### Step 1 — the model outputs raw scores (logits)

Go back to what you learned in the LLM Internals node. At each generation step, the model produces one raw score — a **logit** — for every token in its vocabulary. These numbers can be anything: positive, negative, large, small. The softmax function converts them to probabilities (non-negative numbers that sum to 1).

After temperature adjusts those logits and softmax turns them into probabilities, you have a giant list like this:

```
"mat"      → 0.55
"floor"    → 0.20
"roof"     → 0.10
"ceiling"  → 0.06
"wall"     → 0.04
"tiles"    → 0.02
"thing"    → 0.01
… 99,993 more tokens, sharing the remaining 0.02
```

### Step 2 — keep only the top K

With **K = 3**, you keep `mat`, `floor`, `roof` and zero out everything else:

```
"mat"      → 0.55  ✓ kept
"floor"    → 0.20  ✓ kept
"roof"     → 0.10  ✓ kept
"ceiling"  → 0.00  ✗ zeroed
"wall"     → 0.00  ✗ zeroed
… all others → 0.00  ✗ zeroed
```

### Step 3 — renormalize (the step people always forget)

After zeroing, the remaining three probabilities are `0.55 + 0.20 + 0.10 = 0.85`. They no longer sum to 1, so sampling from them directly would be wrong — there would be a "15% chance of nothing." You have to renormalize: divide each surviving probability by their sum.

```
mat   → 0.55 / 0.85 = 0.647   (~65%)
floor → 0.20 / 0.85 = 0.235   (~24%)
roof  → 0.10 / 0.85 = 0.118   (~12%)
                       ─────────────
                       1.000   ✓
```

Now you sample from `{mat: 65%, floor: 24%, roof: 12%}`. `ceiling`, `wall`, and all 99,994 other tokens are permanently out of the draw for this step.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 Context so far</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM<span class="sub">raw logits over ~100k tokens</span></span>
    <span class="darr">→<span class="lbl">temperature ÷ T</span></span>
    <span class="dbox orange">🔢 Softmax probs<span class="sub">mat .55 · floor .20 · roof .10 · … tail</span></span>
    <span class="darr">→<span class="lbl">keep top K</span></span>
    <span class="dbox blue">✂️ Truncated set<span class="sub">mat · floor · roof only</span></span>
    <span class="darr">→<span class="lbl">renormalize</span></span>
    <span class="dbox green">🎲 Sample<span class="sub">mat 65% · floor 24% · roof 12%</span></span>
  </div>
  <div class="dcap">Temperature reshapes probabilities first; Top-K then fences the candidate set; renormalization makes the survivors sum to 1 again before sampling.</div>
</div>

### The weakness of a fixed K

Top-K's vulnerability is that **K is a constant but the model's confidence varies step by step**.

- Sometimes the model is very confident: `"the"` has 92% probability and everything else is junk. With K=40, you're keeping 39 near-zero candidates for no reason — statistical noise.
- Sometimes the model is genuinely uncertain across many good options (picking the next word in creative prose): 200 tokens each hold ~0.3% probability. A K=40 cap chops off 160 legitimate candidates.

A fixed K can't read the room. This is precisely the weakness that the **next tile, Top-P (nucleus sampling)**, fixes — it keeps a variable number of tokens based on a *probability mass* threshold instead of a count, so it naturally expands when the model is uncertain and contracts when it's confident.

## Concrete example

### On Anthropic (native `top_k` parameter)

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=50,
    temperature=0.8,
    top_k=10,   # only the 10 most likely tokens survive each step
    messages=[{"role": "user", "content": "Complete: The cat sat on the"}],
)
print(response.content[0].text)
```

Set `top_k=1` and you get greedy decoding — the single most likely token every step, regardless of temperature.

### On OpenAI — implement it yourself from logprobs

OpenAI doesn't expose `top_k` as a parameter, but their `logprobs` response field lets you see (and post-process) the top-N token probabilities. Here is a minimal implementation that uses `logprobs` to simulate top-K sampling in NumPy:

```python
# pip install openai numpy
import numpy as np
from openai import OpenAI

client = OpenAI()

def topk_sample_from_logprobs(prompt: str, k: int = 5, temperature: float = 1.0) -> str:
    """One-step top-K demo using OpenAI logprobs."""
    # Ask for the raw log-probabilities over the top-20 next tokens.
    # (OpenAI caps logprobs at 20 — enough to see the shape of the distribution.)
    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1,          # one token so we can inspect the distribution
        logprobs=True,
        top_logprobs=20,       # show top-20 candidates
        temperature=temperature,
    )
    top_tokens = response.choices[0].logprobs.content[0].top_logprobs
    tokens  = [t.token    for t in top_tokens]
    logprbs = np.array([t.logprob for t in top_tokens])  # these are log probs
    probs   = np.exp(logprbs)   # back to raw probabilities

    # Apply top-K: zero out tokens ranked below K
    if k < len(probs):
        # probs are already sorted descending by the API
        probs[k:] = 0.0

    # Renormalize — the crucial step
    total = probs.sum()
    if total == 0:
        raise ValueError("All probabilities zeroed — K is too small for this distribution.")
    probs /= total

    # Sample
    chosen = np.random.choice(tokens, p=probs)
    return chosen

print(topk_sample_from_logprobs("The cat sat on the", k=3))
# -> "mat" or "floor" or "roof", never anything in the tail
```

The key lines are the zeroing (`probs[k:] = 0.0`) and the renormalization (`probs /= total`). Skipping renormalization is the single most common bug in hand-rolled sampling code.

### On Hugging Face (open models)

```python
# pip install transformers torch
from transformers import pipeline

gen = pipeline("text-generation", model="gpt2")
out = gen(
    "The best thing about Dubai is",
    do_sample=True,
    top_k=5,            # only the 5 most likely tokens per step
    temperature=1.0,
    max_new_tokens=20,
)
print(out[0]["generated_text"])
# top_k=1 == greedy; top_k=0 disables the filter entirely (all tokens survive)
```

## How a company uses this

**Back to HelpDesk.** Imagine HelpDesk grows: a second workflow triggers every support ticket filed outside business hours. It uses an open Llama model (self-hosted on vLLM — cheaper at scale than the API) to classify the ticket and draft an auto-reply. The team sets `top_k=40, temperature=0.7` as the standard config. The temperature gives natural variation in the phrasing, but the hard cap of 40 guarantees the model never emits a random Unicode character, an SQL fragment, or a token from an unrelated language domain that leaked into the vocabulary. At millions of daily tokens, that tail-pruning has real value.

More broadly, Dubai AI teams using AWS Bedrock or Azure ML to self-host open models configure top-k as a fleet-wide default in their inference server config — it's a one-line guard that makes the tail behavior of the model predictable.

## Common mistakes / misconceptions

- **"Bigger K is safer."** Wrong direction. Beyond K≈50, you're mostly letting junk back in. Typical production range is K=20–50 for open text, K=5–10 for structured or code output.
- **`top_k=0` means "off" in most frameworks** (all tokens survive — the *opposite* of restrictive). `top_k=1` is greedy decoding.
- **Skipping renormalization.** If you zero out tokens and sample from the raw leftover probabilities without dividing by their sum, your sampler will occasionally produce nothing (the missing mass) or over-represent the survivors. Always renormalize.
- **Applying top-k when the API doesn't support it.** On the OpenAI chat API, reach for `top_p` instead. Don't guess that `top_k` silently works — check the API's accepted parameters or it'll be ignored.
- **Forgetting that temperature and top-k compound.** Temperature reshapes the probabilities *before* top-k cuts them. A high temperature can make the 40th token nearly as likely as the 1st — top-k keeps that diversity. A low temperature makes the 1st token dominate — top-k with K=40 then keeps 39 near-zero tokens for no benefit.

## Interview tip

Say: *"Top-K keeps the K most probable tokens, zeroes the rest, renormalizes so the survivors sum to 1, and samples from them. The critical weakness is that K is fixed while the model's confidence varies per step — when it's very confident a small K wastes nothing, but when it's genuinely uncertain across many tokens a fixed K arbitrarily chops good candidates. That's why Top-P, the next parameter, replaces the count with a probability-mass threshold and adapts automatically."*

Mentioning renormalization and the fixed-vs-adaptive tradeoff together is what separates a textbook answer from a production answer.

---

> **Next up — [Top-P (Nucleus Sampling)](top-p-nucleus.md).** You just saw Top-K's blind spot: it keeps a fixed number of candidates regardless of how confident the model is. Top-P fixes that by working backwards — it keeps whichever tokens together account for probability mass P, so when the model is confident it collapses to 1–2 candidates and when it's uncertain it expands to cover the real choices. That adaptive behavior is why Top-P is the default cutoff on most commercial APIs today.
