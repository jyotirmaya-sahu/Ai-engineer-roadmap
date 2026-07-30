# Top-P (nucleus)

**The one-line idea:** instead of keeping a fixed *number* of candidate tokens, keep the smallest set whose probabilities *add up to* P (say 0.9), then sample from that set. The candidate list grows when the model is unsure and shrinks when it's confident.

## Why it matters for an AI Engineer

Top-P — also called **nucleus sampling** — is the modern default cutoff, and the one OpenAI, Anthropic, and Google all expose. It fixes the core weakness of **[top-k](top-k.md)**: a fixed count can't adapt to how confident the model is. Top-P adapts automatically, which is why "temperature + top-p" is the setting pair you'll actually tune in production. Understanding it — and *why* you rarely lower both it and temperature at once — is table-stakes for an AI Engineer interview.

## The mechanism / how it works

Rank the tokens by probability, highest first, and start adding them up. The moment the running total reaches **P**, stop — everything you've added so far is the "nucleus," and you sample only from it. Everything below the cutoff is discarded.

Worked example with **P = 0.9**:

`mat .55` → total .55
`floor .20` → total .75
`roof .10` → total .85
`ceiling .06` → total .91 ✅ crossed 0.9, stop here

Nucleus = `{mat, floor, roof, ceiling}` (4 tokens). Renormalize and sample from those.

Now watch it **adapt**. If instead the model were very confident — `mat .93, floor .03, …` — the very first token already exceeds 0.9, so the nucleus is just `{mat}`: effectively deterministic. And if the model were very unsure — 50 tokens each around .02 — the nucleus swells to ~45 tokens to reach 0.9. **Same P value, wildly different candidate-set sizes**, matched to the model's actual certainty. That's the whole advantage over top-k.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">Confident step<span class="sub">mat .93 → nucleus = {mat} (1 token)</span></span>
    <span class="darr">↓<span class="lbl">same P=0.9</span></span>
    <span class="dbox orange">Normal step<span class="sub">.55/.20/.10/.06 → nucleus = 4 tokens</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">Unsure step<span class="sub">50 tokens ~.02 → nucleus ≈ 45 tokens</span></span>
  </div>
  <div class="dcap">Top-P keeps a probability *mass*, so the candidate set auto-sizes to the model's confidence at each step.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

r = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "Write one vivid sentence about the Dubai skyline."}],
    temperature=1.0,
    top_p=0.9,        # only sample from the top ~90% probability mass
    max_tokens=40,
)
print(r.choices[0].message.content)
# Lower top_p (e.g. 0.5) -> tighter, safer wording.
# top_p=1.0 -> no nucleus filtering; the full distribution is in play.
```

## How a company uses this

A Dubai media startup generating social captions runs **temperature 0.9, top_p 0.95**: enough randomness for fresh phrasing, but the 0.95 nucleus quietly drops the absolute-garbage tail so captions never go off the rails. For its legal-summary feature it flips to **temperature 0.2, top_p 1.0** — leaving top_p wide open because low temperature has already sharpened the distribution, so the nucleus is naturally tiny. This is the standard pro move: **use temperature as the primary dial and adjust one of top-p/top-k, not both hard at once**, because they compound in confusing ways.

## Common mistakes / misconceptions

- **Lowering temperature *and* top-p both to near-zero.** They stack — you can strangle the output into repeating one phrase. Change one meaningfully, keep the other near default.
- **Thinking top_p=0.9 means "keep 90% of tokens."** It keeps the *fewest* tokens whose *probability* sums to 0.9 — often just a handful, not 90,000.
- **Setting top_p=1.0 and expecting a change.** 1.0 means "no filtering" — the whole distribution is eligible; temperature alone is doing the work.
- **Confusing it with top-k.** Top-k = fixed *count*; top-p = fixed *probability mass* that adapts per step. (See **[top-k](top-k.md)**.)

## Interview tip

Say: *"Top-P, or nucleus sampling, keeps the smallest set of tokens whose probabilities sum to P and samples from that. Unlike top-k's fixed count, the nucleus auto-sizes to the model's confidence — tiny when it's sure, large when it's uncertain. I keep temperature as my main dial and leave top_p around 0.9–1.0, rather than clamping both."* The "adapts to confidence" line is the one that lands.
