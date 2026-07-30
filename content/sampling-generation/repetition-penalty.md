# Repetition penalty

**The one-line idea:** nudge the model *away* from words it has already used, so it stops looping the same phrase over and over. A few related knobs — repetition penalty, frequency penalty, presence penalty — all do a version of this.

## Why it matters for an AI Engineer

LLMs, especially smaller or open-source ones at low temperature, love to get stuck: "The product is great. The product is great. The product is great…" Repetition controls are the fix. Knowing the difference between OpenAI's **frequency/presence penalties** and the open-source **repetition_penalty** — and that they're different *math* — is a real distinction interviewers probe, because it shows you've actually shipped generation code and debugged a looping model.

## The mechanism / how it works

All these knobs edit the **logits** (the raw pre-softmax scores) of tokens the model has *already produced*, making them less likely to be picked again. There are two flavors:

**1. Multiplicative — `repetition_penalty` (Hugging Face, vLLM, most open-source).**
For any token already in the output, divide its logit by a penalty value `r > 1` (e.g. 1.1–1.3). Bigger `r` = stronger discouragement. `r = 1.0` = no penalty. (Technically it divides positive logits and multiplies negative ones, so "already-seen" tokens always move toward less likely.)

**2. Additive — `frequency_penalty` and `presence_penalty` (OpenAI, range −2.0 to 2.0).**
- **Frequency penalty:** subtract an amount from a token's logit *proportional to how many times it already appeared*. Say something 5 times and it gets penalized 5× — scales with overuse.
- **Presence penalty:** subtract a *flat* amount the moment a token appears *even once*. It doesn't care about count — it just pushes the model toward *new* topics/words it hasn't touched yet.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">Token logits<span class="sub">incl. words already said</span></span>
    <span class="darr">→<span class="lbl">seen before?</span></span>
    <span class="dbox purple">subtract / divide penalty</span>
    <span class="darr">→</span>
    <span class="dbox green">softmax → sample<span class="sub">repeats now less likely</span></span>
  </div>
  <div class="dcap">Penalties edit the logits of already-used tokens down before sampling, breaking loops.</div>
</div>

**Rule of thumb:** frequency penalty fights *literal repetition of the same words*; presence penalty pushes toward *covering new ground*.

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

r = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "List 8 marketing ideas for a Dubai cafe."}],
    frequency_penalty=0.6,   # discourage reusing the same words
    presence_penalty=0.3,    # nudge toward fresh topics
    max_tokens=200,
)
print(r.choices[0].message.content)
```

Open-source equivalent (Hugging Face):

```python
gen("Describe the desert at dawn.", repetition_penalty=1.2, max_new_tokens=60)
# 1.0 = off; 1.1-1.3 typical; >1.5 starts hurting fluency.
```

## How a company uses this

A Dubai e-commerce company auto-generating thousands of product descriptions on a self-hosted model kept getting outputs that repeated the brand name every sentence. Setting **repetition_penalty 1.15** cleaned it up without making the copy read strangely. On the OpenAI side, a content team writing long articles uses **presence_penalty ~0.4** to stop the model circling back to the same three points across a 1,500-word piece. In both cases the penalty is a targeted fix for a specific failure mode — not something you crank blindly.

## Common mistakes / misconceptions

- **Cranking it too high.** `repetition_penalty > 1.5` or `frequency_penalty` near 2.0 makes the model *avoid necessary words* (articles, the topic itself) and produces awkward or incoherent text.
- **Confusing frequency and presence penalties.** Frequency scales with count; presence is a one-time flat hit. They solve slightly different problems and can be combined.
- **Mixing up the scales.** OpenAI's penalties run −2 to 2 (additive); open-source `repetition_penalty` is a multiplier around 1.0–1.3. Don't pass a 1.2 to `frequency_penalty` thinking it's the same thing.
- **Using penalties to fix looping that's really caused by too-low temperature.** Sometimes nudging **[temperature](temperature.md)** up slightly is the cleaner fix.

## Interview tip

Say: *"Repetition controls edit the logits of already-used tokens downward. Open-source stacks use a multiplicative `repetition_penalty` around 1.1–1.3; OpenAI splits it into frequency penalty — scales with how often a token appeared — and presence penalty — a flat hit once it appears at all, which pushes toward new topics. I reach for them when a model loops, and keep them modest so fluency survives."* Distinguishing frequency vs presence is the detail that signals real experience.
