# Vector vs Keyword vs SQL vs Graph — When to Use Which

**The one-line idea:** choose retrieval from the shape of the question: meaning, exact text, structured constraints, or relationships. Production search often combines them.

## Why it matters for an AI Engineer

A vector database is not a universal knowledge layer. Semantic similarity is excellent for paraphrases but weak at exact identifiers, calculations, permissions, and multi-hop relationships. Selecting the wrong retrieval engine creates plausible but incomplete answers.

## The decision map

| Method | Best for | Weak at |
|---|---|---|
| Vector search | concepts, paraphrases, natural-language similarity | exact IDs, exhaustive filtering |
| Keyword/BM25 | names, codes, rare terms, exact phrases | paraphrases and vocabulary mismatch |
| SQL | filters, joins, aggregation, authoritative structured facts | fuzzy unstructured meaning |
| Graph | relationship traversal and multi-hop dependencies | broad passage relevance without another index |

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">Question classifier</span>
    <span class="darr">→</span>
    <span class="dbox blue">Vector · BM25 · SQL · Graph</span>
    <span class="darr">→</span>
    <span class="dbox green">Merge + rerank + authorize</span>
  </div>
</div>

Examples:

- “How can I cancel my residency application?” → vector plus keyword hybrid search over guidance.
- “Find policy `HR-2047`” → keyword search.
- “How many applications failed yesterday by emirate?” → SQL.
- “Which services depend on this database?” → graph traversal.

A simple router can be deterministic before it becomes model-driven:

```python
import re

def route(question: str) -> str:
    if re.search(r"\b[A-Z]{2,}-\d{3,}\b", question):
        return "keyword"
    if any(x in question.lower() for x in ("how many", "average", "between dates")):
        return "sql"
    if any(x in question.lower() for x in ("depends on", "connected to", "owner of")):
        return "graph"
    return "hybrid"
```

For hybrid retrieval, normalize or rank-fuse scores rather than adding raw BM25 and cosine scores, whose scales are unrelated. Reciprocal Rank Fusion is a robust starting point. Apply authorization filters before returning evidence; retrieval relevance never overrides access control.

## How a company uses this

A Dubai operations assistant uses SQL for live application status, BM25 for case numbers, vector search for policy explanations, and a graph for service ownership. The answer composer receives typed evidence with provenance instead of pretending all facts came from interchangeable text chunks.

## Common mistakes

- Embedding IDs, dates, and counts and expecting exact answers.
- Letting an LLM generate unrestricted SQL.
- Building a knowledge graph before a real multi-hop use case exists.
- Combining incomparable scores directly.
- Applying permissions only after retrieval.

## Interview tip

Say: *“I route by query intent: vector for meaning, BM25 for exact terms, SQL for structured truth and aggregation, graph for relationships. For mixed questions I retrieve in parallel, apply security filters, fuse ranks, rerank, and preserve provenance.”*

