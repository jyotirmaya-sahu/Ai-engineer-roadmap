# Answer relevancy

**The one-line idea:** Answer relevancy measures whether the answer actually *addresses the question that was asked* — catching responses that are on-topic and even faithful, but rambling, incomplete, or dodging the real question.

## Why it matters for an AI Engineer

Faithfulness checks the answer is grounded; answer relevancy checks it's *responsive*. A RAG system can return a paragraph that's 100% supported by the docs yet never answers what the user asked — full of hedging, padding, or a related-but-wrong tangent. Users experience that as "it didn't help me," and relevancy is the metric that quantifies it. Together, faithfulness + answer relevancy cover the two ways a generated answer fails: *made-up* vs *off-target*.

## The mechanism — how it works

Answer relevancy (a **RAGAS** metric) uses a clever reverse trick: **a relevant answer should let you reconstruct the original question.**

1. **Generate questions from the answer.** An LLM reads only the answer and writes several questions that this answer would be a good response to (typically 3).
2. **Embed and compare to the real question.** Each generated question is embedded and compared (cosine similarity) to the embedding of the *actual* question the user asked.
3. **Score = average similarity.** If the answer squarely addresses the real question, the reverse-generated questions look just like it → high similarity → high relevancy. If the answer wandered, the reverse-generated questions drift away from the real one → low score.

It also **penalizes non-committal answers**: RAGAS flags evasive replies ("I'm not sure, it depends…") as low relevancy because they don't pin down a clear question. Note this metric is about *addressing the question*, deliberately independent of factual correctness — a confidently wrong but on-target answer can still score high on relevancy (that's why you never use it alone).

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 answer</span>
    <span class="darr">↓<span class="lbl">reverse-generate questions</span></span>
    <span class="dbox orange">Q'1 · Q'2 · Q'3</span>
    <span class="darr">↓<span class="lbl">cosine vs real question</span></span>
    <span class="dbox green">relevancy = avg similarity</span>
  </div>
  <div class="dcap">If the answer truly addresses the question, questions reverse-generated from it look like the original.</div>
</div>

## Concrete example

```python
from ragas import evaluate
from ragas.metrics import answer_relevancy
from datasets import Dataset

data = Dataset.from_dict({
    "question": ["What is the notice period to close a savings account?"],
    "answer":   ["Savings accounts are a great way to earn interest and are FDIC-insured."],
    "contexts": [["Closing a savings account requires 30 days written notice."]],
})   # answer is on-topic (savings accounts) but never mentions notice period

result = evaluate(data, metrics=[answer_relevancy])
print(result)   # low relevancy — the answer dodged the actual question
```

The answer talks about savings accounts but never gives a notice period, so reverse-generated questions ("Are savings accounts insured?") diverge from the real one → low score.

## How a company uses this

A **Dubai telecom's** support bot passed faithfulness but users still complained. Adding answer relevancy exposed the pattern: the bot returned grounded-but-generic paragraphs that circled the topic without answering the specific question — high faithfulness, low relevancy. Tracking both metrics turned "customers are unhappy for some reason" into a precise diagnosis, and a prompt change ("answer the specific question directly, then add context") lifted relevancy without hurting grounding. They watch the **faithfulness × relevancy** pair on the dashboard: high-high is the only quadrant that ships.

## Common mistakes / misconceptions

- **Assuming faithful = relevant.** They're orthogonal. A grounded answer can miss the question; relevancy is what catches it.
- **Reading it as a correctness metric.** Answer relevancy is about *addressing the question*, not being *right*. A confident wrong-but-on-target answer scores high. Always pair with faithfulness/correctness.
- **Penalizing honest refusals wrongly.** When context genuinely lacks the answer, a clear "the documents don't cover this" is the *correct* behavior even if relevancy dips — interpret low scores in light of whether the info was retrievable.
- **Using a mismatched embedding model.** Cross-lingual or wrong-domain embeddings distort the similarity. Match the embedder to your language/domain.

## Interview tip
Say: *"Answer relevancy — RAGAS — reverse-generates questions from the answer and measures their similarity to the real question, so it catches on-topic-but-non-responsive replies and penalizes evasive ones. It's deliberately independent of correctness, so I always read it next to faithfulness: grounded *and* on-target is the only pass."* Framing it as one axis of a pair shows you understand RAG eval as a system, not a single number.

See also: [Faithfulness](./faithfulness.md) (grounding, the other half of answer quality), [Context precision](./context-precision.md) and [Context recall](./context-recall.md) (retrieval quality), and [Rubric scoring](./rubric-scoring.md).
