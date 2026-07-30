# ROUGE

**The one-line idea:** ROUGE scores a generated summary by counting how many word-sequences (n-grams) it shares with a human-written reference summary — it's *recall-focused*: did you capture what the reference contained?

## Why it matters for an AI Engineer

ROUGE is the default automatic metric for **summarization** — the single most common LLM feature in enterprise apps (summarize this ticket, this contract, this call transcript). It's cheap, deterministic, and needs no model to compute, so you can score thousands of summaries in seconds on every commit. When someone asks "how did you measure your summarizer?", ROUGE is the expected first word out of your mouth — followed immediately by its limitations.

## The mechanism — how it works

ROUGE = **Recall-Oriented Understudy for Gisting Evaluation**. You compare the model output against one or more reference texts by overlapping n-grams (contiguous word sequences):

- **ROUGE-N** — overlap of n-grams. ROUGE-1 = single words, ROUGE-2 = word pairs (bigrams). Bigrams reward getting word *order* right, not just the bag of words.
- **ROUGE-L** — longest common subsequence. Rewards words appearing in the same *order* even with gaps, so it captures sentence-level structure without requiring exact adjacency.

Because it's "recall-oriented," the core count is: *of the n-grams in the reference, how many did the output also contain?* You usually also report precision (of the output's n-grams, how many are in the reference) and combine both into an **F1**. High ROUGE recall + low precision = your summary is padded with extra words; the reverse = too terse and missing content.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 reference: "the cat sat on the mat"</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🔢 count shared unigrams/bigrams</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 output: "the cat sat on a mat"</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ ROUGE-1 recall = 5/6</span>
  </div>
  <div class="dcap">ROUGE counts overlapping word-sequences between output and reference — recall = fraction of the reference recovered.</div>
</div>

## Concrete example

```python
# pip install rouge-score
from rouge_score import rouge_scorer

reference = "The termination notice period is 30 days for savings accounts."
output    = "Savings accounts require a 30 day termination notice period."

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference, output)

for k, v in scores.items():
    print(f"{k}: P={v.precision:.2f} R={v.recall:.2f} F1={v.fmeasure:.2f}")
# rouge1: P=0.75 R=0.75 F1=0.75   (most content words match)
# rouge2: F1 lower — word order differs
```

Note the model's answer is a *correct paraphrase* but ROUGE-2 drops because it reordered the words — that gap is the metric's key weakness.

## How a company uses this

A **Dubai insurance firm** summarizing claim documents scored 5,000 model summaries against adjuster-written references nightly, reporting ROUGE-1/2/L F1 in their Langfuse dashboard. It ran in **under 10 seconds** with zero API cost, which is exactly why it's the CI-gate metric: an LLM-as-judge over 5,000 items would cost real money and minutes per run. They used ROUGE as a *cheap regression tripwire* — a sudden 5-point drop flagged a bad prompt change — then escalated only the flagged cases to human review.

## Common mistakes / misconceptions

- **Treating ROUGE as ground truth for quality.** It rewards word overlap, not meaning. A perfect paraphrase with different words scores low; a fluent-but-wrong copy of reference words scores high. Pair it with BERTScore (semantic) or LLM-as-judge.
- **Using it without references.** ROUGE *needs* a gold reference. No reference text = use LLM-as-judge instead.
- **Reporting one number.** Always report ROUGE-1, -2, and -L — they measure different things (content vs. order vs. structure).
- **Ignoring precision.** Recall alone lets a verbose summary game the score. Report F1.

## Interview tip
Say: *"ROUGE is recall-oriented n-gram overlap against a reference — ROUGE-1 for content, ROUGE-2 for order, ROUGE-L for structure via longest common subsequence. It's my cheap deterministic gate for summarization in CI, but it's blind to paraphrase, so I back it with BERTScore or an LLM judge for semantic quality."* Naming the paraphrase blind spot is what signals you actually use it.

See also: [BLEU](./bleu.md) (precision-oriented sibling for translation), [BERTScore](./bertscore.md) (semantic overlap), and [LLM-as-judge](./llm-as-judge.md) (when you have no reference).
