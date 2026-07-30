# Fixed-Size Chunking

**The one-line idea:** cut a long document into pieces of a fixed length — every N characters (or tokens) — and store each piece as a chunk. The simplest possible splitter.

## Why it matters for an AI Engineer

Before any document can go into a RAG system (see **RAG Architecture**), it has to be **chunked** — sliced into pieces small enough to embed and retrieve. Fixed-size chunking is the baseline every other strategy is measured against. It is the first thing you'll reach for when prototyping, and the thing you'll explain in an interview when asked "how do you split documents?". Getting the *number* right (chunk size + overlap) directly moves your retrieval quality, your embedding cost, and how much text you stuff into each prompt. Every dirham you spend on embeddings and every token you pay for at generation time traces back to this decision.

## The mechanism / how it works

You pick a **chunk size** — say 1000 characters — and walk through the text, cutting a new chunk every time you hit that limit. That's it. No understanding of the content, no respect for sentences or paragraphs. Just count and cut.

The problem: a hard cut lands *anywhere* — mid-word, mid-sentence, mid-table. So a fact that spans the boundary gets split in half, and neither chunk contains the whole thought. The fix is **overlap**: let each chunk repeat the last, say, 200 characters of the previous one, so a fact straddling the cut survives intact in at least one chunk. (Overlap gets its own tile — **Sliding Window / Overlap**.)

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Long document<span class="sub">8,000 chars</span></span>
    <span class="darr">→<span class="lbl">cut every 1000</span></span>
    <span class="dbox orange">Chunk 1</span>
    <span class="dbox orange">Chunk 2</span>
    <span class="dbox orange">…</span>
    <span class="dbox orange">Chunk 8</span>
  </div>
  <div class="dcap">Fixed-size = count characters, cut at the limit, ignore meaning.</div>
</div>

**Characters vs tokens.** You can measure the limit in raw characters (easy) or in **tokens** (what the model actually reads — see **Sentence / Token-Based Chunking**). Tokens are more accurate because embedding models and LLMs have *token* limits, not character limits. A rough rule for English: 1 token ≈ 4 characters ≈ ¾ of a word. So a 1000-character chunk is roughly 250 tokens.

## Concrete example

LangChain's `CharacterTextSplitter` is the literal fixed-size splitter. (Its cousin `RecursiveCharacterTextSplitter` is smarter — that's the **Recursive Chunking** tile.)

```python
# pip install langchain-text-splitters
from langchain_text_splitters import CharacterTextSplitter

text = open("policy.txt").read()  # imagine a 6,000-char HR policy

splitter = CharacterTextSplitter(
    separator="",        # "" = pure fixed-size, cut anywhere
    chunk_size=1000,     # 1000 characters per chunk
    chunk_overlap=200,   # repeat last 200 chars into next chunk
    length_function=len, # count characters
)

chunks = splitter.split_text(text)
print(f"{len(chunks)} chunks")
for i, c in enumerate(chunks[:2]):
    print(f"\n--- chunk {i} ({len(c)} chars) ---\n{c[:120]}...")
```

With 6,000 characters, size 1000, overlap 200, you advance 800 net characters per chunk, so you get about 8 chunks. Change `chunk_size` to 500 and you double the chunk count (and double retrieval granularity — but also double the risk of splitting a thought).

## How a company uses this

A Dubai fintech building an internal "ask our compliance docs" bot will almost always **start** here: fixed-size 1000/200 over the whole PDF corpus, ship a working demo in an afternoon, then measure. It's the honest MVP. Once real questions come in and they see answers getting cut off mid-clause, they graduate to **Recursive** or **Semantic Chunking**. Fixed-size is the "does RAG even help us?" test before investing in anything fancier.

## Common mistakes / misconceptions

- **Zero overlap.** With `chunk_overlap=0`, any fact on a boundary is destroyed. Always use some overlap (10–20% of chunk size is typical).
- **Confusing characters with tokens.** A 2000-*character* chunk is fine for most embedders; a 2000-*token* chunk may blow past an embedding model's context window. Know which unit you're counting.
- **Assuming fixed-size is "wrong."** It's not wrong, it's the baseline. Ship it first, then improve only if retrieval quality demands it.
- **One giant chunk size.** Huge chunks (say 4000+ tokens) dilute the embedding — the vector becomes an average of too many topics and matches nothing well. See **Chunk Size vs Recall**.

## Interview tip

If asked "how would you chunk documents for RAG?", start with: *"I'd begin with fixed-size — say 1000 characters, 200 overlap — as a baseline, then measure retrieval quality and move to recursive or semantic splitting only if boundaries are hurting answers."* Naming the actual numbers *and* signalling you'd measure before over-engineering is exactly what interviewers want to hear.
