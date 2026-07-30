# Capability vs Task

**What it is:** The discipline of matching a model's *strength* to what the task actually *needs* — using the smallest, cheapest model that reliably does the job, and no bigger.

## Why it matters for an AI Engineer

This is the heart of model selection. Default to your most powerful model "to be safe" and your app is needlessly slow and 10–30× too expensive; pick too weak a model and quality fails. The engineering skill isn't knowing which model is "best" in the abstract — it's knowing which is *sufficient* for each specific task. Interviewers phrase it as "which model would you use for X?" and the strong answer always starts with *what the task demands*, not a brand name.

## The mechanism / how it works

Break "capability" into the axes a task might stress, then match:

- **Reasoning depth** — multi-step logic, math, planning. Needs frontier or reasoning-tier models. A simple lookup does not.
- **Instruction-following & format** — reliably returning strict JSON, obeying long rules. Mid models usually suffice.
- **Knowledge breadth** — obscure facts vs domain-narrow. Often solved by *retrieval* (RAG), not a bigger model.
- **Language** — Arabic-native quality points to [Jais/Falcon](falcon-jais.md), not just "the biggest model."
- **Speed sensitivity** — real-time chat caps how slow (and thus how large) a model can be ([Latency](latency.md)).

The method that separates pros from guessers is **evaluation**: don't argue about which model is smarter — build a small eval set of real task examples with known-good answers, run candidate models against it, and measure accuracy, cost, and latency. Pick the cheapest model that clears your quality bar.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Task's real demands<span class="sub">reasoning? format? language? speed?</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">📊 Eval candidates<span class="sub">small labeled set</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Cheapest that passes<span class="sub">not the biggest</span></span>
  </div>
  <div class="dcap">Define what the task needs, measure candidates, pick the smallest model that clears the bar.</div>
</div>

## Concrete example — measure, don't guess

```python
# Tiny eval: which model classifies support tickets well enough?
cases = [("My card was charged twice", "billing"),
         ("App crashes on login", "technical"),
         ("How do I change my address?", "account")]

def accuracy(classify):        # classify(text) -> label
    return sum(classify(t) == y for t, y in cases) / len(cases)

# Run the SAME cases through a small model and a frontier model.
# If the 8B model scores 1.0 here (and on a bigger held-out set),
# there is zero reason to pay 20x for the frontier model on this task.
```

For narrow, well-specified tasks the small model often *ties or wins* — and costs a fraction. The number that ends the debate is the eval score, not intuition.

## How a company uses this

A Dubai HR-tech firm auto-tags incoming CVs by role (engineering, sales, finance…). They assumed they needed a frontier model and were quoted a scary monthly bill. Before committing they ran a 200-CV eval: a small 8B model hit 96% accuracy on the tagging task — the frontier model hit 97% at 25× the cost and 6× the latency. They shipped the 8B model and put the saved budget into a frontier model only for the *harder* "summarize this candidate's fit for this specific job" step. Same product, ~90% lower model spend, because they matched capability to each task instead of over-buying globally.

## Common mistakes
- **"Use the best model for everything."** Best-in-general is wasteful for narrow tasks; sufficient beats maximal.
- **Guessing instead of evaluating** — without an eval set you can't know which model is actually enough.
- **Ignoring that RAG can replace raw capability** — a mid model with good retrieval often beats a bigger model with none, for knowledge tasks.
- **Forgetting non-quality axes** — a "smarter" model that's too slow for real-time chat is the wrong pick regardless.

## Interview tip
Say: *"I match capability to the task's real demands — reasoning depth, format strictness, language, speed — and pick the smallest model that clears the bar, proven with a small eval set rather than intuition. Over-buying a frontier model for a narrow task wastes cost and latency; often a small model ties it. When knowledge is the gap I add retrieval instead of a bigger model. Right-sizing per task is where real cost savings live."*
