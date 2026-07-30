# Trajectory Eval

**The one-line idea:** Trajectory eval grades the *path* an agent took — the sequence of steps, tool calls, and decisions — instead of only judging the final answer, so you catch agents that reach a lucky-looking result by a wrong or wasteful route.

## Why it matters for an AI Engineer

An agent can produce the right answer for the wrong reasons: it called an expensive tool it didn't need, retried three times, wandered through two irrelevant lookups, and stumbled into a correct final sentence. Grade only the final answer and it passes — until the day the lucky route breaks and it now fails silently. Trajectory eval is how you see *inside* the loop. It's the difference between "the output looked fine" and "the agent reasoned correctly," and it's exactly what separates a toy agent from one you'd trust to run unattended. In interviews, naming trajectory eval signals you understand that agents fail in the *middle*, not just at the end.

## The mechanism — how it works

Every agent run produces a **trajectory**: an ordered list of steps. Each step typically has a *thought* (why it acted), an *action* (which tool + arguments), and an *observation* (the tool's result). Trajectory eval scores that list. Common checks:

- **Tool-selection accuracy** — at each step, did it choose the right tool? (e.g. it should have searched the DB, not the web).
- **Correct arguments** — did it pass the right parameters to the tool?
- **Order / efficiency** — did it take a sensible path, or loop and backtrack? Count redundant or wasted steps.
- **Exact-match vs superset** — compare against a reference trajectory. *In-order match* = same tools in the same order; *any-order* = same set of tools; *superset* = it did at least the required steps (extra allowed); *precision/recall* on the tool set.

You need a **reference** to compare against — either a hand-written "golden" trajectory, or an **LLM-as-judge** that reads the trajectory and rates whether each step was reasonable given the goal. LLM-as-judge scales but is noisier; golden trajectories are precise but expensive to author.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Goal: "refund order #42"</span>
    <span class="darr">↓</span>
    <span class="dbox orange">step 1 · lookup_order(42) ✅</span>
    <span class="darr">↓</span>
    <span class="dbox orange">step 2 · web_search(...) ❌ wrong tool</span>
    <span class="darr">↓</span>
    <span class="dbox orange">step 3 · issue_refund(42) ✅</span>
    <span class="darr">↓</span>
    <span class="dbox yellow">Trajectory score: 2/3 steps correct, 1 wasted</span>
  </div>
  <div class="dcap">Answer may be right, but step 2 was a wrong tool call — only trajectory eval catches it.</div>
</div>

## Concrete example

Using LangSmith's trajectory evaluators (2026):

```python
from langsmith import Client
from agentevals.trajectory.match import create_trajectory_match_evaluator

# reference = the golden path; outputs = what the agent actually did
evaluator = create_trajectory_match_evaluator(trajectory_match_mode="superset")

reference = [
    {"role": "assistant", "tool_calls": [{"function": {"name": "lookup_order"}}]},
    {"role": "assistant", "tool_calls": [{"function": {"name": "issue_refund"}}]},
]
actual = [
    {"role": "assistant", "tool_calls": [{"function": {"name": "lookup_order"}}]},
    {"role": "assistant", "tool_calls": [{"function": {"name": "web_search"}}]},  # extra/wrong
    {"role": "assistant", "tool_calls": [{"function": {"name": "issue_refund"}}]},
]

result = evaluator(outputs=actual, reference_outputs=reference)
# superset mode: passes (required tools present) but you can log the extra web_search as waste
print(result["score"], result["comment"])
```

Modes let you choose strictness: `strict` (exact order), `unordered` (same set), `superset`/`subset` for partial credit.

## How a company uses this

A **Dubai logistics firm**'s dispatch agent kept producing correct delivery schedules — but trajectory eval on 500 logged runs revealed it was calling a **paid traffic API on 40% of runs where it wasn't needed**, because a lucky prompt made it *usually* recover. Final-answer eval showed 96% success and hid the problem entirely. Trajectory eval surfaced ~$3k/month of wasted API calls and a fragile step that broke whenever the traffic API was slow. They added a tool-selection check to CI so any regression in tool choice fails the build before deploy.

## Common mistakes / misconceptions

- **Only grading the final answer.** The most common mistake — it hides wrong-path successes that break later.
- **Demanding exact-match trajectories.** Real agents have many valid paths; strict order-matching flags correct runs as failures. Use superset/set modes unless order truly matters.
- **No reference at all.** Without a golden path or a judge rubric, you're not evaluating, you're just reading logs.
- **Confusing it with task-completion eval.** Trajectory = *how*; completion = *whether the goal was met*. You want both — see [task-completion eval](task-completion-eval.md).

## Interview tip
Say: *"I evaluate agents on two axes: the trajectory (did it pick the right tools in a sensible order, with no wasted steps) and task completion (did it actually achieve the goal). Trajectory eval catches lucky-looking answers reached by a wrong path — I compare against a golden trajectory in superset mode so I allow valid variations but flag wrong or wasteful tool calls, and I wire it into CI so a regression in tool selection fails the build."* Mentioning superset-mode matching and CI shows real production experience.

See also: **[Task-completion eval](task-completion-eval.md)** (the outcome axis) and **[Replayable traces](replayable-traces.md)** (where trajectories come from).
