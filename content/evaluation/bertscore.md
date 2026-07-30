# BERTScore

**The one-line idea:** BERTScore compares output to a reference by *meaning* instead of exact words — it embeds every token with BERT and matches them by similarity, so a correct paraphrase scores high even when it shares almost no literal words.

## Why it matters for an AI Engineer

BERTScore fixes the one thing ROUGE and BLEU get wrong: **paraphrase**. LLMs rarely echo the reference verbatim — they say the same thing differently, and word-overlap metrics unfairly punish that. BERTScore gives you a *semantic* score that still needs only a reference (no expensive LLM judge, deterministic, fast enough for CI). In interviews it's the natural answer to "ROUGE seems too rigid — what do you use instead?"

## The mechanism — how it works

Word-overlap metrics ask "same tokens?" BERTScore asks "same *meaning*?" by working in embedding space:

1. **Embed both texts token-by-token** with a contextual model (BERT/RoBERTa/DeBERTa). Each token becomes a vector that captures its meaning *in context* — so "bank" in "river bank" and "savings bank" get different vectors.
2. **Greedy match by cosine similarity.** For each token in the output, find the reference token it's most similar to; and vice-versa. This is soft matching — "notice period" ≈ "notification window" score high even though the strings differ.
3. **Recall, precision, F1.** Recall = average best-match similarity for each *reference* token (did we cover the reference's meaning?). Precision = same from the *output* side (is our output all on-topic?). F1 combines them. An optional **IDF weighting** downweights common words like "the" so content words dominate.

The result is 0–1 (usually ~0.85–0.95 for good text, since even unrelated English shares some similarity — read it *relatively*).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 reference tokens</span>
    <span class="darr">→<span class="lbl">BERT embed</span></span>
    <span class="dbox blue">🔢 vectors</span>
    <span class="darr">→<span class="lbl">cosine match</span></span>
    <span class="dbox orange">best-match per token</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ P / R / F1</span>
  </div>
  <div class="dcap">Match tokens by embedding similarity, not exact string — so paraphrase counts as a match.</div>
</div>

## Concrete example

```python
# pip install bert-score
from bert_score import score

refs    = ["The termination notice period is 30 days."]
outputs = ["You must give 30 days' notice to terminate."]   # full paraphrase, few shared words

P, R, F1 = score(outputs, refs, lang="en", rescale_with_baseline=True)
print(f"BERTScore F1 = {F1.item():.3f}")   # high (~0.8+) — ROUGE-2 would be near 0 here
```

`rescale_with_baseline=True` re-centers scores so "unrelated text" sits near 0 instead of 0.85, making the numbers far easier to read.

## How a company uses this

A **Dubai media company** auto-summarizing Arabic news articles found ROUGE was flagging good summaries as failures whenever the model paraphrased — burning reviewer time on false alarms. Switching the CI gate to **BERTScore (with a multilingual model)** cut those false negatives sharply: semantically faithful summaries now scored high regardless of wording. They kept ROUGE too, as a cheap first pass, and escalated only cases where *both* ROUGE and BERTScore dropped — a two-tier funnel that reserved the expensive LLM-judge for genuinely ambiguous outputs. At their volume this kept per-release eval cost near zero while catching real regressions.

## Common mistakes / misconceptions

- **Reading raw scores as percentages.** Without baseline rescaling, 0.85 might be *bad*. Always `rescale_with_baseline=True` and compare relatively.
- **Wrong-language model.** For Arabic, use a multilingual/Arabic BERT — an English model gives garbage similarities.
- **Thinking it detects factual errors.** BERTScore measures semantic closeness to the reference, not truth. "The period is 30 days" vs "…is 60 days" are *semantically similar* and score high despite the wrong number. It's not a hallucination detector.
- **Ignoring it needs a reference.** Like ROUGE/BLEU, it's reference-based. No gold text → LLM-as-judge.

## Interview tip
Say: *"BERTScore is semantic overlap — it embeds tokens with BERT and matches by cosine similarity, so it credits paraphrase where ROUGE and BLEU can't. I rescale with the baseline for readable numbers and use a language-matched model. Its blind spot is factuality — it rates meaning-closeness, not truth — so I pair it with faithfulness checks for anything trust-critical."* Naming both the paraphrase win and the factuality blind spot is the full answer.

See also: [ROUGE](./rouge.md) and [BLEU](./bleu.md) (word-overlap it improves on), [METEOR](./meteor.md) (a lighter step toward semantics), and [Faithfulness](./faithfulness.md) (for truth, not similarity).
