# Determinism & Reproducibility

**The one-line idea:** Determinism is making an agent run the *same way twice* given the same inputs — pinning the random knobs so a run you can reproduce is one you can test, debug, and trust, instead of a coin-flip you can never re-create.

## Why it matters for an AI Engineer

LLMs are non-deterministic by default: the same prompt can produce different outputs on different runs. For a chatbot that's fine. For an *agent* — which chains many decisions — it's a nightmare: a test that passes today fails tomorrow with no code change, a production bug can't be reproduced, and you can't tell whether a "fix" actually fixed anything or you just got a luckier roll. Reproducibility is the foundation everything else in reliability sits on: you can't have a stable [eval suite](task-completion-eval.md) or debug a failure without it. This is subtle enough that many engineers don't think about it — naming it in an interview signals real depth.

## The mechanism — how it works

You attack every source of randomness:

- **Temperature = 0 (and pin the model).** Temperature controls sampling randomness; set it to 0 for near-greedy, most-likely-token output. Also pin the exact **model version/snapshot** (e.g. `gpt-4o-2024-11-20`, not the moving `gpt-4o` alias) — a silent model update changes behavior overnight.
- **Seeds.** Many APIs accept a `seed` parameter so the sampler starts from the same point; set the same seed for the same run. Seed your own RNGs too (`random`, `numpy`) if your agent code uses randomness.
- **The honest caveat: LLMs are only *near*-deterministic.** Even at temp 0 with a fixed seed, floating-point non-associativity on GPUs, batching, and mixture-of-experts routing mean you can still get occasional divergence. Providers expose a `system_fingerprint` so you can detect when the backend changed. So you aim for *reproducible enough*, not bit-exact.
- **Determinism in the harness, not just the model.** Pin tool versions, freeze the retrieval index and the clock (mock "now"), and record external API responses. Much agent non-determinism comes from the *environment* (a changing DB, live web), not the LLM.
- **Record-and-replay for full reproducibility.** When true determinism is impossible, *record* every LLM/tool response on the first run and *replay* those exact recordings on later runs — see [replayable traces](replayable-traces.md). This is how you get bit-exact test runs despite a non-deterministic model.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">same input</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 temp 0 · seed · pinned model<span class="sub">+ frozen tools/index/clock</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ same (or replayable) output</span>
  </div>
  <div class="dcap">Pin every random knob and freeze the environment — record/replay for the rest.</div>
</div>

## Concrete example

Pin the knobs on the LLM call, and freeze the environment around it:

```python
resp = client.chat.completions.create(
    model="gpt-4o-2024-11-20",     # pinned snapshot, NOT the moving "gpt-4o" alias
    messages=msgs,
    temperature=0,                 # greedy-ish decoding
    seed=42,                       # same sampler start each run
)
# detect a silent backend change that could break reproducibility:
assert resp.system_fingerprint == EXPECTED_FINGERPRINT, "model backend changed!"

import random, numpy as np
random.seed(42); np.random.seed(42)         # your own RNGs
NOW = datetime(2026, 1, 15)                 # freeze the clock instead of datetime.now()
```

For a genuinely reproducible test, wrap the LLM/tool clients in a record/replay cache so the second run returns the *recorded* responses byte-for-byte.

## How a company uses this

A **Dubai bank**'s compliance team requires that any AI decision affecting a customer be **reproducible for audit** — if a loan-triage agent flags an application, they must be able to re-run it and get the identical result months later. Live LLM calls can't guarantee that, so the team runs the agent with temp 0 and pinned model snapshots *and* **records every LLM and tool response into an immutable trace store**. To reproduce a decision, they replay the recorded trace — same inputs, same recorded model outputs, same conclusion — bit-for-bit. Their CI eval suite uses the same replay mechanism, so tests are stable and a failing test always means a real regression, never a random roll.

## Common mistakes / misconceptions

- **Using the moving model alias.** `gpt-4o` silently updates; your agent's behavior changes with no code change. Always pin the dated snapshot.
- **Believing temp 0 = fully deterministic.** It's *near*-deterministic; GPU non-associativity and MoE routing still cause rare divergence. For true reproducibility, record/replay.
- **Only pinning the model, not the environment.** A changing DB, live web results, or `datetime.now()` make runs diverge even with a frozen model. Freeze the harness too.
- **Flaky tests blamed on "the model."** Usually it's an unpinned model, an unseeded RNG, or a live dependency — fixable, not fate.

## Interview tip
Say: *"Agents are non-deterministic, so I engineer for reproducibility. I set temperature 0, pin an exact model snapshot rather than the moving alias, pass a seed, and freeze the environment — tool versions, the retrieval index, the clock. But temp 0 is only near-deterministic because of GPU float non-associativity, so where I need true reproducibility — audit or a stable CI eval suite — I record every LLM and tool response and replay them byte-for-byte."* The temp-0-isn't-truly-deterministic nuance plus record/replay is the answer that stands out.

See also: **[Replayable traces](replayable-traces.md)** (the record/replay machinery) and **[Task-completion eval](task-completion-eval.md)** (which needs reproducible runs to be meaningful).
