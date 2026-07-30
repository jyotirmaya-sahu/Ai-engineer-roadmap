# RAG in Production

**The one-line idea:** A RAG demo that answers questions over 100 documents on your laptop and a live system answering thousands of users a second over 10 million documents are *not the same thing* — production is where scale, latency, cost, freshness, and reliability turn a weekend prototype into a real engineering problem.

## The prototype-to-production gap

Every RAG tutorial ends the same way: load a folder of PDFs, embed them into an in-memory index, ask a question, get a good answer. It works. It also hides almost everything that makes RAG a *job*.

Here is what actually changes when you cross from demo to production:

| | Prototype | Production |
|---|---|---|
| Documents | 100 (fits in RAM) | 10M–1B vectors, tens of GB of index |
| Users | you | thousands of QPS, spiky |
| Latency | "a few seconds is fine" | p95 must be under ~2s end-to-end |
| Cost | free-tier | a real monthly bill you must defend |
| Freshness | static folder | docs change hourly, model versions change |
| When it breaks | you rerun the cell | a user gets a wrong answer at 3am and files a ticket |
| Uptime | doesn't matter | 99.9% or people notice |

A prototype that returns the wrong chunk is a curiosity. A production system that returns the wrong chunk to a paying customer, slowly, while burning $40k/month, is a fire. This node is about running RAG so that doesn't happen.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💻 Demo<span class="sub">100 docs, you</span></span>
    <span class="darr">→<span class="lbl">scale ×100,000</span></span>
    <span class="dbox purple">🏭 Production<span class="sub">10M docs, 1000s QPS</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Fast, cheap, fresh, reliable</span>
  </div>
  <div class="dcap">Same idea — retrieve, then generate — but every dimension now has a budget and an SLA.</div>
</div>

## The five forces that change everything

Production RAG problems all trace back to five pressures the prototype never felt:

1. **Scale** — 10M vectors don't fit in a flat in-memory index anymore. Index structure, sharding, and memory math become real.
2. **Latency** — you have a fixed p95 budget (say 2000ms) and must divide it across embed → search → rerank → LLM, then defend it under load.
3. **Cost** — embeddings, storage, reranking, and LLM tokens each have a per-unit price; at 1M queries/month they add up to a bill someone signs off on.
4. **Freshness** — documents change, and embedding models get upgraded; stale vectors quietly poison answers.
5. **Reliability** — things fail (a vector DB times out, the LLM API 500s), and you need to degrade gracefully instead of returning an error page.

## The 12 tiles, by the production problem each solves

| Tile | The production problem it solves |
|---|---|
| **Scaling to Millions of Documents** | Your flat index no longer fits in RAM or answers in time |
| **Sharding & Partitioning** | Multiple tenants/customers must be isolated and routed correctly |
| **Incremental Indexing & Updates** | Docs change constantly — you can't re-embed everything nightly |
| **Index Tuning at Scale (HNSW Params)** | Recall, latency, and memory are in tension; you must pick the knobs |
| **Latency Budgeting** | p95 blew past 2s — where did the milliseconds go? |
| **Semantic & Prompt Caching** | The same questions repeat; recomputing them wastes money and time |
| **Async & Batching** | One request at a time can't hit the QPS you need |
| **Cost at Scale** | The monthly bill is scary; which lever actually cuts it? |
| **Debugging Retrieval Failures** | The answer is wrong — is it retrieval or generation, and how do you prove it? |
| **Monitoring & Online Eval** | You can't fix what you can't see; catch regressions in prod |
| **Data Freshness & Re-embedding** | Stale docs and model upgrades silently rot answer quality |
| **High Availability & Fallbacks** | A dependency died — return *something* useful, not a 500 |

## Real world: a Dubai enterprise example

> A **Dubai bank** ships an internal policy-and-compliance assistant. In the pilot it covered 5,000 documents for 20 users in the risk team and everyone loved it. Then it rolled out bank-wide: **8 million** documents (policies, circulars, KYC/AML guidance, Arabic + English), **1,500 employees** hitting it during business hours, a hard **p95 < 2 second** SLA from the CTO, and a compliance rule that a *wrong* answer about a regulation is worse than *no* answer. Suddenly the team needed sharding by department, HNSW tuning to keep 8M vectors under latency, a semantic cache (half the questions were "what's the limit for X?"), a nightly cost report, Langfuse tracing to debug bad answers, change-data-capture so a new circular is searchable within an hour, and a keyword-search fallback for when the vector DB hiccups. None of that was in the demo. *All* of it is in this node.

## Interview tip
Say: *"Anyone can build a RAG demo. Production RAG is an operations problem — I think about it as five budgets: a memory/scale budget for the index, a latency budget I split across embed, search, rerank, and generation, a cost budget per 1M queries, a freshness SLA, and a reliability plan with graceful degradation. I instrument everything with tracing and online eval so I can tell whether a bad answer is a retrieval failure or a generation failure."* That framing signals you've actually *run* RAG, not just wired one up.

---

*Below: deep-dive articles on each production concern.*
