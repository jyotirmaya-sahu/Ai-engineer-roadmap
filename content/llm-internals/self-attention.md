# Self-Attention

**What it is:** The mechanism that lets every token in a sequence look at every other token and pull in the information that's relevant to it — how the model builds context.

## Why it matters for an AI Engineer

Self-attention is *the* core operation of a Transformer, and it drives the two costs you live with: it's **roughly O(n²) in sequence length** (each token compares itself to every other token), which is why long prompts are slow and expensive, and it's why the **KV cache** exists (so past comparisons aren't recomputed each step). When an interviewer says "explain attention," they want this. It's also the reason a model can resolve pronouns, track subjects, and use context at all.

## The everyday analogy

Imagine reading the sentence *"The trophy didn't fit in the suitcase because it was too big."* To know what "it" refers to, you glance back at "trophy" and "suitcase" and weigh which makes sense. Self-attention does exactly that for every token: for each word, it asks *"which other words should I pay attention to, and how much?"* and blends their information accordingly.

## The mechanism

For each token, the model computes three vectors (via learned weight matrices):
- **Query (Q):** what this token is looking for.
- **Key (K):** what each token offers / can be matched against.
- **Value (V):** the actual information each token carries.

Then, for one token:
1. Compare its **Query** to every token's **Key** (a dot product) → a raw relevance score per token.
2. Scale and **softmax** those scores into weights that sum to 1 — the "attention distribution."
3. Take a **weighted sum of all the Values** using those weights → the token's new, context-aware vector.

High-relevance tokens contribute more of their Value; irrelevant ones contribute almost nothing. Do this for every token, in parallel, and every token gets updated with context.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">Query of 'it'</span>
    <span class="darr">→</span>
    <span class="dbox purple wide">Dot-product with every Key</span>
    <span class="darr">→</span>
    <span class="dbox">Scale + Softmax → weights</span>
  </div>
  <div class="flow"><span class="dbox gray">Keys of all tokens</span><span class="darr">↑<span class="lbl">feeds scoring</span></span></div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow">
    <span class="dbox orange wide">Weighted sum of Values</span>
    <span class="darr">→</span>
    <span class="dbox green">New vector for 'it'<span class="sub">now knows it = trophy</span></span>
  </div>
  <div class="flow"><span class="dbox gray">Values of all tokens</span><span class="darr">↑<span class="lbl">blended by weights</span></span></div>
  <div class="dcap">A token's Query scores against every Key, softmaxes into weights, then blends the Values into a context-aware vector.</div>
</div>

**Causal masking:** in a decoder LLM, a token may only attend to *earlier* tokens (and itself), never future ones — otherwise it would "cheat" by seeing the answer during training. Future positions get their scores set to -∞ before softmax, so their weight is zero.

## Concrete example

Sentence: *"river bank"*. When processing "bank," its Query strongly matches "river"'s Key, so "bank" pulls in "river"'s Value. The updated "bank" vector now leans toward *riverbank* rather than *financial bank* — meaning resolved purely by which tokens attended to which. Swap in "money bank" and the weights shift toward "money."

## How this shows up in production

- **Cost/latency:** the pairwise score matrix is n×n, so doubling context roughly quadruples attention work. This is the technical reason long-context calls cost more — and why you trim RAG context rather than dumping everything.
- **KV cache:** at decode time, each new token attends to all previous tokens; servers cache prior Keys and Values so only the new token is computed. This cache is the main inference memory cost and caps concurrency.
- **Efficient attention (FlashAttention, sliding-window, etc.):** serving stacks use optimized attention kernels to make the n² cost tolerable at long context.

## Common misconceptions

- **"Attention is a fixed rule."** The Q/K/V projections are *learned* — the model learns what to attend to from data; it's not hand-coded grammar.
- **"Every token attends to the whole document equally."** Weights are sharply peaked after softmax — usually a few tokens dominate. And in decoder LLMs, tokens can't see the future at all.
- **"Attention alone makes the Transformer."** Each block pairs attention with a feed-forward network (and residuals/normalization). Attention moves information *between* tokens; the FFN processes each token.

## Interview tip

Say: *"Self-attention lets each token build a context-aware representation: it forms a Query, compares it against every token's Key to get relevance scores, softmaxes them into weights, and takes a weighted sum of the Values. In a decoder it's causally masked so tokens only see the past. The n² cost is why long context is expensive and why we cache Keys and Values."* Being able to name Q/K/V *and* tie it to cost is the strong-candidate signal.
