# Context-window overflow on long runs

**What it is:** The failure where an agent's message history grows step-by-step until it exceeds the model's context window — and the whole run crashes with an error instead of an answer.

## Why it matters for an AI Engineer

This is *the* root cause behind most agent blowups. Every other control in this node (compaction, trimming, isolation, step caps) exists to prevent or delay this one failure. If you don't understand *why* context grows, you'll be baffled when a run that worked fine for 10 steps dies on step 40. And because you pay per input token on every step, the same growth that eventually crashes the run is also what makes long runs expensive long before they crash.

## The mechanism — why history grows

LLMs are **stateless**. The model has no memory of your previous call. So to keep a conversation going, *you* (or your framework) re-send the entire message history on every single call: the system prompt, the user task, and every assistant message and tool result so far. The model reads all of it fresh each time.

In an agent loop, each step *adds* to that history:

- Step 1: system + task → model asks to call `search("...")`. History = ~1 K tokens.
- Step 2: you append the search result (say 3 K tokens of results) → send all ~4 K back → model asks to call `fetch(url)`.
- Step 3: append the fetched page (8 K tokens) → send all ~12 K → model reasons.
- …and so on. **Nothing ever leaves** unless you actively remove it.

The context window is a hard ceiling — e.g. **200 K tokens** for Claude Sonnet, **128 K–1 M** for various GPT and Gemini models in 2026. Cross it and the API returns an error like `context_length_exceeded`. The run doesn't degrade gracefully; it dies.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">Step 1<span class="sub">1K</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">Step 2<span class="sub">4K</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Step 3<span class="sub">12K</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Step 10<span class="sub">90K</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">Step 22<span class="sub">200K 💥</span></span>
  </div>
  <div class="dcap">Context is cumulative. Each step re-sends everything before it, so token count only climbs — until it hits the wall.</div>
</div>

There are two costs to this growth, not one:

1. **The crash** at the window limit.
2. **The bill** — because you re-send the *whole* history every step, a 200-step run doesn't cost 200 × (one prompt). It costs the *sum of the growing prefixes*, which is roughly quadratic. Doubling the run length can quadruple the token spend.

## Worked numbers

Say each tool result averages 5 K tokens and the model output is small. Input tokens billed per step ≈ cumulative history:

| Step | History (input tokens) |
|---|---|
| 1 | 1 K |
| 10 | ~46 K |
| 20 | ~96 K |
| 40 | ~200 K → **overflow** |

Total input tokens billed across 40 steps ≈ **4 million** (the sum of all prefixes), not 200 K. At Claude Sonnet input pricing (~$3 / M tokens in 2026), that's ~$12 for *one* run that ultimately **crashed with no answer**. That is the disaster this node exists to prevent.

## How a company uses this

A fintech support agent at a Dubai bank was fine in staging (short tickets) but overflowed in production on complaint threads with long email histories. The team added **token accounting per step** (log `usage.input_tokens` on every call) and a **soft threshold at 60% of the window (120 K)** that triggers [compaction](compaction-summary-checkpoints.md) before the hard limit. They also capped any single [tool result](tool-result-trimming.md) at 2 K tokens. Result: no run has overflowed since, and p95 cost per ticket dropped 70% because the context stopped ballooning. The lesson every team learns: **measure token growth per step in production, not just total — the growth curve tells you when you'll hit the wall.**

## Common mistakes
- **Testing only short tasks.** Overflow only shows up on long runs; your happy-path demo won't reveal it.
- **Watching total cost, not per-step growth.** A steadily climbing per-step token count is the early warning; the crash is the late one.
- **Assuming a bigger window fixes it.** A 1 M window just means you overflow later and pay more per step first. Bounding context is the real fix.
- **Forgetting reasoning/thinking tokens** — extended-thinking models add hidden tokens to the count too.

## Interview tip
Say: *"Context overflow happens because LLMs are stateless, so an agent re-sends its entire growing history every step — cost climbs roughly quadratically and eventually hits the window limit, crashing the run. I defend against it by logging per-step token growth, setting a soft threshold well below the hard limit, trimming tool results, and compacting old history before I hit the wall."* Mentioning the *quadratic* cost of re-sending history is the detail that signals you've actually run long agents.
