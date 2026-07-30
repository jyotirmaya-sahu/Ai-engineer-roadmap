# Coordination Overhead

**The one-line idea:** agents spend time and tokens describing, delegating, synchronizing, and reconciling work; if that overhead exceeds useful parallel work, multiple agents are worse than one workflow.

## Why it matters

Multi-agent architecture is not automatically more capable. Each boundary adds serialization, another model call, duplicated context, queueing, and a chance of disagreement. Parallel workers improve latency only when tasks are independent enough to run concurrently and the merge step is cheap.

## Measure before adding agents

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">Useful work</span>
    <span class="darr">+</span>
    <span class="dbox orange">Coordination<span class="sub">route · handoff · merge · retry</span></span>
    <span class="darr">=</span>
    <span class="dbox green">End-to-end result</span>
  </div>
</div>

Track coordination ratio:

```python
coordination_ms = routing_ms + handoff_ms + merge_ms + waiting_ms
ratio = coordination_ms / total_workflow_ms

if ratio > 0.30:
    print("Simplify the topology or increase task granularity")
```

Thirty percent is a diagnostic threshold, not a law. Also measure tokens spent on delegation/merging, worker utilization, critical-path latency, duplicate tool calls, and rework caused by conflicting results.

Reduce overhead by using deterministic routing where possible, making tasks coarse enough to justify a handoff, passing structured artifacts rather than full transcripts, limiting shared state, and choosing a topology that matches dependencies. A fixed DAG is usually cheaper and easier to debug than an open-ended “agents chatting” design.

## How a company uses this

A compliance report originally used eight specialist agents. Traces showed four workers spent most of their time restating the same policy context and waiting for one database query. The team replaced them with one SQL tool step, two truly independent reviewers, and a deterministic merge. Latency and cost fell while accuracy stayed constant.

## Common mistakes

- Splitting one small task into many roles because the architecture looks sophisticated.
- Parallelizing tasks that depend on one another.
- Broadcasting the complete transcript to every worker.
- Letting agents negotiate responsibilities repeatedly.
- Ignoring queueing and merge time in benchmarks.

## Interview tip

Say: *“I earn the complexity of multi-agent design. I benchmark it against a single-agent or fixed-workflow baseline, inspect the critical path and coordination ratio, and keep only parallel specialists that add measurable quality or latency value.”*

