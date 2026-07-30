# Replayable Traces

**The one-line idea:** A replayable trace is a complete, ordered recording of everything an agent did in a run — every prompt, LLM response, tool call, and result — captured in enough detail that you can inspect it, reproduce it, or *re-run* it later to debug exactly what went wrong.

## Why it matters for an AI Engineer

When an agent fails in production, you have a problem no traditional app has: the run is gone, it was non-deterministic, and re-running it may not fail the same way. Without a trace you're guessing. A replayable trace is the flight recorder — it captures the full decision path so you can open a failed run, see the exact step where it went sideways, read what the model was thinking, and reproduce it on demand. It's the foundation of agent **observability and debugging**, it feeds your [trajectory evals](trajectory-eval.md), and it's what makes runs auditable for compliance. "How do you debug an agent that failed in production?" has one good answer, and it starts with "I look at the trace." This is a daily-driver skill for anyone running agents in production.

## The mechanism — how it works

You instrument the agent to emit a **span** for every meaningful operation, forming a tree/timeline of the whole run:

- **What's captured per step:** the input prompt (including the assembled context), the raw LLM response, the tool name + arguments, the tool's result, token counts, latency, cost, and any errors. Plus run-level metadata: timestamp, model version, seed, user/session ID.
- **The trace tree.** Steps nest — an agent span contains LLM-call spans and tool-call spans; sub-agents nest under their parent. This structure lets you see *where* time and money went and *which* sub-step failed.
- **Inspect vs replay** — two levels:
  - **Inspect (observability):** read the trace to understand a run. Tools like LangSmith, Langfuse, or OpenTelemetry-based tracing render the tree, show each prompt/response, and let you search across runs.
  - **Replay (reproduction):** because you *recorded the actual LLM and tool outputs*, you can re-execute the run feeding back those recorded responses — getting a bit-exact reproduction even though the model is non-deterministic (the record/replay side of [determinism](determinism-reproducibility.md)). You can also **fork** a trace: replay up to step 5, then swap in a fixed prompt to test whether your change fixes the bug — without re-running the expensive earlier steps.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 run</span>
    <span class="darr">↓<span class="lbl">emit spans</span></span>
    <span class="dstack">
      <span class="dbox blue">span: LLM call · prompt+response · 1.2k tok · 800ms</span>
      <span class="dbox blue">span: tool lookup_order · args · result · 40ms</span>
      <span class="dbox blue">span: LLM call · ... · 900ms</span>
      <span class="dbox orange">span: tool issue_refund · ❌ error</span>
    </span>
    <span class="darr">↓</span>
    <span class="dbox green">🔍 inspect · ▶️ replay · 🍴 fork-and-fix</span>
  </div>
  <div class="dcap">Every step recorded as a span → a searchable, reproducible timeline of the whole run.</div>
</div>

## Concrete example

Instrument an agent with a tracer (Langfuse-style, 2026); every step becomes a recorded span:

```python
from langfuse import observe, get_client
langfuse = get_client()

@observe()                                   # captures inputs, outputs, latency, cost
def run_agent(task):
    langfuse.update_current_trace(user_id="u_42", metadata={"model": "gpt-4o-2024-11-20"})
    state = init(task)
    while not state.done:
        resp = call_llm(state)               # LLM call auto-traced as a child span
        record = {"prompt": state.prompt, "response": resp.content,
                  "tokens": resp.usage.total_tokens}
        state = execute_tools(state, resp)   # tool calls traced too, with args + results
    return state.result
# every prompt, response, tool arg/result, token count, and error is now in the trace store,
# viewable as a tree — and replayable because the raw responses were recorded
```

The recorded raw responses are what let you later replay or fork the run.

## How a company uses this

A **Dubai travel platform**'s booking agent occasionally booked the wrong fare class — rare, ~1 in 500 runs, and impossible to reproduce live. With **replayable traces** in their observability stack, an engineer pulled the exact failing trace, saw that on step 3 the agent had misread a malformed fare-rules response and picked the wrong tool, then **forked the trace at step 3** with a patched prompt and replayed — confirming the fix reproduced correctly without re-running the whole booking flow or spending on live APIs. The bug was fixed and regression-tested in an hour. At their scale (millions of searches/month) the trace store is also the audit trail for every booking decision.

## Common mistakes / misconceptions

- **Only logging the final output.** A one-line log can't tell you *where* a multi-step run broke. You need the full step-by-step tree.
- **Logging inspect-only, not replay-able.** If you record a summary but not the raw LLM/tool responses, you can inspect but never truly reproduce or fork. Capture the raw payloads.
- **Logging secrets/PII into traces.** Traces contain full prompts and results — redact sensitive data before storing, or your observability store becomes a data-leak.
- **No sampling strategy at scale.** Tracing every token of millions of runs is costly; sample low-risk traffic and trace 100% of errors and high-value flows.

## Interview tip
Say: *"I trace every agent run as a span tree — each prompt, LLM response, tool call and result, with tokens, latency, and cost. That gives me two things: observability, so I can open a failed production run and see the exact step it broke, and reproducibility, because I record the raw responses so I can replay a run bit-exact or fork it at a step to test a fix cheaply. It also doubles as the audit trail. I redact PII before storing and sample at scale but always trace 100% of errors."* Distinguishing inspect from replay, and mentioning fork-and-fix, is the answer that shows you've actually debugged agents in production.

See also: **[Trajectory eval](trajectory-eval.md)** (traces are what it grades), **[Determinism & reproducibility](determinism-reproducibility.md)** (the record/replay foundation), and the **Agent Cost & Context Control** node (replayable/debuggable trajectories at scale).
