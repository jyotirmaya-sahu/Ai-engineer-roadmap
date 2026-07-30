# Multi-Query Retrieval

**The one-line idea:** Multi-query uses an LLM to **rewrite the user's question several different ways**, runs a search for each version, and merges the results — so a vaguely-worded question still catches the chunks it would have missed with a single phrasing.

## Why it matters for an AI Engineer

A single query is a single point in embedding space — if the user phrased it awkwardly, that point lands in the wrong neighborhood and misses relevant chunks that used different wording. Multi-query is the cheapest fix for **recall** problems caused by *phrasing*, not by the corpus. It's a first-line query-transformation technique (built into LangChain as `MultiQueryRetriever`), and it pairs naturally with everything downstream. When someone asks "the bot misses obvious answers when users phrase things weirdly," this is the fix you name.

## The mechanism — how it works

Four steps:

1. **Generate variations.** Send the original question to a cheap/fast LLM with a prompt like *"Give 3 alternative phrasings of this question."* "How do I cancel?" becomes: "How do I terminate my subscription?", "What's the process to end my plan?", "Steps to close my account?"
2. **Search each variation** independently against the vector store — each phrasing lands in a slightly different spot, so together they cover more ground.
3. **Merge and dedupe** all the returned chunks into one pool (a chunk found by multiple variations is a strong signal).
4. **(Optional) rerank** the merged pool down to the final k.

The insight: different wordings retrieve *overlapping but not identical* chunk sets. The union has higher recall than any single query — you've cast several nets instead of one.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ original question</span>
    <span class="darr">↓<span class="lbl">LLM rewrites ×3</span></span>
    <div class="flow">
      <span class="dbox orange">🔍 phrasing 1</span>
      <span class="dbox orange">🔍 phrasing 2</span>
      <span class="dbox orange">🔍 phrasing 3</span>
    </div>
    <span class="darr">↓<span class="lbl">merge + dedupe</span></span>
    <span class="dbox green">✅ union of chunks<span class="sub">higher recall</span></span>
  </div>
  <div class="dcap">Several phrasings search several neighborhoods; their union catches what one phrasing misses.</div>
</div>

## Concrete example

LangChain's `MultiQueryRetriever` does all four steps for you:

```python
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_openai import ChatOpenAI

base = store.as_retriever(search_kwargs={"k": 4})
mqr = MultiQueryRetriever.from_llm(
    retriever=base,
    llm=ChatOpenAI(model="gpt-4o-mini", temperature=0),  # cheap model for rewrites
)

docs = mqr.invoke("how do I stop paying for this?")
# The LLM generates e.g.:
#   "How do I cancel my subscription?"
#   "What are the steps to end my paid plan?"
#   "How do I turn off recurring billing?"
# Each is searched; results are merged & deduped -> broader, more reliable recall.
```

One vague query ("stop paying") that might miss the "cancel subscription" chunk now hits it via a reworded variation.

## How a company uses this

A **Dubai government e-services** portal gets questions in wildly inconsistent wording ("renew my visa," "extend residency," "get my Emirates ID redone"). Multi-query rewrites each into several canonical phrasings before search, so citizens' casual language still retrieves the correctly-titled official procedure — a big recall win over single-query search on formal government documents.

## Common mistakes / misconceptions

- **Confusing it with query expansion or decomposition.** Multi-query makes *whole rephrasings* of the *same* question. **Expansion** adds synonyms/terms to one query. **Decomposition** splits a *multi-part* question into different sub-questions. Different problems.
- **Too many variations.** 3–5 is plenty. Each adds a search (latency) and the LLM call adds cost — more isn't better.
- **Forgetting to dedupe.** Overlapping results will repeat; dedupe before sending to the LLM or you waste context.
- **Using an expensive LLM for rewrites.** The rewrite is trivial — use a small fast model to keep cost and latency low.

## Interview tip
Say: *"Multi-query uses an LLM to generate a few alternative phrasings of the question, searches each, and merges the results for higher recall — it's the fix when users phrase things inconsistently and a single query lands in the wrong part of embedding space. I keep it to 3–5 rewrites with a cheap model, dedupe, and often rerank the merged pool."* Cleanly separating it from expansion and decomposition shows you know the query-transformation family.

See also: **Query Expansion**, **Query Decomposition**, **HyDE**, and **Reranking** (to trim the merged pool).
