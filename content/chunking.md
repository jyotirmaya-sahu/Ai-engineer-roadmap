# Chunking

**The one-line idea:** Chunking is cutting your documents into smaller pieces *before* you embed and store them, so retrieval can later pull back just the relevant paragraph instead of a whole 50-page PDF.

## Why we even need it

A RAG system retrieves text, then stuffs it into the LLM's prompt. Two hard limits force you to split documents first:

1. **Embeddings blur when the text is too long.** An embedding model squeezes a piece of text into a single vector. Feed it one sentence — the vector sharply captures that meaning. Feed it a whole chapter — the vector becomes a mushy average of ten different topics, and it matches *nothing* well. Small, focused chunks = sharp, searchable vectors.
2. **The context window is finite and expensive.** You can't paste an entire document into every prompt — you'd blow the token budget and pay for thousands of irrelevant tokens. You want to retrieve the 3–5 *most relevant* pieces, not everything.

So chunking is the bridge: it turns "one giant document" into "many searchable, prompt-sized units."

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 50-page PDF</span>
    <span class="darr">→<span class="lbl">chunk</span></span>
    <span class="dbox">¶ chunk 1</span>
    <span class="dbox">¶ chunk 2</span>
    <span class="dbox">¶ chunk 3…</span>
    <span class="darr">→</span>
    <span class="dbox blue">🗄️ each embedded + stored</span>
  </div>
  <div class="dcap">Chunking splits a document into small, focused units — each becomes one searchable vector.</div>
</div>

## Why it's the highest-leverage knob in RAG

Here's the part beginners miss: **if the right chunk was never created, retrieval can never find it.** Chunking happens *before* embedding and search, so a bad split poisons everything downstream. Split mid-sentence and you cut an answer in half; make chunks too big and the vector is unfocused; too small and each chunk loses the context it needs to make sense. Most "the RAG answer is wrong" bugs trace back to chunking, not the LLM.

That's why there isn't one chunking method — there's a family of strategies, each trading off differently between **keeping related text together** and **keeping chunks focused**.

## The strategies you'll learn (and when to reach for each)

| Strategy | Core idea | Best when |
|---|---|---|
| **Fixed-size** | cut every N characters/tokens | simplest baseline, uniform text |
| **Sliding window / overlap** | let chunks share a bit of text at the edges | so answers spanning a boundary aren't lost |
| **Recursive** | split on structure (paragraphs → sentences → words) | the practical default for most docs |
| **Semantic** | split where the *topic* shifts | high-value, mixed-topic documents |
| **Sentence / token-based** | respect sentence or exact token boundaries | precise budgeting, clean grammar |
| **Hierarchical (parent-child)** | search small pieces, return their bigger parent | best of both: precise match + full context |

Two cross-cutting decisions apply to all of them: **chunk size vs recall** (how big to make chunks) and **metadata per chunk** (attaching source, page, section so you can filter and cite).

## Real world: how a company uses this

> **A Dubai law firm** building a contract-Q&A assistant learned this the hard way. Fixed 1000-character chunks kept slicing clauses in half, so "what's the termination notice period?" retrieved half a clause and the model guessed. Switching to **recursive splitting on clause boundaries + parent-child retrieval** (match the exact clause, return the full section for context) fixed accuracy overnight. Same documents, same model — only the chunking changed.

## Interview tip
Say: *"Chunking is the pre-processing step that decides what a RAG system can even retrieve. I default to recursive character splitting with ~10–20% overlap, tune chunk size against retrieval recall, attach metadata for filtering and citations, and reach for semantic or parent-child chunking when documents are long or mixed-topic. Most RAG quality problems are chunking problems, not model problems."* That framing shows you know where RAG actually breaks.

---

*Below: deep-dive articles on each chunking strategy.*
