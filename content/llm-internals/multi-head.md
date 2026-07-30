# Multi-Head Attention

**What it is:** Running several attention operations in parallel — each "head" learns to focus on a different kind of relationship — then combining their results.

## Why it matters for an AI Engineer

A single attention pass can only average things one way; language needs many relationships at once (grammar, coreference, topic). Multi-head attention is how Transformers capture that richness, and it directly affects **inference memory** — the number of heads is a factor in KV-cache size, and modern memory-saving tricks (Grouped-Query and Multi-Query Attention) are all about *reducing the number of key/value heads*. When you tune a serving stack or read a model config (`num_attention_heads`, `num_key_value_heads`), this is what those numbers mean.

## The everyday analogy

Imagine reviewing a contract with a team instead of alone: one person checks legal terms, one checks numbers, one checks dates. Each specialist reads the *same* document but pays attention to different things, then you pool their notes. Multi-head attention is that team — several attention "specialists" reading the same sequence, each tracking a different pattern.

## The mechanism

Instead of computing one big attention over the full hidden dimension, the model **splits** the vector into `h` smaller chunks and runs attention on each chunk independently:

1. Project the input into `h` separate sets of Query/Key/Value, each of dimension `d_model / h`.
2. Run the standard `softmax(QKᵀ/√d_k)·V` attention **within each head** — each with its own learned weights, so each head attends differently.
3. **Concatenate** all heads' outputs back into a full-size vector.
4. Pass through a final output projection `W_O` to mix the heads together.

Total compute is about the same as one big attention (you split the dimension), but you get `h` different "views" instead of one.

<div class="diagram">
  <div class="flow"><span class="dbox gray">Token vectors</span></div>
  <div class="flow"><span class="darr">↓<span class="lbl">split across heads</span></span></div>
  <div class="flow">
    <span class="dbox purple">Head 1<span class="sub">subject-verb</span></span>
    <span class="dbox purple">Head 2<span class="sub">pronoun refs</span></span>
    <span class="dbox purple">Head 3<span class="sub">next-word syntax</span></span>
    <span class="dbox purple">Head h<span class="sub">...</span></span>
  </div>
  <div class="flow"><span class="darr">↓</span></div>
  <div class="flow">
    <span class="dbox">Concatenate</span>
    <span class="darr">→</span>
    <span class="dbox">Output projection W_O</span>
    <span class="darr">→</span>
    <span class="dbox green">Updated token vectors</span>
  </div>
  <div class="dcap">The vector is split across heads that each attend differently, then concatenated and mixed by W_O.</div>
</div>

Researchers have found (loosely — heads aren't cleanly interpretable) that different heads specialize: some track positional neighbors, some track syntactic dependencies, some copy rare tokens. You don't program this; it emerges from training.

## Concrete example

For *"The keys to the cabinet are on the table,"* getting the verb agreement ("are," not "is") requires linking "keys" (plural) across the distractor "cabinet" (singular). One head can lock onto the "keys → are" subject-verb link while another head simultaneously tracks "cabinet → table" spatial info. A single head would have to compromise between these; multiple heads don't have to.

Typical sizes: GPT-3 used 96 heads; Llama 3 8B uses 32 query heads but only 8 key/value heads (GQA).

## How this shows up in production

- **Reading model configs:** `num_attention_heads` vs `num_key_value_heads` differing means the model uses GQA — fewer K/V heads shrink the KV cache with little quality loss.
- **Multi-Query Attention (MQA):** the extreme — *one* shared K/V head for all query heads. Tiny KV cache, faster decode, slight quality cost; used where memory/latency is critical.
- **Attention-head pruning:** some heads are redundant and can be pruned to speed up inference, a known model-compression technique.

## Common misconceptions

- **"Each head sees the whole vector."** No — the vector is *split* across heads; each head works on a slice of dimension `d_model/h`. That's why multi-head isn't `h`× more expensive.
- **"Heads have clean, human-labeled jobs."** Specialization is real but messy and only partially interpretable — don't claim head 5 "is the grammar head."
- **"More heads always help."** Beyond a point, extra heads add little and some are prunable; head count is a design tradeoff, not a bigger-is-better dial.

## Interview tip

Say: *"Multi-head attention splits the hidden dimension into several heads, each running its own Q/K/V attention with separate weights, so different heads capture different relationships; the outputs are concatenated and projected. It's roughly the same compute as one attention because the dimension is split."* Bonus: *"GQA and MQA reduce the number of key/value heads to shrink the KV cache — that's the modern memory optimization."*
