# Concurrent / Parallel

**What it is:** running several agents *at the same time* instead of one after another, then merging their results — the multi-agent trick that actually makes things *faster*, not just more modular.

## Why it matters for an AI Engineer

Every other architecture on this node adds agents to improve *quality* or *structure* — and pays in latency. Parallelism is the one that *buys latency back*. When sub-tasks are independent (search three sources, analyze five documents), doing them concurrently turns a 15-second serial run into a 5-second one. For user-facing AI with hard latency budgets, this is often the difference between shippable and not. It's also the cleanest way to run [voting/consensus](voting-consensus.md), where you *want* N agents on the same question simultaneously.

## The mechanism / how it works

The requirement is **independence**: the sub-tasks must not need each other's output. If agent B needs A's result, they're sequential and parallelism is impossible. If they don't, you fan out — launch all of them at once — then fan in — collect and combine results with an **aggregator** (concatenate, vote, or an LLM that synthesizes).

Under the hood this is ordinary async concurrency: because each agent spends almost all its time *waiting on a network call* to the LLM API, `asyncio.gather` runs them in overlapping time even on one thread. Wall-clock time becomes roughly the *slowest* agent, not the *sum* of all agents.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 Task</span>
    <span class="darr">↓<span class="lbl">fan out</span></span>
  </div>
  <div class="flow">
    <span class="dbox blue">🔎 Agent A</span>
    <span class="dbox blue">🔎 Agent B</span>
    <span class="dbox blue">🔎 Agent C</span>
  </div>
  <div class="flow v">
    <span class="darr">↓<span class="lbl">fan in</span></span>
    <span class="dbox purple">🧩 Aggregator</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Merged result</span>
  </div>
  <div class="dcap">Independent agents run at once; an aggregator merges them. Latency ≈ slowest agent, not the sum.</div>
</div>

## A concrete example

Fan out three research agents, fan in with `asyncio.gather`:

```python
import asyncio
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o")

async def research(source: str) -> str:
    r = await model.ainvoke(f"Summarize the latest from {source}.")
    return r.content

async def run():
    sources = ["central bank news", "fintech blogs", "regulator filings"]
    # all three LLM calls happen concurrently — total time ≈ the slowest one
    results = await asyncio.gather(*(research(s) for s in sources))
    merged = await model.ainvoke("Combine into one brief:\n" + "\n".join(results))
    return merged.content

print(asyncio.run(run()))
```

Serial, this is three round-trips (~9s). Parallel, it's ~3s. In LangGraph you get the same effect by adding multiple edges from one node — the framework runs those branches concurrently and merges their state updates.

## How a company uses this

A Dubai news aggregator generates morning market briefings by having five agents each analyze a different asset class *simultaneously*, then one agent stitches them together. Serially this took ~40 seconds — too slow for the 6 AM auto-send window with hundreds of briefings. Parallelized, each briefing completes in ~9 seconds (bounded by the slowest asset-class agent), letting them clear the whole queue before market open. Note the cost didn't drop — they still pay for five agents' tokens — but the *latency* did, and that was the constraint.

## Common mistakes / misconceptions

- **Parallelizing dependent steps.** If B needs A's output, running them "in parallel" just means B works on stale/empty input. Only fan out truly independent tasks.
- **Expecting a cost saving.** Parallelism cuts *time*, not *tokens* — you run the same work, just overlapped. See [cost-explosion.md](cost-explosion.md).
- **No concurrency limit.** Fanning out 500 agents at once will hit API rate limits and errors. Bound it with a semaphore.
- **Merging naively.** Concatenating conflicting agent outputs confuses the model — use a real aggregator step to reconcile them.

## Interview tip
Say: *"When sub-tasks are independent I run agents concurrently and fan in with an aggregator — since each agent is I/O-bound on the API, wall-clock time drops to roughly the slowest one. It cuts latency, not cost, and I bound concurrency to stay under rate limits."* That shows you optimize the metric users actually feel.
