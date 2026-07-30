# Cohere

**What it is:** An enterprise-focused AI provider whose real strength isn't chat but the **retrieval stack** — best-in-class embedding and reranking models (plus its Command generation models) built for production RAG.

## Why it matters for an AI Engineer

Most "which model?" thinking fixates on the chat model, but a RAG system's quality is set more by its **embeddings** and **reranker** than by the generator. Cohere specializes exactly there. Its **Embed** and **Rerank** models are frequent production picks for enterprise search — including strong *multilingual* support (Arabic among them), which matters directly in the Gulf. Knowing Cohere signals you understand that in RAG the retrieval components are first-class model choices, not afterthoughts. That's a distinguishing point in an AI-Engineer interview.

## The mechanism / how it works

Cohere offers three model types, and the retrieval two are the standouts:

- **Embed** — turns text into vectors for semantic search. Strong multilingual embeddings mean an Arabic query can match an English document (cross-lingual retrieval) — a real need in bilingual UAE enterprises.
- **Rerank** — the secret weapon. After your vector search returns, say, the top 50 candidate chunks, a reranker re-scores each *query–chunk pair together* and reorders them so the truly relevant ones rise to the top. Vector search is fast but approximate; reranking is slower but far more precise. Running cheap retrieval wide, then reranking to pick the best few, is the standard high-accuracy RAG pattern.
- **Command** — generation models for the final answer, tuned for grounded, cited enterprise responses.

Cohere is available via its own API and, importantly, through **AWS, Azure, and Oracle Cloud**, plus **private/VPC deployment** — so regulated clients can run it inside their own cloud boundary.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🔍 query</span>
    <span class="darr">→</span>
    <span class="dbox blue">Embed → vector search<span class="sub">top 50, fast/approx</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Rerank<span class="sub">re-score pairs → top 5</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">Command<span class="sub">grounded answer</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ cited response</span>
  </div>
  <div class="dcap">Cohere's RAG stack: broad cheap retrieval, then precise reranking, then grounded generation.</div>
</div>

## Concrete example — rerank to sharpen retrieval

```python
import cohere
co = cohere.ClientV2()  # COHERE_API_KEY

query = "What is the termination notice period?"
candidates = [        # top hits from your vector search
    "Either party may terminate with 30 days written notice.",
    "Payments are due within 15 days of invoice.",
    "The agreement renews annually unless cancelled.",
]
r = co.rerank(model="rerank-v3.5", query=query, documents=candidates, top_n=1)
best = candidates[r.results[0].index]
print(best)   # the termination clause — reranked to the top
```

Vector search alone might have ranked the payment clause near the termination one; the reranker, judging query and text *together*, promotes the right chunk.

## How a company uses this

A Dubai bank's bilingual (Arabic/English) policy-search tool struggled: employees asked questions in Arabic but the policies were in English, and vector search alone surfaced near-misses. They rebuilt retrieval on **Cohere Embed** (cross-lingual, so Arabic queries match English docs) plus **Rerank** to reorder the top candidates. Top-1 retrieval accuracy jumped from ~68% to ~91% on their eval set — with the *same* generation model. They deployed it inside their **AWS VPC** so no policy data left their cloud boundary. The lesson: they fixed a "bad answers" problem by upgrading the retrieval models, not the chat model.

## Common mistakes
- **Ignoring reranking** and trusting raw vector-search order — reranking is often the single biggest RAG accuracy win.
- **Overlooking Cohere because it's not a chat headline** — its value is retrieval, exactly where RAG quality lives.
- **Missing the multilingual angle** — for Arabic/English enterprises, cross-lingual embeddings solve a problem generic English embeddings can't.

## Interview tip
Say: *"Cohere is my enterprise-RAG pick — its Embed and Rerank models are where retrieval quality actually comes from. The high-accuracy pattern is cheap wide vector search, then rerank the top candidates to promote the truly relevant chunks. Its cross-lingual embeddings are a real advantage for Arabic/English enterprises, and it runs in-VPC on major clouds for regulated clients. I treat retrieval models as first-class model choices, not afterthoughts to the generator."*
