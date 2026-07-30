# Orchestrator-workers

**What it is:** a lead LLM (the **orchestrator**) that looks at a task, **decides on the fly** how to break it into subtasks, hands each to a worker LLM, and then synthesizes their results — like a project manager who reads the brief, invents the task list *for this specific job*, and assigns it to the team.

## Why it matters for an AI Engineer

[Parallelization](parallelization.md) splits work into subtasks *you* defined in advance. But some tasks can't be pre-split — you don't know until you see the input how many pieces there are or what they'll be. "Fix all the bugs in this codebase" might mean two files or twenty; "research this company" might need three sub-questions or eight. You can't hardcode that.

Orchestrator-workers is the pattern for exactly this: the subtasks are **determined by the model at runtime**, not by your code. This is your first real step into *agentic* territory — the LLM controls part of the flow. For an AI Engineer, it's the go-to when the shape of the work is unpredictable but you still want the parallelism and specialization of a worker pool. It's more capable than a fixed workflow and more controllable than a fully autonomous agent — a sweet spot.

## The mechanism / how it works

The orchestrator receives the task and produces a **structured list of subtasks** (usually JSON). Your code spins up a worker call per subtask — often in [parallel](parallelization.md) — collects the outputs, and feeds them back to the orchestrator (or a synthesizer) to assemble the final answer.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📋 Complex task</span>
    <span class="darr">↓</span>
    <span class="dbox purple wide">🧭 Orchestrator: decompose (dynamic)</span>
    <span class="darr">↓<span class="lbl">spawns N workers</span></span>
    <div class="flow">
      <span class="dbox orange">👷 worker A</span>
      <span class="dbox orange">👷 worker B</span>
      <span class="dbox orange">👷 worker C</span>
    </div>
    <span class="darr">↓<span class="lbl">gather</span></span>
    <span class="dbox purple">🧵 Synthesize</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Final result</span>
  </div>
  <div class="dcap">The orchestrator decides the subtask list at runtime — the number and nature of workers isn't fixed in code.</div>
</div>

The crucial difference from parallelization: **who writes the subtask list.** In parallelization, you did, in code. Here, the orchestrator LLM does, per input. That flexibility is the power *and* the risk — the model could spawn too many workers, so you bound it (cap the number of subtasks, cap total spend).

## A concrete example

An orchestrator that decomposes a research question into sub-questions, runs a worker per sub-question, and synthesizes.

```python
import json, asyncio
from openai import AsyncOpenAI
client = AsyncOpenAI()

async def llm(prompt: str) -> str:
    r = await client.chat.completions.create(
        model="gpt-4o-mini", temperature=0,
        messages=[{"role": "user", "content": prompt}])
    return r.choices[0].message.content

async def orchestrate(task: str) -> str:
    # Orchestrator decides the subtasks (capped at 4)
    raw = await llm(f'Break this into up to 4 research sub-questions. '
                    f'Return a JSON list of strings.\nTask: {task}')
    subtasks = json.loads(raw)[:4]                       # bound the fan-out

    # One worker per subtask, in parallel
    findings = await asyncio.gather(*[
        llm(f"Answer concisely: {q}") for q in subtasks])

    # Synthesize
    joined = "\n".join(f"Q: {q}\nA: {a}" for q, a in zip(subtasks, findings))
    return await llm(f"Synthesize into one brief:\n{joined}")

print(asyncio.run(orchestrate(
    "Should we open a fintech office in Dubai's DIFC?")))
```

The subtask list isn't in the code — the orchestrator invents it for this question. The `[:4]` cap is the guardrail that stops a runaway decomposition.

## How a company uses this

A **Dubai consulting firm** built a market-research assistant. Given "assess the EV-charging market in the UAE," an orchestrator decomposes it live — one run yields 4 sub-questions (demand, competitors, regulation, infrastructure), another yields 6, depending on scope. Each becomes a parallel worker with web-search tools; a synthesizer merges them into a briefing. A typical report uses 5–9 worker calls and costs ~$0.15, finishing in ~20s versus the ~2 hours an analyst spent manually. They cap workers at 8 and total spend at $0.50/run — without those caps, an early version once spun up 30 sub-questions on a vague prompt and burned $6 on one request.

## Common mistakes / misconceptions

- **No cap on subtasks.** A vague input can make the orchestrator spawn dozens of workers. Always bound the fan-out and total spend.
- **Confusing it with parallelization.** If *you* wrote the subtask list, it's parallelization. Orchestrator-workers means the *model* wrote it — that's the whole distinction.
- **Skipping synthesis.** Raw worker outputs aren't an answer. The orchestrator (or a dedicated synthesizer) must merge them coherently.
- **Using it for predictable tasks.** If you already know the subtasks, don't pay an LLM to "decide" them — just parallelize. Reserve orchestration for genuinely unpredictable decomposition.

## Interview tip
Say: *"Orchestrator-workers is for tasks where I can't predict the subtasks ahead of time — a lead LLM decomposes the task at runtime, spawns a worker per subtask, and a synthesizer merges them. It's my first step into agentic control because the model decides the fan-out, so I always bound the number of workers and total spend. The tell versus parallelization is who writes the subtask list — code (parallelization) or the model (orchestration)."* That distinction is a common interview trap, and nailing it signals real understanding.
