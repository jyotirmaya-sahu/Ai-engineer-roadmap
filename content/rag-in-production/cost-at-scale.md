# Cost at Scale

**What it is:** the actual monthly bill of running RAG — embeddings, vector storage, reranking, and LLM tokens — worked out with real 2026 numbers, and the levers that cut it.

## Why it matters for an AI Engineer

At demo scale, RAG is free-tier. At **10M documents + 1M queries/month**, it's a real line item someone in finance questions. An AI Engineer who can say "our RAG costs $X/month, and I can cut it 60% by adding a semantic cache and dropping to a cheaper generation model" is far more valuable than one who just wires up an API and hopes. Knowing where the money goes — and it's almost never where beginners think — is a core production skill.

## The four cost buckets

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🔢 embeddings<span class="sub">one-time-ish</span></span>
    <span class="dbox blue">🗄️ storage<span class="sub">monthly</span></span>
    <span class="dbox orange">🎯 rerank<span class="sub">per query</span></span>
    <span class="dbox purple">🧠 LLM tokens<span class="sub">per query — the big one</span></span>
  </div>
  <div class="dcap">Four buckets. At query scale, LLM tokens usually dwarf the other three combined.</div>
</div>

## A worked monthly bill: 10M docs + 1M queries

Assume: 10M chunks, 1536-dim embeddings; each query embeds 1 short question, retrieves + reranks ~30 candidates, and generates an answer with ~3k input tokens (system + 5 retrieved chunks) and ~400 output tokens. Prices are representative 2026 order-of-magnitude figures — *always re-check current pricing.*

| Bucket | Calculation | Monthly cost |
|---|---|---|
| **Embeddings — indexing** | 10M chunks × ~200 tokens = 2B tokens × ~$0.02/1M (small model) | **~$40** (one-time-ish) |
| **Embeddings — queries** | 1M queries × ~15 tokens = 15M tokens × ~$0.02/1M | **~$0.30** |
| **Vector storage** | ~20 GB effective (int8 quantized) on a managed DB | **~$70–300** |
| **Reranking** | 1M queries × 30 candidates → Cohere rerank ~$1–2 per 1k searches | **~$1,000–2,000** |
| **LLM generation** | 1M queries × (3k in + 400 out). At a mid-tier model (~$0.30/1M in, ~$1.20/1M out): in = 3B tok ≈ $900; out = 0.4B ≈ $480 | **~$1,400** |
| **Total** | | **~$2,500–3,800 / month** |

The headline: **embeddings and storage are cheap; reranking and LLM generation dominate.** Beginners obsess over embedding cost (~$40) while reranking + generation is ~99% of the bill. Note how a frontier generation model (~$5/1M in, $15/1M out) would push generation alone to **~$21,000/month** — model choice is the single biggest lever.

## The levers, biggest first

1. **Semantic cache.** A 40% hit rate cuts *per-query* costs (rerank + generation) by ~40% — here roughly **$1,000–1,300/month saved** (see [semantic-prompt-caching.md](semantic-prompt-caching.md)). Best ROI, always do this.
2. **Cheaper generation model.** Grounded RAG answers often don't need a frontier model — the retrieved context does the work. Dropping from frontier to mid-tier is a **5–10× cut** on the biggest bucket.
3. **Prompt caching** on the fixed system prefix — **50–90% off cached input tokens**, a big chunk of that $900 input cost.
4. **Rerank fewer candidates / rerank selectively.** Reranking 15 instead of 30 halves rerank cost; skip reranking on high-confidence retrievals. Or use a cheaper/self-hosted cross-encoder ([../retrieval/reranking-cross-encoder-cohere.md](../retrieval/reranking-cross-encoder-cohere.md)).
5. **Trim context.** Sending 8 chunks instead of 5 is +60% input tokens for often-marginal quality. Retrieve wide, but send only what helps.
6. **Quantize + smaller dims** to shrink storage (see [millions-of-documents.md](millions-of-documents.md)) — matters at 100M+ vectors, minor below.

## Concrete example: a cost estimator

```python
def monthly_cost(queries, in_tok, out_tok, price_in, price_out,
                 rerank_per_1k, cache_hit=0.0):
    billable = queries * (1 - cache_hit)           # cache serves the rest for ~free
    gen = billable * (in_tok/1e6*price_in + out_tok/1e6*price_out)
    rerank = billable/1000 * rerank_per_1k
    return round(gen + rerank, 0)

# mid-tier model, no cache:
print(monthly_cost(1_000_000, 3000, 400, 0.30, 1.20, 1.5))          # ~2880
# same, with a 40% semantic-cache hit rate:
print(monthly_cost(1_000_000, 3000, 400, 0.30, 1.20, 1.5, cache_hit=0.4))  # ~1728
assert monthly_cost(1_000_000, 3000, 400, 0.30, 1.20, 1.5, 0.4) < \
       monthly_cost(1_000_000, 3000, 400, 0.30, 1.20, 1.5)
```

Run this *before* launch so the bill is a decision, not a surprise.

## How a company uses this

> A **Dubai enterprise** launched an internal RAG assistant on a frontier model and got a **~$22k first-month bill** — 90% of it generation tokens. Three changes brought it under $4k: (1) switched grounded answers to a mid-tier model (context did the reasoning), (2) added a semantic cache that hit ~50% of the repetitive internal questions, (3) enabled prompt caching on their long compliance system prompt. Retrieval and storage were never touched — they were a rounding error the whole time.

## Common mistakes
- **Optimizing embedding cost** (~$40) while ignoring generation (~$1,400+).
- **Defaulting to a frontier model** for grounded answers that a mid-tier model handles fine — the #1 overspend.
- **No caching** — paying full price for questions asked 50 times a day.
- **Estimating cost only after** the first scary invoice instead of modeling it pre-launch.

## Interview tip
Say: *"For 10M docs and 1M queries a month, embeddings and storage are trivial — tens to a few hundred dollars — and the bill is dominated by LLM generation and reranking. So I model it up front: my biggest levers are model choice for generation, a semantic cache, and prompt caching on the fixed prefix. Dropping from a frontier to a mid-tier model plus a 40% cache hit routinely cuts the bill 5–6×, and I never spend effort shaving embedding cost."*
