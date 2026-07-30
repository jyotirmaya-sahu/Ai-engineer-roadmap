# Reflection Loop

**What it is:** an agent pausing to *evaluate its own work or progress* and adjust before continuing — "wait, let me reconsider that" built into the loop.

## Why it matters for an AI Engineer

Agents that only ever push forward accumulate errors: a bad early step poisons everything after it, and the agent never notices. Reflection inserts a checkpoint where the agent (or a critic) asks "is this actually right? am I on track?" and corrects course. It's the mechanism behind self-correcting agents, and it's closely tied to [generator-critic](generator-critic.md) — reflection is the *loop*, generator-critic is one common *way to fill it*. For an AI Engineer, reflection is a primary lever for turning a fragile agent into a reliable one, and it's a named technique (Reflexion) worth citing.

## The mechanism / how it works

A reflection loop adds an explicit **evaluate-and-revise** step after action:

1. **Act / produce** — the agent does a step or generates output.
2. **Reflect** — it (or a separate critic) examines the result against the goal: Did it work? Is it correct? What went wrong? This reflection is written down, often to a [scratchpad](shared-scratchpad.md).
3. **Revise** — the agent uses that reflection to improve the next attempt, *carrying the lesson forward* rather than repeating the mistake.
4. Repeat until good enough or a cap is hit.

Two flavors: **self-reflection** (the same agent critiques itself in a separate turn — cheaper, but risks the self-bias problem) and **external reflection** (a dedicated critic agent — more objective, the generator-critic setup). The defining feature versus a plain retry is *memory*: reflection records *why* the last attempt failed so the next attempt is genuinely different, not a re-roll of the same mistake. That accumulated "here's what didn't work" is what makes Reflexion-style agents improve across iterations instead of flailing.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">⚙️ Act / produce</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🪞 Reflect<span class="sub">what went wrong? on track?</span></span>
    <span class="darr">↓<span class="lbl">write lesson to memory</span></span>
    <span class="dbox blue">📝 Revise with the lesson</span>
    <span class="darr">↑<span class="lbl">loop, capped</span></span>
    <span class="dbox green">✅ Good enough → stop</span>
  </div>
  <div class="dcap">Reflection carries *why the last try failed* into the next — that memory is what a plain retry lacks.</div>
</div>

## A concrete example

A reflection loop that accumulates lessons:

```python
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-4o")

def solve_with_reflection(task, max_iters=3):
    lessons = []                                    # memory of past failures
    attempt = model.invoke(f"Solve: {task}").content
    for _ in range(max_iters):                      # bounded — reflection can loop forever
        reflection = model.invoke(
            f"Task: {task}\nAttempt:\n{attempt}\n"
            f"Critique it honestly. Is it correct and complete? "
            f"If good, reply DONE. Else explain exactly what's wrong."
        ).content
        if "DONE" in reflection:
            return attempt
        lessons.append(reflection)                  # carry the lesson forward
        attempt = model.invoke(
            f"Task: {task}\nPrevious attempt:\n{attempt}\n"
            f"Known problems to avoid:\n" + "\n".join(lessons) + "\nProduce a better answer."
        ).content
    return attempt
```

Passing the growing `lessons` list forward is the whole point — that's what separates reflection from a blind retry.

## How a company uses this

A Dubai fintech runs an agent that writes SQL against their data warehouse for ad-hoc analyst questions. After generating a query it *reflects*: it runs an `EXPLAIN`, checks for obvious mistakes (missing join, wrong date filter), and if the result looks empty or malformed, it reflects on *why* and rewrites — carrying "last time I forgot the tenant filter" into the retry. This reflection step lifted first-answer correctness materially versus a single generation pass, and it's capped at three tries so a genuinely impossible question fails fast to a human instead of looping. The reflections are logged, giving analysts insight into how the agent reasoned.

## Common mistakes / misconceptions

- **Reflection without memory.** If each retry doesn't know *why* the last failed, it just re-rolls the same error. Carry lessons forward.
- **No cap.** A never-satisfied reflection loop is an [infinite loop](infinite-loops.md) — always bound iterations.
- **Self-reflection on subtle errors.** An agent can't always spot its own blind spots; use an external critic ([generator-critic](generator-critic.md)) for hard correctness.
- **Reflecting on trivial tasks.** Extra reflection turns cost tokens; skip it when a single pass is reliably fine.

## Interview tip
Say: *"A reflection loop adds an evaluate-and-revise step that carries *why the last attempt failed* into the next — that memory is what makes Reflexion-style agents actually improve rather than re-roll the same mistake. I bound the iterations and use an external critic when the errors are subtle, since self-reflection has blind spots."* Citing Reflexion and the memory distinction shows real depth.
