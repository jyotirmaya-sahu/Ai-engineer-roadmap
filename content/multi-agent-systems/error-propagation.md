# Error Propagation in Multi-Agent Systems

**The one-line idea:** one agent’s confident mistake becomes another agent’s input, so multi-agent systems can amplify errors unless every handoff is typed, validated, and observable.

## Why it matters

Adding agents adds failure boundaries. A researcher may retrieve the wrong document; a planner converts it into a flawed plan; an executor performs the wrong action; a reviewer sees only the polished result. The system can look more confident as accuracy falls.

## Containment pattern

<div class="diagram">
  <div class="flow">
    <span class="dbox red">Agent output</span>
    <span class="darr">→</span>
    <span class="dbox orange">Schema + evidence + policy checks</span>
    <span class="darr">→</span>
    <span class="dbox green">Next agent</span>
  </div>
</div>

Treat every handoff like an external API:

```python
from pydantic import BaseModel, Field

class Finding(BaseModel):
    claim: str
    source_ids: list[str] = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)

def accept(raw: dict, allowed_sources: set[str]) -> Finding:
    finding = Finding.model_validate(raw)
    if not set(finding.source_ids) <= allowed_sources:
        raise ValueError("unverified evidence")
    return finding
```

Use typed contracts, provenance, validation, bounded retries, timeouts, idempotency keys, and explicit failure states. Do not convert “failed to find evidence” into an empty successful result. Store a trace containing each input, output, tool call, validation decision, model version, and latency.

For high-impact actions, separate proposing from executing. A planner emits an action proposal; a policy component checks permissions and limits; a human or deterministic rule approves it; an executor then performs an idempotent action.

## How a company uses this

In a claims workflow, a document agent extracts values, a fraud agent scores anomalies, and a payment agent proposes settlement. Missing citations stop the chain. Conflicting amounts open a review task. The payment agent never receives authority merely because an upstream agent returned JSON.

## Common mistakes

- Passing free-form prose between agents.
- Retrying the whole workflow and duplicating side effects.
- Hiding partial failure in a “best effort” answer.
- Asking another LLM to validate facts without evidence.
- Logging only the final answer.

## Interview tip

Say: *“I assume upstream agent output is untrusted. Every boundary has a schema, provenance and policy validation; side effects are idempotent and approval-gated; failures are explicit; and the full trajectory is traceable and replayable.”*

