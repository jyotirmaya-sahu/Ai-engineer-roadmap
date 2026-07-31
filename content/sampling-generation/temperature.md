# Temperature

**The one-line idea:** temperature is a single number you pass to the API that controls how much randomness goes into the model's next-token choices — low means "always pick the safest word," high means "take wilder risks."

> **Bridge from the node intro.** In the Sampling & Generation overview you learned that an LLM turns your prompt into a *probability distribution* over its entire vocabulary — maybe 100 000 tokens, each with a score — and that *sampling parameters* are the dials that decide which token actually gets picked. Temperature is the **first and most important** of those dials. It sits inside the softmax step you already saw in the LLM Internals node, so this tile will make that math feel real for the first time.

## Why it matters for an AI Engineer

Temperature is the knob you adjust on almost every production API call. The stakes:

- **Support bots** answering policy questions need near-identical answers every time — inconsistency erodes trust and fails compliance audits.
- **Creative tools** (copywriting, brainstorming) need variety, otherwise every user gets the same sentence.
- **JSON-extraction pipelines** need the model locked down so it never drifts from the schema — even a single random token can break a downstream parser.
- **In interviews,** "what does temperature do and how does it work mechanically?" is the single most common sampling question. Knowing the math (not just the intuition) is what separates a confident answer from a vague one.

## The mechanism / how it works

### Step 1 — what the model outputs before temperature

You learned in LLM Internals that the model's final layer outputs a **logit** for every token in its vocabulary. A logit is just a raw score — a real number, not yet a probability. Think of it as "the model's unscaled confidence in each token."

Example: three candidate tokens with logits `mat = 2.0, floor = 1.0, roof = 0.1`.

Those numbers mean nothing on their own. To turn them into a probability distribution (all values between 0 and 1, summing to 1) the model runs **softmax**:

```
softmax(x_i) = exp(x_i) / sum(exp(x_j) for all j)
```

At T = 1.0 (the default — no temperature adjustment at all):

```
exp(2.0) = 7.39,  exp(1.0) = 2.72,  exp(0.1) = 1.10
total = 11.21

P(mat)   = 7.39 / 11.21 ≈ 0.66   (66%)
P(floor) = 2.72 / 11.21 ≈ 0.24   (24%)
P(roof)  = 1.10 / 11.21 ≈ 0.10   (10%)
```

So the model samples from `{mat: 66%, floor: 24%, roof: 10%}`. Most of the time it picks `mat`, but the others are live options.

### Step 2 — where temperature enters

Temperature **T** is a divisor applied to every logit *before* softmax:

```
adjusted_logit_i = logit_i / T
```

That's the entire mechanism — one division, then softmax as normal.

**Why does division change randomness?** Dividing the logits changes the *gaps between them*. Softmax is exponential, so gaps determine how dominant the top token is.

- **T < 1.0 → gaps get bigger → distribution sharpens (more deterministic)**
  Dividing by 0.5 is the same as multiplying by 2: the already-larger score grows even more dominant.
- **T > 1.0 → gaps get smaller → distribution flattens (more random)**
  Dividing by 2 brings all scores closer together; weak tokens gain relative ground.
- **T → 0 → top token wins with probability ≈ 1**
  This is called **greedy decoding** — no randomness, always the argmax.

### Step 3 — worked numbers at three temperatures

Starting from the same logits `[2.0, 1.0, 0.1]`:

**T = 0.5** — divide each logit by 0.5 → `[4.0, 2.0, 0.2]`

```
exp(4.0) = 54.60,  exp(2.0) = 7.39,  exp(0.2) = 1.22
total = 63.21

P(mat)   = 54.60 / 63.21 ≈ 0.86   (86%)
P(floor) =  7.39 / 63.21 ≈ 0.12   (12%)
P(roof)  =  1.22 / 63.21 ≈ 0.02   (2%)
```

**T = 1.0** — logits unchanged → `[2.0, 1.0, 0.1]`

```
P(mat) ≈ 0.66,  P(floor) ≈ 0.24,  P(roof) ≈ 0.10
```

(as computed above)

**T = 2.0** — divide each logit by 2 → `[1.0, 0.5, 0.05]`

```
exp(1.0) = 2.72,  exp(0.5) = 1.65,  exp(0.05) = 1.05
total = 5.42

P(mat)   = 2.72 / 5.42 ≈ 0.50   (50%)
P(floor) = 1.65 / 5.42 ≈ 0.30   (30%)
P(roof)  = 1.05 / 5.42 ≈ 0.19   (19%)
```

`roof` went from a 10% long-shot to a near-coin-flip candidate — that's what high temperature does. The model hasn't become "smarter" or "dumber"; the *same knowledge* is now sampled more or less narrowly.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">Logits<span class="sub">mat 2.0 · floor 1.0 · roof 0.1</span></span>
    <span class="darr">→<span class="lbl">÷ T</span></span>
    <span class="dbox orange">Scaled logits<span class="sub">÷ 0.5 | ÷ 1.0 | ÷ 2.0</span></span>
    <span class="darr">→<span class="lbl">softmax</span></span>
    <span class="dbox blue">T=0.5<span class="sub">mat 86% · floor 12% · roof 2%</span></span>
  </div>
  <div class="flow">
    <span class="dbox gray wide"> </span>
    <span class="darr" style="visibility:hidden">→</span>
    <span class="dbox gray wide"> </span>
    <span class="darr" style="visibility:hidden">→</span>
    <span class="dbox green">T=1.0<span class="sub">mat 66% · floor 24% · roof 10%</span></span>
  </div>
  <div class="flow">
    <span class="dbox gray wide"> </span>
    <span class="darr" style="visibility:hidden">→</span>
    <span class="dbox gray wide"> </span>
    <span class="darr" style="visibility:hidden">→</span>
    <span class="dbox purple">T=2.0<span class="sub">mat 50% · floor 30% · roof 19%</span></span>
  </div>
  <div class="dcap">Same logits, same softmax — only T changes. Lower T sharpens; higher T flattens. The model's knowledge is unchanged; only how narrowly you sample from it changes.</div>
</div>

## Concrete example — in the API and in NumPy

### Passing temperature to the API

In the Working with LLM APIs node you learned the `client.chat.completions.create(...)` call. Temperature is one parameter there:

```python
from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY from env

for temp in (0.0, 1.5):
    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[{"role": "user", "content": "Give me one name for a coffee shop."}],
        temperature=temp,
        max_tokens=10,
    )
    print(f"T={temp}: {response.choices[0].message.content}")

# T=0.0 → same name every single run  ("The Daily Grind")
# T=1.5 → different, quirkier each run ("Foam & Ember", "Cinder Cup", …)
```

### Implementing softmax-with-temperature yourself (numpy)

This makes the math tangible:

```python
import numpy as np

def softmax_with_temperature(logits: list[float], T: float) -> np.ndarray:
    logits = np.array(logits, dtype=float)
    scaled = logits / T            # the one line temperature adds
    exp_scaled = np.exp(scaled - scaled.max())  # subtract max for numerical stability
    return exp_scaled / exp_scaled.sum()

logits = [2.0, 1.0, 0.1]
tokens = ["mat", "floor", "roof"]

for T in (0.5, 1.0, 2.0):
    probs = softmax_with_temperature(logits, T)
    print(f"\nT={T}")
    for token, p in zip(tokens, probs):
        bar = "█" * int(p * 30)
        print(f"  {token:6s}  {p:.2%}  {bar}")
```

Run this and you'll see the exact numbers from the worked example above — and the bar chart makes the sharpening/flattening visceral.

## How a company uses this — HelpDesk

Remember HelpDesk, the support assistant you built in v1–v8 of the capstone. Every one of those `create()` calls ran at the API's default temperature (usually 1.0). Here's what changes when you tune it:

```python
# HelpDesk — tuned support reply (v8+)
response = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": customer_message},
    ],
    temperature=0.2,   # low: consistent, on-policy, easy to test in CI
    max_tokens=300,
)
```

**Why 0.2, not 0.0?** Exactly 0 can occasionally produce awkward, overly terse phrasing because there's zero variation. 0.1–0.3 keeps the wording natural while staying tightly consistent — two customers asking the same policy question get effectively the same answer. At scale (thousands of tickets/day) this also makes outputs **easier to cache** and **easier to regression-test**: set temperature to 0 only in your test harness, so a re-run catches prompt regressions reliably.

Contrast this with a hypothetical **HelpDesk Marketing Assistant** feature on the same infrastructure — brainstorming subject lines for outbound emails:

```python
# Marketing brainstorm: same model, opposite temperature
response = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "Give me 5 email subject lines for our summer promo."}],
    temperature=0.9,
    max_tokens=150,
)
```

Same model, same infrastructure, opposite dial — the sampling settings *are* the product difference between the two features.

## Common mistakes / misconceptions

- **"Low temperature = smarter model."** Temperature controls consistency, not correctness. A low temperature will confidently repeat the *same wrong answer* if the prompt is bad. Fix bad answers by fixing the prompt or the context, not by lowering temperature.
- **"High temperature fixes boring output."** Usually the real issue is a weak prompt. Temperature can add variety, but it can't add knowledge or creativity that isn't already in the model's weights.
- **Stacking high temperature and wide top-p simultaneously.** Both dials flatten the same distribution; using both aggressively gives unpredictable, hard-to-debug output. Pick one as your primary knob. (The next tile, [Top-K](top-k.md), explains why these interact.)
- **Expecting T = 0 to be perfectly deterministic across all runs.** Floating-point arithmetic and GPU batching effects mean even T = 0 can occasionally vary. For true reproducibility in tests, pair it with a fixed **[seed](seed.md)**.
- **Forgetting temperature on structured-output calls.** If you're asking the model to produce JSON, set temperature to 0 (or 0.1 at most). A random token inside a JSON string breaks every downstream parser.

## Interview tip

Say: *"Temperature divides every logit by T before softmax. T below 1 magnifies the gaps between logits, sharpening the distribution toward the top token — near-deterministic. T above 1 shrinks the gaps, flattening the distribution so unlikely tokens become real candidates — more creative but riskier. It controls consistency, not correctness. I use 0–0.3 for extraction, JSON, and factual Q&A, and 0.7–1.0 for copywriting or brainstorming. I pair T = 0 with a fixed seed for reproducible tests."* Citing the logit-division step shows you understand it mechanically, not just as a "creativity slider."

---

**Next up — [Top-K](top-k.md).** Temperature reshapes the whole distribution, but it never removes any token from consideration — even at T = 0.5, `roof` still has 2% probability, so on a long enough run it will eventually be sampled. Top-K takes a harder stance: it removes all but the K highest-scoring tokens *before* sampling even begins. That's the next dial to learn.
