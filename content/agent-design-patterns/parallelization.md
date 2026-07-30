# Parallelization

**What it is:** running multiple LLM calls **at the same time** instead of one after another — either to split independent subtasks across workers, or to ask the *same* question several times and combine the answers.

## Why it matters for an AI Engineer

LLM calls are slow — often 2–10 seconds each. If your task needs five of them and you run them in a chain, the user waits for the sum. If those five don't depend on each other, that wait is pure waste. Parallelization collapses "5 × 3s = 15s" into "≈3s" by firing all five at once.

There's a second, subtler use: **voting for quality.** LLMs are non-deterministic, so a single call can be wrong by luck. Asking the same question three times and taking the majority answer measurably raises accuracy on hard reasoning tasks. For an AI Engineer, parallelization is the pattern that buys you either **speed** or **reliability** — sometimes both — for the price of a little more compute.

## The mechanism / how it works

There are two flavors:

- **Sectioning** — split a task into genuinely independent subtasks, run each in its own call concurrently, then stitch the results. Example: summarize a 10-chapter book by summarizing all chapters at once, then merging.
- **Voting** — send the *same* prompt N times (usually with temperature > 0 for variety), then aggregate by majority vote, taking the best, or having a final call synthesize them.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Task</span>
    <span class="darr">↓<span class="lbl">fan out</span></span>
    <div class="flow">
      <span class="dbox purple">🤖 call 1</span>
      <span class="dbox purple">🤖 call 2</span>
      <span class="dbox purple">🤖 call 3</span>
    </div>
    <span class="darr">↓<span class="lbl">aggregate</span></span>
    <span class="dbox green">✅ Merged / voted result</span>
  </div>
  <div class="dcap">Independent calls run concurrently, then an aggregation step combines them.</div>
</div>

Mechanically, you use your language's async tools — in Python, `asyncio.gather` fires all the requests and waits for them together. The wall-clock time becomes roughly the time of the *slowest* single call, not the sum. The catch: you pay for every call, and you must have a real **aggregation step** — parallel calls are useless until you decide how to merge them.

## A concrete example

A voting setup: ask the same tricky question three times, return the majority answer.

```python
import asyncio
from collections import Counter
from openai import AsyncOpenAI
client = AsyncOpenAI()

async def ask(question: str) -> str:
    r = await client.chat.completions.create(
        model="gpt-4o-mini", temperature=0.7,
        messages=[{"role": "user", "content":
            f"{question}\nAnswer with only YES or NO."}],
    )
    return r.choices[0].message.content.strip().upper()

async def vote(question: str, n: int = 3) -> str:
    answers = await asyncio.gather(*[ask(question) for _ in range(n)])
    return Counter(answers).most_common(1)[0][0]

print(asyncio.run(vote(
    "Is a contract signed under duress legally enforceable?")))
```

`asyncio.gather` launches all three calls together, so total latency is ~one call, not three. `Counter(...).most_common` picks the majority — smoothing out the one-in-three unlucky answer.

## How a company uses this

A **Dubai media agency** runs brand-safety checks on user-generated video captions before publishing. Each caption is screened by three parallel LLM calls (hate speech, misinformation, spam), fired with `asyncio.gather`. Because they run concurrently, a caption clears review in ~1.2s instead of ~3.5s serial — critical when moderating ~50,000 items/day, where serial latency would create an hours-long backlog. For borderline political content they add a *voting* layer: five calls, publish only if ≥4 agree it's safe, which cut false-approvals on ambiguous cases by about a third versus a single call.

## Common mistakes / misconceptions

- **Parallelizing dependent steps.** If call 2 needs call 1's output, you *can't* parallelize — that's a [chain](prompt-chaining.md). Only truly independent work parallelizes.
- **Forgetting the aggregation step.** Three answers with no merge logic is three problems, not a solution. Decide up front: majority vote, best-of, or synthesize.
- **Ignoring rate limits.** Firing 50 concurrent calls can hit provider limits and cause failures. Cap concurrency (e.g. a semaphore) at production scale.
- **Voting with temperature 0.** Zero temperature gives near-identical answers, so voting adds cost for nothing. Voting needs *diversity* — raise the temperature.

## Interview tip
Say: *"Parallelization has two uses: sectioning independent subtasks to cut latency, and voting on the same prompt to raise reliability. I run the calls concurrently with `asyncio.gather` so wall-clock time is the slowest call, not the sum, and I always define the aggregation step — majority vote, best-of, or a synthesizer. It only works for independent work; anything with a dependency is a chain. At scale I cap concurrency to respect rate limits."* That shows you understand both the speed and the quality angle.
