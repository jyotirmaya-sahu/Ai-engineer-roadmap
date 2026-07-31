# Repetition penalty

**The one-line idea:** before the model picks the next token it scores every word in its vocabulary — so just reach into those scores for words it already said and push them down, making the model less likely to loop or repeat itself.

> **Continuing from top-p.** In [Top-P (nucleus sampling)](top-p-nucleus.md) you saw that sampling draws from a probability distribution built by running raw scores through softmax. That distribution is the thing repetition controls edit — they reach *before* softmax and dent the scores of already-used tokens so repeats become less probable. Same pipeline, one extra step inserted in the middle.

## Why it matters for an AI Engineer

LLMs, especially at low temperature or when the prompt is short and under-specified, love to get stuck in loops: *"Our team is dedicated to helping you. Our team is dedicated to helping you. Our team is—"* The controls in this tile are the targeted fix. Equally important: there are **two different flavors of repetition control with different math and different APIs**. Open-source servers (Hugging Face, vLLM, Ollama) expose a **multiplicative** `repetition_penalty`. OpenAI exposes two **additive** knobs — `frequency_penalty` and `presence_penalty` — that behave differently from each other. Mixing up the scales, or reaching for these when the real culprit is too-low temperature, is a classic production mistake. Interviewers probe exactly this because it separates people who've actually debugged a looping model from people who've only read about sampling.

## The mechanism — what is a "logit" and how does penalty edit it?

Every step of generation, the model produces a vector of raw numbers — one number per vocabulary token, roughly 100,000+ of them. These raw numbers are called **logits** (from "log-odds": they live on an unbounded real-number scale). A high logit means "this token is a strong candidate"; a low or very negative logit means "very unlikely." Before any sampling happens, the logits pass through **softmax**, which converts them into probabilities that sum to 1.

**Repetition controls intercept the logits before softmax.** They look at which tokens have already appeared in the output and edit those tokens' logits downward. After that edit, softmax runs on the modified logits, and the probability of already-used tokens comes out lower. The model isn't forbidden from repeating — it just now assigns lower probability to those tokens at every subsequent step.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📝 Tokens generated so far<span class="sub">"The cat sat on the mat"</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🔢 Raw logits<span class="sub">one score per vocab token</span></span>
    <span class="darr">→<span class="lbl">penalty edit</span></span>
    <span class="dbox purple">🔧 Modified logits<span class="sub">"the","cat","mat" pushed down</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">softmax</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Probs → sample<span class="sub">repeats less likely</span></span>
  </div>
  <div class="dcap">Penalties are injected between the model's raw output and softmax — they edit scores, not probabilities directly.</div>
</div>

## Two flavors: multiplicative vs additive

### Flavor 1 — `repetition_penalty` (open-source: Hugging Face, vLLM, Ollama)

For every token that already appears anywhere in the prompt **or** the generated output so far, **divide its logit by the penalty value `r`**. Positive logits get smaller (less probable); negative logits get more negative (also less probable). The result is: any token you've already said is uniformly discouraged, regardless of how many times.

- **`r = 1.0`** — no change (disabled).
- **`r = 1.1–1.3`** — typical production range; noticeable without breaking fluency.
- **`r > 1.5`** — starts making the model avoid even necessary words (articles, the topic name itself), causing incoherent output.

**Worked numbers.** Suppose after generating "the cat sat on the mat" the model is choosing the next token. Two candidates:

| Token | Raw logit | After `repetition_penalty=1.3` |
|---|---|---|
| `mat` (already used) | 3.0 | 3.0 / 1.3 = **2.31** |
| `floor` (not yet used) | 2.5 | 2.5 (unchanged) |

Before the penalty, `mat` (logit 3.0) beat `floor` (2.5). After, `floor` (2.5) beats `mat` (2.31). Same math every subsequent step — so the longer the model says "mat", the more `floor`, `table`, `rug` get their turn.

### Flavor 2 — `frequency_penalty` and `presence_penalty` (OpenAI, range −2.0 to 2.0)

OpenAI splits repetition control into two **additive** knobs. Instead of dividing, they *subtract* an amount from the logit. The difference is *what you subtract*:

**`frequency_penalty` — scales with count.** For each token, subtract `frequency_penalty × (number of times that token has appeared so far)`. Say a word 5 times and it accumulates 5× the penalty. This attacks *literal word repetition* — the model is progressively discouraged from repeating any specific word the more it has already used it.

**`presence_penalty` — flat, one-time.** The moment a token appears *at all*, subtract a flat `presence_penalty` amount (regardless of how many times). This doesn't care about count — it just makes the model prefer tokens it hasn't touched yet at all, nudging it toward *new topics or fresh vocabulary*.

| | `frequency_penalty` | `presence_penalty` |
|---|---|---|
| **When applied** | every time token appears | once (first time only) |
| **Amount subtracted** | penalty × count | flat penalty amount |
| **Fixes** | literal word repetition | circling back to same topic |
| **Range** | −2.0 to 2.0 (default 0) | −2.0 to 2.0 (default 0) |

Both can be combined. A small positive value (0.2–0.6) is usually enough for production. You can also set them negative — that *encourages* repetition, useful in rare cases like refrain-heavy poetry generation.

**The scale difference is critical.** OpenAI's additive range is −2 to 2. The open-source multiplicative range is 1.0 to ~1.5. Never pass `1.3` to `frequency_penalty` — that would be a very strong additive push, not a gentle ×1.3 multiplier.

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

# HelpDesk: a small frequency_penalty stops support replies repeating boilerplate
r = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[
        {"role": "system", "content": "You are HelpDesk, a Dubai e-commerce support assistant."},
        {"role": "user",   "content": "My order hasn't arrived in 10 days, what should I do?"},
    ],
    frequency_penalty=0.3,   # discourages reusing the same words (scales with count)
    presence_penalty=0.2,    # gently nudges toward fresh phrasing
    max_tokens=150,
)
print(r.choices[0].message.content)
```

Open-source equivalent (Hugging Face `transformers`):

```python
from transformers import pipeline

gen = pipeline("text-generation", model="mistralai/Mistral-7B-Instruct-v0.3")
out = gen(
    "Describe the Dubai Marina at night:",
    repetition_penalty=1.2,   # 1.0 = off; 1.1–1.3 typical sweet spot
    max_new_tokens=80,
    do_sample=True,
    temperature=0.8,
)
print(out[0]["generated_text"])
# Raise to 1.4+ and watch fluency degrade — the model starts avoiding "the", "and", etc.
```

## How a company uses this — HelpDesk

**HelpDesk** is where this earns its keep. Support replies have a natural repetition problem: the model has seen thousands of "We apologize for the inconvenience. Please contact our support team." lines in training, and at low temperature it defaults to exactly that boilerplate. A **`frequency_penalty` of 0.3** is the lightweight fix — it doesn't change *what* the model says, just discourages it from reaching for the same canned phrases reply after reply. If you're on a self-hosted model (say a fine-tuned open-source LLM behind vLLM), the equivalent is **`repetition_penalty 1.15`**.

For comparison: a Dubai content platform auto-generating thousands of product descriptions on a self-hosted LLM kept getting outputs that repeated the brand name every sentence. `repetition_penalty=1.15` fixed it. A content team writing long-form articles on the OpenAI API uses `presence_penalty=0.4` to stop the model circling back to the same three points across a 1,500-word piece. In both cases, the penalty is a *targeted* fix for a specific, observed failure mode — not something you raise preemptively.

## Common mistakes / misconceptions

- **Cranking it too high.** `repetition_penalty > 1.5` or `frequency_penalty` near 2.0 forces the model away from necessary words — articles ("the", "a"), the topic keyword itself — and the output becomes incoherent. Start low (0.2–0.4 for OpenAI; 1.1–1.2 for open-source) and raise only if you still see loops.
- **Confusing frequency and presence penalties.** Frequency scales with how many times a word appeared — it's a progressive penalty. Presence is a flat one-time hit — it pushes toward new topics. They're for different problems.
- **Mixing up the scales across APIs.** OpenAI's knobs are additive (range −2 to 2). Open-source `repetition_penalty` is a multiplier (range ~1.0 to 1.5). Passing `1.3` to `frequency_penalty` thinking it's a gentle penalty will actually apply a very strong push.
- **Using penalties when temperature is the real culprit.** If the model loops because temperature is near 0.0, it's collapsed the distribution so tightly that the same token wins every time. Nudge [temperature](temperature.md) up to 0.3–0.5 first — that may solve the loop without any penalty.
- **Expecting penalties to substitute for a good prompt.** If the prompt says "list 5 things" and the model runs out of ideas, repetition penalty can't invent new content — it just produces awkward circumlocutions. The real fix is a better prompt or a higher token budget.

## Interview tip

Say: *"Repetition controls work on logits before softmax — they reach into the raw scores for tokens already used and push them down so the model becomes less likely to repeat. Open-source stacks (Hugging Face, vLLM) use a multiplicative `repetition_penalty` around 1.1–1.3, dividing the logit of any seen token. OpenAI splits it into `frequency_penalty` — which scales with how many times the token appeared — and `presence_penalty` — a flat one-time hit that pushes toward fresh vocabulary. The scales are different (additive −2 to 2 vs multiplicative around 1.0), so you can't swap values directly. I reach for a small frequency_penalty (0.2–0.4) when support replies repeat boilerplate, and I raise temperature before touching penalties when the real issue is a too-sharp distribution."* Distinguishing the math and the scales is the detail that signals you've actually debugged this.

---

**Next up:** [Max tokens](max-tokens.md) — once you've shaped *which* tokens get sampled, you need a hard ceiling on *how many* you let the model produce. Max tokens is the cost and latency guardrail that turns an open-ended generator into a production-safe API call.
