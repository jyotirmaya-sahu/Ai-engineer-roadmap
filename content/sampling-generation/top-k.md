# Top-K

**The one-line idea:** before sampling, throw away every token except the **K most likely** ones — then pick from just that short list. It's a hard cap on how many candidates the model is allowed to consider.

## Why it matters for an AI Engineer

Top-K is a safety rail against the model picking bizarre, low-probability words. Even at a modest temperature, the long tail of a 100,000-token vocabulary contains a lot of garbage, and occasionally the dice land there. Top-K guarantees you only ever sample from a small, sane set. You'll see it exposed in Anthropic's API and in open-source inference servers (vLLM, Hugging Face `transformers`), so knowing when to reach for it — and why top-p often beats it — is standard AI-engineer knowledge.

## The mechanism / how it works

At each generation step the model ranks all tokens by probability. Top-K does exactly one thing: **keep the top K, discard the rest, renormalize the kept probabilities so they sum to 1, and sample from those.**

Example with K=3. Say the ranked probabilities are:

`mat .55, floor .20, roof .10, ceiling .06, wall .04, … (long tail)`

With **K=3**, only `mat, floor, roof` survive. Their `.55/.20/.10` are rescaled to sum to 1 → roughly `.65/.24/.12`. Everything from `ceiling` down is now impossible, no matter how the dice roll.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">All tokens<span class="sub">mat .55 · floor .20 · roof .10 · ceiling .06 · … tail</span></span>
    <span class="darr">→<span class="lbl">K = 3</span></span>
    <span class="dbox green">Keep top 3<span class="sub">mat · floor · roof</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">sample here</span>
  </div>
  <div class="dcap">Top-K keeps a fixed number of candidates and deletes the rest before sampling.</div>
</div>

**The weakness — it's a *fixed* number, but confidence varies.** Sometimes the model is very sure: the top token is 95% and #2 is 1%. Here K=40 wastes effort keeping 39 junk tokens. Other times the model is genuinely uncertain across 200 near-equal options (e.g. picking the next word in open-ended prose), and K=40 chops off good candidates. A fixed K can't adapt to how peaked or flat the distribution is — which is exactly the problem **[Top-P](top-p-nucleus.md)** solves by using a probability threshold instead of a count.

## Concrete example

Top-K is most visible in open-source generation. Hugging Face `transformers` exposes it directly:

```python
# pip install transformers torch
from transformers import pipeline
gen = pipeline("text-generation", model="gpt2")

out = gen(
    "The best thing about Dubai is",
    do_sample=True,
    top_k=5,          # only sample among the 5 most likely next tokens
    temperature=1.0,
    max_new_tokens=20,
)
print(out[0]["generated_text"])
# Setting top_k=1 == greedy/deterministic; top_k=0 disables the filter entirely.
```

Anthropic's Messages API accepts `top_k` too; OpenAI's chat API historically does **not** expose it (they favor `top_p`).

## How a company uses this

A team self-hosting an open Llama-3 model on vLLM to generate product descriptions sets **top_k=40, temperature 0.8** as a stable default — enough variety to avoid copy-paste descriptions, but the hard cap of 40 candidates prevents the rare off-brand or nonsensical word that a pure high-temperature setting would occasionally emit. In practice, top-k is the "belt" and temperature is the "suspenders": temperature controls the *flavor* of randomness, top-k caps its *worst case*.

## Common mistakes / misconceptions

- **Thinking bigger K = better quality.** Beyond a point, extra K just re-admits junk tokens. Typical useful range is K=20–50.
- **Setting K=0 expecting "off means safe."** In most libraries `top_k=0` means *disable the filter* (consider all tokens) — the opposite of safe. `top_k=1` is greedy.
- **Using top-k when the API prefers top-p.** On OpenAI you often can't set top-k at all; reach for **[top-p](top-p-nucleus.md)** there.
- **Forgetting it interacts with temperature.** Top-k picks the candidate *set*; temperature still reshapes the probabilities *within* that set.

## Interview tip

Say: *"Top-K keeps the K most probable tokens and samples only among them — a hard cap on candidates. Its limitation is that K is fixed while the model's confidence isn't, so I usually prefer top-p, which keeps a probability mass instead of a count and adapts per step. I'll use top-k on open-source stacks where it's the natural knob."* Naming the fixed-vs-adaptive tradeoff is the insight interviewers are listening for.
