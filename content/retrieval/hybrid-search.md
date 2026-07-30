# Hybrid Search

**The one-line idea:** Hybrid search runs **both** dense (meaning) and sparse (keyword) retrieval on every query and **fuses their results into one ranked list** — so you get semantic matching *and* exact-term matching instead of choosing one and losing the other.

## Why it matters for an AI Engineer

This is the production default. Dense search alone misses codes and names; sparse search alone misses paraphrases. Real queries need both — "what changed in the **remittance fee** for account **ADCB-SAV-01**?" has a semantic part *and* an exact-code part. Hybrid is how you stop apologizing for one blind spot or the other, and "I default to hybrid" is a phrase interviewers listen for because it signals you've actually shipped RAG, not just followed a tutorial.

## The mechanism — how it works

You run the two searches in parallel, then **fuse** their rankings. The catch: dense scores (cosine, ~0–1) and BM25 scores (unbounded, ~0–30) live on totally different scales — you can't just add them. Two standard ways to combine:

**1. Reciprocal Rank Fusion (RRF) — the robust default.** Ignore the raw scores; use only each result's *rank position* in each list. A document's fused score is the sum over both lists of `1 / (k + rank)` (k is a constant, usually 60). A chunk ranked #1 in either list gets a big boost; a chunk that appears near the top of *both* wins outright. Because it uses ranks, not scores, it sidesteps the scale-mismatch problem entirely — that's why most vector DBs default to it.

**2. Weighted score fusion.** Normalize both score sets to 0–1, then blend: `final = α·dense + (1−α)·sparse`. Tuning α lets you lean semantic (α high) or keyword (α low) per use case — more control, more tuning work.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ query</span>
    <div class="flow">
      <span class="dbox purple">🔢 dense search<span class="sub">meaning</span></span>
      <span class="dbox orange">🔤 sparse / BM25<span class="sub">keywords</span></span>
    </div>
    <span class="darr">↓<span class="lbl">RRF fuse ranks</span></span>
    <span class="dbox green">✅ one merged ranked list</span>
  </div>
  <div class="dcap">Both searches run in parallel; RRF merges their rank positions so a chunk strong in either surfaces.</div>
</div>

## Concrete example

LangChain's `EnsembleRetriever` does RRF-style fusion of a dense retriever and a BM25 retriever:

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever

texts = [
    "To terminate a subscription, open Settings > Billing.",
    "Error E-4021 occurs when the auth token expires; re-login to fix it.",
    "Refunds are processed within 5 business days of cancellation.",
]

dense = FAISS.from_texts(texts, OpenAIEmbeddings(model="text-embedding-3-small")
                         ).as_retriever(search_kwargs={"k": 3})
sparse = BM25Retriever.from_texts(texts); sparse.k = 3

hybrid = EnsembleRetriever(retrievers=[dense, sparse], weights=[0.5, 0.5])

print(hybrid.invoke("how do I cancel my plan?"))   # dense wins -> "terminate a subscription"
print(hybrid.invoke("error E-4021"))               # sparse wins -> exact code chunk
```

The *same* retriever answers a paraphrased question (dense carries it) and an exact-code lookup (sparse carries it). Managed vector DBs (Pinecone, Weaviate, Qdrant, pgvector + a BM25 extension) offer this natively so you don't run two systems by hand.

## How a company uses this

The **Dubai bank** from the node overview switched its policy assistant to hybrid. Staff searching natural-language questions ("*what's the notice period to close an account?*") get semantic hits; staff pasting product codes ("*ADCB-SAV-01 fees*") get exact hits. One search box, both behaviors — no user has to know which mode they're in.

## Common mistakes / misconceptions

- **Adding raw scores.** Cosine and BM25 aren't on the same scale — naive addition lets BM25's big numbers swamp dense. Use RRF (ranks) or normalize first.
- **Assuming hybrid always beats dense.** For purely conversational corpora with no codes/names, dense alone can match hybrid — measure, don't assume.
- **Confusing hybrid with reranking.** Hybrid *fuses two searches*; reranking *re-scores one candidate set with a heavier model*. They're complementary and often stacked: hybrid to gather candidates, rerank to order them.
- **Tuning α blindly.** Weighted fusion needs a small eval set; otherwise you're guessing. RRF's k=60 default is a safer starting point.

## Interview tip
Say: *"Hybrid search runs dense and sparse in parallel and fuses them, usually with Reciprocal Rank Fusion so the score-scale mismatch doesn't matter. It's my default because dense handles paraphrase and sparse handles exact terms like codes — and I'll often add a reranker on top of the fused candidates for final precision."* Naming RRF and distinguishing it from reranking is the tell of someone who's built this.

See also: **Dense Retrieval**, **Sparse Retrieval (BM25/TF-IDF)**, and **Reranking** for the precision layer on top.
