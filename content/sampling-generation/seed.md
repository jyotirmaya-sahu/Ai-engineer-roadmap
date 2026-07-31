# Seed

**The one-line idea:** a seed is a number you pass to the API that makes the model's randomness reproducible — so the same prompt and settings give (nearly) the same output every time, instead of something different on every call.

> **Continuing from Stop sequences.** You just learned how to make the model stop at the right place. Now flip the focus: *what is produced* in between. Because sampling is random, two identical prompts can produce two completely different outputs. A **seed** is the lever that pins that randomness down — crucial for testing, debugging, and anything where consistency matters more than variety.

## Why you need to understand this first

Before explaining seeds, you need to understand *where* the randomness in an LLM response actually comes from — because seeds don't remove it, they just make it repeat.

Go back to the **[Temperature tile](temperature.md)** for a moment. When the model finishes reading your prompt, it produces a score for every token in its vocabulary — maybe 100,000+ numbers, one per possible next word. It then converts those scores into probabilities. With a **temperature above zero**, the model doesn't just pick the single most-likely token every time. It *randomly samples* from the distribution: like rolling a weighted die where the highest-probability tokens are most likely, but less-likely tokens still have a real chance of being picked.

That random die roll happens at every single token position. And it uses a **pseudo-random number generator** — a PRNG — to do so.

A PRNG isn't truly random. It's a deterministic mathematical function that starts from a number and produces a long sequence of values that *look* random. The critical property: **the same starting number always produces the same sequence.** That starting number is the **seed**.

So: same seed → same sequence of "random" die rolls → same token chosen at every step → same output.

## What "same" actually means here

Let's be concrete. Suppose the model is generating the third word of your response. The PRNG spits out `0.71`. Based on that draw, `"important"` is selected over `"critical"` and `"useful"`. On the next run with the same seed, the PRNG spits out `0.71` again at that same step, and `"important"` is selected again. This repeats for every token in the sequence. The entire output is rebuilt from the same chain of draws.

Change the seed to `43` and you get a *different* sequence of draws — a different output, but now *that* output is deterministic. The seed selects which version you get; it doesn't make all seeds produce the same thing.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Prompt + settings<span class="sub">temperature=1.0, seed=42</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">🎲 PRNG(seed=42) → sequence: [0.71, 0.14, 0.88, …]</span>
    <span class="darr">↓<span class="lbl">same draws every run</span></span>
    <span class="dbox orange">🔢 Token choices: "important" → "step" → "forward" …</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Identical output, run 1 and run 2</span>
  </div>
  <div class="dcap">A fixed seed makes the PRNG replay the same sequence of draws, producing the same tokens at every position — even at high temperature.</div>
</div>

## The honest caveat: best-effort, not a guarantee

OpenAI officially describes seed as **best-effort determinism**, and means it. Two things can break the guarantee:

1. **`system_fingerprint` changes.** OpenAI returns a `system_fingerprint` field in every response — a string that encodes the current model weights and infrastructure version. If that string changes between two calls (for example, OpenAI silently deploys a model update), the same seed may produce different output even though your code didn't change. This is a real production concern, not a theoretical one.

2. **Floating-point hardware differences.** Tiny rounding differences between GPU batch sizes or hardware generations can cascade into different token selections — the die roll of `0.71` might become `0.7099999` in a slightly different environment, and push across a probability boundary.

**The practical rule:** combine `seed` with `temperature=0` for your most stable tests. At temperature 0 the model is already near-deterministic (it picks the highest-probability token at each step with very little sampling randomness), so seed + temp-0 gives you the strongest reproducibility available. For tests where you want some variability locked in (testing that a specific creative output is reproduced), use `temperature > 0` with a seed and watch the `system_fingerprint`.

**Note:** temperature 0 alone is *near*-deterministic but it isn't the same as seeded. Seed is the *explicit* lever — it names what you want reproducible. Temperature=0 just happens to reduce variance; it doesn't formally anchor to a starting value.

## Concrete example — run it twice, compare

```python
from openai import OpenAI

client = OpenAI()

def call_with_seed(seed: int) -> tuple[str, str]:
    r = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[{"role": "user", "content": "Invent a one-sentence startup pitch."}],
        temperature=1.0,       # high randomness — seed is doing all the work
        seed=seed,
    )
    text = r.choices[0].message.content
    fingerprint = r.system_fingerprint   # track this — if it changes, outputs may drift
    return text, fingerprint

# Run twice with the same seed
out_a, fp_a = call_with_seed(42)
out_b, fp_b = call_with_seed(42)

print("Same output?   ", out_a == out_b)          # True (while fingerprint matches)
print("Fingerprints:  ", fp_a, fp_b)               # should be identical

# Run once with a different seed — deterministically different
out_c, fp_c = call_with_seed(99)
print("Seed 42 == 99? ", out_a == out_c)           # False — different seed, different output
```

A few things to notice:
- Even with `temperature=1.0` — maximum randomness — both calls with `seed=42` return identical text. The seed is doing the work, not a low temperature.
- The `system_fingerprint` is printed. In a real eval suite you'd save this alongside the expected output and alert when it changes.
- Seed 99 gives a different result, but *that* result is now itself repeatable.

## How a company uses this

**HelpDesk eval suite.** Your support chatbot's prompt is now tuned. But how do you confirm it still works after you edit it next week? You build a table of 30 representative customer messages, each with an expected "good" response. You run `seed=0, temperature=0` on every one and save the outputs as your baseline. Next time you touch the prompt, you re-run and diff. If an output changes, it's because your *prompt* changed — not because the dice rolled differently. That's a rigorous eval, not a vibes-check.

A Dubai fintech team does the same thing in CI: they lock outputs to a seed, assert against them, log the `system_fingerprint`, and re-baseline automatically when the fingerprint shifts (a provider model update). This separates "our code broke it" from "the provider updated the model."

For A/B testing two prompt variants, they fix `seed=42` on both. Same randomness budget applied to both → the only difference in outputs is the prompt wording → a fair comparison.

## Common mistakes / misconceptions

- **Expecting bit-for-bit determinism forever.** It's best-effort. Watch `system_fingerprint` and re-baseline when it changes.
- **Thinking seed removes randomness.** It doesn't — it makes the randomness *repeat*. At seed=42 and temperature=1.0 the model is still sampling; it just samples the same way every time.
- **Using a seed in production when you want variety.** A support bot generating 5 phrasing options for the same message should *not* reuse one seed — every call would return the same 5 options. Either vary the seed or drop it entirely.
- **Not logging `system_fingerprint`.** You'll have no warning when a provider model change silently breaks your test baseline.
- **Thinking temperature=0 makes seed unnecessary.** They serve different purposes. Temperature=0 reduces variance; seed explicitly pins the starting state. For reproducible tests, use both.

## Interview tip

Say: *"A seed fixes the pseudo-random generator so the same prompt and settings reproduce the same output — essential for eval suites and A/B tests where I want the only variable to be what I changed. It's best-effort though: I always log OpenAI's `system_fingerprint` alongside expected outputs, and re-baseline when it shifts. I pair seed with temperature=0 for maximum stability."* Naming `system_fingerprint` and the best-effort caveat shows you've actually relied on this in production, not just read about it.

---

**Next: [Logprobs](logprobs.md).** You now control *which* output you get and can make it repeat. The next tile opens the model's own probability scores — letting you see *how confident* it was at each token, which is the building block for confidence scoring, classification, and debugging hallucinations.
