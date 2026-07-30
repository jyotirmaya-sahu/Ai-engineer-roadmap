# RAG & Retrieval Eval

**What it is:** the interview drill where you design a Retrieval-Augmented Generation system *and* prove it works with numbers — because "it feels good" is not an answer a Dubai AI Engineer interviewer accepts.

## Why it matters for an AI Engineer

RAG shows up in ~27% of Dubai AI Engineer JDs and is the single most-asked design topic. But almost every candidate can *describe* RAG ("embed docs, retrieve, stuff into prompt"). What separates a hire from a reject is **evaluation**: can you tell whether retrieval is actually finding the right chunks, and can you measure the answer quality? Teams have been burned by RAG demos that look great and hallucinate in production, so interviewers now probe eval hard. If you can talk metrics fluently, you signal "I've run this in production," which is exactly the seniority they're paying for.

## The mechanism: two things to eval, separately

RAG has two stages that fail differently, so you evaluate them **separately** — this framing alone impresses interviewers.

**1. Retrieval eval (did we fetch the right context?)** You need a small labelled set: questions paired with the chunk(s) that contain the answer. Then:

- **Recall@k** — of the questions, for how many did the correct chunk appear in the top *k* retrieved? This is the metric that matters most. If recall@5 is low, no LLM can save you — the answer was never in the prompt.
- **Precision@k / MRR** — how high did the right chunk rank? Mean Reciprocal Rank rewards putting the correct chunk at position 1.

**2. Generation eval (given good context, was the answer right?)** Here you grade the final answer on:

- **Faithfulness** — is every claim supported by the retrieved context, or did the model invent things? (The anti-hallucination metric.)
- **Answer relevance** — did it actually answer the question asked?

The modern practice is **LLM-as-judge**: a strong model scores faithfulness/relevance against the retrieved context on a rubric. Frameworks like **RAGAS** and **DeepEval** package these metrics. The key mental model: *retrieval recall is a lookup problem; faithfulness is a grounding problem — fix them with different levers.*

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Question</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🔍 Retrieve top-k</span>
    <span class="darr">↓<span class="lbl">eval: recall@k, MRR</span></span>
    <span class="dbox orange">📄 Context chunks</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 LLM generates</span>
    <span class="darr">↓<span class="lbl">eval: faithfulness, relevance</span></span>
    <span class="dbox green">✅ Answer</span>
  </div>
  <div class="dcap">Two failure surfaces, two metric families — always eval them separately.</div>
</div>

## Concrete example: a minimal recall@k check

```python
# Tiny retrieval-eval harness. Runs against any retriever(query) -> list[chunk_id].
eval_set = [
    {"q": "What is the termination notice period?", "gold": "clause_7"},
    {"q": "Who owns the IP created under this contract?", "gold": "clause_12"},
    {"q": "What is the governing law?", "gold": "clause_1"},
]

def recall_at_k(retriever, eval_set, k=5):
    hits = 0
    for row in eval_set:
        retrieved = retriever(row["q"])[:k]     # list of chunk ids
        if row["gold"] in retrieved:
            hits += 1
    return hits / len(eval_set)

# score = recall_at_k(my_retriever, eval_set, k=5)  -> e.g. 0.67
# If low: fix chunking / add hybrid (BM25 + vector) / rerank — not the LLM.
```

Twenty labelled questions is enough to start. In the interview, *saying* "I'd build a 20-question gold set and track recall@5 before touching the model" is often the winning line.

## How a company uses this (production lens)

A Dubai fintech running a policy-Q&A assistant over ~200k document chunks tracks **recall@5** nightly on a 150-question gold set in CI — a regression below 0.85 blocks the deploy. In production the retrieval budget is tight: a **p95 latency of ~300 ms** for the vector search, so they cap *k* at 8 and add a cross-encoder reranker only on the top 30 candidates (reranking all 200k would blow the budget). Faithfulness is scored by an LLM-judge on a 2% sample of live traffic; a spike in unfaithful answers pages the on-call, because it usually means an ingestion job silently corrupted chunks. Cost: judge calls on 2% of traffic keep eval under ~$40/day instead of thousands.

## Common mistakes
- **Only evaluating the final answer.** A right answer can hide broken retrieval (the model knew it anyway); a wrong answer doesn't tell you *which* stage failed. Split the eval.
- **No gold set.** "We eyeball outputs" signals no production experience. Always propose a labelled set.
- **Blaming the LLM for a retrieval miss.** If recall@k is low, swapping GPT for Claude changes nothing.
- **Testing recall@1 only.** RAG stuffs several chunks in; recall@k for your real *k* is the honest metric.

## Interview tip
When asked "how would you evaluate your RAG system?", answer in one breath: *"I split it — retrieval eval with recall@k and MRR against a gold set, generation eval with faithfulness and answer-relevance via LLM-as-judge. I fix low recall with chunking, hybrid search, and reranking; I fix low faithfulness with tighter prompts and grounding. I wire recall@k into CI so a regression blocks deploy."* That sentence alone often clears the round. See also [Failure-mode analysis](failure-mode-analysis.md) and [Cost / latency estimation](cost-latency-estimation.md).
