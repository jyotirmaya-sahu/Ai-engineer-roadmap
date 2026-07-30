# Temperature

**The one-line idea:** temperature is a single number that decides how *random* the model's word choices are — low means "always pick the safest, most likely word," high means "take more creative risks."

## Why it matters for an AI Engineer

Temperature is the knob you touch on almost every API call, and it's the difference between a support bot that gives the same correct answer twice and one that improvises differently each time. Set it too high and a factual assistant starts inventing details; set it too low and a creative-writing tool produces flat, repetitive prose. In interviews, "what does temperature do?" is the single most common sampling question — because it's the master dial that the other knobs refine.

## The mechanism / how it works

Remember that at each step the model produces a **raw score (a logit)** for every token in its vocabulary. To turn those scores into probabilities, it runs them through a function called **softmax**. Temperature (T) is a divisor applied to the logits *before* softmax:

`adjusted_logit = logit / T`

- **T = 1.0** — logits pass through unchanged. The natural distribution.
- **T < 1.0** (e.g. 0.2) — dividing by a small number *magnifies* the gaps between logits. The top token pulls even further ahead, so its probability approaches 100%. The distribution gets **sharper** → more deterministic.
- **T > 1.0** (e.g. 1.5) — dividing by a big number *shrinks* the gaps. Weak tokens get relatively more probability, so unlikely words become viable. The distribution gets **flatter** → more random.
- **T → 0** — the top token wins with probability ~1. This is effectively **greedy decoding**: always pick the single most likely token.

Worked example. Suppose three tokens have logits `mat=3.0, floor=1.0, roof=0.0`.

- At **T=1.0**, softmax gives roughly `mat 84%, floor 11%, roof 4%`.
- At **T=0.5** (divide logits by 0.5 → `6, 2, 0`), the gaps double: `mat ~98%, floor 2%, roof ~0%`. Almost always `mat`.
- At **T=2.0** (divide by 2 → `1.5, 0.5, 0`), gaps shrink: `mat ~57%, floor 21%, roof 13%`. Now `roof` is a real possibility.

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">Low T (0.2)<span class="sub">▇▁▁ sharp → deterministic</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">T = 1.0<span class="sub">▇▃▁ natural</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">High T (1.5)<span class="sub">▇▅▃ flat → creative/risky</span></span>
  </div>
  <div class="dcap">Temperature reshapes the same distribution: low sharpens toward the top token, high flattens it toward the tail.</div>
</div>

## Concrete example

```python
# pip install openai
from openai import OpenAI
client = OpenAI()

for temp in (0.0, 1.4):
    r = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": "Give me a name for a coffee shop."}],
        temperature=temp,
        max_tokens=10,
    )
    print(f"T={temp}: {r.choices[0].message.content}")
# T=0.0 -> same safe answer every run ("The Daily Grind")
# T=1.4 -> different, quirkier each run ("Foam & Ember")
```

Anthropic and Google use the same parameter name; most APIs accept `0.0`–`2.0`.

## How a company uses this

A Dubai insurance firm running a claims-explainer bot on Claude sets **temperature 0** for the part that quotes policy numbers — they cannot afford a hallucinated coverage limit — and bumps it to **0.7** only for the friendly summary paragraph. Splitting one workflow into two temperature regimes is a common production pattern: deterministic where correctness matters, warmer where tone matters. At scale, low temperature also makes outputs cacheable and easier to test in CI.

## Common mistakes / misconceptions

- **"Temperature controls how smart the model is."** No — it only controls randomness. A low temperature doesn't make the model more accurate, it makes it more *consistent* (it will confidently repeat the same wrong answer if the prompt is bad).
- **Stacking temperature *and* top-p aggressively.** They both shape the same distribution; cranking both leads to unpredictable output. Pick temperature as your main dial and leave top-p near default, or vice versa (see **[Top-P](top-p-nucleus.md)**).
- **Expecting T=0 to be perfectly deterministic.** Floating-point and batching effects mean even T=0 can occasionally vary across hardware. For true reproducibility you also want a **[seed](seed.md)**.
- **Using high temperature to "fix" boring output** when the real issue is a weak prompt.

## Interview tip

Say: *"Temperature divides the logits before softmax — below 1 sharpens the distribution toward the top token (deterministic), above 1 flattens it (creative). I use near-0 for extraction, JSON, and factual Q&A, and 0.7–1.0 for brainstorming or copywriting. It changes *consistency*, not *correctness*."* Mentioning the logit-division mechanism instantly signals you understand it beyond the surface.
