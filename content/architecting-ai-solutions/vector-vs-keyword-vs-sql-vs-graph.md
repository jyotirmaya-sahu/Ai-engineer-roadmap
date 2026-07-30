# Vector vs keyword vs SQL vs graph

**What it is:** the decision of *where to store your data and how to fetch it* — because the shape of your query, not fashion, decides whether you reach for a vector DB, keyword search, a SQL database, or a graph.

## Why it matters for an AI Engineer

Every RAG-happy engineer's reflex is "embed everything into a vector DB." But vector search answers *one* kind of question well — "find text that *means* something similar" — and is the *wrong* tool for exact lookups, aggregations, and relationship traversals. Pick the wrong store and you get slow, wrong, or absurdly expensive retrieval: a vector search to find "order #4432" (an exact key lookup a SQL `WHERE` does in a millisecond) is both slower and less reliable. Matching the store to the query shape is a core architecture skill and a frequent interview probe.

## The mechanism: four stores, four query shapes

Each store is built for a different *kind* of question:

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧲 Vector<span class="sub">"means similar"</span></span>
    <span class="dbox blue">🔤 Keyword<span class="sub">"contains this word"</span></span>
    <span class="dbox green">🗃️ SQL<span class="sub">"exact + aggregate"</span></span>
    <span class="dbox orange">🕸️ Graph<span class="sub">"how are these related"</span></span>
  </div>
  <div class="dcap">Pick the store by the question's shape, not by what's trendy.</div>
</div>

- **Vector (semantic) search** — embeds text into vectors; finds items *close in meaning* even with no shared words ("annual leave" matches "vacation days"). Best for: fuzzy, natural-language retrieval over unstructured text — the "R" in RAG. Weak at: exact matches, numbers, "must contain this exact code."
- **Keyword / full-text search (BM25)** — matches exact terms and rare tokens. Best for: exact identifiers, product codes, names, acronyms, legal citations — anything where the *literal* word matters. A vector might "semantically" miss the exact SKU "AE-2291"; BM25 nails it. In practice you combine vector + keyword = **hybrid search**, which beats either alone.
- **SQL / relational** — structured rows and columns. Best for: exact lookups (`WHERE order_id = 4432`), filters, and **aggregations** ("total revenue in Dubai last quarter") — things an LLM cannot compute by reading text. If your data is already tabular, don't embed it; *query* it. The LLM's job is to write the SQL (text-to-SQL), not to memorize the table.
- **Graph** — nodes and edges. Best for: **relationship traversal** — "who reports to whom," "which suppliers connect to this delayed shipment two hops out," "what's related to X *through* Y." Questions about *connections* that would be a nightmare of SQL joins are a natural graph query. Powers GraphRAG for multi-hop reasoning.

| Store | Answers | Reach for it when | Weak at |
|---|---|---|---|
| **Vector** | "similar in meaning" | fuzzy search over text | exact codes, numbers, aggregation |
| **Keyword** | "contains this term" | exact IDs, names, rare tokens | synonyms / paraphrase |
| **SQL** | "exact match + aggregate" | structured data, math, filters | fuzzy text meaning |
| **Graph** | "how X connects to Y" | multi-hop relationships | bulk text search |

**The senior move:** a real system often uses *several* — SQL for structured facts, vector+keyword hybrid for docs, sometimes a graph for relationships — routed by a tool-calling layer that picks the right store per question.

## Worked example: routing by query shape

```python
# The LLM picks the store via tool-calling — each question goes where it belongs
tools = [
  {"name": "sql_query",     "desc": "orders, revenue, exact IDs, totals, filters"},
  {"name": "vector_search", "desc": "policy/FAQ questions in natural language"},
  {"name": "graph_query",   "desc": "supplier/shipment relationships, multi-hop"},
]
# "What's our total Dubai revenue this month?"     -> sql_query   (aggregation)
# "What's the refund policy for damaged goods?"    -> vector_search (fuzzy text)
# "Which suppliers feed the delayed KSA route?"    -> graph_query  (relationships)
```

Forcing all three through a vector DB would return fuzzy, wrong answers for the first and third — the aggregation and the traversal simply aren't what embeddings do.

## How a company uses this

> **A Dubai supply-chain platform.** Early version embedded *everything* — orders, policies, supplier records — into one vector DB "for RAG." It failed on the two most important questions: "total late shipments this week" (an aggregation vectors can't do — it returned semantically-similar-but-wrong rows) and "which suppliers are two hops from this port closure" (a relationship query). The rebuild split it: **SQL** for the orders table (exact + aggregate, millisecond lookups over 20M rows), a **Neo4j graph** for supplier→route→port relationships (multi-hop in one query vs a 5-table join), and **hybrid vector+keyword** only for the unstructured policy PDFs. A tool-calling router sends each question to the right engine. Retrieval accuracy jumped and cost dropped, because most queries now hit a cheap indexed SQL lookup instead of an embedding search.

## Common mistakes
- **Vector DB for everything.** The dominant error. Embeddings are for *meaning*, not exact IDs, numbers, or relationships.
- **Vector search for exact identifiers.** "Find SKU AE-2291" should be keyword/SQL, not semantic — embeddings blur exact tokens.
- **Making the LLM do aggregation over text.** Asking a model to "sum the revenue in these 200 rows" is slow and error-prone. Put it in SQL and run `SUM()`.
- **Skipping hybrid search.** Pure vector misses exact terms; pure keyword misses synonyms. Combining them is nearly free accuracy.
- **Reaching for a graph too early.** Graphs shine for genuine multi-hop relationships; for flat data they're overkill. Use one when connections *are* the question.

## Interview tip
Say: *"I choose the store by the query's shape. Meaning-based text search → vector, usually hybrid with keyword so exact codes still hit. Exact lookups, filters, and aggregations → SQL; I'd never make the model sum numbers it reads. Multi-hop relationship questions → a graph. Real systems use several behind a tool-calling router. The anti-pattern I avoid is embedding everything into a vector DB and then wondering why 'total revenue' comes back wrong."* This shows you understand retrieval as a data-modeling decision, not a reflex. See also [structured output vs tool-calling vs text](structured-output-vs-tool-calling-vs-text.md) for how the router actually picks.
