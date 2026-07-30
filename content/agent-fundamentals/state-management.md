# State Management

**What it is:** The plumbing that carries an agent's state — the conversation, tool results, plan, and memory pointers — through every turn of the [agent loop](agent-loop.md), and persists it so a run can pause, resume, or recover after a crash.

## Why it matters for an AI Engineer

Everything else in this node — the loop, memory — only works because *state flows correctly between steps*. State management is the unglamorous engineering that makes an agent production-grade: it's what lets a long-running agent survive a server restart, resume a task where it left off, run for a human-approval pause and pick back up, and be *replayed for debugging*. Get it wrong and your agent loses its place, double-executes an action, or can't be recovered when it crashes mid-task. Frameworks like LangGraph exist largely to solve this one problem, and knowing *why* they're built around explicit state is a strong signal in interviews.

## The mechanism: how it works

"State" is the complete snapshot the agent needs to continue: the message history (short-term memory), any plan, intermediate results, tool outputs, loop counters, and references into long-term memory. State management is how you **thread, persist, and recover** it.

Three levels:

1. **In-memory threading (basic).** State is just a variable — the `messages` list — passed into each loop iteration and updated after. Fine for a single short run in one process. If the process dies, the state is gone.

2. **Explicit state object (structured).** Instead of an ad-hoc list, define a typed state (e.g. a dict/schema with `messages`, `plan`, `step`, `results`). Each loop step is a pure function `state → new state`. This is the **LangGraph model**: nodes read and write a shared state object, edges decide the next node. Making state explicit means you can inspect it, validate it, and reason about it.

3. **Persisted / checkpointed (production).** After each step, **save the state** to a store (a database, LangGraph's checkpointer). Now the agent can: **resume** after a crash from the last checkpoint, **pause** for human approval and continue later, run **long-lived** tasks across hours, and be **replayed** — load a past checkpoint and step forward to debug exactly what happened. Persistence usually keys state by a **thread/session ID** so many concurrent agents don't collide.

The core discipline: state should be **explicit and serialisable**, not hidden in local variables. If you can save it, you can resume, recover, and replay it.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 Step N reads state</span>
    <span class="darr">↓</span>
    <span class="dbox orange">✏️ produces new state (msgs, plan, step++)</span>
    <span class="darr">↓<span class="lbl">checkpoint</span></span>
    <span class="dbox blue">🗄️ persist by thread-id</span>
    <span class="darr">↓<span class="lbl">resume / replay</span></span>
    <span class="dbox green">🧠 Step N+1 reads state</span>
  </div>
  <div class="dcap">State flows step→step and is checkpointed, so runs can resume, pause for approval, or be replayed.</div>
</div>

## Concrete example

An explicit, serialisable state with per-step checkpointing (the pattern LangGraph automates):

```python
import json, os

def load(thread):                       # RESUME from last checkpoint
    p = f"state/{thread}.json"
    if os.path.exists(p):
        return json.load(open(p))
    return {"messages": [], "step": 0, "plan": None}

def save(thread, state):                # CHECKPOINT after each step
    os.makedirs("state", exist_ok=True)
    json.dump(state, open(f"state/{thread}.json", "w"))

def run_step(state, client, tools):
    # ... call the LLM, run any tool, append results ...
    state["step"] += 1
    return state

def agent(thread, max_steps=10):
    state = load(thread)                # picks up where a crash left off
    while state["step"] < max_steps and not state.get("done"):
        state = run_step(state, client=None, tools=[])
        save(thread, state)             # durable after every step
    return state
```

Because `state` is a plain serialisable dict saved after each step, killing the process mid-run and calling `agent(thread)` again resumes from the last checkpoint instead of restarting. Keying by `thread` isolates concurrent runs.

## How a company uses this

A government-services portal in Dubai runs agents that process multi-step applications (licence renewals) that legally **require a human officer to approve** before the final action. State management is what makes this possible: the agent gathers documents, checkpoints its full state, and **pauses**; hours later the officer approves, and the agent **resumes from the exact checkpoint** to complete the filing — no re-doing the earlier steps. They also rely on checkpoints for **crash recovery** (a node restart mid-application loses nothing) and **auditability** — every application's state history is replayable, so a regulator can inspect precisely what the agent did and why. At their scale (tens of thousands of concurrent applications) state is keyed by application ID in a database, and checkpointing after every step is the backbone of both the human-in-the-loop flow and compliance. Without persisted state, none of it works.

## Common mistakes

- **State hidden in local variables.** If it only lives in memory, a crash loses the task and you can't resume or replay. Make state explicit and serialisable.
- **Non-serialisable state.** Stuffing live objects (open connections, functions) into state breaks checkpointing. Keep it plain data.
- **No thread/session key.** Sharing one global state across concurrent runs causes agents to corrupt each other's context.
- **Checkpointing too rarely.** Only saving at the end defeats resume/recovery — checkpoint after each meaningful step.
- **Non-idempotent steps on resume.** If resuming re-runs an action that already happened (charging a card twice), you get double-execution. Track completed actions in state.

## Interview tip
Say: *"State management threads the agent's state — messages, plan, results, memory pointers — through the loop and persists it. I keep state explicit and serialisable, key it by thread ID, and checkpoint after each step. That's what enables crash recovery, pausing for human approval and resuming, long-running tasks, and replay-based debugging. It's the main reason frameworks like LangGraph are built around an explicit state object — and I watch for non-idempotent steps so a resume doesn't double-execute an action."* Naming resume/replay/human-in-the-loop as the payoffs shows you know why it matters in production.

See also: [Agent loop](agent-loop.md) (what state flows through), [Short-term memory](short-term.md) (the biggest part of state), [Long-term memory](long-term.md) (referenced from state).
