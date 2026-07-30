# Retrieval

**The one-line idea:** Once your chunks are embedded and stored in a vector database, *retrieval* is the step that, for each user question, **finds the handful of chunks most likely to answer it and puts them in the best order** before they're handed to the LLM.

## Where retrieval sits in RAG

RAG has two halves. The **offline** half (chunk → embed → store) happens once, ahead of time. The **online** half runs on every question: take the query, go find the right chunks, and stuff them into the prompt. Retrieval is that online "go find" step — and it's where a RAG system usually lives or dies.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ user query</span>
    <span class="darr">→<span class="lbl">retrieve</span></span>
    <span class="dbox blue">🗄️ vector store</span>
    <span class="darr">→</span>
    <span class="dbox orange">📄 top chunks</span>
    <span class="darr">→<span class="lbl">rank</span></span>
    <span class="dbox orange">📄 best chunks, ordered</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ grounded answer</span>
  </div>
  <div class="dcap">Retrieval = finding the right chunks for a query and ranking them well, before the LLM ever sees them.</div>
</div>

## Why naive top-K vector search isn't enough

The beginner's RAG is one line: embed the query, grab the K nearest vectors, done. It works in demos and disappoints in production. Here's why:

- **Vector search matches *meaning*, not *words*.** Ask for error code "E-4021" or a product SKU and dense embeddings often miss it — they're great at "these two paragraphs are *about* the same thing," bad at exact tokens. That's what sparse keyword search is *good* at.
- **The nearest vectors aren't always the *most useful* ones.** The top 5 can be five near-duplicates of the same paragraph — the answer needs the *sixth*, slightly different one. Redundancy wastes your context budget.
- **The query itself is often the problem.** A vague, misspelled, or multi-part question ("compare the 2024 and 2025 leave policies") produces a vague query vector that matches nothing sharply — or only half the answer.
- **The embedding model is a fast, blunt filter.** It scores millions of chunks cheaply but coarsely. It has no idea which of its top 20 *actually* answers the question; it just knows they're in the neighborhood.
- **Order matters to the LLM.** Models pay most attention to the start and end of the context ("lost in the middle") — so *where* a chunk sits changes the answer.

So real retrieval is a small pipeline, not a single call. It has three jobs, and the 12 tiles below each own a piece of one:

1. **Search methods** — *how* you find candidate chunks: dense (meaning), sparse (keywords), or hybrid (both).
2. **Selection & ranking** — from those candidates, *which* ones to keep and in *what* order: top-K, metadata filters, diversity (MMR), and a smarter reranker.
3. **Query transformation** — fixing the *question* before search so it retrieves better: rewriting, expanding, splitting, or imagining an ideal answer.

## The 12 techniques — and when to reach for each

| Tile | What it does | Reach for it when |
|---|---|---|
| **Dense Retrieval** | nearest-neighbor search on embeddings (meaning) | your default semantic search; paraphrased questions |
| **Sparse (BM25 / TF-IDF)** | keyword/term-overlap search | exact terms: codes, names, SKUs, acronyms, jargon |
| **Hybrid Search** | fuse dense + sparse scores | you need both meaning *and* exact-term matching (most prod systems) |
| **Top-K Selection** | how many chunks to keep | tuning the recall vs. context-budget trade-off |
| **Metadata Filtering** | restrict search by tags (date, dept, lang) | "only 2025 docs," per-tenant, per-region, access control |
| **MMR (diversity)** | drop near-duplicate results | your top-K keeps returning the same paragraph five ways |
| **Reranking (cross-encoder / Cohere)** | re-score top candidates with a deeper model | precision matters; you can afford one extra model call |
| **Multi-Query** | rephrase the question several ways, merge results | vague or under-specified questions |
| **HyDE** | generate a fake ideal answer, search with *that* | sparse corpora where the question looks nothing like the answer |
| **Query Expansion** | add synonyms / related terms to the query | domain jargon, acronyms, short queries |
| **Query Decomposition** | split a multi-part question into sub-questions | "compare X and Y," multi-hop questions |
| **Contextual Compression** | trim retrieved chunks down to the relevant sentences | long chunks blow the token budget or bury the answer |

## Real world: how a Dubai company uses this

> **A Dubai bank** built an internal assistant over its policy PDFs and product sheets. Pure vector search failed two ways: staff searching for account type "**ADCB-SAV-01**" got semantically-similar-but-wrong products, and "**what changed in the 2025 remittance fees?**" pulled 2023 documents. The fix was a full retrieval pipeline: **hybrid search** (so exact product codes hit), a **metadata filter** on `year = 2025` and `department`, and a **Cohere reranker** on the top 40 candidates to push the truly-relevant clause to the top. Same embeddings, same LLM — retrieval quality alone took them from "unusable" to "shipped."

## Interview tip
Say: *"Naive top-K vector search is a demo, not a system. Real retrieval is a pipeline: pick a search method (I default to hybrid so exact terms like codes aren't lost), filter on metadata, then rerank the top candidates with a cross-encoder for precision — and if the question is weak, I transform it first with multi-query or decomposition. Most 'the RAG answer is wrong' bugs are retrieval bugs, and they're fixable without touching the model."* That shows you see retrieval as an engineering problem, not a single API call.

---

*Below: deep-dive articles on each retrieval technique.*
