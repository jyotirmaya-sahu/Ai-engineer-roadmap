# Prompt chaining

**What it is:** breaking a task into a **fixed sequence** of LLM calls, where each call's output becomes the next call's input — like an assembly line where every station does one thing well.

## Why it matters for an AI Engineer

The instinct of a beginner is to write one giant prompt: *"Read this document, extract the key points, translate them to Arabic, and format as a table."* One model, one call, four jobs. It works on easy inputs and quietly falls apart on hard ones — the model forgets a step, mixes the translation into the extraction, or gets the format wrong. Each extra job you cram into a single call **degrades every other job**.

Prompt chaining is the fix and the most underrated pattern in the toolkit. By giving each LLM call exactly one focused task, every step gets a short, clear prompt that's easy to get right, easy to test, and easy to debug when it breaks. It's the workflow pattern with the best accuracy-per-dollar for any task that decomposes cleanly — and a huge fraction of real tasks do.

## The mechanism / how it works

You decompose the task into ordered subtasks, then wire the calls in a straight line. The output of step 1 is passed (often lightly reshaped in code) into the prompt of step 2, and so on. The control flow is **entirely in your code** — the model never decides what comes next, so the path is 100% predictable.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Raw input</span>
    <span class="darr">→</span>
    <span class="dbox purple">🔍 Extract facts</span>
    <span class="darr">→</span>
    <span class="dbox purple">✍️ Draft summary</span>
    <span class="darr">→</span>
    <span class="dbox purple">🌐 Translate</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Final output</span>
  </div>
  <div class="dcap">Each call does one job; its output feeds the next. The sequence is fixed in code.</div>
</div>

The power move is adding a **gate** between steps: a cheap check (in code or a small LLM call) that validates step N's output before spending money on step N+1. If the extraction returns nothing usable, you stop early instead of translating garbage. This trades a bit of latency for a lot of reliability.

Because the flow is linear and deterministic, chaining is the *cheapest* and *most debuggable* multi-step pattern. When a chain gives a bad answer, you can look at each intermediate output and see exactly which station failed — you can't do that with a monolithic prompt.

## A concrete example

A two-step chain with a validation gate: extract structured data, check it, then generate a report only if extraction succeeded.

```python
from openai import OpenAI
client = OpenAI()

def call(prompt: str) -> str:
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return r.choices[0].message.content.strip()

def chain(document: str) -> str:
    # Step 1: extract
    facts = call(f"Extract the 3 key financial figures as a bullet list:\n{document}")

    # Gate: cheap validation before spending on step 2
    if "•" not in facts and "-" not in facts:
        return "Could not extract figures — check the source document."

    # Step 2: generate, using step 1's output
    return call(f"Write a 2-sentence executive summary from these figures:\n{facts}")

print(chain("Q3 revenue was AED 4.2M, up 18%, with net margin at 22%."))
```

Notice each prompt is short and single-purpose. Swapping the extraction prompt doesn't touch the summary logic — that separation is the whole benefit.

## How a company uses this

A **Dubai real-estate portal** auto-generates property listings from agents' messy notes. A single prompt produced inconsistent output, so they chained it: (1) extract fields (price, beds, location) into JSON, (2) a code gate rejects listings missing price or location, (3) generate the marketing copy, (4) translate to Arabic. Processing ~8,000 listings/day, the gate alone catches ~6% of inputs before the expensive copy-generation call, saving roughly $180/month in wasted tokens and — more importantly — stopping malformed listings from ever reaching the site. Because it's a fixed chain, when copy quality dips they know instantly it's step 3, not the extraction.

## Common mistakes / misconceptions

- **Chaining when you don't need to.** If the subtasks are truly independent, run them in [parallel](parallelization.md) instead — a chain needlessly serializes them and adds latency.
- **No gates.** Passing an unvalidated step-1 failure into step 2 just launders garbage through more expensive calls. Add a cheap check between costly steps.
- **Losing information across steps.** Each step only sees what you pass it. If step 3 needs the original document, thread it through — don't assume the model "remembers."
- **Confusing it with an agent.** A chain has a fixed path *you* wrote. The moment the model decides which step runs next, you've left workflow territory (see [workflow-vs-autonomous-agent.md](workflow-vs-autonomous-agent.md)).

## Interview tip
Say: *"Prompt chaining is my default for any task that decomposes into ordered steps. One focused call per subtask beats one prompt doing five jobs — each step is short, testable, and debuggable, and I can drop a cheap validation gate between expensive steps to fail fast. It's the highest accuracy-per-dollar workflow pattern, and it's fully deterministic because the control flow lives in my code, not the model's."* That shows you reach for simplicity before autonomy.
