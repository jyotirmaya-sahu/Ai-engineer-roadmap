# Precision@K / MRR / NDCG

**The one-line idea:** These are the classic *ranking* metrics — the exact, label-based way to score a retriever on whether it puts the right chunks near the top of the list, before any LLM is involved.

## Why it matters for an AI Engineer

RAGAS metrics use an LLM to judge relevance, which costs money and adds noise. When you have **labeled data** (you know which chunks are the correct ones for each query), Precision@K, MRR, and NDCG grade the retriever *deterministically and for free* — the same metrics search engines have used for decades. They're how you tune the retrieval layer in isolation (embedding model, K, reranker) without paying for an LLM judge on every experiment. Interviewers expect you to know these by name and to explain what each one rewards.

## The mechanism — how it works

All three score a *ranked list* of retrieved results against known-relevant items:

- **Precision@K** — of the top K results, what fraction are relevant? Top-5 with 3 relevant → P@5 = 0.6. Simple, but **ignores order within the top K** and ignores anything past K.
- **MRR (Mean Reciprocal Rank)** — for each query, take 1 / (rank of the *first* relevant result), then average over queries. First relevant at position 1 → 1.0; at position 3 → 0.33. Perfect when you care about **the single best answer landing at the top** (e.g. one correct document per question).
- **NDCG (Normalized Discounted Cumulative Gain)** — the most complete. It (a) supports **graded relevance** (an item can be "highly relevant" = 3, "somewhat" = 1), (b) **discounts by position** (a hit at rank 5 counts less than at rank 1, via a log factor), and (c) **normalizes** against the ideal ranking so the score is 0–1 and comparable across queries. Use it when relevance isn't just yes/no and order among the top results matters.

<div class="diagram">
  <div class="dstack">
    <span class="dbox green">rank 1 ✅ relevant</span>
    <span class="dbox gray">rank 2 ❌</span>
    <span class="dbox green">rank 3 ✅ relevant</span>
    <span class="dbox gray">rank 4 ❌</span>
  </div>
  <div class="flow">
    <span class="darr">→</span>
    <span class="dbox orange">P@4 = 0.5<span class="sub">fraction relevant</span></span>
    <span class="dbox orange">MRR = 1.0<span class="sub">first hit at #1</span></span>
    <span class="dbox orange">NDCG<span class="sub">position-weighted</span></span>
  </div>
  <div class="dcap">Same ranked list, three lenses: how many relevant, how soon the first, and how well-ordered overall.</div>
</div>

## Concrete example

```python
import numpy as np

def precision_at_k(relevant, k):          # relevant: 1/0 per ranked result
    return sum(relevant[:k]) / k

def mrr(relevant):                        # reciprocal rank of first hit
    for i, r in enumerate(relevant, 1):
        if r: return 1 / i
    return 0.0

def ndcg_at_k(gains, k):                  # gains: graded relevance per result
    def dcg(g): return sum(gi / np.log2(i + 2) for i, gi in enumerate(g[:k]))
    ideal = sorted(gains, reverse=True)
    return dcg(gains) / dcg(ideal) if dcg(ideal) else 0.0

ranked = [1, 0, 1, 0]                      # relevance of top-4 retrieved
print(precision_at_k(ranked, 4))           # 0.5
print(mrr(ranked))                         # 1.0  (first hit at rank 1)
print(ndcg_at_k([3, 0, 1, 0], 4))          # ~0.86 (high hits are near the top)
```

## How a company uses this

Before wiring an LLM into their pipeline, a **Dubai bank's** team built a labeled set of ~150 questions each mapped to its correct policy document, then benchmarked retriever variants purely on **NDCG@10 and MRR** — no LLM cost, runs in seconds. That let them compare three embedding models and a reranker cheaply: the reranker lifted MRR from 0.62 to 0.88 (the right doc now usually lands at #1), which justified its latency. Only *after* retrieval scored well did they spend money on end-to-end RAGAS/LLM-judge eval. Cheap ranking metrics for fast iteration, expensive LLM metrics for final validation — the standard funnel.

## Common mistakes / misconceptions

- **Using P@K when position matters.** P@5 is identical whether the relevant items are at ranks 1–3 or 3–5. If order matters, use MRR or NDCG.
- **MRR when there are many relevant items.** MRR only looks at the *first* hit — it ignores whether you found the other 4 relevant docs. Use recall@K or NDCG then.
- **Skipping graded relevance.** Treating "perfect" and "kind of related" as equally relevant loses signal — NDCG's graded gains capture it.
- **No labels = can't use these.** They need ground-truth relevance judgments. Without labels, fall back to RAGAS context precision/recall (LLM-judged).

## Interview tip
Say: *"For retrieval I use classic ranking metrics on a labeled set — Precision@K for raw hit fraction, MRR when one correct doc should land at the top, and NDCG when relevance is graded and position matters. They're deterministic and free, so I tune embeddings and rerankers on them first, then validate end-to-end with RAGAS and an LLM judge."* Knowing *when each metric is the right one* — not just their names — is the differentiator.

See also: [Context precision](./context-precision.md) and [Context recall](./context-recall.md) (LLM-judged retrieval metrics for when you lack labels), and [Faithfulness](./faithfulness.md) (end-to-end answer quality).
