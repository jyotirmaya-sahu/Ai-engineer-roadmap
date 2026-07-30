# Debugging Retrieval Failures

**What it is:** the systematic playbook for "the RAG answer is wrong" — how to tell whether the failure is in *retrieval* (the right context was never fetched) or *generation* (the context was there but the LLM ignored or misused it), then root-cause and fix it.

## Why it matters for an AI Engineer

"The answer is wrong" is the ticket you'll get most in production RAG — and it's ambiguous. If you guess, you waste days tuning the LLM when the real problem was a missing chunk, or vice versa. The single most valuable RAG debugging skill is the **split**: retrieval failure or generation failure? They have completely different fixes. Being able to answer that in minutes, with evidence, is what separates an engineer who *operates* RAG from one who just built it.

## The core question: retrieval or generation?

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❌ wrong answer</span>
    <span class="darr">↓<span class="lbl">is the right chunk in retrieved context?</span></span>
    <div class="flow">
      <span class="dbox orange">NO → retrieval failure<span class="sub">fix chunking / embeddings / index / query</span></span>
      <span class="dbox purple">YES → generation failure<span class="sub">fix prompt / model / context order</span></span>
    </div>
  </div>
  <div class="dcap">The first split that decides everything: was the answer even retrievable in what you sent the model?</div>
</div>

**The test:** look at the exact chunks that were retrieved and sent to the LLM for that query. Ask: *does the correct answer physically appear in that text?*

- **The right text is NOT in the retrieved chunks → retrieval failure.** The LLM never had a chance. Fixing the prompt won't help.
- **The right text IS in the retrieved chunks but the answer is still wrong → generation failure.** The model ignored it, got confused by a distractor chunk, or the prompt is weak.

You cannot do this split without **logging the retrieved chunks per request** — which is why tracing (see [monitoring-online-eval.md](monitoring-online-eval.md)) is a prerequisite for debugging, not a nice-to-have.

## The playbook, step by step

**1. Reproduce.** Pull the exact query and, from your trace, the retrieved chunk IDs, scores, and final prompt. If you didn't log them, you can't debug — fix logging first, then wait for it to recur.

**2. Do the split** (above). Read the retrieved chunks. Is the answer in there?

**3a. If retrieval failed**, walk the pipeline backward to find *where*:

| Symptom | Likely cause | Fix |
|---|---|---|
| Right chunk exists in corpus but wasn't retrieved | recall too low / `ef_search` low | raise `ef_search` ([index-tuning-at-scale-hnsw-params.md](index-tuning-at-scale-hnsw-params.md)) |
| Answer split across two chunks, each half | bad chunking | overlap / recursive splitting (../chunking.md) |
| Query wording differs from doc wording | vocabulary mismatch | hybrid search / query expansion ([../retrieval/hybrid-search.md](../retrieval/hybrid-search.md)) |
| Right chunk retrieved but ranked #20 | weak reranking | add/tune reranker ([../retrieval/reranking-cross-encoder-cohere.md](../retrieval/reranking-cross-encoder-cohere.md)) |
| Correct doc *doesn't exist* in index | ingestion/parsing gap or stale index | check ingestion, re-index ([data-freshness-re-embedding.md](data-freshness-re-embedding.md)) |

**Quick isolation trick:** manually query the vector DB for the correct chunk's text. If it *is* in the index but doesn't come back for the user's query → it's a ranking/recall problem. If it's *not* in the index → it's an ingestion/freshness problem.

**3b. If generation failed**, the context was there but the answer wasn't:

- **Distractor chunks** — an irrelevant chunk confused the model. Rerank harder, send fewer chunks.
- **Lost in the middle** — the right chunk was buried in a long context. Put the best chunk first/last, send less.
- **Weak prompt** — no instruction to ground strictly in context / to say "I don't know." Add "answer only from the context; if it's not there, say you don't know."
- **Model too small** — genuinely couldn't reason over it. Try a stronger model on that case.

**4. Build an offline eval set — the real fix for *repeat* failures.** Every real bug becomes a test case: `(query, expected answer / expected chunk IDs)`. Run the whole set on every change so you never regress a fixed bug.

```python
# tiny offline eval: did retrieval fetch the known-relevant chunk?
eval_set = [
    {"query": "annual leave days?",     "gold_chunk": "hr_policy::chunk_12"},
    {"query": "notice period to quit?", "gold_chunk": "hr_policy::chunk_31"},
]

def retrieval_recall(index, eval_set, k=5):
    hits = 0
    for row in eval_set:
        got = [m.id for m in index.query(embed(row["query"]), top_k=k)]
        hit = row["gold_chunk"] in got
        hits += hit
        if not hit:
            print(f"MISS: {row['query']!r} → retrieved {got}")  # localizes the failure
    return hits / len(eval_set)

assert retrieval_recall(index, eval_set) >= 0.9   # gate every deploy on this
```

## How a company uses this

> A **Dubai HR-tech** RAG kept answering "notice period is 30 days" when the policy said 60. The team almost fine-tuned the model. Instead they logged the retrieved chunks: the *correct* clause wasn't there — retrieval failure. The corpus query showed the clause *was* indexed but ranked #14 because a differently-worded FAQ chunk out-scored it. Adding a cross-encoder reranker pulled the real clause to #1 and the answer became correct. They turned that query into an eval case so it can never silently regress. Total fix time: an afternoon, because the split pointed straight at retrieval.

## Common mistakes
- **Blaming the LLM by default** — most "wrong answer" bugs are retrieval failures the model never had the data to solve.
- **Debugging without the retrieved chunks logged** — you're guessing; instrument first.
- **Fixing one query by hand** and not turning it into an eval case — it regresses next deploy.
- **No labeled eval set** — you can't measure whether a change helped or just moved the problem.

## Interview tip
Say: *"My first move on a wrong RAG answer is always the split: I look at the exact chunks that were retrieved and ask whether the correct answer is physically in them. If it's not, it's a retrieval failure — I trace back through recall, reranking, chunking, and ingestion. If it is there, it's a generation failure — prompt, distractors, or model. And every real bug becomes a case in an offline eval set I gate deploys on, so fixed bugs stay fixed."*
