# Infinite Loops

**The one-line idea:** agent graphs need explicit termination conditions; “continue until satisfied” is not a production stopping rule.

## Why it matters

Planner–executor and generator–critic systems can bounce forever when success is subjective, state fails to update, or two agents keep rejecting one another. The result is unbounded cost, timeouts, repeated side effects, and a terrible user experience.

## Design termination first

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">Step</span>
    <span class="darr">→</span>
    <span class="dbox orange">Goal reached?</span>
    <span class="darr">no → budget check →</span>
    <span class="dbox red">Stop / escalate</span>
  </div>
</div>

Use several independent brakes:

- terminal success and failure states;
- maximum graph steps and per-node visits;
- wall-clock deadline;
- token and dollar budgets;
- repeated-state or repeated-tool-call detection;
- maximum critique or retry rounds;
- human escalation for unresolved ambiguity.

```python
import hashlib, json

seen: set[str] = set()

def guard(state: dict, step: int, max_steps: int = 12):
    if step >= max_steps:
        return "budget_exhausted"
    fingerprint = hashlib.sha256(
        json.dumps(state, sort_keys=True, default=str).encode()
    ).hexdigest()
    if fingerprint in seen:
        return "repeated_state"
    seen.add(fingerprint)
    return "continue"
```

Do not hash raw timestamps or request IDs, which make identical logical states look different. Normalize state to the fields that represent progress. Make side-effecting tools idempotent so an allowed retry cannot charge a card or send a message twice.

## How a company uses this

A document agent gets at most two extraction repairs and one policy-review cycle. If required fields remain missing, it creates a human-review task with the partial result and trace. The user receives a clear status rather than a spinner that eventually times out.

## Common mistakes

- Relying only on a natural-language prompt telling the model to stop.
- Counting retries but not graph transitions.
- Treating “no progress” as a reason to try the identical call again.
- Terminating without preserving the best partial result.
- Retrying non-idempotent side effects.

## Interview tip

Say: *“Every cyclic graph has explicit success/failure states, step and spend caps, a deadline, and repeated-state detection. Side effects are idempotent, and exhausted runs return a useful partial result or human escalation—not an endless loop.”*

