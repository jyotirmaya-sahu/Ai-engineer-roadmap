# Latency budgeting

**The one-line idea:** Decide up front *how many milliseconds each step of your pipeline is allowed to take*, so the total stays under a user-facing target — like splitting a family budget across rent, food, and savings before you overspend.

## Why it matters for an AI Engineer

Users abandon slow apps. A page that takes >3 seconds loses a huge chunk of visitors, and a RAG or agent pipeline has *many* steps that each eat time. If you don't assign a budget per step, one slow component silently blows the whole request — and you won't know which one. Latency budgeting turns "it feels slow sometimes" into a concrete, testable target you can hold each part accountable to. In interviews, being asked to "design a system with p95 latency under 2 seconds" is standard; the first thing you do is *budget it*.

## The mechanism — how it works

Start from the **user-facing target**, expressed as a percentile, not an average. **p95 latency** means 95% of requests finish within that time — the number that matters, because averages hide the slow tail that actually annoys users. Say your target is **p95 < 2000 ms**.

Now list every step in the request path and assign each a slice, leaving **headroom** (10–20%) for network jitter and queuing:

- The sum of all slices must be ≤ your target.
- Measure each step in production (not guesses) and compare actual vs budget.
- Any step over budget is your optimization target — nothing else matters until it's fixed.

A key move: **the LLM generation step is usually the biggest and least controllable slice.** Its time ≈ *time-to-first-token* + *(output tokens × time-per-token)*. So the two levers you control are **fewer output tokens** (shorter answers, `max_tokens`) and a **faster model**. Retrieval, reranking, and parsing are the small controllable slices you tighten around it.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Target: p95 &lt; 2000ms</span>
    <span class="darr">→<span class="lbl">split</span></span>
    <span class="dbox blue">🔍 retrieve 150ms</span>
    <span class="dbox orange">📊 rerank 250ms</span>
    <span class="dbox purple">🧠 generate 1300ms</span>
    <span class="dbox yellow">🧰 slack 300ms</span>
  </div>
  <div class="dcap">Allocate the total budget across steps with headroom; any step over its slice is the thing to fix.</div>
</div>

## Concrete example

Measure each stage and check it against its budget:

```python
import time
from contextlib import contextmanager

budgets_ms = {"retrieve": 150, "rerank": 250, "generate": 1300}
actual = {}

@contextmanager
def stage(name):
    t0 = time.perf_counter()
    yield
    actual[name] = (time.perf_counter() - t0) * 1000

with stage("retrieve"):
    docs = retriever.search(query, k=20)
with stage("rerank"):
    docs = reranker.rank(query, docs)[:5]
with stage("generate"):
    answer = llm.generate(query, docs, max_tokens=400)  # cap output = cap tail

for name, ms in actual.items():
    over = ms - budgets_ms[name]
    flag = "  ⚠️ OVER" if over > 0 else ""
    print(f"{name:9} {ms:6.0f}ms / {budgets_ms[name]}ms{flag}")
print(f"total     {sum(actual.values()):6.0f}ms / 1700ms budget")
```

If `generate` clocks 1900 ms against its 1300 ms budget, you don't touch retrieval — you cut `max_tokens`, switch to a faster model (e.g. a Haiku/mini tier), or stream so *perceived* latency drops even if total doesn't.

## How a company uses this

A **Dubai fintech** ran a fraud-explanation assistant with a hard **p95 < 1.5 s** SLA (it blocks a payment screen). Their budget: 100 ms feature lookup, 200 ms retrieval, 1000 ms generation, 200 ms slack. Dashboards tracked p50/p95/p99 per stage in Langfuse. When p95 crept to 2.1 s, the per-stage breakdown showed generation had ballooned because a prompt change let answers run long; capping `max_tokens` at 300 and dropping to a faster model tier pulled it back under 1.5 s in an afternoon — no guesswork, because the budget told them exactly where the overrun was. At 40 QPS, that fix also cut token spend ~35%.

## Common mistakes / misconceptions

- **Optimizing the average.** Averages look fine while your p95/p99 tail quietly hurts real users. Always budget and measure percentiles.
- **No headroom.** Budget to exactly the target and real-world jitter/queuing pushes you over constantly. Leave 10–20% slack.
- **Budgeting steps you can't measure.** If you can't instrument a stage, you can't hold it to a budget — add timing first.
- **Ignoring that output length drives generation time.** Long answers are the #1 hidden latency cost; cap tokens.

## Interview tip
Say: *"I budget from a p95 target, not an average — split the total across each stage with ~15% headroom, instrument every stage, and treat any stage over its slice as the optimization target. Generation is usually the biggest slice, so I control it with output-token caps, a faster model tier, and streaming for perceived speed."* Leading with percentiles instantly signals production maturity.

See also: **[Streaming & first-token time](streaming-first-token-time.md)** (cut *perceived* latency) and **[Parallel / speculative execution](parallel-speculative-execution.md)** (overlap steps to fit the budget).
