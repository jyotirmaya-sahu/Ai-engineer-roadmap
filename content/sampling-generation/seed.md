# Seed

**The one-line idea:** a seed is a fixed starting number for the model's random dice, so that the *same* prompt with the *same* settings produces the *same* output every time — making otherwise-random generation reproducible.

## Why it matters for an AI Engineer

Sampling is random by design (see **[temperature](temperature.md)**), which is great for creativity but terrible for testing. If every run gives a different answer, you can't write a stable test, compare two prompt versions fairly, or reproduce a bug a user reported. A seed pins the randomness down. It's the difference between "the eval passed on my machine, sometimes" and "this prompt produces exactly this output, reproducibly." Interviewers ask about it to see if you think about *testing and reproducibility*, not just calling the API.

## The mechanism / how it works

When temperature > 0, the model samples from its probability distribution using a **pseudo-random number generator (PRNG)**. A PRNG isn't truly random — it's a deterministic sequence of numbers that *looks* random, and it's fully determined by its starting value: the **seed**. Same seed → same sequence of "random" draws → same tokens chosen at every step → identical output.

Pass an integer `seed` and, holding everything else constant (model, prompt, temperature, top_p, max_tokens), you get repeatable results. Change the seed and you get a *different but still deterministic* output — useful for generating several distinct variations you can reproduce later.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">seed = 42<span class="sub">+ same prompt & settings</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 PRNG draws same sequence</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ identical output every run</span>
  </div>
  <div class="dcap">A fixed seed makes the "random" draws repeatable, so generation becomes reproducible.</div>
</div>

**The honest caveat: "best-effort," not guaranteed.** OpenAI documents seed as *best-effort* determinism and exposes a **`system_fingerprint`** — if the provider changes the backend model or infrastructure, the fingerprint changes and identical seeds may diverge. Floating-point rounding across different GPUs and batch sizes can also cause tiny differences. So a seed gives you *strong* reproducibility, not a cryptographic guarantee. For maximum stability, combine `seed` with `temperature=0`.

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

def gen():
    r = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": "Invent a startup name."}],
        temperature=1.0,
        seed=42,                      # pin the randomness
    )
    return r.choices[0].message.content, r.system_fingerprint

out1, fp1 = gen()
out2, fp2 = gen()
print(out1 == out2)   # True (same seed, same fingerprint)
print(fp1)            # note it — if it changes later, outputs may drift
```

## How a company uses this

A Dubai SaaS team running an automated **prompt-eval suite in CI** sets `seed=0, temperature=0` for every test case, so each of 200 graded prompts returns a fixed output they can assert against; a diff means *their prompt changed*, not that the dice rolled differently. They also log `system_fingerprint` with each run — when it shifts (a provider model update), they know to *re-baseline* the expected outputs rather than chase phantom regressions. For A/B testing two prompt variants, they reuse one seed across both so the only variable is the prompt wording, making the comparison fair.

## Common mistakes / misconceptions

- **Expecting bit-for-bit determinism forever.** It's best-effort; a backend change (watch `system_fingerprint`) can break it. Not every provider even supports seeding.
- **Setting a seed but leaving temperature high and *not* re-checking.** It still works, but for the *most* stable tests people combine seed with `temperature=0`.
- **Thinking a seed improves quality.** It only affects *reproducibility*, not correctness or creativity.
- **Reusing one seed in production** where you actually *want* variety (e.g. generating diverse suggestions) — you'll get the same output every time.

## Interview tip

Say: *"A seed fixes the pseudo-random generator so the same prompt and settings reproduce the same output — I use it in eval suites and A/B tests so the only variable is what I changed. It's best-effort, though: I log OpenAI's system_fingerprint and re-baseline when it shifts, and I pair seed with temperature 0 for maximum stability."* Naming `system_fingerprint` and the best-effort caveat shows you've actually relied on it.
