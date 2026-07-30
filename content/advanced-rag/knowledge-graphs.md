# Knowledge Graphs

**What it is:** A knowledge graph is a way of storing facts as **things and the relationships between them** — nodes (entities like *Sara*, *Acme Corp*, *Contract #4*) joined by labelled edges (*Sara —WORKS_AT→ Acme Corp*). It's the structured store that [Graph RAG](graph-rag.md) retrieves from.

## Why it matters for an AI Engineer

Text chunks in a vector index are *isolated islands* — each one knows nothing about the others. But a huge amount of business knowledge *is* the connections: who reports to whom, which part goes in which product, which clause overrides which. If you only store text, the LLM has to rediscover those relationships from scratch on every query, and it often gets them wrong.

A knowledge graph stores the relationships **explicitly and permanently**. Once *"Building C —MANAGED_BY→ FM-Co"* is an edge, every query can use it instantly and correctly. For an AI Engineer, knowing how to *build* one from messy documents is the prerequisite skill for Graph RAG — the graph is the data, Graph RAG is the query engine.

## The mechanism / how it works

A knowledge graph has three ingredients:

- **Nodes (entities):** the "things" — `Person`, `Company`, `Contract`, `Building`. Each has properties (`name`, `date`).
- **Edges (relationships):** typed, directional links — `SIGNED`, `MANAGED_BY`, `OWNS`. The *type* carries meaning.
- **Schema (the ontology):** the allowed node types and edge types. This is the guardrail that keeps extraction clean.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🏢 Acme Corp</span>
    <span class="darr">→<span class="lbl">SIGNED</span></span>
    <span class="dbox orange">📄 Contract #4</span>
    <span class="darr">→<span class="lbl">SIGNED_BY</span></span>
    <span class="dbox blue">👤 Sara Ali</span>
    <span class="darr">→<span class="lbl">WORKS_AT</span></span>
    <span class="dbox blue">🏢 Acme Corp</span>
  </div>
  <div class="dcap">Nodes = things, edges = typed relationships. The edge labels are where the meaning lives.</div>
</div>

**Building one from documents (2026 workflow):** you don't hand-draw it. You use an LLM to read each document and extract nodes and edges *against a schema you define*. The schema is the crucial part — without it the LLM invents inconsistent labels (`WORKS_AT`, `employed by`, `staff of` for the same relationship) and the graph becomes un-queryable. You then load the extracted triples into a graph database (**Neo4j** is the default; alternatives are Amazon Neptune or Postgres with the Apache AGE extension).

You store the graph *alongside* your vector index, not instead of it: vectors for "find similar text," the graph for "follow the relationships." This pairs directly with [../embeddings-indexing.md](../embeddings-indexing.md) and the retrieval strategies in [../retrieval/](../retrieval/).

## A concrete example

LangChain's `LLMGraphTransformer` extracts a schema-constrained graph and writes it to Neo4j:

```python
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_neo4j import Neo4jGraph
from langchain_openai import ChatOpenAI
from langchain_core.documents import Document

# Constrain the schema — this is what keeps the graph clean and queryable.
transformer = LLMGraphTransformer(
    llm=ChatOpenAI(model="gpt-4o", temperature=0),
    allowed_nodes=["Person", "Company", "Contract"],
    allowed_relationships=["SIGNED", "SIGNED_BY", "WORKS_AT"],
)

doc = Document(page_content=(
    "Contract #4 was signed by Acme Corp and signed by Sara Ali, "
    "who works at Acme Corp."
))
graph_docs = transformer.convert_to_graph_documents([doc])

for node in graph_docs[0].nodes:
    print(node.id, "→", node.type)
# Sara Ali → Person   Acme Corp → Company   Contract #4 → Contract

# Persist to Neo4j so Graph RAG can traverse it later:
graph = Neo4jGraph(url="neo4j+s://…", username="neo4j", password="…")
graph.add_graph_documents(graph_docs)
```

The `allowed_nodes` / `allowed_relationships` lists are the difference between a usable graph and noise. Always constrain them.

## How a company uses this

A **Dubai logistics firm** stored every shipment, customs document, and carrier contract as flat PDFs. Answering *"which carriers handle shipments for clients in the free zone?"* meant an analyst opening dozens of files. They extracted a knowledge graph — `Client —SHIPS_WITH→ Carrier`, `Shipment —CLEARED_UNDER→ CustomsDoc` — into Neo4j. Now the relationship is a stored edge, queried in milliseconds, and their Graph RAG assistant answers ownership and routing questions that were previously human-only work.

## Common mistakes / misconceptions

- **No schema.** The single biggest failure. Without `allowed_nodes`/`allowed_relationships` the LLM emits inconsistent labels and duplicate nodes ("IBM", "I.B.M.", "ibm"). Constrain the schema and normalize entity names.
- **Confusing a knowledge graph with a vector DB.** They solve different problems. A vector DB finds *similar* text; a knowledge graph stores *exact relationships*. Production systems use both.
- **Trying to graph everything.** Only entities whose *relationships* matter belong in the graph. Free-form prose still lives in your vector index.

## Interview tip
Say: *"A knowledge graph stores facts as typed nodes and edges, so relationships are explicit and permanent instead of rediscovered per query. I build one by LLM-extracting entities and relationships against a fixed schema — the schema is what keeps it queryable — and load it into Neo4j alongside my vector index. Vectors for similarity, the graph for relationships; Graph RAG queries the graph."* That shows you understand the graph as *data infrastructure*, not a gimmick.
