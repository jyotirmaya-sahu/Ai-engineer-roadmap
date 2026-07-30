# Chunk Size vs Recall

**The one-line idea:** chunk size is a dial with a sweet spot — too small and you lose context, too big and you lose precision. Where you set it directly controls whether retrieval finds the right text.

## Why it matters for an AI Engineer

Every chunking method — **Fixed-Size**, **Recursive**, **Semantic** — forces one central decision: *how big?* This isn't a cosmetic knob; it's the single biggest lever on RAG quality. Get it wrong and a perfectly good vector database returns useless chunks, and the LLM answers wrong no matter how good the model is. In interviews, "how do you choose chunk size?" is a near-guaranteed question, and "it depends — here's what it depends on" is the answer that lands. On the job, tuning this is often the fastest way to rescue a mediocre RAG system.

## The mechanism / how it works

First, terms. **Recall** = "of all the chunks that *actually* contain the answer, how many did retrieval bring back?" High recall = you didn't miss the relevant text. **Precision** = "of the chunks retrieved, how many were *actually* relevant?" The tension:

- **Small chunks (≈128–256 tokens).** Each embedding is about *one* narrow idea, so it matches a specific question sharply — **high precision**. But the chunk is a stranded fragment; the surrounding context that makes the answer *complete* is in a neighboring chunk you didn't retrieve. The LLM gets a right-but-incomplete snippet.
- **Big chunks (≈1000–2000 tokens).** Full context in one piece — but the embedding is an **average of many ideas**, a blurry vector that matches *lots* of questions weakly and none sharply. Precision drops; you also waste prompt budget stuffing irrelevant sentences into the context.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🔬 Tiny chunks<span class="sub">sharp match, no context</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🎯 Sweet spot<span class="sub">~256–512 tokens</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🌫️ Huge chunks<span class="sub">full context, blurry match</span></span>
  </div>
  <div class="dcap">Precision falls off at both ends — tune toward the middle, then measure.</div>
</div>

A practical default for prose is **256–512 tokens with 10–20% overlap**, but the right value depends on your content (dense legal text wants bigger; terse FAQ wants smaller) and your embedding model. **You don't guess the final number — you measure it** on a small set of question→correct-chunk pairs and try a few sizes.

## Concrete example — sweep sizes and measure

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

# a tiny eval set: question -> a phrase that MUST appear in the retrieved chunk
eval_set = [("What is the refund window?", "14 days"),
            ("Who approves overtime?",     "line manager")]

# PSEUDOCODE — illustrates the sweep; the embed/retrieve step is left as a stub
# (measured_recall and my_docs are placeholders, not runnable as-is).
def recall_at_k(chunk_size, docs, k=3):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=int(chunk_size * 0.15))
    chunks = splitter.split_text(docs)
    # (embed chunks, embed each question, take top-k, check the phrase is present)
    # ... retrieval omitted for brevity ...
    return measured_recall   # fraction of questions whose answer chunk was in top-k

for size in (128, 256, 512, 1024):
    print(size, "tokens -> recall:", recall_at_k(size, my_docs))
# typically you'll see recall peak in the middle and fall off at both extremes
```

The habit that matters: **build a small eval set and sweep chunk sizes**, rather than trusting a tutorial's magic number.

## How a company uses this

A Dubai e-commerce company's product-support bot was "answering vaguely." The fix wasn't a bigger model — it was chunk size. They'd used 1500-token chunks; each embedding blended shipping, returns, and warranty text, so a returns question retrieved a blurry chunk. Dropping to 400 tokens with 15% overlap sharpened matches and answer accuracy jumped, at *lower* prompt cost. When a question truly needed surrounding context, they layered on **Hierarchical (Parent-Child) Chunking** to keep small-chunk precision while restoring full context.

## Common mistakes / misconceptions

- **Believing bigger = better.** Bigger chunks feel "safer" but blur the embedding and burn prompt budget. Both ends hurt.
- **Copying a number without measuring.** "1000/200" is a *starting* point, not a truth. Your corpus decides.
- **Confusing recall with precision.** Retrieving *more* chunks (higher k) raises recall but dumps junk into the prompt, hurting precision and cost. Tune size *and* k together.
- **Tuning chunk size to fix a model problem.** If the right chunk *is* retrieved and the answer is still wrong, the issue is the prompt or model, not chunking.

## Interview tip

Answer "how do you pick chunk size?" with the trade-off, not a number: *"Small chunks give precise matches but lose context; big chunks keep context but blur the embedding and waste tokens. I start around 256–512 tokens with ~15% overlap, then measure recall on a small question→chunk eval set and sweep sizes. If I need precision *and* context, I go parent-child."* Showing you'd *measure* — and naming recall vs precision — is what separates a builder from a tutorial-follower.
