# Query Decomposition

**The one-line idea:** Query decomposition **splits a complex, multi-part question into several simple sub-questions**, retrieves for each one separately, and combines the pieces — so "compare the 2024 and 2025 leave policies" doesn't get answered by a single muddled search.

## Why it matters for an AI Engineer

Some questions ask for **two or more things at once**, and a single query vector can't be near *all* of them. "Compare X and Y" sits *between* X and Y in embedding space and matches *neither* well. "What's the fee **and** the notice period **and** are there exceptions?" needs chunks from three different places. Decomposition is the fix for these **multi-hop / multi-part** questions — a core query-transformation skill, and increasingly the bridge between plain RAG and agentic retrieval. When a question needs information from several documents, this is the technique you name.

## The mechanism — how it works

1. **Detect & split.** An LLM breaks the question into independent sub-questions:
   - "Compare 2024 and 2025 leave policies" → ["What was the 2024 leave policy?", "What was the 2025 leave policy?"]
   - "What's the fee and notice period to close an account?" → ["What is the account closing fee?", "What is the notice period to close an account?"]
2. **Retrieve per sub-question.** Each sub-question runs its own search, landing in the *right* neighborhood for *that* part. The 2024 query finds 2024 docs; the 2025 query finds 2025 docs.
3. **Combine.** Merge all retrieved chunks into one context, and let the LLM synthesize the final answer using all the pieces.

For **multi-hop** questions where step 2 depends on step 1's answer ("What's the leave policy in the *country where our HQ is*?" — first find the HQ country, *then* look up its policy), decomposition becomes **sequential**: answer sub-question 1, feed its answer into sub-question 2. That's the seed of agentic RAG.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ "compare 2024 vs 2025 leave policy"</span>
    <span class="darr">↓<span class="lbl">LLM splits</span></span>
    <div class="flow">
      <span class="dbox orange">🔍 "2024 leave policy?"</span>
      <span class="dbox orange">🔍 "2025 leave policy?"</span>
    </div>
    <span class="darr">↓<span class="lbl">retrieve each, then synthesize</span></span>
    <span class="dbox green">✅ side-by-side comparison</span>
  </div>
  <div class="dcap">Each sub-question searches its own neighborhood; the LLM combines the parts into one answer.</div>
</div>

## Concrete example

Decompose, retrieve per part, then answer from the union:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
retriever = store.as_retriever(search_kwargs={"k": 3})

question = "Compare the 2024 and 2025 annual leave policies."

# 1. split into sub-questions (one per line)
subs = llm.invoke(
    f"Break this into simple standalone sub-questions, one per line:\n{question}"
).content.strip().splitlines()
# -> ["What was the 2024 annual leave policy?", "What was the 2025 annual leave policy?"]

# 2. retrieve for each sub-question, pool the context
context = []
for s in subs:
    context += [d.page_content for d in retriever.invoke(s)]

# 3. synthesize the final answer from all retrieved pieces
answer = llm.invoke(
    f"Using this context, answer: {question}\n\nContext:\n" + "\n---\n".join(context)
).content
```

A single search for the original comparison question would have returned a mush of both years mixed together; per-sub-question retrieval gets clean, complete evidence for each side.

## How a company uses this

A **Dubai holding company** with subsidiaries in banking, retail, and logistics runs an internal RAG. Executives ask cross-cutting questions like "*how did headcount and revenue change across all three divisions last year?*" Decomposition splits this into per-division, per-metric sub-questions, retrieves each from the right subsidiary's documents, and the LLM assembles the comparison — something a single query could never retrieve completely.

## Common mistakes / misconceptions

- **Applying it to simple questions.** A single-fact question needs no splitting — decomposition just adds LLM calls and latency. Detect complexity first, or only split when the question clearly has multiple parts.
- **Missing dependencies.** Some sub-questions must run *in order* (multi-hop). Running them in parallel when step 2 needs step 1's answer produces wrong results.
- **Confusing it with multi-query.** Multi-query makes *rephrasings of the same* question for recall; decomposition makes *different sub-questions* for *different parts*. Different goals.
- **Not deduping / over-stuffing context.** Pooled chunks can be redundant or blow the budget — dedupe, and consider reranking the pool.

## Interview tip
Say: *"Query decomposition splits a multi-part or multi-hop question into standalone sub-questions, retrieves for each, and lets the LLM synthesize — because a 'compare X and Y' query sits between X and Y and matches neither. For multi-hop I run sub-questions sequentially, feeding one answer into the next, which is basically where RAG starts becoming agentic. I only decompose genuinely complex questions to avoid needless LLM calls."* The multi-hop / agentic connection is a strong signal.

See also: **Multi-Query Retrieval**, **Query Expansion**, and **Reranking** (to clean the pooled results).
