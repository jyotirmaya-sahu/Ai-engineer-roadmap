# Determinism & seeds

**What it is:** Making an agent run reproducible — same inputs producing the same outputs — by controlling the sources of randomness, so you can test, debug, and eval it reliably.

## Why it matters for an AI Engineer

You cannot debug or eval what you can't reproduce. If an agent fails on step 40 and re-running gives a *different* trajectory, you're chasing ghosts. Determinism is the foundation of a real testing story: regression tests that don't flake, evals whose scores mean something run-to-run, and A/B comparisons where the only variable is the thing you changed. It's also honesty in interviews — knowing that LLMs are **not** fully deterministic (and why) is the mark of someone who's actually tried to write tests around them.

## The mechanism — where the randomness comes from

An agent's output varies for several reasons; you address each:

1. **Sampling temperature.** The model samples the next token from a probability distribution. `temperature=0` makes it (near-)greedy — always pick the most likely token — which is the biggest lever toward reproducibility. For agents you almost always want low temperature anyway; you want consistent tool use, not creative variety.
2. **The `seed` parameter.** Even at temperature 0, ties and floating-point nondeterminism leak in. Most 2026 APIs (OpenAI, and others) accept a `seed` and return a `system_fingerprint`. Same seed + same fingerprint + same prompt → *best-effort* identical output. Anthropic's API is low-variance at temp 0 but doesn't expose a seed; you get reproducibility mainly via temperature and pinned model versions.
3. **The catch — LLMs are only *best-effort* deterministic.** Provider-side batching, mixed hardware, and MoE routing mean even seed + temp 0 can occasionally differ, and a `system_fingerprint` change signals the backend changed under you. Never promise *bit-exact* determinism; promise *reproducible enough to test*.
4. **Your own non-model randomness.** `random`, `uuid4()`, `datetime.now()`, dict ordering, and tool responses (a live API returns different data each call). Seed your RNG, freeze the clock in tests, and **mock/record tool responses** — this is often the *bigger* source of run-to-run drift than the model.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">same task + same seed</span>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox purple">temp=0</span>
      <span class="dbox purple">seed set</span>
      <span class="dbox blue">mocked tools</span>
      <span class="dbox blue">frozen clock</span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ reproducible trajectory (best-effort)</span>
  </div>
  <div class="dcap">Pin every knob — temperature, seed, model version, tool responses, clock — to get a run you can re-run and debug.</div>
</div>

## Concrete example

```python
# Model-side determinism
resp = client.chat.completions.create(
    model="gpt-4.1-2025-04-14",   # pin the exact version, not a floating alias
    temperature=0,
    seed=42,
    messages=history,
)
assert resp.system_fingerprint == EXPECTED_FP, "backend changed → results may drift"

# Your-side determinism (in tests)
random.seed(42)
freeze_time("2026-07-30T12:00:00Z")            # e.g. freezegun
tool_responses = load_cassette("run_042.json") # replay recorded tool outputs
```

Pinning the **exact model version** (`gpt-4.1-2025-04-14`, not `gpt-4.1`) is essential — a floating alias silently upgrades and breaks reproducibility overnight.

## How a company uses this

A Dubai healthtech company runs a nightly **eval suite** of 200 patient-intake scenarios against its triage agent. Early on, scores swung ±4% run-to-run purely from nondeterminism, so they couldn't tell a real regression from noise. They pinned `temperature=0`, a fixed `seed`, the exact model version, and **recorded all tool responses into cassettes** (replaying the same lab-API data every run). Score variance dropped to <0.5%, so a 2% drop now reliably means *they broke something*. When a model version bump did change behavior, the `system_fingerprint` change flagged it immediately, and the eval caught a real regression in medication-name matching before it shipped. Determinism turned their eval from decorative to load-bearing.

## Common mistakes
- **Promising bit-exact determinism** — LLMs are best-effort only; claim "reproducible enough to test," not "identical."
- **Using a floating model alias** — silent upgrades destroy reproducibility; pin the dated version.
- **Forgetting non-model randomness** — live tool calls, `now()`, and `uuid4()` cause more test flakiness than the model does. Mock and freeze them.
- **Temperature > 0 in tests/evals** — you're then measuring noise, not behavior.
- **Ignoring `system_fingerprint`** — it's your signal the backend changed; log and assert on it.

## Interview tip
Say: *"LLMs are only best-effort deterministic, so for testing I pin temperature to 0, set a seed where the API supports one, pin the exact dated model version, and — the part people miss — mock tool responses and freeze the clock, since live tools and timestamps cause more run-to-run drift than the model. I watch system_fingerprint to catch silent backend changes. The goal isn't bit-exact output, it's runs reproducible enough that an eval regression means a real bug."* Naming non-model randomness and best-effort-not-exact is what signals real testing experience.
