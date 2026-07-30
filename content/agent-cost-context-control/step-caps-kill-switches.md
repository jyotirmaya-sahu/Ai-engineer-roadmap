# Step caps & kill-switches

**What it is:** A hard limit on how many loop iterations an agent may run (the step cap), plus an out-of-band way to stop a run immediately (the kill-switch).

## Why it matters for an AI Engineer

This is the seatbelt — the simplest, most essential agent guardrail, and the one people forget until it's 3am. An agent loop with no step cap is an `while True` that spends money; if the model never emits a "done" signal, it runs until it [overflows](context-window-overflow-on-long-runs.md) or your [budget](per-run-token-spend-budgets.md) trips. The step cap is the cheapest possible bound, and the kill-switch is how you stop a *fleet* of runaway agents in production without redeploying. Every agent framework ships these because every team eventually needs them.

## The mechanism

**Step cap.** The agent loop is literally `for step in range(MAX_STEPS)`. When the counter hits the cap, you stop — regardless of whether the task is "done." You then return a partial result plus a `hit_step_cap` flag so the caller knows it wasn't a clean finish. Typical caps: 8–15 for simple task agents, 30–50 for research/coding agents. Set it to *a bit more than the worst legitimate run you've observed* — high enough to not cut off real work, low enough to bound disasters.

**Kill-switch.** A step cap stops *one* run at its own pace. A kill-switch stops runs *now*, from outside, often *all* of them:
- **Per-run:** a cancellation token / `asyncio` cancel the caller can fire (user clicks "stop").
- **Global:** a feature flag or a Redis key like `agents:enabled=false` that every loop checks at the top of each iteration. Flip it and every agent in the fleet halts within one step — no deploy needed. This is what you reach for when a bad model update or a prompt-injection wave is burning money across production.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox gray">step 0</span>
      <span class="darr">→</span>
      <span class="dbox purple">check kill-switch</span>
      <span class="darr">→</span>
      <span class="dbox orange">step &lt; cap?</span>
      <span class="darr">→</span>
      <span class="dbox purple">🧠 run step</span>
      <span class="darr">→<span class="lbl">loop</span></span>
    </div>
    <div class="flow">
      <span class="dbox gray">🛑 kill flag set → abort</span>
      <span class="dbox gray">🛑 cap reached → return partial</span>
      <span class="dbox green">✅ model says done → finish</span>
    </div>
  </div>
  <div class="dcap">Every iteration checks three exits: global kill-switch, step cap, and the model's own done-signal.</div>
</div>

## Concrete example

```python
MAX_STEPS = 15

def run_agent(task):
    history = [system, task]
    for step in range(MAX_STEPS):
        if kill_switch.is_set():                      # global or per-run
            return partial(history, reason="killed")
        resp = client.messages.create(model="claude-sonnet-4-6",
                                       messages=history, tools=TOOLS)
        if resp.stop_reason == "end_turn":            # model signals done
            return done(resp)
        history += apply_tool_calls(resp)             # do the work, append results
    return partial(history, reason="step_cap")        # cap reached, no clean finish
```

Note the three exits: kill-switch, model-done, and cap. The cap is the *backstop* — it fires only when the model fails to terminate on its own, which is exactly the failure mode you can't predict.

## How a company uses this

A Dubai bank's onboarding agent (KYC document checks) runs with **`MAX_STEPS=12`** and a **Redis global kill-switch**. The step cap earned its keep when a document-OCR tool started returning empty results after a vendor outage; the agent kept re-trying to read the "missing" field and would have looped forever — the cap stopped it at 12 and routed the case to a human. The global kill-switch earned its keep during a separate incident: a prompt-injection payload in a customer-uploaded PDF was steering agents to exfiltrate data. Ops flipped `agents:enabled=false` and **every agent across the fleet halted within ~1 second**, buying time to patch — no deploy, no downtime for the rest of the system. Recovery was flipping the flag back.

## Common mistakes
- **No step cap at all** — the classic. A model that never emits "done" loops until something else (budget, context) crashes it, wasting money the whole way.
- **Cap too low** — cutting off legitimate long runs and returning garbage partials. Tune against observed real-run lengths.
- **Silent cap** — returning a partial result with no flag, so downstream code treats an aborted run as a successful one.
- **Kill-switch checked only at start** — check it *every iteration*, or a long run won't notice the flag until it's over.
- **No graceful partial** — killing a run mid-write can corrupt state; pair kill-switches with [permission checks / transactions](permission-checks-before-high-impact-tools.md) on destructive tools.

## Interview tip
Say: *"Every agent loop is bounded by a step cap — a `for` over MAX_STEPS with a partial-result-plus-flag fallback — because a model that never signals done will otherwise loop until it overflows or blows the budget. On top of that I add a kill-switch: a per-run cancel token and a global feature flag every iteration checks, so I can halt the whole fleet in one second without a deploy when something goes wrong in production."* The global-flag-checked-every-iteration detail is the tell that you've operated this at scale.
