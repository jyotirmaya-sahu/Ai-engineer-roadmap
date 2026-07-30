# Query / Key / Value

**What it is:** The three learned roles every token plays inside attention — a Query (what I'm looking for), a Key (what I offer), and a Value (what I actually hand over) — the machinery that makes attention work.

## Why it matters for an AI Engineer

Q/K/V is the "how" behind self-attention, and it's the level of detail interviewers probe when they want to know you *really* understand Transformers. It also demystifies production concepts: the **"KV cache"** is literally a cache of Keys and Values, and **Grouped-Query Attention (GQA)** — used in Llama and other modern models to save memory — is an optimization on how many K/V sets you keep. You can't reason about inference memory without knowing what K and V are.

## The library analogy

You want to learn about something (your **Query**). Every book on the shelf has a spine label (its **Key**) and actual contents (its **Value**). You compare your query to each spine label to see how relevant each book is, then you read more from the books that match best and skim the rest. Attention does this numerically: match Query against Keys to get relevance, then blend the Values weighted by relevance.

## The mechanism (with tiny math)

Each token's hidden vector `x` is projected three ways by learned matrices:

```
Q = x · W_Q      K = x · W_K      V = x · W_V
```

Then attention for a token is:

```
scores = Q · Kᵀ            # dot product: how well my query matches each key
scores = scores / √d_k     # scale so values don't blow up as dimension grows
weights = softmax(scores)  # turn scores into weights that sum to 1
output = weights · V       # weighted blend of the values
```

That's the famous formula `Attention(Q,K,V) = softmax(QKᵀ / √d_k) · V`.

**Tiny worked example.** Say token "it" has query `q = [1, 0]`, and three candidate tokens have keys:
- "trophy": `k = [1, 0]` → dot = 1.0
- "suitcase": `k = [0, 1]` → dot = 0.0
- "the": `k = [0.2, 0]` → dot = 0.2

Softmax of `[1.0, 0.0, 0.2]` ≈ `[0.55, 0.20, 0.25]` (they sum to 1). So "it" pulls ~55% of its new content from "trophy"'s Value — it has effectively resolved "it" → "trophy."

<div class="diagram">
  <div class="flow"><span class="dbox gray">Token vector x</span></div>
  <div class="flow"><span class="darr">↓<span class="lbl">3 learned projections</span></span></div>
  <div class="flow">
    <span class="dbox blue">Q = x·W_Q</span>
    <span class="dbox blue">K = x·W_K</span>
    <span class="dbox orange">V = x·W_V</span>
  </div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow">
    <span class="dbox purple wide">scores = Q·Kᵀ / √d_k</span>
    <span class="darr">→</span>
    <span class="dbox">softmax → weights</span>
    <span class="darr">→</span>
    <span class="dbox green">output = weights · V</span>
  </div>
  <div class="dcap">One token vector projects into Q, K, V; Q·Kᵀ scaled and softmaxed gives weights that blend the Values.</div>
</div>

**Why √d_k?** As the key dimension `d_k` grows, raw dot products get large, pushing softmax into a region where one weight ≈ 1 and gradients vanish. Dividing by √d_k keeps scores in a sane range so training is stable.

## Concrete example (production)

In a served model, once token *t* is processed, its **K** and **V** vectors never change — future tokens will keep attending to them. So the server stores them in the **KV cache**. Generating token 1,000 then only computes token 1,000's Q/K/V and reuses the 999 cached K/V pairs, instead of recomputing everything. That cache is the dominant GPU-memory cost at inference.

## How this shows up in production

- **KV cache sizing:** cache memory ≈ `2 (K and V) × layers × heads × d_head × sequence_length × batch × bytes_per_element` (bytes = 2 for fp16, 1 for int8). The `bytes` factor is easy to forget and it doubles your estimate — this formula tells you how many concurrent long-context requests fit on a GPU.
- **Grouped-Query Attention (GQA):** many query heads share a smaller number of K/V heads, shrinking the KV cache with minimal quality loss — standard in Llama 3, Mistral, etc.
- **Why Q isn't cached:** Queries are only needed for the *current* token's step, so there's nothing to reuse — only K and V are cached.

## Common misconceptions

- **"Q, K, V are three different inputs."** They're three *projections of the same input* (in self-attention). One token produces all three from its own vector.
- **"The Value is the same as the Key."** Key is for matching (relevance); Value is the payload that gets blended. Different matrices, different purposes.
- **"Scaling by √d_k is optional."** Skip it and softmax saturates, killing gradients — it's essential for stable training.

## Interview tip

Write the formula `softmax(QKᵀ/√d_k)·V` and narrate it: *"Query matches against Keys via dot product to get relevance, scale by √d_k for stability, softmax into weights, then take a weighted sum of Values."* Then connect to systems: *"K and V are cached at inference — that's the KV cache — and GQA shares K/V across query heads to shrink it."* That arc from math to memory is exactly what strong candidates show.
