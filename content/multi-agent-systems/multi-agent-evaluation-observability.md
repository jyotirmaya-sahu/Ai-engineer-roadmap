# Multi-Agent Evaluation & Observability

**The one-line idea:** evaluate both the final outcome and the trajectory that produced it; a correct answer can hide wasteful or unsafe coordination.

## Why it matters

Final-answer metrics cannot reveal that the router chose the wrong specialist, two agents duplicated work, an unsafe tool was attempted, or a critic added three useless rounds. Multi-agent systems need outcome, component, and trajectory evaluation.

## What to capture

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">Trace<span class="sub">agents · tools · handoffs</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">Evaluators<span class="sub">quality · safety · efficiency</span></span>
    <span class="darr">→</span>
    <span class="dbox green">Regression gate</span>
  </div>
</div>

For every run, record a trace ID, user/tenant, graph version, model snapshots, prompts, agent inputs/outputs, tool arguments/results, handoffs, state transitions, validation and approval decisions, tokens, cost, and latency. Redact secrets and sensitive user data before telemetry leaves the trust boundary.

Evaluate:

- **Outcome:** task success, groundedness, correctness, user acceptance.
- **Routing:** correct specialist selected; unnecessary agents avoided.
- **Tools:** correct tool and arguments; side effects authorized.
- **Coordination:** duplicate work, handoff quality, conflict resolution.
- **Efficiency:** calls, steps, tokens, cost, critical-path latency.
- **Safety:** policy violations, blocked actions, human approvals.

```python
def trajectory_score(trace):
    return {
        "success": trace.final_grade >= 0.8,
        "route_accuracy": trace.expected_agent == trace.first_agent,
        "duplicate_calls": len(trace.tool_calls) - len(set(trace.tool_calls)),
        "within_budget": trace.cost_usd <= trace.budget_usd,
        "steps": len(trace.transitions),
    }
```

Build a golden set of representative tasks with expected outcomes and allowed tool paths. Run it in CI for prompt, model, graph, and tool changes. Use production traces—after privacy filtering—to discover new failure cases and add them to the regression set.

## How a company uses this

A customer-service supervisor graph may answer correctly while routing simple FAQ questions through expensive billing and policy agents. Outcome quality looks fine, but trajectory metrics expose the waste. A regression gate then fails releases that exceed the route or cost budget.

## Common mistakes

- Logging only the final answer.
- Using an LLM judge as the sole evaluator.
- Storing secrets or raw PII in traces.
- Comparing versions on different task sets.
- Optimizing average cost while missing runaway p99 trajectories.

## Interview tip

Say: *“I evaluate outcome and trajectory. Traces capture every handoff, tool call, state change, model, latency and cost; golden tasks test routing, safety and completion in CI; and production failures feed the regression set after privacy controls.”*

