# Error Recovery

**The one-line idea:** Error recovery is what an agent does when a step fails in a way that retrying won't fix — it feeds the error message back into the agent's context so the model can *understand what went wrong and adapt*, instead of crashing or blindly repeating the same broken action.

## Why it matters for an AI Engineer

[Retry with backoff](retry-backoff.md) handles *transient* failures — the same call would succeed if you just wait. But many failures are *not* transient: the agent passed a malformed argument, called a tool that returned "customer not found", hit a validation error, or wrote code that threw an exception. Retrying those identically fails identically. What you want is for the agent to **read the error, learn from it, and try something different** — fix the argument, pick another tool, ask for clarification. This is the capability that makes agents feel *robust* rather than brittle. An agent that self-corrects from errors is dramatically more reliable in production, and "how does your agent handle tool failures?" is a near-guaranteed interview question.

## The mechanism — how it works

The core move is simple but powerful: **catch the error and put it back into the conversation as an observation.** Instead of letting an exception bubble up and kill the run, you wrap the tool call, and on failure you append a message like *"Tool `lookup_order` failed: order 42 not found. Try a different approach."* to the agent's context. The LLM then re-plans with that new information. Recovery strategies, from simplest to most robust:

- **Reflect & retry differently.** Return the error to the model; it corrects the arguments or reasoning and tries again (this is the ReAct loop's natural error path).
- **Fallback tool/path.** If the primary tool fails, route to an alternative (primary DB down → use cache; premium model errors → cheaper model).
- **Graceful degradation.** If nothing works, return a partial-but-honest result ("I couldn't reach the pricing service, here's everything else") instead of a crash.
- **Escalate.** Give up autonomously and hand to a human (see [human approval](human-approval.md)) or log for later.

Crucially, error recovery must combine with a **loop limit** — an agent that keeps failing and re-trying with new errors can spiral. Cap the recovery attempts.

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">🔧 tool call → ❌ "order not found"</span>
    <span class="darr">↓<span class="lbl">catch, don't crash</span></span>
    <span class="dbox blue">💬 feed error back as observation</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 agent re-plans<span class="sub">"maybe it's a different ID format"</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ corrected call succeeds</span>
  </div>
  <div class="dcap">Turn the error into context so the model adapts — don't let it crash or blindly repeat.</div>
</div>

## Concrete example

Catch tool errors and return them to the agent instead of raising:

```python
def safe_tool_call(tool, args, max_recover=3):
    """Return tool output, or an error-observation the agent can learn from."""
    for attempt in range(max_recover):
        try:
            return {"ok": True, "result": tool(**args)}
        except ValidationError as e:
            # non-transient: give the model the error so it fixes the args next turn
            return {"ok": False, "observation":
                    f"Tool '{tool.__name__}' rejected the input: {e}. "
                    f"Check the argument format and try again."}
        except ServiceUnavailable:
            fallback = FALLBACKS.get(tool.__name__)      # graceful degradation
            if fallback:
                return {"ok": True, "result": fallback(**args), "note": "used fallback"}
            return {"ok": False, "observation":
                    f"'{tool.__name__}' is unavailable and has no fallback."}
    return {"ok": False, "observation": "recovery attempts exhausted — escalating."}
```

The agent reads `observation` on its next turn and adjusts — the loop cap prevents an infinite retry-with-new-error spiral.

## How a company uses this

A **Dubai real-estate portal**'s listing agent enriches property data from several external APIs. One partner API frequently returns "property ID not recognized" for older formats. Before recovery, that error crashed the enrichment and dropped the listing. Now the failure is fed back as an observation — the agent recognizes the pattern, reformats the ID (adds the legacy prefix), and retries successfully. For APIs that are genuinely down, it degrades gracefully: it publishes the listing with the fields it *could* fetch and flags the rest for a nightly re-run. Result: near-zero dropped listings, versus a steady trickle of crashes before.

## Common mistakes / misconceptions

- **Letting exceptions crash the run.** An unhandled tool error throws away all prior work. Catch and convert to an observation.
- **Recovering without a cap.** Feeding errors back forever can loop endlessly (each attempt fails differently). Always bound recovery attempts.
- **Confusing it with retry/backoff.** Backoff = *same call, wait, repeat* for transient errors. Recovery = *different call/approach* because repeating won't help. You need both.
- **Silent recovery that hides real bugs.** If a tool "recovers" by always using a fallback, you may never notice the primary is broken. Log recoveries and alert on their rate.

## Interview tip
Say: *"I split failures into transient and non-transient. Transient ones get retry-with-backoff. Non-transient ones — bad args, 'not found', validation errors — I catch and feed back into the agent's context as an observation so it re-plans and adapts, with fallbacks for degraded service and graceful partial results as a last resort. All of it is bounded by a recovery cap so it can't spiral, and I log recovery rates so a silently-failing primary tool still gets noticed."* Distinguishing the two failure classes cleanly is the mark of someone who's debugged real agents.

See also: **[Retry / backoff](retry-backoff.md)** (the transient-failure counterpart) and **[Loop / iteration limits](loop-iteration-limits.md)** (the cap that stops recovery from spiraling).
