# Prompt chaining & decomposition

**What it is:** Prompt chaining is breaking a complex task into several smaller prompts run in sequence, where each step's output feeds the next — instead of asking one giant prompt to do everything at once.

## Why it matters for an AI Engineer
A single prompt trying to "read this contract, extract the risks, rate each one, and write a client email" does all four jobs mediocrely and is impossible to debug when it's wrong. Decompose it into four focused steps and each does one thing well, you can test each independently, and when the output is bad you know *which* step failed. For an AI Engineer this is the core skill for building anything non-trivial — it's how you get reliability, debuggability, and control on complex tasks, and it's the mental model behind agents, RAG pipelines, and workflows.

## The mechanism
The idea is classic software decomposition applied to prompts. You:

1. **Split** the task into sub-tasks with clear inputs/outputs.
2. **Run** each as its own prompt (often with its own [system prompt](./system-prompting.md), examples, and [structured output](./structured-output.md)).
3. **Pass** each step's (usually structured) result into the next step's prompt.

Why this beats one mega-prompt:

- **Focus.** A prompt doing one job is more accurate than one juggling five — less for the model to lose track of.
- **Debuggability.** You can inspect the output between every step and pinpoint failures. One giant prompt is a black box.
- **Control & cost.** Route each step to the right-sized model — a cheap model for extraction, an expensive one only for the hard reasoning step. Add validation, retries, or human review between steps.
- **Reuse & caching.** Steps become reusable components; stable prefixes cache well.

Chaining can be **linear** (A→B→C), **branching** (a router step sends to different sub-chains), or **iterative** (loop a step until a check passes). It's distinct from [ReAct](./react.md): chaining is a *predefined* pipeline you design; ReAct lets the *model* decide the next action dynamically. Use a fixed chain when you know the steps; use an agent loop when you don't.

## Concrete example
A 2-step chain: extract structured complaints, then draft a reply from them.

```python
from openai import OpenAI
client = OpenAI()

def call(system, user):
    return client.chat.completions.create(
        model="gpt-4o-mini", temperature=0,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    ).choices[0].message.content

review = "Late delivery, the box was damaged, but support was very kind."

# Step 1: extract issues (structured)
issues = call("Extract customer issues as a JSON list of short strings. Only issues.",
              review)
# -> '["late delivery", "damaged box"]'

# Step 2: draft an apology using step 1's output
reply = call("You are a support agent. Write a 3-sentence apology addressing each "
             "listed issue and offering a fix.",
             f"Issues: {issues}")
print(reply)
# -> "I'm sorry your order arrived late and the box was damaged... [specific fixes]"
```

Each step is small, testable, and you can see the intermediate `issues` — if the email misses "damaged box," you check whether step 1 or step 2 dropped it.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Review</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔎 Step 1: extract issues</span>
    <span class="darr">→<span class="lbl">JSON</span></span>
    <span class="dbox purple">✍️ Step 2: draft reply</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Email</span>
  </div>
  <div class="dcap">Each step does one job; structured output flows between them, and you can inspect every hand-off.</div>
</div>

## How a company uses this
A Dubai legal-tech firm reviews contracts with a 4-step chain: (1) cheap model extracts all clauses → (2) classify each clause type → (3) an expensive reasoning model flags risky clauses with rationale → (4) generate a client-facing summary. Splitting it lets them run step 1–2 on a cheap model over thousands of clauses and reserve the expensive model for step 3 only — cutting cost sharply versus running everything on the top model. When a review is wrong, they trace it to the exact step (usually a classification miss in step 2) and fix *that* prompt in isolation. They also cache step-1 output so re-runs skip re-extraction. The production win is as much *operability* as accuracy — a monolithic prompt would be un-debuggable and un-optimizable.

## Common mistakes
- **One mega-prompt for a multi-part task.** Lower accuracy, impossible to debug. Decompose.
- **Passing prose between steps instead of structured data.** Use [structured output](./structured-output.md) at hand-offs so the next step gets clean, parseable input.
- **Too many tiny steps.** Each hop adds latency and cost; don't over-fragment. Split by *distinct job*, not by sentence.
- **No validation between steps.** A bad step-1 output silently corrupts everything after it. Check hand-offs.
- **Chaining when you should use an agent.** If the steps depend on runtime decisions, a [ReAct](./react.md) loop fits better than a fixed chain.

## Interview tip
Say: *"I decompose complex tasks into a chain of focused prompts passing structured output between steps. It buys accuracy, debuggability, and cost control — I can route each step to the right-sized model and pinpoint which step failed. I use a fixed chain when I know the steps, and an agent loop when the model needs to decide them at runtime."* That last distinction shows you know chaining's boundary with agents.
