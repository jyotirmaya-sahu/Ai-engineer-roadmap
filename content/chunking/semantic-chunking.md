# Semantic Chunking

**The one-line idea:** cut the document where the *meaning* changes — use embeddings to detect topic shifts and put the break there — instead of cutting at an arbitrary character count.

## Why it matters for an AI Engineer

**Fixed-Size** and **Recursive Chunking** cut based on *shape* (character counts, paragraph marks). They don't know *what the text says*. So a single 1000-character window can accidentally staple together the end of one topic and the start of another — a muddy chunk that embeds to a muddy vector and retrieves poorly. Semantic chunking makes chunks that are each about *one thing*, which gives cleaner embeddings and sharper retrieval. It's the strategy you propose when someone says "recursive isn't good enough, answers are still mixing topics." Knowing *when* it's worth the extra cost is a senior-level distinction interviewers probe for.

## The mechanism / how it works

The insight: **sentences about the same topic have similar embeddings; a topic change shows up as a sudden drop in similarity between consecutive sentences.** So:

1. Split the document into sentences.
2. **Embed each sentence** (often with a small sliding group of neighbors to smooth noise).
3. Walk sentence-to-sentence and measure the **similarity** (or distance) between each pair.
4. When similarity **drops past a threshold** — a semantic "seam" — start a new chunk there.

The result is variable-length chunks whose boundaries land exactly where the subject shifts.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Sentences</span>
    <span class="darr">→</span>
    <span class="dbox purple">🔢 Embed each</span>
    <span class="darr">→</span>
    <span class="dbox orange">Compare neighbors<span class="sub">similarity</span></span>
    <span class="darr">→<span class="lbl">big drop = seam</span></span>
    <span class="dbox green">✂️ Cut at topic shift</span>
  </div>
  <div class="dcap">Break where consecutive sentences stop being similar — a topic change.</div>
</div>

**The threshold** is the key knob. LangChain's `SemanticChunker` sets it from the distribution of gaps, using `breakpoint_threshold_type`: `"percentile"` (break at the 95th-percentile biggest gaps — the default), `"standard_deviation"`, `"interquartile"`, or `"gradient"`. Lower percentile = more, smaller chunks; higher = fewer, larger chunks.

**The cost.** This is far more expensive than recursive: you make an **embedding API call for every sentence** at ingestion time, not just once per chunk. Over a big corpus that's real money and real latency. That's why it's an *upgrade*, not a default.

## Concrete example

```python
# pip install langchain-experimental langchain-openai
# Note: SemanticChunker lives in langchain-experimental and is still marked
# experimental — the API can shift and it may pin older langchain-core versions.
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

text = open("research_note.txt").read()

chunker = SemanticChunker(
    OpenAIEmbeddings(model="text-embedding-3-small"),
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,   # break at the largest 5% of gaps
)
docs = chunker.create_documents([text])

print(f"{len(docs)} semantic chunks")
for d in docs[:2]:
    print("---", d.page_content[:100], "...")
```

Notice the chunks come out **uneven** — a tightly-focused section stays whole even if long; a section that jumps topics gets split into several. That variability is the *point*.

## How a company uses this

A Dubai healthcare or research firm indexing long clinical papers and mixed-topic reports uses semantic chunking so a "methods" passage never bleeds into "results" within one chunk. When a doctor asks about dosage, the retrieved chunk is *purely* about dosage — no diluted vector, no off-topic sentences padding the prompt. They accept the higher ingestion cost because retrieval precision on dense, high-stakes documents is worth far more than the embedding bill. For their high-churn FAQ, though, they stick with recursive.

## Common mistakes / misconceptions

- **Using it as the default.** The per-sentence embedding cost rarely pays off for short or uniform documents. Start with **Recursive Chunking**; upgrade only when measured retrieval quality demands it.
- **Ignoring chunk-size blowups.** A long on-topic section can produce a huge chunk that overflows your embedding/context limit. Cap max size as a safety net.
- **Expecting magic on messy input.** Garbled OCR or heavy tables confuse sentence embeddings and produce nonsense seams. Clean parsing first.
- **Confusing it with the LLM's semantics.** The "meaning" here is just embedding similarity, a statistical proxy — not deep comprehension.

## Interview tip

Frame it as a *cost-aware upgrade*: *"Semantic chunking uses embedding similarity between sentences to cut at topic changes, so each chunk is single-topic and embeds cleanly. But it costs an embedding call per sentence at ingestion, so I only reach for it when recursive chunking measurably mixes topics and hurts answers."* Naming both the mechanism *and* the reason it's not your default is exactly the trade-off judgment interviewers want.
