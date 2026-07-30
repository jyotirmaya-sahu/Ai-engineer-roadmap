# Logits

**What it is:** The raw, unnormalized scores an LLM assigns to *every* token in its vocabulary at each step — the numbers that become probabilities right before a token is picked.

## Why it matters for an AI Engineer

Everything you tune about generation — `temperature`, `top_p`, `top_k`, `logit_bias`, `logprobs` — operates on logits. If you understand that the model outputs a score per vocab token and then samples from them, you can reason about *why* raising temperature makes output weirder, why a model sometimes returns a confident wrong answer, and how to force or ban specific tokens. Logits are also how you get **confidence scores** for classification or extraction, which is a common production need.

## The mechanism

After the last Transformer layer, the final hidden state for the current position (a vector of, say, 4096 numbers) is multiplied by the **output projection** — a big matrix of shape `[hidden_size × vocab_size]`. Out comes one number per vocabulary token. For a 128k-token vocab, that's 128,000 numbers. These are the **logits**: raw scores, any real value, positive or negative, not yet probabilities.

To turn them into probabilities, apply **softmax**: exponentiate each logit and normalize so they sum to 1.

```
softmax(z_i) = e^(z_i) / Σ_j e^(z_j)
```

Then a sampling rule picks the next token from that probability distribution.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">Final hidden state</span>
    <span class="darr">→</span>
    <span class="dbox purple">Output projection</span>
    <span class="darr">→</span>
    <span class="dbox orange wide">Logits<span class="sub">one score per vocab token</span></span>
    <span class="darr">→</span>
    <span class="dbox">÷ temperature</span>
    <span class="darr">→</span>
    <span class="dbox">Softmax</span>
    <span class="darr">→</span>
    <span class="dbox">Probabilities</span>
    <span class="darr">→</span>
    <span class="dbox yellow">🔢 Sample next token</span>
  </div>
  <div class="dcap">Hidden state → projection → raw logits → temperature → softmax → probabilities → sampled token.</div>
</div>

## Concrete example

Suppose the vocab is tiny — 4 words — and after "The capital of France is" the logits are:

| token | logit |
|---|---|
| " Paris" | 8.0 |
| " Lyon" | 3.0 |
| " London" | 1.0 |
| " banana" | -2.0 |

Softmax turns these into roughly `Paris 0.99, Lyon 0.007, London 0.001, banana ~0`. Paris dominates because softmax is exponential — a gap of 5 in logits is a huge gap in probability.

**Temperature** divides logits *before* softmax. `temperature=0.5` doubles all logits → gaps widen → Paris even more certain (sharper). `temperature=2.0` halves them → distribution flattens → Lyon/London get real chances (more random). `temperature=0` = always pick the top logit (greedy).

```python
# OpenAI-style: get the actual numbers back
resp = client.chat.completions.create(
    model="gpt-4o-mini", messages=[...],
    logprobs=True, top_logprobs=5)   # log-probabilities per top token
```

## How this shows up in production

- **Confidence for extraction/classification:** Read the logprob of the chosen token to gate on certainty ("only auto-approve if P(label) > 0.9").
- **`logit_bias` to force/ban tokens:** Add +100 to a token's logit to force it, or -100 to ban it (e.g. block a profanity token, or force JSON-only output).
- **Guided/structured decoding:** Constrained JSON works by masking logits — setting illegal next-tokens to -infinity so softmax can never pick them.

## Common misconceptions

- **"Logits are probabilities."** No — they're raw scores from -∞ to +∞. Softmax converts them; they don't sum to 1 on their own.
- **"Higher temperature adds knowledge/creativity."** It only flattens the existing distribution so lower-ranked tokens get chosen more often. The model learns nothing new; it just gambles more.
- **"logprobs give a true calibrated confidence."** They reflect the model's *internal* certainty, which can be confidently wrong. Useful signal, not ground truth.

## Interview tip

Nail the chain: *"final hidden state → output projection → logits (one per vocab token) → optionally divide by temperature → softmax → probabilities → sample."* Then add: *"temperature, top_p, top_k, and logit_bias are all just transformations on the logits before sampling."* That one sentence shows you understand every generation knob at once.
