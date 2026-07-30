# BLEU

**The one-line idea:** BLEU scores generated text by measuring how many of *its* n-grams appear in a reference — it's *precision-focused* (did you avoid saying things the reference didn't?), with a penalty for being too short.

## Why it matters for an AI Engineer

BLEU is the classic metric for **machine translation** and any task where output should closely match a known correct string — and LLMs now do a lot of translation (localize this UI into Arabic, translate these support tickets). More importantly, BLEU is the counterpart every interviewer expects you to contrast with ROUGE: *ROUGE is recall (summarization), BLEU is precision (translation)*. Knowing which to reach for — and why overlap metrics fail on open-ended chat — is core evaluation literacy.

## The mechanism — how it works

BLEU = **BiLingual Evaluation Understudy**. It flips ROUGE's question: instead of "how much of the reference did we recover?", it asks **"how much of what we produced is actually in the reference?"** — precision, so it punishes made-up extra words.

Three moving parts:

1. **Modified n-gram precision.** For n=1..4, count how many of the output's n-grams appear in the reference — but *clip* each n-gram's count at how many times it appears in the reference, so repeating "the the the" can't inflate the score.
2. **Geometric mean** of the 1-, 2-, 3-, 4-gram precisions. Because it's a geometric mean, **any single n-gram level scoring 0 zeroes the whole thing** — that's why BLEU on short texts is brittle.
3. **Brevity penalty (BP).** Precision alone loves short output (say one correct word, score 1.0). BP multiplies the score down when the output is shorter than the reference, forcing adequate length.

`BLEU = BP × exp(mean of log n-gram precisions)`, reported 0–100.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 output n-grams (1–4)</span>
    <span class="darr">↓<span class="lbl">clip to reference counts</span></span>
    <span class="dbox orange">🔢 precision per n</span>
    <span class="darr">↓<span class="lbl">geometric mean</span></span>
    <span class="dbox orange">× brevity penalty</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ BLEU 0–100</span>
  </div>
  <div class="dcap">Clipped n-gram precision, geometric-averaged, then penalized for being too short.</div>
</div>

## Concrete example

```python
# pip install sacrebleu   (the standard, tokenization-stable implementation)
import sacrebleu

references = [["The termination notice period is 30 days."]]  # list of ref-lists
output     = ["Termination notice period is 30 days."]

bleu = sacrebleu.corpus_bleu(output, references)
print(bleu.score)   # ~62 — high overlap, brevity penalty for the dropped "The"
```

Always use **sacreBLEU**, not a hand-rolled BLEU — scores are only comparable across papers/teams if tokenization is identical, and sacreBLEU standardizes it.

## How a company uses this

A **Dubai govt e-services team** localizing an English portal to Arabic ran BLEU against professional human translations as a **fast, free regression gate**: every model or prompt change re-scored 1,000 sentence pairs in seconds, and a BLEU drop flagged translations for a human reviewer before release. At their scale (tens of thousands of strings) they couldn't human-review everything each build, so BLEU triaged *which* strings degraded. They knew its ceiling — one valid translation can phrase things differently from the reference and score low — so BLEU never *approved* a release alone; it only *flagged regressions*.

## Common mistakes / misconceptions

- **Using BLEU on chat / open-ended answers.** It assumes one right string. Free-form responses have many valid forms → BLEU is meaningless there. Use LLM-as-judge.
- **Comparing BLEU across different tokenizations.** A BLEU number is only meaningful with a stated setup — hence sacreBLEU.
- **Expecting high absolute values.** Even great translations often score 30–50; BLEU is for *relative* comparison, not an absolute grade.
- **One reference.** BLEU improves a lot with multiple references — real translation has many correct forms.

## Interview tip
Say: *"BLEU is precision-oriented clipped n-gram overlap with a brevity penalty — the translation counterpart to ROUGE's recall. I use sacreBLEU for reproducibility, treat it as a relative regression tripwire not an absolute grade, and never apply it to open-ended chat where there's no single correct string."* The ROUGE-vs-BLEU (recall vs precision, summarize vs translate) contrast is the exact thing they're probing.

See also: [ROUGE](./rouge.md) (recall-oriented sibling), [METEOR](./meteor.md) (adds synonyms/stemming to fix BLEU's rigidity), and [BERTScore](./bertscore.md) (semantic, paraphrase-aware).
