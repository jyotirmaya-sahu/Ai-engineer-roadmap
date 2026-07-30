# Loop / Iteration Limits

**The one-line idea:** Loop limits stop an agent that's stuck going in circles — either after a maximum number of iterations, or the moment it detects the agent is repeating the same action over and over without making progress.

## Why it matters for an AI Engineer

Agents don't always fail loudly — sometimes they fail by **never stopping**. The model calls the same search, gets the same unhelpful result, "reflects," and calls it again… forever. Or two conditions ping-pong: it edits a file, a check fails, it edits it back, the check fails again. Each individual step looks fine, so nothing intervenes. Loop limits are the control that breaks this cycle. They're closely related to [budget caps](step-spend-budget-caps.md) — an iteration cap *is* a kind of budget — but loop limits add the smarter idea of **detecting non-progress**, not just counting to a number. An agent that can recognize "I'm stuck" and stop is far more reliable, and "how do you prevent infinite loops?" is a staple agent interview question.

## The mechanism — how it works

Two complementary techniques:

1. **Hard iteration cap.** A maximum number of loop turns (e.g. 15–25). When hit, stop and return the best partial result. This is the blunt, always-on backstop — it *guarantees* termination regardless of what the agent thinks it's doing. (LangGraph calls this `recursion_limit`.)

2. **Loop / stall detection (the smart part).** Watch for signs of *non-progress* and stop early, before wasting the full budget:
   - **Repeated actions.** The agent calls the same tool with the same arguments N times in a row → it's spinning. Track a short history of `(tool, args)` and break on repetition.
   - **Repeated observations / no state change.** The agent's working state hasn't changed across the last few steps → nothing is advancing.
   - **Cycles.** Action A → B → A → B ping-pong. Detect the repeating pattern.
   - **No progress toward the goal.** A cheap check or judge decides recent steps haven't moved closer to completion.

On detection, you can hard-stop, or first **nudge** the agent — inject a message like *"You've tried this 3 times without success; try a fundamentally different approach or stop."* — which sometimes breaks it out. If the nudge fails, stop.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 step</span>
    <span class="darr">→</span>
    <span class="dbox orange">same (tool,args) as last 3? &nbsp; iterations &gt; 20?</span>
    <span class="darr">→<span class="lbl">yes</span></span>
    <span class="dbox yellow">🛑 stall detected → nudge or stop</span>
  </div>
  <div class="dcap">Count iterations AND watch for repetition/no-progress — break the loop before it drains the budget.</div>
</div>

## Concrete example

An iteration cap plus repeated-action detection around an agent loop:

```python
MAX_ITERS = 20
recent = collections.deque(maxlen=3)     # last 3 tool signatures

for i in range(MAX_ITERS):               # hard cap: guarantees termination
    action = agent.next_action(state)
    sig = (action.tool, json.dumps(action.args, sort_keys=True))

    if recent.count(sig) == 3:           # same call 3x in a row -> stuck
        state = agent.nudge(state,
            "You've repeated this exact action 3 times with no progress. "
            "Try a different approach, or conclude you cannot complete the task.")
        recent.clear()
        continue

    recent.append(sig)
    state = agent.execute(action, state)
    if state.done:
        break
else:
    log.warning("hit MAX_ITERS without completing")   # the backstop fired

return state.result_or_partial()
```

The `for/else` gives you a clean "cap was hit" path; the deque catches spinning long before the cap.

## How a company uses this

A **Dubai devtools startup** built a coding agent that fixes failing tests. A subtle bug made it fall into a loop on certain cases: change line 10 → test fails differently → change it back → repeat. With only an LLM in the loop it would spin until something external stopped it. They added a **20-iteration cap** as a backstop and, more usefully, **repeated-diff detection** — if the agent proposes the same edit it already tried, it's nudged to try a structurally different fix, and after two nudges it stops and reports "couldn't resolve, needs human." This cut wasted iterations by ~60% and, combined with the spend cap, made per-task cost predictable enough to price the product.

## Common mistakes / misconceptions

- **Relying only on a big iteration cap.** A cap of 50 lets a spinning agent waste 50 expensive steps before stopping. Add stall detection to break early.
- **No cap at all.** Some agents have *no* hard limit and rely on the model to decide it's done — a recipe for infinite runs on edge cases.
- **Detecting loops but never nudging.** Sometimes a single "you're repeating yourself, change approach" message frees the agent — cheaper than a hard stop and re-run.
- **Ignoring near-repeats.** Agents often loop with *slightly* varied arguments that are effectively the same call; exact-match detection misses these. Normalize before comparing.

## Interview tip
Say: *"I use two layers: a hard iteration cap that guarantees termination, and stall detection that stops early — I track recent (tool, args) signatures and the working state, and if the agent repeats an action or stops making progress, I first nudge it to change approach and then stop if that fails. The hard cap is the backstop; the detection is what saves the budget. Exact repeats are easy; the trick is normalizing near-repeats so a slightly-varied but equivalent call still counts."* Pairing the guaranteed backstop with smart early detection is the complete answer.

See also: **[Step / spend budget caps](step-spend-budget-caps.md)** (the dollar-based ceiling this complements) and **[Error recovery](error-recovery.md)** (why recovery attempts must be bounded).
