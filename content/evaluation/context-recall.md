# Context recall

**The one-line idea:** Context recall measures whether the retriever fetched *all* the information needed to answer — of the facts required by the correct answer, how many actually appear in the retrieved chunks?

## Why it matters for an AI Engineer

This is the metric that catches RAG's most silent failure: **the answer was never retrievable.** If the chunk containing the answer never made it into the context, no prompt, no model, no reranker can save you — the LLM is forced to guess or refuse. Context recall is your proof that retrieval *found the answer at all*. It's the completeness half of RAGAS retrieval eval, and it's usually the *first* thing to check when faithfulness is low: often the LLM didn't hallucinate out of malice, it hallucinated because you never gave it the facts.

## The mechanism — how it works

Context recall (a **RAGAS** metric) needs a **ground-truth answer** and works backward from it:

1. **Break the ground-truth answer into claims.** The reference answer is decomposed into its individual factual statements.
2. **Check each claim against the retrieved context.** For every claim in the *correct* answer, can it be attributed to (found in) the retrieved chunks? Yes/No.
3. **Score = attributable claims / total claims in the ground truth.** If the correct answer needs 3 facts and only 2 appear in your retrieved context, recall = 0.67 — one required fact was never fetched.

The key contrast with precision: **recall is about the reference answer**, not about the chunks. Precision asks "is what I retrieved clean?"; recall asks "does what I retrieved *contain everything the right answer needs*?" You can max one while tanking the other, which is exactly why RAGAS reports both.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 ground-truth answer</span>
    <span class="darr">↓<span class="lbl">decompose into needed facts</span></span>
    <span class="dbox orange">fact A · fact B · fact C</span>
    <span class="darr">↓<span class="lbl">each found in retrieved context?</span></span>
    <span class="dbox blue">🗄️ ✅ ✅ ❌</span>
    <span class="darr">↓</span>
    <span class="dbox green">recall = 2/3</span>
  </div>
  <div class="dcap">Of the facts the correct answer requires, how many did retrieval actually surface?</div>
</div>

## Concrete example

```python
from ragas import evaluate
from ragas.metrics import context_recall
from datasets import Dataset

data = Dataset.from_dict({
    "question":     ["How do I close my savings account and is there a fee?"],
    "ground_truth": ["Give 30 days written notice; a 50 AED early-closure fee applies."],
    "answer":       ["Give 30 days written notice."],
    "contexts":     [[                                   # retriever fetched only:
        "Closing a savings account requires 30 days written notice.",
        # the fee document was NOT retrieved
    ]],
})

result = evaluate(data, metrics=[context_recall])
print(result)   # ~0.5 — the "notice" fact is present, the "fee" fact was never retrieved
```

The fee fact required by the correct answer is missing from the context, so recall drops to ~0.5 — a retrieval gap, not a generation bug.

## How a company uses this

A **Dubai bank's** assistant kept giving *incomplete* answers on multi-part questions. Faithfulness looked fine (everything it said *was* grounded), which is why the team almost blamed the prompt. Context recall revealed the truth: recall was ~0.6 — retrieval routinely missed one of the needed documents. The fix was in the **retriever**, not the LLM: larger K, hybrid search, and better chunking so related facts weren't split across chunks that ranked far apart. Recall climbed to ~0.9 and answers became complete. They now gate releases on **both** recall (nothing missing) and precision (nothing noisy), because optimizing one alone quietly wrecks the other.

## Common mistakes / misconceptions

- **Blaming the LLM for incomplete answers.** If recall is low, the facts were never retrieved — fix retrieval (K, hybrid search, chunking), not the prompt.
- **Thinking high precision implies high recall.** A retriever returning one perfect chunk has precision 1.0 but may miss two other needed facts → recall 0.33. Independent axes.
- **Skipping the ground truth.** Context recall *requires* a reference answer to know what facts were needed. It's a golden-dataset metric.
- **Chasing recall to 1.0 blindly.** Retrieving everything to guarantee recall destroys precision and cost. Balance the two.

## Interview tip
Say: *"Context recall checks whether retrieval surfaced *all* the facts the correct answer needs — it decomposes the ground-truth answer and verifies each fact appears in the retrieved chunks. It's my first stop when answers are incomplete or faithfulness is low, because that's usually a retrieval gap, not the LLM. I tune it against precision — complete but not noisy."* Diagnosing incompleteness as a retrieval problem is the exact reasoning interviewers want.

See also: [Context precision](./context-precision.md) (the clean-vs-complete counterpart), [Faithfulness](./faithfulness.md) (often low *because* recall is low), and [Precision@K / MRR / NDCG](./precision-k-mrr-ndcg.md).
