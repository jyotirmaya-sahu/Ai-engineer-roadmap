# Query Expansion

**The one-line idea:** Query expansion **adds extra terms** — synonyms, acronym expansions, related words — to the user's query before searching, so a short or jargon-heavy question matches documents that use different vocabulary for the same thing.

## Why it matters for an AI Engineer

Short queries and domain jargon are a recall killer. A user types "**PTO**" but the handbook says "**paid time off**"; someone searches "**AC**" but the manual says "**air conditioning**." The overlap is thin and retrieval misses. Query expansion bridges that vocabulary gap — it's a lightweight, high-ROI query transformation, especially in specialized domains (medical, legal, finance) thick with acronyms and synonyms. It's the natural fix when your bot fails on terse or abbreviation-heavy queries, and it's cheap enough to apply broadly.

## The mechanism — how it works

You enrich the query with related terms *before* it hits the retriever. Two flavors:

**1. LLM-based expansion (modern default).** Ask a small LLM: *"Add synonyms, expand acronyms, and list related terms for this query."* "PTO policy" → "PTO paid time off vacation leave annual leave time-off policy." The enriched query now overlaps far more documents. The LLM understands *context* — it expands "AC" to "air conditioning" in an HVAC doc, not "alternating current."

**2. Classic thesaurus / lexical expansion.** Use a synonym dictionary (e.g. WordNet) or domain glossary to append known synonyms. No LLM needed, fully deterministic, but context-blind — it can add the *wrong* sense of an ambiguous word.

The added terms matter most for **sparse/keyword search** (more terms = more overlap) but also nudge dense search by enriching the query's meaning. Key difference from multi-query: expansion produces **one richer query**; multi-query produces **several separate queries**.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ "PTO policy"</span>
    <span class="darr">→<span class="lbl">expand</span></span>
    <span class="dbox orange">➕ "PTO paid time off vacation leave annual leave"</span>
    <span class="darr">→<span class="lbl">search</span></span>
    <span class="dbox green">✅ matches "paid time off" doc</span>
  </div>
  <div class="dcap">Adding synonyms and expanded acronyms widens term overlap so different vocabulary still matches.</div>
</div>

## Concrete example

LLM-based expansion, then search the enriched query:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
query = "PTO policy for new joiners"

expanded = llm.invoke(
    f"Rewrite this search query, expanding acronyms and adding synonyms "
    f"and closely related terms. Return only the expanded query:\n{query}"
).content
# -> "PTO paid time off vacation annual leave holiday allowance policy for new joiners new hires employees"

docs = store.as_retriever(search_kwargs={"k": 4}).invoke(expanded)
# now matches chunks that say "paid time off" / "annual leave" / "new hires"
```

The original three-word query would have missed a chunk titled "Annual Leave for New Hires"; the expanded version catches it.

## How a company uses this

A **Dubai hospital**'s internal RAG serves clinicians who type abbreviations constantly ("**MI**," "**BP meds**," "**PRN**"). Query expansion expands each — "MI" → "myocardial infarction heart attack" — before searching the clinical guidelines, which are written out in full. Without expansion, terse clinical shorthand missed the very documents it referred to.

## Common mistakes / misconceptions

- **Over-expanding.** Piling on loosely-related terms dilutes the query and drags in off-topic chunks (query drift). Keep expansions tight and relevant.
- **Context-blind thesaurus expansion.** Adding the wrong sense of a homonym ("bank" the finance vs. the river) hurts. LLM expansion is safer because it reads context.
- **Confusing it with multi-query.** Expansion = *one enriched query*; multi-query = *several full rephrasings searched separately*. Related family, different mechanics.
- **Ignoring domain glossaries.** For a fixed domain, a curated acronym/synonym list is cheaper and more reliable than an LLM for the known terms — combine them.

## Interview tip
Say: *"Query expansion enriches a single query with synonyms and expanded acronyms — usually via a small LLM that respects context — so short or jargon-heavy queries match documents that use different wording. It's especially strong for sparse search and acronym-heavy domains. The risk is over-expansion causing query drift, so I keep additions tight, and I distinguish it from multi-query, which fires several separate queries."* Naming the query-drift failure mode shows practical experience.

See also: **Multi-Query Retrieval**, **HyDE**, and **Sparse Retrieval (BM25/TF-IDF)** (which benefits most from added terms).
