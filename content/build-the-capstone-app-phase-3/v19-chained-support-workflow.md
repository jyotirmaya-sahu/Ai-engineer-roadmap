# v19 · Chained Support Workflow

**What you'll build:** replace one oversized “understand, research, decide, and answer” prompt with a small stateful workflow whose stages have explicit schemas and failure paths.

## Why this version

One prompt doing five jobs is hard to debug. If the result is wrong, you cannot tell whether HelpDesk misunderstood the intent, chose the wrong tool, misread evidence, or wrote a poor answer. Decomposition turns those hidden steps into observable contracts.

## The mechanism

Use five stages: classify the request, create a bounded plan, execute only allowed reads, draft a grounded response, and verify it. Each stage receives only the context it needs.

<div class="diagram">
  <div class="flow"><span class="dbox gray">request</span><span class="darr">→</span><span class="dbox orange">classify</span><span class="darr">→</span><span class="dbox purple">plan</span><span class="darr">→</span><span class="dbox blue">execute tools</span><span class="darr">→</span><span class="dbox orange">draft + verify</span><span class="darr">→</span><span class="dbox green">answer</span></div>
  <div class="dcap">Small stages expose where a failure occurred and prevent irrelevant context from leaking between tasks.</div>
</div>

Persist `workflow_runs` and `workflow_steps`. A run carries tenant, conversation, immutable release-bundle ID, deadline, and status. Each step carries a typed allowlisted operation, dependency, canonical input hash, attempt, lease, result reference, and version. The API commits the run plus first job and returns `202`; workers advance one transition at a time with optimistic locking.

```python
async def run_next_step(run_id: UUID, tenant: TenantContext, db):
    step = await claim_next_step(run_id, tenant, db)
    if not step:
        return
    try:
        handler = STEP_HANDLERS[type(step.operation)]
        result = await handler(step.operation, tenant)
        await complete_step_and_enqueue_dependents(db, step, result)
    except RetryableStepError as exc:
        await schedule_step_retry(db, step, safe_error_code(exc))
    except Exception as exc:
        await fail_run_and_emit_event(db, step, safe_error_code(exc))
```

This is a bounded **plan-and-execute** workflow, not a free-running ReAct loop: application code owns the stages and tool allowlist. Cap steps, tools, tokens, and elapsed time. Store concise structured decisions—not private hidden chain-of-thought. For hard classification, an independent verifier or structured vote can improve reliability; for open-ended planning, Tree-of-Thought-style branching is usually too expensive unless offline evaluation proves value.

Compile model plans into discriminated, server-owned step types; arbitrary tool names never reach a dispatcher. Make every stage replayable with saved sanitized input references and fake tool outputs. A worker restart resumes after the last committed stage. Read stages may retry; state-changing tools require provider/application idempotency keys and a recorded result, or an explicit compensation plan. A failure identifies `stage=verify`, release bundle, and `reason=unsupported_claim`, not merely “model failed.”

## How a company uses this

Workflow traces let operations see that most failures occur during evidence selection, not answer writing. Engineers can improve that stage without changing the rest. Latency budgets also become explicit: classification 400 ms, tool reads 800 ms, draft 1.5 s, verifier 500 ms. Independent stages may run in parallel when dependencies allow.

## Common mistakes

- Turning decomposition into dozens of model calls.
- Letting the model execute arbitrary tool names or arguments.
- Passing the full conversation to every stage.
- Recording private reasoning instead of concise decision fields.
- Retrying the entire workflow when only one safe stage failed.

## Interview tip

Show that workflows trade extra calls for debuggability and control. State the step cap, tool allowlist, per-stage schema, and verifier behavior.

## Practice — assignments

1. Split the support path into five typed stages.
2. Give each stage a distinct prompt and context budget.
3. Enforce a three-step tool cap and total deadline.
4. Replay a saved workflow using fake tool results.
5. Add an unsupported-claim verifier.
6. Measure quality, latency, and cost against the single-prompt baseline.
7. Remove any stage that adds cost without measurable benefit.
