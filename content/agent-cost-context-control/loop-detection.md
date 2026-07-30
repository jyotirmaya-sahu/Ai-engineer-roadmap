# Loop detection

**What it is:** Catching when an agent is repeating itself — calling the same tool with the same arguments, or cycling through the same few actions — and breaking out before it wastes a whole [budget](per-run-token-spend-budgets.md) going nowhere.

## Why it matters for an AI Engineer

A [step cap](step-caps-kill-switches.md) stops a runaway *eventually* (at step 15, say). Loop detection stops it *early* (at the 3rd identical action, step 4) — saving the tokens the cap would have let it burn, and, crucially, catching the specific failure that a cap alone hides: an agent stuck in a tight repeat isn't making progress, so letting it run to the cap is pure waste. Loops are also the most common way agents "fail without failing" — they don't crash, they just quietly repeat until money runs out. Detecting them is what turns a step cap from a blunt backstop into a smart one.

## The mechanism — detect repetition, then act

An agent loops when the model keeps choosing the same action because the *situation looks the same* to it each step (a tool keeps failing the same way, or a summary keeps losing the fact the model keeps re-fetching). Detection strategies, cheap to expensive:

1. **Exact-match on (tool, args).** Hash each tool call as `f"{name}:{json.dumps(args, sort_keys=True)}"`. Keep a counter. Same hash ≥ N times (e.g. 3) → loop.
2. **Sliding-window cycle detection.** Keep the last K action hashes; if a short sequence repeats (A→B→A→B), it's a cycle even without a single action repeating.
3. **No-progress heuristic.** Track a "progress" signal (new files written, new facts added, task-state changes). If M consecutive steps produce *zero* progress, treat it as a stall even if the actions differ.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 action</span>
    <span class="darr">→</span>
    <span class="dbox orange">hash (tool,args)</span>
    <span class="darr">→</span>
    <span class="dbox yellow">seen 3×?</span>
    <span class="darr">→</span>
    <span class="dbox gray">🛑 break loop → escalate / abort</span>
  </div>
  <div class="dcap">Fingerprint each action; when the same fingerprint repeats past a threshold, break out early instead of burning steps.</div>
</div>

**What to do on detection** matters as much as detecting:
- **Perturb once:** inject a message like *"You've tried `fetch(X)` 3 times with the same failure. Try a different approach or report that it's not working."* Often the model breaks its own loop.
- **Escalate:** hand off to a human or a fallback path.
- **Abort with a clear reason** if perturbation doesn't help — never just keep looping.

## Concrete example

```python
from collections import Counter
seen = Counter()

def check_loop(tool_name, args, limit=3):
    key = f"{tool_name}:{json.dumps(args, sort_keys=True)}"
    seen[key] += 1
    return seen[key] >= limit

# in the loop, after the model picks a tool call:
if check_loop(call.name, call.args):
    history.append({"role": "user", "content":
        f"You've called {call.name} with identical args {seen[...]}× and it isn't "
        f"progressing. Change approach or report failure."})   # perturb once
    if seen[key] >= 5:
        return partial(history, reason="loop_detected")         # give up
```

## How a company uses this

A Dubai travel agency's booking agent queried a flaky third-party flight API. When the API returned a rate-limit error, the model would re-issue the *exact same* `search_flights` call, get the same error, and repeat — a textbook tight loop. With a **15-step cap only**, each stuck run burned all 15 steps ≈ $0.20 for nothing. Adding exact-match loop detection (**3 identical calls → perturb, 5 → abort**) cut those runs to ~4 steps ≈ $0.05 and, thanks to the perturbation message, the model often switched to a cached-results fallback and *recovered* instead of failing. Across ~30 K bookings/day with a ~2% flaky-API rate, that saved an estimated **$90/day** and turned silent failures into either recoveries or clean human escalations. They also alert when loop-detection fires spike — it's an early signal a downstream dependency is degraded.

## Common mistakes
- **Relying on the step cap alone** — it stops runaways but lets every stuck run burn to the cap first; loop detection stops them early.
- **Threshold of 1** — some tasks legitimately call the same tool twice (pagination, retry-after-backoff). Use ≥3 and consider args.
- **Detecting but not acting differently** — if you just abort on every repeat you'll cut off valid retries; perturb first, then abort.
- **Ignoring near-duplicate loops** — a model that varies args trivially (`page=1`, `page=1 `) can still loop; normalize args before hashing.
- **No alerting** — loop spikes are a free health signal for your dependencies; wire them to monitoring.

## Interview tip
Say: *"A step cap is a backstop; loop detection is the early exit. I fingerprint each (tool, args) call and, on the 3rd identical one, inject a message telling the model to change approach — which often breaks the loop and even recovers — then abort with a clear reason if it persists. That catches the most common agent failure, where it repeats an action without progressing and quietly burns budget, and the detection rate doubles as a signal that a dependency is degraded."* The perturb-then-abort nuance is what shows you've actually debugged stuck agents.
