# LLM Internals

**The one-line idea:** LLM internals is what's actually happening inside the model when it turns your prompt into text — just enough of the machinery (tokens, the transformer, attention, decoding, training) to reason about cost, limits, and quality instead of treating the model as magic.

## Why we even need it

You can use an LLM without knowing any of this — until something goes wrong and you can't explain *why*. Why did the bill double? Why did the model forget the start of a long document? Why does it sometimes contradict itself mid-answer? Why can't it just "remember" our whole knowledge base?

Every one of those questions has an answer buried in how the model works. You don't need a PhD or the math — but an AI engineer who understands the **shape** of the mechanism makes better decisions about prompts, context windows, model choice, and cost, and sails through interviews where "explain how an LLM generates text" is a standard opener.

The core surprise for beginners: an LLM doesn't "think" and then write an answer. It predicts **one token at a time**, over and over, each new token conditioned on everything so far. That single fact explains cost (you pay per token), latency (long answers are slow), and the context window (there's a hard limit on how much it can look at). Understand the loop and the rest clicks.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">📝 prompt</span>
      <span class="darr">→<span class="lbl">tokenize</span></span>
      <span class="dbox orange">🔢 tokens</span>
      <span class="darr">→</span>
      <span class="dbox purple">🧠 transformer<span class="sub">attention layers</span></span>
      <span class="darr">→</span>
      <span class="dbox orange">📊 logits<span class="sub">next-token scores</span></span>
      <span class="darr">→<span class="lbl">pick 1</span></span>
      <span class="dbox green">✅ next token</span>
    </div>
  </div>
  <div class="dcap">The generation loop: text → tokens → transformer → logits → one token — then that token is appended and the whole loop runs again.</div>
</div>

## The pieces you'll learn (and how they fit)

The tiles group into four stages of the story — **inputs, engine, output, and origins:**

| Group | Tiles | The question it answers |
|---|---|---|
| **Tokenization** | BPE/WordPiece, Vocabulary, Token limits, Special tokens | How is text turned into the numbers the model reads? |
| **The engine** | Transformer, Hidden states, Attention (self-attention, Q/K/V, multi-head, positional encoding, context window) | How does the model relate every word to every other word? |
| **Decoding** | Logits, Autoregressive decoding | How does it choose the next word, one at a time? |
| **Training lifecycle** | Pre-training, SFT, RLHF, DPO, Instruction tuning | How did the model learn to be helpful in the first place? |

Read left to right, they tell one continuous story. **Tokenization** breaks your text into chunks and maps them to numbers — and directly explains why you pay per token and why "token limits" exist. The **transformer** is the engine, and its heart is **attention**: a mechanism where every token looks at every other token (via Query/Key/Value vectors) to figure out what's relevant — which is *why* a longer context costs more and why the **context window** has a hard ceiling. The model produces **logits** (a score for every possible next token), and **autoregressive decoding** picks one, appends it, and repeats. Finally, the **training lifecycle** explains where the model's behavior came from: raw prediction from **pre-training**, then **SFT / instruction tuning** to follow requests, then **RLHF / DPO** to align it with human preferences.

## Real world: how a company uses this

> A **Dubai fintech** team kept hitting mysterious cost spikes and truncated answers on their document assistant. The fix came straight from internals literacy: they realized Arabic text tokenizes into **far more tokens** than English (so the same document cost more and filled the context window faster), and that stuffing entire documents into every prompt was blowing the **context window** limit. Understanding tokenization and attention led them to trim prompts, switch to a longer-context model deliberately, and cut costs — decisions impossible to make if the model is a black box.

## Interview tip
Say: *"An LLM generates text autoregressively — one token at a time. Text is tokenized into sub-word units, run through transformer layers whose attention mechanism lets every token weigh every other, producing logits over the vocabulary; we sample one token, append it, and repeat until it stops. That loop explains per-token cost, latency, and the fixed context window. And its helpfulness comes from the training pipeline: pre-training, then supervised instruction tuning, then preference alignment like RLHF or DPO."* Nailing that end-to-end sentence signals real depth.

---

*Below: deep-dive articles on each LLM internal.*
