# Tree-of-Thought

**What it is:** Tree-of-Thought (ToT) is a reasoning method where the model explores *multiple* branching lines of thought, evaluates how promising each is, and expands the best ones — like searching a tree of possibilities instead of committing to one straight line.

## Why it matters for an AI Engineer
[Chain-of-Thought](./chain-of-thought.md) walks *one* path and can't undo a bad early step. [Self-consistency](./self-consistency.md) runs several *independent* paths and votes. Tree-of-Thought goes further: it treats reasoning as **search** — generate several possible next steps, score them, keep the good branches, prune the bad, and go deeper only where it's promising. For problems that genuinely need exploration and backtracking — puzzles, planning, constraint problems, "find a sequence that works" — ToT beats both. As an AI Engineer you won't reach for it daily, but knowing it exists (and its steep cost) shows you understand the full toolbox and when a problem is a *search* problem.

## The mechanism
ToT has three moving parts:

- **Branching (generate).** At each step, ask the model for *several* candidate next thoughts, not one.
- **Evaluation (score).** Use the model (or a heuristic) to rate each branch — "is this promising / likely to lead to a solution?" — often on a 1–10 scale or "sure / maybe / impossible."
- **Search (expand + prune).** Keep the top-scoring branches, drop the rest, and repeat from the survivors. This is breadth-first or best-first search over thoughts, with **backtracking**: if a branch dead-ends, you return to an earlier node and try a different one.

That backtracking is the key difference from CoT — a single chain can't recover from a wrong turn, but a tree can abandon a bad branch and explore elsewhere. The price is heavy: you're making many LLM calls per problem (generate candidates + evaluate each, at every depth), so cost and latency can be 10–50× a single CoT. You only accept that when the problem is hard *and* has a checkable notion of a good partial solution.

## Concrete example
A simplified one-level ToT for a planning task — generate 3 candidate plans, score them, pick the best:

```python
from openai import OpenAI
client = OpenAI()

def ask(p):
    return client.chat.completions.create(
        model="gpt-4o", temperature=0.8,
        messages=[{"role": "user", "content": p}]
    ).choices[0].message.content

task = "Plan a 1-day Dubai itinerary that stays indoors (it's 45°C) and costs under 200 AED."

# BRANCH: 3 diverse candidate plans
candidates = [ask(f"{task}\nGive ONE concise plan.") for _ in range(3)]

# EVALUATE: score each against the constraints
scored = []
for c in candidates:
    s = ask(f"Rate this plan 1-10 for staying indoors AND under 200 AED. "
            f"Reply with just the number.\n\n{c}")
    scored.append((int("".join(ch for ch in s if ch.isdigit()) or 0), c))

best = max(scored)[1]   # keep the highest-scoring branch
print(best)
```

Real ToT recurses this (expand the best branch into new sub-branches), but the shape — generate → score → keep best → repeat — is exactly this.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">❓ Problem</span>
    <span class="darr">↓<span class="lbl">branch</span></span>
    <span class="dbox orange">🌿 A (7) · 🌿 B (3) · 🌿 C (8)</span>
    <span class="darr">↓<span class="lbl">prune, keep A & C</span></span>
    <span class="dbox orange">🌿 A→ · 🌿 C→ (expand)</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ Best complete solution</span>
  </div>
  <div class="dcap">Explore several branches, score them, expand the promising ones, prune the rest — search, with backtracking.</div>
</div>

## How a company uses this
A Dubai smart-building startup uses a ToT-style planner to schedule HVAC and maintenance across a tower under constraints (occupancy, energy price windows, equipment availability). A linear plan often violated a late constraint and had no way to recover; ToT explores several schedules, scores each against all constraints, and backtracks when one fails. Because it's expensive, they run it **offline nightly**, not per-request, and cache the resulting schedule. That's the practical pattern: ToT for hard, occasional planning done in the background — never in a live user-latency path.

## Common mistakes
- **Reaching for ToT on simple tasks.** If CoT or self-consistency works, ToT is massive overkill — 10–50× the cost for nothing.
- **No real evaluation signal.** ToT only helps if you can *score* partial solutions; without a good evaluator it's just expensive random sampling.
- **Running it in a latency-sensitive path.** Its many sequential calls make it slow; batch it offline where possible.
- **Unbounded search.** Cap branch width and depth, or cost explodes exponentially.

## Interview tip
Say: *"Tree-of-Thought treats reasoning as search — branch into candidate steps, score them, expand the best, prune and backtrack. It shines on puzzle/planning problems where a single chain can't recover from a bad step, but it's 10–50× the cost, so I use it offline for hard problems with a checkable evaluator, not in live paths."* Naming the cost and the evaluator requirement shows you know *when not to* use it.
