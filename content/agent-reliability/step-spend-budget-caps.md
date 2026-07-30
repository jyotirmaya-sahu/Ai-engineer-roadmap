# Step / Spend Budget Caps

**The one-line idea:** Budget caps are hard ceilings on how many steps an agent may take and how much money it may spend in a single run — a kill-switch that force-stops the agent the instant it crosses the limit, no matter what it's "trying" to do.

## Why it matters for an AI Engineer

An agent loops, and every loop iteration costs money (LLM tokens, paid tool calls). A bug, a bad prompt, or an adversarial input can send it looping far longer than intended — and because each step *looks* reasonable in isolation, nothing stops it. The failure mode is legendary: an overnight run that should have cost $2 racks up a $2,000 bill, or hammers a paid API 10,000 times. Budget caps are the non-negotiable safety net. They're **deterministic external limits** — enforced by *your* code, not by asking the model nicely — so they hold even when the agent is completely off the rails. Every production agent needs them, and "how do you stop an agent from running up the bill?" is a question you must have a crisp answer to.

## The mechanism — how it works

You track running totals for a single agent run and check them *before each step*. Cross a limit → stop immediately.

- **Step cap.** Maximum number of agent iterations (LLM-call/tool-call cycles), e.g. 25. Simple, and the first line of defense against runaway loops.
- **Token/spend cap.** Maximum tokens or dollars for the whole run. More precise than step count because one step can be cheap or expensive. You accumulate the token usage returned by each LLM call, price it, and stop when the run's cost exceeds the cap (e.g. AED 5).
- **Wall-clock cap.** Maximum time (e.g. 5 minutes) — catches steps that hang.

The key property is that these are **hard limits, external to the agent**. The model doesn't get to negotiate them. On breach you don't just crash — you stop cleanly, return the best partial result, log *why* it stopped, and often alert. Caps are usually **per-run**, but for shared systems you also layer **per-user** and **per-day** quotas so one tenant can't drain the whole budget.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 before each step</span>
    <span class="darr">↓</span>
    <span class="dbox orange">steps &lt; 25? &nbsp; spend &lt; AED 5? &nbsp; time &lt; 5m?</span>
    <span class="darr">↓<span class="lbl">all ok → continue · any breached →</span></span>
    <span class="dbox yellow">🛑 kill-switch: stop, return partial, alert</span>
  </div>
  <div class="dcap">Check totals before every step; breach any ceiling and force-stop — the model can't override it.</div>
</div>

## Concrete example

A budget-enforcing wrapper around an agent loop:

```python
class BudgetExceeded(Exception): ...

class Budget:
    def __init__(self, max_steps=25, max_usd=1.50, max_seconds=300):
        self.max_steps, self.max_usd, self.max_seconds = max_steps, max_usd, max_seconds
        self.steps, self.usd, self.start = 0, 0.0, time.time()

    def charge(self, usage):
        self.steps += 1
        self.usd += usage.prompt_tokens * 2.5e-6 + usage.completion_tokens * 1e-5  # $/token
        if self.steps > self.max_steps:      raise BudgetExceeded("step cap")
        if self.usd   > self.max_usd:        raise BudgetExceeded(f"spend cap ${self.usd:.2f}")
        if time.time() - self.start > self.max_seconds: raise BudgetExceeded("time cap")

budget = Budget()
try:
    while not done:
        resp = call_llm(state)
        budget.charge(resp.usage)     # <-- enforced before the next iteration
        state = step(resp)
except BudgetExceeded as e:
    log.warning(f"agent stopped: {e}")
    return best_partial_result(state)   # graceful stop, not a crash
```

Frameworks like LangGraph expose a `recursion_limit` for the step cap; the spend cap you track from each response's `usage`.

## How a company uses this

A **Dubai SaaS company** runs a research agent for its users. Early on, a single malformed query made one agent loop on a search-summarize cycle that never satisfied its stop condition — it ran for 40 minutes and burned ~$180 in LLM calls before an engineer killed it manually. They added a **25-step cap, a $1.50/run spend cap, a 5-minute wall-clock cap, and a $50/user/day quota**. Now the same runaway self-terminates in seconds with a logged reason and a partial result, and no single user can spend more than their daily quota. The caps turned an unbounded liability into a predictable line item on the P&L.

## Common mistakes / misconceptions

- **No cap at all.** The default mistake — agents ship without limits and the first runaway is a surprise invoice.
- **Only a step cap, no spend cap.** Steps vary wildly in cost; 25 cheap steps and 25 expensive ones differ 100×. Track dollars, not just count.
- **"Asking the model to stay under budget" in the prompt.** A prompt is a suggestion; the model can't reliably count its own spend. Enforce in code.
- **Crashing instead of degrading.** Breaching a cap should return the best partial answer and log the reason, not throw an unhandled exception into the user's face.
- **Per-run only.** Without per-user/per-day quotas, one tenant (or one abuser) can still drain the global budget.

## Interview tip
Say: *"Every agent I ship has hard, external budget caps enforced in code, not in the prompt: a step cap, a token/dollar spend cap accumulated from each response's usage, and a wall-clock cap — plus per-user and per-day quotas on shared systems. On breach it's a clean kill-switch: stop, return the best partial result, log why, and alert. This is the single control that turns an unbounded runaway risk into a predictable cost."* Emphasizing *external and dollar-based* (not step-only, not prompt-based) is the answer that signals production scars.

See also: **[Loop / iteration limits](loop-iteration-limits.md)** (detecting the loop that would blow the budget) and **[Human approval](human-approval.md)** (the other high-impact-action safeguard).
