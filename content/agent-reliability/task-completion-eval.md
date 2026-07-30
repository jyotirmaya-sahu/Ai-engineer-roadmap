# Task-Completion Eval

**The one-line idea:** Task-completion eval asks the only question the user cares about — *did the agent actually finish the job?* — and turns it into a single pass/fail (or scored) signal you can track across every run.

## Why it matters for an AI Engineer

A user doesn't care that the agent called six tools elegantly; they care whether the flight got booked, the ticket got resolved, the report got generated. Task-completion eval is your **north-star metric**: one number per run that says "goal met" or "goal not met." It's what you put on a dashboard, what you gate deploys on, and what you show a stakeholder to prove the agent works. Without it you're flying blind — you can't tell if a prompt change made the agent better or worse. This is the metric interviewers expect you to name first when they ask "how do you know your agent is good?"

## The mechanism — how it works

You define **success criteria** for the task, then check the *end state* against them. Three ways to do the check, from cheapest to most flexible:

1. **Exact / programmatic check.** The goal has a verifiable outcome: a row exists in the DB, the returned JSON matches the expected schema and values, the file was written. Cheap, deterministic, no ambiguity — use this whenever the outcome is concrete.
2. **Reference comparison.** Compare the agent's final answer to a known-good answer (exact match, or embedding similarity for free-text).
3. **LLM-as-judge.** For fuzzy goals ("write a helpful summary"), a judge model scores the output against a rubric ("does it cover X, Y, Z? is it grounded?"). Flexible, but calibrate it — pin the rubric, use a strong judge model, and spot-check its scores against human labels.

Run this over a **fixed evaluation set** of representative tasks (say 50–200) and report the aggregate: *completion rate*. Track it over time so every change is a measurable up or down.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Task + success criteria</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 Agent runs</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔍 Check end state<span class="sub">programmatic · reference · judge</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ pass / ❌ fail</span>
  </div>
  <div class="dcap">Grade the outcome against explicit success criteria — aggregate to a completion rate.</div>
</div>

## Concrete example

A programmatic check is the gold standard when the outcome is verifiable:

```python
def eval_refund_task(agent, order_id, db):
    """Success = a refund row exists for this order after the agent runs."""
    agent.run(f"Process the refund for order {order_id}")
    refund = db.query("SELECT * FROM refunds WHERE order_id = ?", order_id)
    return refund is not None and refund.status == "issued"

# aggregate over a fixed eval set
tasks = load_eval_set("refund_tasks.jsonl")   # 100 representative orders
passed = sum(eval_refund_task(agent, t.order_id, db) for t in tasks)
completion_rate = passed / len(tasks)
print(f"Completion rate: {completion_rate:.1%}")   # e.g. 94.0%
```

For fuzzy tasks, swap the check for an LLM judge:

```python
from openai import OpenAI
client = OpenAI()
judge = client.chat.completions.create(
    model="gpt-4o", temperature=0,
    messages=[{"role": "user", "content":
        f"Rubric: does this summary cover the risks, timeline, and cost? "
        f"Answer PASS or FAIL only.\n\nSummary:\n{agent_output}"}],
)
passed = judge.choices[0].message.content.strip() == "PASS"
```

## How a company uses this

A **Dubai insurance company** built a claims-triage agent. Their task-completion metric was concrete: *did the claim end up in the correct queue with all required fields filled?* — a pure DB check, no judge needed. They ran it nightly over a frozen set of 150 historical claims. When a prompt tweak dropped completion from 91% to 84%, the nightly run caught it *before* release; without the metric, they'd have shipped a regression that misrouted real claims. At scale (12k claims/day), a 7-point drop is ~840 misrouted claims daily — the eval set paid for itself the first time it fired.

## Common mistakes / misconceptions

- **Reaching for an LLM judge when a programmatic check exists.** If the outcome is a DB row or a schema, check it directly — it's free, deterministic, and un-gameable.
- **No fixed eval set.** Grading random production traffic gives noisy numbers you can't compare week to week. Freeze a representative set.
- **An uncalibrated judge.** LLM judges drift and can be lenient; spot-check against human labels and pin `temperature=0` and a strict rubric.
- **Treating it as a substitute for trajectory eval.** A run can complete the task *and* have taken a wasteful/dangerous path — you need both. See [trajectory eval](trajectory-eval.md).

## Interview tip
Say: *"Task-completion eval is my north-star: one pass/fail per run against explicit success criteria, aggregated to a completion rate over a fixed eval set. I use programmatic checks whenever the outcome is verifiable — a DB row, a schema — and fall back to a calibrated LLM-as-judge only for fuzzy goals. I run it in CI so a prompt change that drops the completion rate blocks the deploy."* Leading with the programmatic-check preference shows engineering maturity.

See also: **[Trajectory eval](trajectory-eval.md)** (grade the path too) and **[Determinism & reproducibility](determinism-reproducibility.md)** (what makes an eval run repeatable).
