# Transformer

**What it is:** The neural network architecture behind every modern LLM — a stack of identical blocks that lets every word in a sentence "look at" every other word in parallel.

## Why it matters for an AI Engineer

Almost every model you'll call in production (GPT, Claude, Llama, Gemini) is a *decoder-only Transformer*. Understanding its shape explains the two facts you fight with daily: **cost grows with the number of tokens** (attention compares tokens pairwise), and **generation is sequential** (one token at a time). If you can't explain why a 10,000-token prompt is slow and expensive, you can't reason about latency or bills. This is the single most-asked architecture question in AI Engineer interviews.

## The old world: RNNs, and why they lost

Before Transformers, we used RNNs (recurrent neural networks). An RNN reads text like a person reading with a finger on the page — one word, update memory, next word. Two problems: it's **inherently sequential** (can't parallelize training across a sentence), and it **forgets** — information from word 1 gets diluted by the time you reach word 500.

The 2017 paper "Attention Is All You Need" replaced recurrence with **attention**: instead of passing memory forward one step at a time, let every token directly read every other token in one shot. That's parallelizable (great for GPUs) and has no forgetting bottleneck — word 500 can read word 1 directly.

## The pipeline (decoder-only)

Modern LLMs are **decoder-only**: one stack that both reads the prompt and writes the continuation.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📄 Text</span>
    <span class="darr">↓</span>
    <span class="dbox">Tokenizer<span class="sub">text → token IDs</span></span>
    <span class="darr">↓</span>
    <span class="dbox">Embedding<span class="sub">IDs → vectors</span></span>
    <span class="darr">↓</span>
    <span class="dbox">+ Positional info</span>
    <span class="darr">↓</span>
    <span class="dbox purple wide">🧠 Transformer Block × N</span>
    <span class="darr">↓</span>
    <span class="dbox">Final layer<span class="sub">vectors → logits</span></span>
    <span class="darr">↓</span>
    <span class="dbox">Softmax → probabilities</span>
    <span class="darr">↓</span>
    <span class="dbox yellow">🔢 Pick next token</span>
  </div>
  <div class="dgroup">
    <span class="dgt">Inside one Transformer Block</span>
    <div class="flow">
      <span class="dbox purple">Self-Attention</span>
      <span class="darr">→</span>
      <span class="dbox purple">Feed-Forward Network</span>
    </div>
  </div>
  <div class="dcap">Decoder-only pipeline: text → tokens → vectors → N attention+FFN blocks → logits → next token, repeated autoregressively.</div>
</div>

Step by step:

1. **Tokenize** — split text into subword tokens, map each to an integer ID.
2. **Embed** — look up each ID in a table to get a vector (e.g. 4096 numbers) that carries the token's meaning.
3. **Add position** — attention alone doesn't know order, so we inject position info (see positional-encoding).
4. **Transformer blocks (the stack)** — repeat N times (GPT-3 had 96). Each block does two things:
   - **Self-attention:** each token gathers relevant info from other tokens ("bank" reads "river" nearby and leans toward the water meaning).
   - **Feed-forward network (FFN):** a small per-token MLP that processes each token's updated vector — this is where a lot of factual "knowledge" is stored.
   - Both wrapped with **residual connections** (add the input back) and **normalization** to keep training stable.
5. **Output head** — the final vector for the last position is projected to a **logit** per vocabulary token, then softmaxed into probabilities. Pick one, append it, repeat.

## Concrete example

Prompt: `"The capital of France is"`. After tokenizing and running the stack, the last position's vector produces logits over the whole vocabulary. `" Paris"` gets the highest logit → highest probability → it's chosen. That token is appended and the whole thing runs again to produce the next token. Nothing magic — just the same block stack applied repeatedly.

## How this shows up in production

- **Cost/latency scaling:** self-attention is roughly O(n²) in sequence length. Double the prompt, quadruple the attention work. That's why long-context calls cost more and respond slower — and why you trim RAG context instead of dumping everything.
- **KV cache:** because each new token re-attends to all previous tokens, servers cache the previous tokens' Key/Value vectors so they aren't recomputed. This cache is the main GPU-memory consumer at inference and drives how many concurrent requests a server can hold.

## Common misconceptions

- **"Transformers understand grammar like a parser."** No — they learn statistical patterns from data; there's no explicit grammar module.
- **"Decoder-only means it can't read, only write."** It reads the prompt *and* writes — "decoder-only" refers to the architecture (single masked stack), not a read/write limitation. The original 2017 model had a separate encoder and decoder (for translation); modern chat LLMs dropped the encoder.
- **"More layers always = smarter."** Depth helps, but data quality, width, and training compute matter as much.

## Interview tip

Be ready to say: *"A decoder-only Transformer maps tokens → embeddings → a stack of (self-attention + FFN) blocks with residuals → logits over the vocabulary, generating autoregressively."* If they push on RNNs, the answer is: **parallelizable training + direct long-range access via attention**, versus the RNN's sequential, forgetful memory.
