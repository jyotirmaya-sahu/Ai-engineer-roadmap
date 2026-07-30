# Cost Explosion in Multi-Agent Systems

**The one-line idea:** agent count multiplies steps, context, retries, and tool calls; without budgets, a small request can silently become dozens of model calls.

## Why it matters

The cost of a workflow is approximately:

```text
total = Σ(model input + model output + tool cost) across every step and retry
```

An orchestrator with five workers, two review rounds, and one retry can easily exceed 15 calls. Shared conversation history grows each round, so later calls are often the most expensive.

## Control the budget

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">Request budget<span class="sub">$ · tokens · steps · time</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">Allocate per worker</span>
    <span class="darr">→</span>
    <span class="dbox red">Stop or degrade<span class="sub">before overspend</span></span>
  </div>
</div>

```python
from dataclasses import dataclass

@dataclass
class Budget:
    tokens_left: int = 30_000
    steps_left: int = 12

    def charge(self, tokens: int):
        if self.steps_left <= 0 or tokens > self.tokens_left:
            raise RuntimeError("workflow budget exhausted")
        self.steps_left -= 1
        self.tokens_left -= tokens
```

Set limits before execution: maximum steps, workers, parallel branches, retries, input/output tokens, tool spend, and wall-clock time. Give each worker only the context it needs. Use smaller models for routing, extraction, and validation; reserve expensive models for the genuinely difficult step. Cache deterministic tool results and reuse artifacts instead of pasting the entire history.

Cost observability should attribute spend to tenant, feature, workflow, agent, step, and model. Alert on p95 cost and runaway trajectories, not only monthly totals.

## How a company uses this

A research assistant may allow a $0.20 interactive budget and a $2 approved deep-research budget. At 80% consumption it stops adding sources, asks workers for concise findings, and produces the best grounded answer available. It never silently crosses the user’s tier.

## Common mistakes

- Using the same frontier model for every role.
- Giving every worker the full transcript.
- Unlimited evaluator–optimizer loops.
- Retrying deterministic failures.
- Measuring average cost while ignoring pathological p99 runs.

## Interview tip

Say: *“Multi-agent cost is multiplicative. I enforce per-run token, dollar, step, retry and time budgets; isolate context; route simple steps to cheaper models; cache tool outputs; and trace cost per agent. When the budget tightens, the workflow degrades predictably instead of running away.”*

