# Advanced RAG

**The one-line idea:** Once a plain "chunk → embed → retrieve → answer" RAG works, *Advanced RAG* is the set of upgrades you bolt on when that naive pipeline starts failing on the hard cases — questions that span many documents, knowledge that lives in tables and images, answers the model gets *confidently wrong*, and traffic that's too slow or too expensive at production scale.

## Why this node exists

Naive RAG (see [RAG Architecture](rag-architecture.md)) is a straight line: embed the question, pull the top-k similar chunks, stuff them in the prompt, generate. It works great in demos. Then real users arrive and it breaks in predictable ways:

- *"Which of our suppliers are also our customers?"* — the answer isn't in any single chunk; it's a **relationship** spread across many documents.
- *"What does the error dialog in the screenshot mean?"* — the knowledge is a **picture**, and a text-only embedder can't see it.
- The model retrieves an irrelevant chunk and **answers anyway**, hallucinating with a citation attached — worse than saying "I don't know."
- The app is correct but takes **6 seconds** per answer and re-pays for the same popular question a thousand times a day.

Each of these has a named, well-understood fix. That's what Advanced RAG is: not a rewrite, but four families of upgrades you reach for *by symptom*.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Naive RAG<span class="sub">works in the demo</span></span>
    <span class="darr">→<span class="lbl">hard cases</span></span>
    <span class="dbox purple">🧠 Advanced RAG<span class="sub">upgrades by symptom</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Production-grade<span class="sub">accurate, multimodal, fast</span></span>
  </div>
  <div class="dcap">Advanced RAG = targeted upgrades you add when naive retrieval starts failing.</div>
</div>

## The five upgrades (and when to reach for each)

| Tile | What it adds | Reach for it when… |
|---|---|---|
| **[Graph RAG](advanced-rag/graph-rag.md)** | retrieval over a graph of connected facts, not just a flat vector index | the answer needs to *connect the dots* across many documents ("multi-hop" questions, global summaries) |
| **[Knowledge Graphs](advanced-rag/knowledge-graphs.md)** | the structured entity-and-relationship store that Graph RAG reads from | your domain has clear entities (people, companies, parts, clauses) whose *relationships* carry the meaning |
| **[Multimodal RAG](advanced-rag/multimodal-rag.md)** | retrieval over images, tables, diagrams, and scanned pages — not just text | your knowledge lives in screenshots, charts, PDFs, product photos, or floor plans |
| **[Self-RAG / Corrective RAG](advanced-rag/self-rag-corrective-rag.md)** | a self-checking loop that grades its own retrieval and retries or abstains | the model confidently answers from bad or missing context (hallucination on wrong retrieval) |
| **[Caching & Streaming](advanced-rag/caching-streaming.md)** | semantic caching + token streaming for speed and cost | it's *correct* but too slow or too expensive at real traffic |

The first two go together: **Knowledge Graphs** are the data structure, **Graph RAG** is how you retrieve from it. The last two are orthogonal to *what* you retrieve — **Self-RAG** improves *quality*, **Caching & Streaming** improves *latency and cost*. You rarely need all five at once; you add them one symptom at a time.

## How a company uses this

> **A Dubai real-estate developer** built a RAG assistant over its property portfolio. Naive RAG handled *"what's the service charge for Marina Tower?"* fine. But three questions kept failing, one per upgrade: *"which towers share the same facilities-management contractor?"* needed **Graph RAG** over a **knowledge graph** of building→contractor relationships; *"what's the layout of the 2-bed in Building C?"* needed **Multimodal RAG** to retrieve floor-plan images; and the assistant kept inventing service-charge figures when the right document was missing, which **Corrective RAG** fixed by making it retry or say "not on file." Once accurate, they added **semantic caching** because the top 20 questions were 60% of all traffic — same answer, paid for once. Same corpus, four independent upgrades, each triggered by a specific failure.

## Interview tip
Say: *"Naive RAG is a baseline, not a destination. I upgrade it by symptom — Graph RAG plus a knowledge graph for multi-hop relationship questions, multimodal embeddings when knowledge lives in images or tables, a Corrective/Self-RAG loop that grades retrieval and abstains instead of hallucinating, and semantic caching with streaming for latency and cost. I don't add all of them; I add the one that matches how the system is actually failing."* That shows you treat RAG as an engineering system with distinct failure modes, not a single recipe.

---

*Below: deep-dive articles on each advanced pattern.*
