# Live Coding

**What it is:** the interview round where you write working Python on a shared screen while someone watches — for AI Engineer roles this is usually *not* LeetCode, but practical tasks: parse data, call an LLM API, build a small retrieval loop, or fix a broken prompt pipeline.

## Why it matters for an AI Engineer

Python is in ~77% of Dubai AI Engineer JDs, and companies want proof you can actually *write* it, not just talk about it. The good news: AI Engineer coding rounds are usually more forgiving than classic SWE ones — the tasks mirror real work (string/JSON wrangling, API calls, data transforms) rather than dynamic-programming puzzles. The bad news: coding *while narrating* under observation is its own skill, and freezing on syntax you know cold is common. This drill is about performing your existing Python smoothly, out loud.

## The mechanism: how to run a live-coding round

**1. Clarify before typing (60 seconds).** Restate the problem, ask about inputs/edge cases, confirm the expected output. "So input is a list of dicts, and I return the top-k by score — should ties break by name?" This buys thinking time and signals rigor.

**2. Narrate your plan first.** Say the approach in plain English before coding: *"I'll build a lookup dict, then iterate once — O(n)."* Interviewers grade your *thinking*; silent coding hides it.

**3. Write the simplest correct version.** Don't optimize prematurely. Get something working, say "let me get a naive version first," then improve if asked. A working slow solution beats a broken clever one.

**4. Talk while you type.** "Now I'll guard against an empty list…" Keeps them with you and lets them nudge you before you go down a wrong path.

**5. Test it out loud.** Trace one example by hand or run it. "For input [3,1,2], k=2, this returns [3,2] — correct." Testing unprompted is a strong signal.

**6. Handle the AI-specific bits.** Know the current SDK patterns cold — creating a client, a `messages.create` call, reading `response.content`, parsing JSON from a model, a retry. Fumbling the API you claim to use daily is a red flag.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🗣️ Clarify</span>
    <span class="darr">→</span>
    <span class="dbox orange">📝 Narrate plan</span>
    <span class="darr">→</span>
    <span class="dbox purple">⌨️ Simplest correct</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔍 Test out loud</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Refine if asked</span>
  </div>
  <div class="dcap">Talk through every stage — they grade your reasoning, not just the final code.</div>
</div>

## Concrete example: a typical AI Engineer live task

*"Given LLM responses as JSON strings, parse them, keep only ones with confidence > 0.8, return sorted by confidence."*

```python
import json

def filter_high_confidence(responses: list[str], threshold: float = 0.8):
    kept = []
    for raw in responses:
        try:
            obj = json.loads(raw)                 # models emit messy JSON — guard it
        except json.JSONDecodeError:
            continue                              # skip malformed, don't crash
        if obj.get("confidence", 0) > threshold:
            kept.append(obj)
    return sorted(kept, key=lambda o: o["confidence"], reverse=True)

# Test out loud:
data = ['{"answer":"A","confidence":0.9}', 'broken{', '{"answer":"B","confidence":0.5}']
assert filter_high_confidence(data) == [{"answer": "A", "confidence": 0.9}]
```

Notice the two moves that win points: the **try/except around `json.loads`** (models produce malformed JSON constantly — showing you know that is real-world signal) and the **assert test** at the end.

## How a company uses this (production lens)

The task above isn't contrived — it's a real production concern. A Dubai team's LLM extraction pipeline processes ~40k documents/day, and roughly **2–4% of model outputs are malformed JSON** (truncated at the token limit, or wrapped in markdown fences). Their production parser does exactly this: try/except, skip-or-repair, log the failure rate as a metric. A candidate who *instinctively* guards `json.loads` in the interview is showing the exact reflex the job needs. The ones who assume model output is clean JSON write the bug that pages the on-call at 40k docs/day.

## Common mistakes
- **Silent coding.** No narration = interviewer can't grade your reasoning and can't help you recover.
- **Coding before clarifying.** Solving the wrong problem fast is still wrong.
- **Assuming clean inputs.** Real AI code deals with malformed JSON, empty lists, None. Guarding them is signal.
- **Fumbling the LLM SDK.** Not knowing how to make a basic model call undercuts your whole story.
- **Premature optimization.** Get it working first; optimize only if asked.

## Interview tip
Practice writing — from memory, no autocomplete — the three snippets you'll always need: a basic LLM API call, JSON parsing with error handling, and a top-k filter/sort. Rehearse *narrating while typing* by doing mock tasks out loud to a rubber duck. The candidate who calmly says "let me clarify inputs, then I'll write a naive version and test it" beats a faster silent coder almost every time. Your project work in [Project deep-dive defense](project-deep-dive-defense.md) is where this fluency comes from.
