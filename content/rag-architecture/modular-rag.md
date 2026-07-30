# Modular RAG

**The one-line idea:** stop thinking of RAG as one fixed pipeline and start thinking of it as **interchangeable Lego blocks** — retrievers, rerankers, query transformers, memory, routers — that you compose, swap, and rearrange for the job, instead of a single hard-wired chain.

## Why it matters for an AI Engineer

Naive and Advanced RAG describe *linear* pipelines: query in, answer out, always the same path. Real products aren't that tidy. One query needs a database lookup, another needs a web search, a third needs the last three turns of conversation. Modular RAG is the architectural mindset — and the term you'll see in the literature (the "Naive → Advanced → Modular" progression from the 2024 RAG survey) — that lets you build systems flexible enough to handle that variety. For your job, this is what separates a script that answers one kind of question from a **platform** that a whole company builds on. Interviewers use "modular RAG" to check whether you think in reusable components or in one giant `def rag()`.

## The mechanism / how it works

Modular RAG breaks the monolithic pipeline into named, swappable **modules**, each with a clean input/output contract. The common ones:

- **Indexing** — how docs are chunked, embedded, and stored (swap FAISS for Pinecone without touching anything else).
- **Retriever** — dense, sparse, hybrid, SQL, or graph. Pluggable.
- **Query transformer** — rewriting, HyDE, decomposition. Optional, chainable.
- **Reranker** — cross-encoder scoring. Drop in or out.
- **Router** — inspects the query and *chooses* which retriever/index to use.
- **Memory** — feeds recent conversation turns back into retrieval.
- **Fusion** — merges results from several retrievers into one ranked list.
- **Generator** — the LLM and its prompt template.

Two structural ideas make it "modular" rather than just "a longer chain":

**Routing** — a lightweight classifier or LLM call decides the path *per query*. "Refund policy?" → HR index. "Order #4471 status?" → SQL database. "Latest AED/USD rate?" → web search. Same entry point, different modules fire.

**Loops and branches** — modules can repeat or fork. Retrieve → check if enough → retrieve again with a rewritten query. This conditional control flow is the bridge toward **Agentic RAG** (the difference: modular RAG's routing is usually *pre-defined* rules; agentic RAG lets an LLM *reason* about the path freely).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Query</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧭 Router<span class="sub">picks the path</span></span>
    <div class="flow">
      <span class="dbox blue">🗄️ Vector index</span>
      <span class="dbox blue">🔢 SQL DB</span>
      <span class="dbox blue">🌐 Web search</span>
    </div>
    <span class="darr">↓<span class="lbl">fuse</span></span>
    <span class="dbox orange">reranker</span>
    <span class="darr">↓</span>
    <span class="dbox green">🤖 Generator → ✅ Answer</span>
  </div>
  <div class="dcap">Interchangeable modules; a router chooses which fire per query.</div>
</div>

## Concrete example — a router picking retrievers

```python
from langchain_openai import ChatOpenAI
router_llm = ChatOpenAI(model="gpt-5.4-mini")

def route(query: str) -> str:
    choice = router_llm.invoke(
        f"Classify into one word: 'policy', 'orders', or 'web'.\nQuery: {query}"
    ).content.strip().lower()
    return choice

RETRIEVERS = {                      # each is a swappable module
    "policy": vector_retriever,     # dense search over HR/policy docs
    "orders": sql_retriever,        # queries the orders table
    "web":    web_retriever,        # live search API
}

def modular_rag(query):
    retriever = RETRIEVERS.get(route(query), vector_retriever)
    context = retriever(query)
    return generate(query, context)   # shared generator module
```

Adding a fourth data source = write one retriever and add one dict entry. No rewrite of the pipeline. That composability *is* modular RAG.

## How a company uses this

A Dubai super-app (think a Careem/Talabat-style platform) runs one assistant over wildly different data: static help articles, a live orders SQL database, and real-time driver/restaurant status. A monolithic RAG chain can't serve all three. They built a modular system where a **router** classifies each message and dispatches to the right retriever module, a **fusion** step merges when a query spans sources, and a shared **generator** produces the reply. The payoff is organizational: the payments team owns the SQL retriever, the content team owns the vector index, and they ship independently because the module contracts are fixed. At platform scale (thousands of QPS), the cheap router call (~50ms, a fraction of a cent) also *saves* money — routing "order status" straight to SQL avoids an expensive, useless vector search entirely.

## Common mistakes / misconceptions

- **Over-modularizing a simple app.** If you have one corpus and one question type, naive RAG is correct — modular RAG's abstraction is pure overhead. Reach for it when data sources or query types genuinely diverge.
- **Router with no fallback.** Misclassification happens; always route unknowns to a sensible default retriever instead of erroring.
- **Thinking "modular" means "agentic."** Modular RAG's paths are still author-defined (rules/router). Handing path *decisions* to an autonomous LLM loop is **Agentic RAG** — the next tile.
- **Leaky module contracts.** If modules assume each other's internals, you've just written a monolith with extra steps. Keep inputs/outputs clean or you lose the swap-ability.

## Interview tip

Say: *"Modular RAG treats retrieval as composable blocks — retriever, reranker, query transformer, router, memory — instead of one fixed chain. A router picks the path per query, so I can serve vector, SQL, and web sources from one assistant and let different teams own different modules. It's the step between a linear advanced-RAG pipeline and a fully agentic one."* Placing it correctly on the Naive → Advanced → Modular → Agentic ladder shows you know the architecture landscape, not just one recipe.
