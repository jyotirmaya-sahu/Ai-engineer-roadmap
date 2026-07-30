# Per-run token & spend budgets

**What it is:** A hard cap on how many tokens (or dollars) a single agent task is allowed to spend, enforced in code, that aborts the run the moment it's exceeded.

## Why it matters for an AI Engineer

This is the control that keeps a surprise from becoming a catastrophe. Without a budget, a single pathological task — a retry storm, an [infinite loop](loop-detection.md), a user pasting a 500-page PDF — can cost tens of dollars, and 10,000 such tasks can cost a five-figure invoice nobody approved. A per-run budget converts "unbounded worst case" into "known worst case," which is the difference between a feature you can ship and one your finance team vetoes. Interviewers treat "how do you bound cost?" as a shibboleth for whether you've run agents for real.

## The mechanism — meter, accumulate, enforce

You need three things:

1. **A meter.** Every LLM response returns a usage object — `input_tokens`, `output_tokens` (and cached/thinking tokens). Read it after each call.
2. **An accumulator.** Keep a running total of tokens *and* dollars for the run. Convert tokens to dollars with the model's price sheet (input and output are priced differently — output is typically 3–5× input).
3. **An enforcer.** Before or after each step, check the accumulator against the budget. If over, **stop the loop** and return a graceful partial result or a "budget exceeded" error — never just keep going.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox purple">🧠 step</span>
      <span class="darr">→</span>
      <span class="dbox blue">read usage<span class="sub">in/out tokens</span></span>
      <span class="darr">→</span>
      <span class="dbox orange">accumulate $</span>
      <span class="darr">→</span>
      <span class="dbox yellow">over budget?</span>
    </div>
    <div class="flow">
      <span class="dbox green">no → continue loop</span>
      <span class="dbox gray">yes → 🛑 abort + return partial</span>
    </div>
  </div>
  <div class="dcap">After every step, meter usage, roll it into a running dollar total, and abort the instant it crosses the cap.</div>
</div>

Set budgets at **two tiers**: a per-run cap (this task can't exceed $0.50) *and* a per-user or per-tenant daily cap (this customer can't exceed $20/day) to stop abuse across many runs. The per-run cap protects against one bad task; the daily cap protects against many.

## Concrete example

```python
PRICE = {"in": 3/1e6, "out": 15/1e6}   # Claude Sonnet 2026, $/token

class Budget:
    def __init__(self, max_usd): self.max_usd, self.spent = max_usd, 0.0
    def charge(self, usage):
        self.spent += usage.input_tokens*PRICE["in"] + usage.output_tokens*PRICE["out"]
        if self.spent > self.max_usd:
            raise BudgetExceeded(f"${self.spent:.2f} > ${self.max_usd:.2f}")

budget = Budget(max_usd=0.50)
for step in range(MAX_STEPS):
    resp = client.messages.create(model="claude-sonnet-4-6", messages=history, ...)
    budget.charge(resp.usage)          # raises → loop aborts gracefully
    ...
```

Wrap the loop in `try/except BudgetExceeded` to return whatever partial progress exists plus a clear "hit budget cap" flag, so the caller/user isn't left with a silent failure.

## Worked numbers

A support agent has a $0.30 per-ticket budget. Normal tickets cost ~$0.04. One day a customer forwards a 200-message email thread; the agent starts re-sending a huge history each step. **Without a budget** it would run to the context limit at ~$9. **With the budget**, it aborts at step 7 having spent $0.31, returns "this thread is too large to auto-resolve — escalating to a human," and pages nobody. Multiply across 50,000 tickets/month: the budget is the difference between a predictable ~$2 K bill and an unpredictable one with a fat tail.

## How a company uses this

A Dubai insurance company's claims-triage agent enforces a **$0.25 per-claim** hard budget and a **$50/day per broker-account** cap. The per-claim cap caught a bug where a malformed PDF made the parser tool return garbage that the agent kept re-analyzing — it aborted at $0.26 instead of running away. The per-account cap caught a broker script hammering the API 4,000×; it throttled at $50 and alerted ops instead of billing $900. They log every abort to a dashboard, and a rising abort rate is now an early-warning signal that something upstream is broken — the budget doubles as a monitoring tripwire.

## Common mistakes
- **Pricing input and output the same** — output tokens cost several times more; a text-heavy agent's bill is dominated by output. Meter them separately.
- **Only a global monthly cap** — that lets one run or one user cause damage before the cap trips. You need per-run and per-tenant granularity.
- **Aborting ungracefully** — throwing a raw exception to the user. Catch it and return a partial result with a clear reason.
- **Forgetting cached/thinking tokens** — cached input is cheaper, thinking tokens still cost; use the real usage object, don't estimate.

## Interview tip
Say: *"Every run gets a hard token/dollar budget I meter from the usage object after each step, pricing input and output separately, and I enforce two tiers: per-run to stop one bad task and per-tenant/day to stop abuse. On breach I abort gracefully with a partial result. This turns an unbounded worst case into a known one — which is what makes an agent shippable — and the abort rate doubles as a monitoring signal."* The two-tier point and the graceful-abort point are what land it.
