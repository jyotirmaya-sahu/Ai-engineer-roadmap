# Context precision

**The one-line idea:** Context precision measures the *signal-to-noise ratio* of what your retriever returned — of the chunks you pulled back, how many were actually relevant, and are the relevant ones ranked at the top?

## Why it matters for an AI Engineer

RAG has two halves — retrieval and generation — and most quality bugs live in retrieval. Context precision is how you grade the retriever's *precision*: did it fetch mostly useful chunks, or did it bury one good chunk under nine irrelevant ones? Low precision means the LLM has to read through noise, which raises cost, latency, *and* hallucination risk (irrelevant context distracts the model). It's half of the RAGAS retrieval diagnosis (precision = "is what we got clean?", recall = "did we get everything?").

## The mechanism — how it works

Context precision (a **RAGAS** metric) asks, for the list of retrieved chunks: **what fraction are relevant, and are the relevant ones near the top?**

1. **Judge each retrieved chunk's relevance.** An LLM checks each chunk against the question (and the ground-truth answer) — is this chunk useful for answering, yes/no?
2. **Reward good ranking, not just presence.** It's computed as a rank-aware average (mean of precision@k at each position where a relevant chunk appears). Putting relevant chunks *first* scores higher than the same chunks buried at the bottom — because rerankers and the LLM both weight earlier context more.
3. **Score 0–1.** All retrieved chunks relevant and well-ordered → near 1.0. Relevant chunks scattered among junk → lower.

Because it's rank-aware, context precision is essentially a RAGAS-flavored, LLM-judged cousin of classic ranking metrics like MRR — but instead of needing labeled relevance judgments, an LLM supplies them.

<div class="diagram">
  <div class="dstack">
    <span class="dbox green">chunk 1 ✅ relevant</span>
    <span class="dbox gray">chunk 2 ❌ noise</span>
    <span class="dbox green">chunk 3 ✅ relevant</span>
    <span class="dbox gray">chunk 4 ❌ noise</span>
  </div>
  <div class="flow">
    <span class="darr">→<span class="lbl">rank-aware avg</span></span>
    <span class="dbox orange">precision ↓ (relevant not all at top)</span>
  </div>
  <div class="dcap">Reward relevant chunks that rank high; penalize noise and buried hits.</div>
</div>

## Concrete example

```python
from ragas import evaluate
from ragas.metrics import context_precision
from datasets import Dataset

data = Dataset.from_dict({
    "question":     ["What is the notice period to close a savings account?"],
    "ground_truth": ["30 days written notice."],
    "answer":       ["30 days written notice."],
    "contexts":     [[                                   # what the retriever returned:
        "Closing a savings account requires 30 days written notice.",  # relevant (top ✅)
        "Our branches are open Sunday to Thursday, 8am to 3pm.",       # noise
        "Interest is calculated daily and paid monthly.",             # noise
    ]],
})

result = evaluate(data, metrics=[context_precision])
print(result)   # relevant chunk is #1 (good) but 2/3 are noise → precision < 1.0
```

## How a company uses this

A **Dubai bank's** RAG pipeline retrieved the top 10 chunks and saw context precision sitting around 0.4 — most retrieved chunks were noise, inflating token cost and confusing the model. That number justified adding a **cross-encoder reranker** to reorder and trim to the best 4: precision jumped to ~0.85, the LLM saw cleaner context, faithfulness rose, and per-answer token spend *dropped* because fewer junk chunks reached the prompt. Context precision was the metric that turned "retrieval feels noisy" into a fundable engineering decision, and they track it per-release so a chunking or embedding change that reintroduces noise is caught immediately.

## Common mistakes / misconceptions

- **Confusing precision with recall.** Precision = "is what we retrieved clean?" Recall = "did we get everything we needed?" You can have perfect precision (one relevant chunk, nothing else) yet terrible recall (missed two other needed chunks). Always read them together.
- **Retrieving huge K "to be safe."** More chunks tanks precision, raises cost, and can *lower* answer quality via distraction. Retrieve wide, then rerank narrow.
- **Ignoring order.** Two systems with the same relevant chunks can differ if one ranks them at the bottom — context precision (rightly) penalizes that.
- **No ground truth.** RAGAS context precision works best with a reference answer to judge relevance against; skipping it makes the judgment noisier.

## Interview tip
Say: *"Context precision is the signal-to-noise of retrieval — the rank-aware fraction of retrieved chunks that are relevant, with relevant ones near the top scoring higher. Low precision means I'm feeding the LLM noise, so I fix it with reranking or a smaller K, not a prompt tweak. I always read it beside context recall — clean *and* complete."* Naming reranking as the fix and pairing it with recall shows you diagnose RAG by component.

See also: [Context recall](./context-recall.md) (the completeness counterpart), [Precision@K / MRR / NDCG](./precision-k-mrr-ndcg.md) (classic ranking metrics it echoes), and [Faithfulness](./faithfulness.md) (what clean context enables).
