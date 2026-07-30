# Replayable / debuggable trajectories

**What it is:** Logging every step of an agent run — each prompt, model output, tool call, and tool result — so you can inspect *exactly* what happened, and re-run (replay) a failed run to debug it.

## Why it matters for an AI Engineer

When an agent gives a wrong or expensive answer in production, "it messed up somewhere" is useless. You need to see the *trajectory*: which step went wrong, what the model saw, what the tool returned. Without recorded trajectories, every agent incident is unreproducible and undebuggable — you're guessing. With them, a postmortem is "open run `abc123`, step 14, see the tool returned stale data." This is the observability layer that turns agents from a black box into a system you can actually operate, and it's the difference between fixing a bug in an hour versus a week.

## The mechanism — record everything, structured

A trajectory is the full ordered record of a run. For each step, capture:

- **step index & timestamp**
- **input context** sent to the model (or a hash/reference if huge)
- **model output** — reasoning, the tool call chosen, `stop_reason`
- **tool call** — name + exact args
- **tool result** — raw (or a reference to it)
- **usage** — input/output tokens, cost (ties to [budgets](per-run-token-spend-budgets.md))
- **run-level metadata** — task, model version, `seed`, `system_fingerprint`, user/tenant, [kill/loop](loop-detection.md) events

Store it structured (JSON lines per step, or a tracing backend). Two capabilities fall out:

1. **Debug / inspect** — a human or eval reads the trajectory to find the failing step.
2. **Replay** — re-run the agent feeding the *recorded* tool results back (instead of calling live tools). Combined with [determinism](determinism-seeds.md) (temp 0, pinned model, seed), the run reproduces, so you can step through it, tweak the prompt, and see the fix — cheaply and offline.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox purple">step 1</span>
      <span class="dbox purple">step 2</span>
      <span class="dbox orange">step 14 ⚠️</span>
      <span class="dbox purple">step 15</span>
      <span class="darr">→<span class="lbl">logged</span></span>
      <span class="dbox blue">🗄️ trajectory store</span>
    </div>
    <span class="darr">↓<span class="lbl">replay w/ recorded tool results</span></span>
    <span class="dbox green">🔁 reproduce &amp; fix offline</span>
  </div>
  <div class="dcap">Every step is recorded; a failed run is replayed from its log — with recorded tool outputs — to debug it deterministically.</div>
</div>

## Concrete example

```python
import json, time, uuid

class Trajectory:
    def __init__(self, task, meta):
        self.id = str(uuid.uuid4())
        self.f = open(f"traj/{self.id}.jsonl", "w")
        self._w({"type": "run_start", "task": task, **meta, "t": time.time()})
    def _w(self, rec): self.f.write(json.dumps(rec) + "\n"); self.f.flush()
    def step(self, i, ctx_hash, model_out, tool, args, result, usage):
        self._w({"type": "step", "i": i, "ctx_hash": ctx_hash,
                 "model_out": model_out, "tool": tool, "args": args,
                 "result": result, "usage": dict(usage), "t": time.time()})

# Replay: feed recorded results instead of calling live tools
def replay(traj_id):
    steps = [json.loads(l) for l in open(f"traj/{traj_id}.jsonl") if '"step"' in l]
    for s in steps:
        # re-issue the model call with same context; assert same tool/args,
        # and return s["result"] instead of hitting the real tool
        ...
```

Production teams usually use a tracing tool (LangSmith, Langfuse, Phoenix, or OpenTelemetry-based tracing) rather than hand-rolling files — but the *content* recorded is exactly the above.

## How a company uses this

A Dubai government-services agent (visa-status queries) had a complaint: one user got a wrong status. With trajectories in Langfuse, support pulled the exact run in minutes and saw at **step 6** the `lookup_status` tool had returned a **cached response from 8 hours earlier** — the bug was a stale cache, not the model. They fixed the tool, then **replayed 400 recent trajectories** offline against the fixed tool to confirm no other users were affected — for the cost of the model calls only, no live system load. Without trajectories, that's a multi-day reproduction hunt; with them, it was an afternoon, and the replay gave regulators an auditable record that the issue was contained. In enterprise Dubai contexts, that audit trail is often a compliance requirement, not just a debugging nicety.

## Common mistakes
- **Logging only the final answer** — the answer tells you *that* it failed, not *where*. Log every step.
- **Not recording context/model version/seed** — then you can't replay deterministically and the trajectory is only half-useful.
- **Storing full raw tool results inline forever** — huge and costly; store big blobs by reference (hash → object storage) and keep the trajectory light.
- **No PII handling** — trajectories capture real user data; redact/encrypt and set retention, especially under UAE data-protection rules.
- **Treating replay as bit-exact** — pair it with [determinism](determinism-seeds.md) and accept best-effort; the recorded tool results are what make replay reliable, not the model alone.

## Interview tip
Say: *"I record the full trajectory of every run — context, model output, tool calls and results, usage, and metadata like model version and seed — to a tracing backend. That makes any incident debuggable: I open the run, find the failing step, and can replay it offline by feeding the recorded tool results back, so I reproduce and fix deterministically without hitting live systems. It's the observability layer that makes agents operable, and in regulated Dubai enterprise work it's also the audit trail."* The replay-with-recorded-tool-results detail is what shows you've debugged agents for real.
