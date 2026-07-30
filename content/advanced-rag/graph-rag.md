# Graph RAG

**What it is:** Instead of retrieving the top-k text chunks that are *similar* to your question, Graph RAG retrieves *connected facts* — it walks a graph of entities and relationships to answer questions where the answer is a **chain of links**, not a single passage.

## Why it matters for an AI Engineer

Plain vector RAG (see [../rag-architecture.md](../rag-architecture.md)) is great at *"find the paragraph that mentions X."* It's terrible at two things real users ask constantly:

1. **Multi-hop questions** — *"Who is the manager of the person who signed contract #4?"* The answer spans three facts that live in three different chunks. Vector search retrieves each chunk in isolation and the model has to guess how they connect — or it never retrieves all three at once.
2. **Global / "sense-making" questions** — *"What are the main themes across these 500 support tickets?"* No single chunk contains the theme. Similarity search can't summarize a whole corpus; it just returns 5 tickets.

Graph RAG fixes both by giving retrieval a *structure to traverse*. For an AI Engineer, this is the difference between a chatbot that answers lookup questions and one that answers *analytical* questions — the kind decision-makers actually pay for.

## The mechanism / how it works

Graph RAG has two phases, mirroring the ingest/query split of ordinary RAG.

**① Build the graph (offline).** You run each document through an LLM to extract **entities** (nodes) and **relationships** (edges). "Acme Corp signed a contract with Beta LLC, managed by Sara Ali" becomes three nodes and two typed edges. This entity-and-relationship store *is* a [knowledge graph](knowledge-graphs.md) — that tile covers how to build and store it. Optionally, you also cluster the graph into communities and pre-write a summary of each cluster (this is what Microsoft's **GraphRAG** does, and it's what powers global "what are the themes" questions).

**② Retrieve by traversal (at query time).** Given a question, you find the entry-point nodes (often via vector search on node names/descriptions), then **walk the edges** — one hop, two hops, three — collecting the connected facts. You hand that subgraph (as text) to the LLM instead of a bag of loose chunks.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ "Manager of whoever signed contract #4?"</span>
    <span class="darr">↓<span class="lbl">find entry node</span></span>
    <span class="dbox orange">📍 Contract #4</span>
    <span class="darr">↓<span class="lbl">hop: signed_by</span></span>
    <span class="dbox orange">👤 Sara Ali</span>
    <span class="darr">↓<span class="lbl">hop: managed_by</span></span>
    <span class="dbox blue">👤 Omar Khan</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ "Omar Khan"</span>
  </div>
  <div class="dcap">Graph RAG walks typed edges across documents — each hop is a fact vector search would have retrieved separately, if at all.</div>
</div>

The key insight: **similarity finds *related* text; traversal finds *connected* facts.** A two-hop question is trivial for a graph and nearly impossible for flat top-k retrieval.

## A concrete example

Using Neo4j (the most common graph DB in 2026) with LangChain's graph retriever. This answers a multi-hop question by generating a graph query:

```python
from langchain_neo4j import Neo4jGraph, GraphCypherQAChain
from langchain_openai import ChatOpenAI

graph = Neo4jGraph(
    url="neo4j+s://xxxx.databases.neo4j.io",
    username="neo4j",
    password="…",
)

# The chain turns a natural-language question into a Cypher graph query,
# runs it against the graph, and phrases the result in words.
chain = GraphCypherQAChain.from_llm(
    llm=ChatOpenAI(model="gpt-4o", temperature=0),
    graph=graph,
    allow_dangerous_requests=True,  # required: the LLM writes read queries
    verbose=True,
)

print(chain.invoke({"query":
    "Who manages the person who signed contract #4?"}))
```

Under the hood the LLM emits Cypher like `MATCH (:Contract {id:4})<-[:SIGNED]-(p)-[:MANAGED_BY]->(m) RETURN m.name` — a two-hop traversal expressed in one query. No amount of chunk similarity gets you that.

For *global* questions (themes, summaries), you instead use Microsoft's `graphrag` library, which pre-computes community summaries and answers by aggregating them — a "global search."

## How a company uses this

A **Dubai bank's** compliance team asked *"which of our corporate clients share a beneficial owner?"* — a classic multi-hop relationship question buried across thousands of KYC documents. Vector RAG returned individual client files and the model couldn't connect them. A Graph RAG system extracted `Company —OWNED_BY→ Person` edges into Neo4j; the query became a single traversal finding shared owners, surfacing hidden ownership circles for fraud review. The graph did in one query what analysts did in weeks.

## Common mistakes / misconceptions

- **"Graph RAG replaces vector RAG."** No — most production systems are *hybrid*: vector search to find entry nodes, then graph traversal from there. Keep both.
- **Extracting a messy graph.** Garbage entities in = garbage traversal out. Constrain the LLM to a fixed schema of allowed node/edge types (covered in [knowledge-graphs.md](knowledge-graphs.md)).
- **Using it for everything.** Simple lookup questions don't need a graph and traversal adds latency. Route only multi-hop/global questions to Graph RAG.

## Interview tip
Say: *"Graph RAG shines on multi-hop and global questions where the answer is a chain of relationships across documents, not a single similar passage. I extract entities and typed edges into a graph store like Neo4j, then retrieve by traversal — vector search to find entry nodes, graph hops to connect facts — while still using plain vector RAG for simple lookups."* That signals you know *when* the extra machinery earns its keep.
