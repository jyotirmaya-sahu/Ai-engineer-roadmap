# Contextual Compression

**The one-line idea:** Contextual compression **trims each retrieved chunk down to just the sentences that actually answer the query** (and drops chunks that turned out irrelevant) *after* retrieval but *before* the LLM sees them — so you send a few tight, relevant lines instead of several bloated paragraphs.

## Why it matters for an AI Engineer

Retrieved chunks are usually bigger than they need to be — you fetched a 500-token paragraph but only two sentences answer the question. That padding costs money (you pay per token), eats context budget, and *hurts quality*: irrelevant text distracts the LLM and buries the answer in the middle where models pay least attention ("lost in the middle"). Contextual compression is the cleanup step that fixes all three at once — it's a direct lever on **cost, latency, and answer quality**, which is exactly the trio interviewers care about. It's especially valuable with large chunks or large k.

## The mechanism — how it works

It sits *between* the retriever and the LLM: retrieve normally, then **compress the results against the query** before they enter the prompt. "Contextual" = the compression depends on *this specific query*, not a fixed summary. Three common strategies:

- **Extractive filtering:** keep only the sentences/passages in each chunk that are relevant to the query; drop the rest. The kept text is verbatim (good for citations).
- **LLM extraction/summarization:** a cheap LLM reads each chunk *with the query* and returns only the relevant portion, optionally condensed.
- **Whole-document filtering:** score each retrieved chunk against the query and **drop entire chunks** below a relevance threshold — so a chunk that slipped into top-K but doesn't help is removed before it wastes tokens.

Often you combine them: filter out useless chunks, then trim the survivors. (Note: a *reranker* used as a filter is a form of this — reorder *and* discard.)

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">📄 5 big chunks<span class="sub">~2500 tokens, mostly padding</span></span>
    <span class="darr">→<span class="lbl">compress vs query</span></span>
    <span class="dbox green">📄 6 key sentences<span class="sub">~400 tokens, all relevant</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
  </div>
  <div class="dcap">Keep only the query-relevant sentences; cut tokens, cost, and distraction before the LLM.</div>
</div>

## Concrete example

LangChain's `ContextualCompressionRetriever` wraps any base retriever with a compressor:

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_openai import ChatOpenAI

base = store.as_retriever(search_kwargs={"k": 6})  # fetch generously
compressor = LLMChainExtractor.from_llm(
    ChatOpenAI(model="gpt-4o-mini", temperature=0)  # cheap model extracts relevant lines
)

retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base,
)

docs = retriever.invoke("what is the notice period to close a savings account?")
# each returned doc now holds only the sentence(s) about the notice period,
# not the whole surrounding page — far fewer tokens to the final LLM
```

You can also use an `EmbeddingsFilter` (drop chunks below a similarity threshold — no LLM call, near-free) or a `CohereRerank` compressor (rerank *and* keep only top_n).

## How a company uses this

A **Dubai law firm**'s contract assistant retrieved full contract *sections* (long, dense) to answer narrow questions like "what's the governing law?" Sending whole sections was expensive and made answers ramble. Adding **contextual compression** — extract only the governing-law clause from each retrieved section — cut input tokens by ~70% and made answers crisp and directly citable, with no loss of accuracy.

## Common mistakes / misconceptions

- **Compressing away needed context.** Over-aggressive trimming can cut a qualifying condition ("...unless the account is under 6 months old"). Extractive filtering that keeps whole relevant sentences is safer than tight summarization.
- **Using an expensive compressor.** If the compression LLM costs as much as you save, it's pointless — use a cheap model, or a non-LLM `EmbeddingsFilter`.
- **Confusing it with chunking.** Chunking splits documents *offline before storage*; compression trims retrieved results *online per query*. Different stages.
- **Skipping it with big chunks + big k.** That's exactly the case where it pays off most — don't leave the savings on the table.

## Interview tip
Say: *"Contextual compression trims retrieved chunks down to the query-relevant sentences — and drops chunks that don't help — before the LLM sees them. It cuts tokens and cost and improves quality by removing distraction and the lost-in-the-middle effect. I use a cheap extractor or a plain embeddings-similarity filter, and I keep whole relevant sentences so I don't accidentally cut a qualifying condition."* Tying it to cost *and* the lost-in-the-middle quality effect is the strong answer.

See also: **Top-K Selection** (fetch wide, compress after), **Reranking** (compression that also reorders), and the **Chunking** node (the offline counterpart).
