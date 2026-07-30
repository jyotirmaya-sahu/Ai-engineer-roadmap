# Reflection

**What it is:** having the model **review and critique its own output**, then revise it — a built-in "wait, let me check that" pass before it hands you the final answer.

## Why it matters for an AI Engineer

An LLM generates left-to-right in one pass, committing to each word as it goes. It can't "look back and fix" mid-generation — so first drafts contain avoidable errors: a bug in the code, a step skipped in the reasoning, a claim it can't actually support. Humans catch these by re-reading; reflection gives the model the same second look.

For an AI Engineer, reflection is the cheapest quality boost you can add — often a single extra call. On coding tasks especially, "write it, then review and fix it" measurably beats a single pass, because the model reviewing finished code spots bugs it couldn't see while writing. It's the foundation of agent self-correction, and it's the difference between an agent that confidently ships a broken result and one that catches its own mistake first.

## The mechanism / how it works

Reflection is a loop of **generate → critique → revise**, all done by the *same* model wearing two hats:

1. The model produces a draft.
2. You prompt it to critique its *own* draft against the goal — "what's wrong or missing here?"
3. It revises using that critique.
4. Optionally repeat, but with a cap.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Task</span>
    <span class="darr">↓</span>
    <span class="dbox purple">✍️ Generate draft</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🪞 Critique own draft</span>
    <span class="darr">↓<span class="lbl">apply fixes</span></span>
    <span class="dbox green">✅ Revised answer</span>
    <span class="darr">↺<span class="lbl">optional, capped</span></span>
  </div>
  <div class="dcap">The same model critiques its own output and revises — a cheap self-correction pass.</div>
</div>

The magic is in the **separate critique step**. Asking the model to review already-written text is a different, easier cognitive task than writing it — with the whole draft in front of it, it can spot the missing edge case. Reflection gets even stronger when the critique can use **external signals**: run the generated code and feed the error back, or run a linter, so the reflection is grounded in real feedback, not just the model's opinion.

The relation to [evaluator-optimizer](evaluator-optimizer.md): that pattern uses *two separate roles* (author + independent critic); reflection is the *self-review* version — one model critiquing itself. Reflection is simpler and cheaper; evaluator-optimizer is more objective because the critic isn't grading its own work.

## A concrete example

Generate code, run it, and if it errors, feed the error back for a reflection-driven fix.

```python
from openai import OpenAI
client = OpenAI()

def llm(prompt):
    return client.chat.completions.create(
        model="gpt-4o", temperature=0,
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content

def generate_with_reflection(task: str, max_tries: int = 2) -> str:
    code = llm(f"Write Python for: {task}. Return only code.")
    for _ in range(max_tries):
        try:
            exec(code, {})                       # run it (sandbox in prod!)
            return code                          # ran clean → done
        except Exception as e:
            # reflect: feed the real error back for self-correction
            code = llm(f"This code failed with: {e}\n\n{code}\n"
                       f"Find the bug and return the corrected code only.")
    return code

print(generate_with_reflection("compute the median of [3,1,4,1,5,9,2]"))
```

The runtime error is the external signal that makes the reflection grounded — the model isn't guessing what's wrong, it's fixing a real traceback.

## How a company uses this

A **Dubai logistics startup** built an internal "text-to-SQL" tool so ops staff can query the shipments database in plain English. The LLM writes SQL, the tool runs it against a read-only replica, and on any database error the error message is reflected back for one correction attempt. About 22% of generated queries fail on the first try (wrong column name, bad join); ~90% of those are fixed by a single reflection pass grounded in the real DB error. Capped at two attempts, this took the tool from "usable by engineers only" to "usable by the ops team," because self-correction hid most of the model's SQL slip-ups behind the scenes.

## Common mistakes / misconceptions

- **Reflection without external grounding.** "Are you sure?" often just makes the model second-guess a correct answer. Ground the critique in a real signal — run the code, check against a rubric — whenever you can.
- **No cap.** Endless self-revision loops burn tokens and can drift *away* from a good early answer. Cap the passes (usually 1–2 is where the gains are).
- **Expecting objectivity.** A model reviewing itself shares its own blind spots. For high stakes, use a separate critic ([evaluator-optimizer](evaluator-optimizer.md)) instead of self-reflection.
- **Reflecting when the first draft is fine.** Every reflection pass doubles cost and latency. Reserve it for tasks where single-pass errors are common and costly.

## Interview tip
Say: *"Reflection is self-critique: the model reviews its own draft and revises, because judging finished text is easier than writing it in one pass. It's cheapest and most reliable when the critique is grounded in a real signal — I feed back the actual runtime error or test result rather than just asking 'are you sure?'. I cap it at one or two passes. When I need an objective check I switch to a separate evaluator, since a model reviewing itself keeps its own blind spots."* That distinction — grounded vs ungrounded, self vs separate critic — shows depth.
