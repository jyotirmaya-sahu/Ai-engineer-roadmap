# HyDE (Hypothetical Document Embeddings)

**The one-line idea:** HyDE asks an LLM to **write a fake, made-up answer** to the question first, then searches with *that answer's* embedding instead of the question's — because an answer looks far more like the real document than a question does.

## Why it matters for an AI Engineer

Dense retrieval has a subtle mismatch: **questions and answers are written differently.** A question is short and interrogative ("What's the leave policy for new joiners?"); the document is declarative and detailed ("Employees in their first six months accrue leave at..."). Their embeddings can sit surprisingly far apart. HyDE closes that gap by turning the query into something *shaped like a document* before searching. It's a clever, well-known query-transformation trick that shines on sparse or specialized corpora, and knowing it — plus its main risk — signals you've read past the basics.

## The mechanism — how it works

Three steps:

1. **Hallucinate an answer.** Send the question to an LLM: *"Write a short passage that answers this question."* The model produces a plausible **hypothetical document** — it may be factually wrong, and that's *fine*, because you never show it to the user.
2. **Embed the hypothetical answer** (not the question) and use *that* vector to search the store.
3. **Retrieve real chunks** nearest to it. Since the fake answer mimics the *style, vocabulary, and structure* of a real answer, its embedding lands in the right neighborhood — right next to the *actual* documents that answer the question.

The trick: you're matching **answer-to-answer** (fake answer ↔ real chunks) instead of **question-to-answer**, and answer-to-answer similarity is far tighter. The hypothetical doc's *facts* don't matter; its *shape* does.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ question</span>
    <span class="darr">→<span class="lbl">LLM writes fake answer</span></span>
    <span class="dbox purple">📝 hypothetical doc<span class="sub">maybe wrong — fine</span></span>
    <span class="darr">→<span class="lbl">embed & search</span></span>
    <span class="dbox blue">🗄️ store</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ real matching chunks</span>
  </div>
  <div class="dcap">Search with an answer-shaped vector, not a question-shaped one — answer-to-answer matches tighter.</div>
</div>

## Concrete example

HyDE by hand — it's just an LLM call plus your normal retriever:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
question = "What is the leave policy for employees in their first six months?"

# 1. generate a hypothetical answer (facts may be invented — we don't care)
hypo = llm.invoke(
    f"Write a short factual paragraph answering: {question}"
).content

# 2. retrieve using the hypothetical ANSWER's embedding, not the question's
docs = store.as_retriever(search_kwargs={"k": 4}).invoke(hypo)

# 3. now feed the REAL retrieved docs (not the hypo) to the LLM to answer for real
```

The `hypo` text might state a wrong number of days — irrelevant. Its embedding still lands next to the real policy chunk because it *reads like a policy paragraph*.

## How a company uses this

A **Dubai medical clinic** built a RAG over clinical guideline PDFs. Doctors typed terse questions ("first-line meds for pediatric asthma?") that looked nothing like the dense, prose-heavy guideline text, so plain vector search underperformed. **HyDE** — generate a paragraph-style hypothetical guideline answer, then search with it — pulled the correct guideline sections far more reliably, because the fake answer matched the guidelines' style.

## Common mistakes / misconceptions

- **Fearing the hallucination.** The point is the *shape*, not the facts. You throw the fake answer away after searching and answer for real from the retrieved chunks.
- **Using it everywhere.** HyDE adds an LLM call (latency + cost) to every query. On well-matched corpora it barely helps and can even hurt if the hypothetical drifts off-topic. Reach for it on sparse/specialized corpora where question and answer styles diverge.
- **Letting the fake answer reach the user.** Never. It's an internal search key only.
- **Confusing it with multi-query.** Multi-query rephrases the *question*; HyDE fabricates an *answer* to search with. Different mechanisms.

## Interview tip
Say: *"HyDE generates a hypothetical answer with an LLM, embeds *that* instead of the question, and searches with it — because answer-to-answer similarity is tighter than question-to-answer. The hypothetical can be factually wrong; only its style matters, and it never reaches the user. I use it on specialized corpora where questions look nothing like the documents, accepting the extra LLM call."* Stressing "facts don't matter, shape does" shows you actually understand *why* it works.

See also: **Multi-Query Retrieval**, **Query Expansion**, and **Dense Retrieval** (the question-answer gap HyDE closes).
