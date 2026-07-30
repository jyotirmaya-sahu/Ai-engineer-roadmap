# METEOR

**The one-line idea:** METEOR is a smarter word-overlap metric that fixes BLEU's biggest rigidities — it matches synonyms and word stems, not just exact words, and rewards keeping matched words in the right order.

## Why it matters for an AI Engineer

METEOR sits between crude n-gram metrics (BLEU/ROUGE) and heavy semantic ones (BERTScore): it correlates better with human judgment than BLEU while still being cheap and deterministic. You'll meet it in translation and captioning benchmarks and in evaluation reports where teams want "BLEU but less brittle." Knowing it rounds out your grasp of the *intrinsic metric* family — the classic overlap metrics you use when you have references.

## The mechanism — how it works

METEOR = **Metric for Evaluation of Translation with Explicit ORdering**. It improves on BLEU in three ways:

1. **Flexible matching (the key upgrade).** It aligns output and reference words in stages: first **exact** matches, then **stem** matches ("running" ↔ "run"), then **synonym** matches via WordNet ("quick" ↔ "fast"). So a correct paraphrase isn't punished the way BLEU punishes it.
2. **Recall-weighted F-mean.** It computes precision and recall on the matched words and combines them into an F-score that **weights recall higher** (default recall counts ~9× precision) — because missing content hurts more than saying a bit extra.
3. **Fragmentation penalty for word order.** It groups the matched words into the fewest contiguous "chunks." If your matches are scattered (bad order), you have many chunks and get penalized; if they run in-order, few chunks and little penalty. This is how METEOR rewards fluent ordering without demanding rigid n-gram adjacency.

`METEOR = F_mean × (1 − fragmentation_penalty)`, from 0–1.

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">exact match</span>
    <span class="darr">↓<span class="lbl">then</span></span>
    <span class="dbox orange">stem match (run/running)</span>
    <span class="darr">↓<span class="lbl">then</span></span>
    <span class="dbox orange">synonym match (fast/quick)</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ recall-weighted F × order penalty</span>
  </div>
  <div class="dcap">Stage the alignment (exact → stem → synonym), then score recall-weighted overlap penalized for scattered order.</div>
</div>

## Concrete example

```python
# pip install nltk
import nltk
nltk.download("wordnet")   # METEOR needs WordNet for synonym matching
from nltk.translate.meteor_score import meteor_score

reference = "The termination notice period is 30 days".split()
output    = "The cancellation notice window is 30 days".split()
#            "cancellation"≈"termination", "window"≈"period" via WordNet

print(round(meteor_score([reference], output), 3))
# ~0.85 — high, because synonyms are credited; BLEU-2 here would be far lower
```

## How a company uses this

A team building an **English↔Arabic translation quality dashboard** for a Dubai enterprise reported BLEU *and* METEOR side by side. BLEU alone kept flagging perfectly good translations that used a synonym of the reference word, generating noise for reviewers; METEOR's stem/synonym matching absorbed those cases and tracked human ratings more closely, so it became the metric managers actually trusted for "is quality trending up?" They still watched BLEU for cross-team comparability (it's the lingua franca), but used METEOR as the **human-aligned trend line**. For Arabic specifically they noted WordNet synonym coverage is English-centric — a known limitation they compensated for with occasional human spot-checks.

## Common mistakes / misconceptions

- **Expecting synonym matching in every language.** METEOR's synonym stage relies on WordNet, which is strongest for English. In low-resource languages you effectively get stem+exact matching only.
- **Treating it as semantic understanding.** It matches word-by-word (with synonyms), not whole-sentence meaning like BERTScore. It won't credit a full structural paraphrase the way an embedding metric does.
- **Using its default weights blindly.** The recall bias and penalty weights were tuned on translation; for other tasks the defaults may not be ideal.
- **Skipping the WordNet download.** Without it, synonym matching silently degrades to exact/stem only.

## Interview tip
Say: *"METEOR is BLEU made less brittle — it aligns words in stages (exact, then stem, then WordNet synonyms), scores a recall-weighted F-mean, and penalizes scattered word order via a fragmentation term. It correlates with humans better than BLEU but is still a word-level metric, so for full paraphrase I'd reach for BERTScore."* Placing it precisely on the crude-to-semantic spectrum shows real command of the metric family.

See also: [BLEU](./bleu.md) (the metric it improves on), [ROUGE](./rouge.md) (recall-oriented overlap), and [BERTScore](./bertscore.md) (fully semantic, embedding-based).
