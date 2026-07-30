# Context Window

**What it is:** The maximum span of tokens a model can attend to at once — its working memory. Anything outside the window simply doesn't exist to the model.

## Why it matters for an AI Engineer

The context window is the stage on which everything happens: prompt, chat history, retrieved documents, and the answer all share it. Its size sets what you can do (analyze a whole contract vs. a paragraph), and its *behavior* — especially **"lost in the middle"** — determines whether stuffing more context actually helps or quietly hurts. Understanding it is what separates "throw everything at the model" from designing a system that reliably uses the right context.

## The mechanism

The context window is a token limit baked into the model, enforced by its positional encoding and training. In 2026, windows range from 8k (older/local models) to 128k–200k (GPT/Claude class) up to 1M+ (Gemini class). Every token in the window can attend to every other token (subject to causal masking), which is exactly why compute scales roughly **quadratically** with window usage — the attention comparison is pairwise. (In practice a 1M-token call doesn't cost 1000× a 1k call: providers bill **per token**, not per attention-op, and use memory-efficient kernels like FlashAttention plus context caching to keep the constant down. The quadratic is real in the math; the price you pay is closer to linear per token.)

Two facts follow:
- The window is **shared** by input and output — see token-limits.
- Filling it is **not free or neutral**: more tokens mean more compute *and* a real quality risk.

## Lost in the middle

A crucial, well-documented finding: models attend most reliably to information at the **beginning** and **end** of a long context, and are **weakest in the middle**. Put the key fact in the middle of a 100k-token prompt and the model may effectively ignore it — even though it "fits." This is a U-shaped attention curve, not a hard cutoff.

<div class="diagram">
  <div class="flow">
    <span class="dbox green">Start<span class="sub">high recall</span></span>
    <span class="darr">→</span>
    <span class="dbox orange wide">Middle<span class="sub">weak recall (lost)</span></span>
    <span class="darr">→</span>
    <span class="dbox green">End<span class="sub">high recall</span></span>
  </div>
  <div class="dcap">"Lost in the middle": models recall the start and end of a long context far better than the middle.</div>
</div>

The practical takeaway: **position matters**. Long context is capacity, not guaranteed attention.

## Concrete example

Give a model 40 retrieved chunks and ask a question whose answer is in chunk #20. A naive dump often fails; the model latches onto the first and last chunks. Fix it by **reranking** so the most relevant chunk sits near the top or bottom, and by **trimming** to the few chunks that matter. Same model, same question — much better answer, because you respected how the window actually works.

```python
# Sketch: rank, keep top-k, and place the best chunk at an edge
chunks = rerank(query, retrieved)          # relevance-ordered
kept = chunks[:6]                          # trim to fit + avoid dilution
prompt = build(system, kept, user_question)  # best chunks near start/end
```

## How this shows up in production

- **RAG design:** retrieval + reranking + trimming exist largely because you can't (and shouldn't) dump everything into the window. Relevance and placement beat volume.
- **"Needle in a haystack" evals:** teams test long-context models by hiding a fact at various depths and checking recall — this is how the lost-in-the-middle weakness is measured before trusting a big window.
- **Cost/latency ceilings:** a 200k-token call is slow and pricey. Prompt caching and context trimming keep long-context features economical.

## Common misconceptions

- **"A bigger window means I can stop doing RAG."** No — retrieval controls *relevance and cost*, and long windows still suffer lost-in-the-middle. Big context complements RAG; it doesn't replace it.
- **"If it fits, the model uses it equally."** Attention is uneven — middle content is under-used. Placement and trimming matter.
- **"Context window = the model's long-term memory."** It's *working* memory, wiped every request. Persistent memory requires storing and re-injecting context yourself.

## Interview tip

Say: *"The context window is the token span the model can attend to — shared by input and output, with cost scaling roughly quadratically. Bigger isn't automatically better because of 'lost in the middle': models recall the start and end of long contexts far better than the middle. So I rerank and trim retrieved context and place the most important content at the edges, rather than dumping everything in."* That answer shows you know both the limit *and* its failure mode.
