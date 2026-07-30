# Generator-Critic

**What it is:** a two-role pattern where one agent *produces* something and a second agent *critiques* it, feeding the critique back so the generator improves — split the "do it" and "judge it" jobs into different agents.

## Why it matters for an AI Engineer

An LLM is a weak judge of its own output *in the same breath* it produces it — it's biased toward what it just wrote. Separating generation from criticism breaks that bias: a fresh critic agent, with a prompt tuned only for finding flaws, catches errors the generator won't. This is one of the most broadly useful multi-agent patterns — it underpins code review bots, content pipelines, and the [reflection loop](reflection-loop.md). For an AI Engineer, it's the go-to structure whenever quality matters more than a single fast pass. It's often called the **evaluator-optimizer** pattern.

## The mechanism / how it works

Two distinct agents with opposite jobs:

- **Generator** — produces a draft (code, text, a plan). Its prompt is "create the best X you can."
- **Critic** — reviews the draft against explicit criteria and returns *specific, actionable* feedback ("claim 2 lacks a source"; "this function doesn't handle empty input"). Its prompt is "find what's wrong" — a fundamentally different mindset.

The critique loops back: the generator revises using the feedback, the critic reviews again, until the critic approves *or* you hit an iteration cap. The magic is the **separation** — because the critic never had to produce the draft, it isn't defensive about it, so it critiques honestly. Giving the critic a *checklist* (correctness, completeness, style) makes its feedback concrete instead of vague praise.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">✍️ Generator<span class="sub">produces draft</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🕵️ Critic<span class="sub">finds flaws</span></span>
    <span class="darr">→<span class="lbl">feedback</span></span>
    <span class="dbox purple">✍️ Generator<span class="sub">revises</span></span>
  </div>
  <div class="flow">
    <span class="darr">↻<span class="lbl">loop until critic approves or cap hit</span></span>
    <span class="dbox green">✅ Approved output</span>
  </div>
  <div class="dcap">Split "make it" from "judge it" — a fresh critic isn't defensive about the draft, so it catches real flaws.</div>
</div>

## A concrete example

Generator-critic loop with an iteration cap:

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
model = ChatOpenAI(model="gpt-4o")

class Review(BaseModel):
    approved: bool
    feedback: str

critic = model.with_structured_output(Review)

def generate_critique_loop(task, max_iters=3):     # cap prevents endless revision
    draft = model.invoke(f"Do this task well: {task}").content
    for _ in range(max_iters):
        review = critic.invoke(
            f"Task: {task}\nDraft:\n{draft}\n"
            f"Check correctness, completeness, clarity. Approve only if genuinely good."
        )
        if review.approved:
            return draft
        draft = model.invoke(                       # revise using the specific feedback
            f"Task: {task}\nYour draft:\n{draft}\nFix these issues:\n{review.feedback}"
        ).content
    return draft   # return best effort if not approved within the cap
```

Structured `Review` output makes the approve/loop decision clean, and the cap guarantees termination.

## How a company uses this

A Dubai media company auto-generates Arabic and English social copy at scale. A generator writes the post; a critic agent — prompted with brand voice, factual accuracy, and cultural-sensitivity rules specific to the UAE market — reviews it and sends back fixes. Splitting the roles caught issues the generator consistently missed on its own, especially cultural-sensitivity slips that could embarrass the brand. They cap it at three revision rounds; in practice ~85% of posts pass within two. The critic essentially replaced a first-pass human editor, and the human now only reviews the ~15% the critic still flags after three rounds.

## Common mistakes / misconceptions

- **Same agent generates and critiques in one call.** It rubber-stamps its own work. Use a *separate* critic agent (or at least a separate, differently-prompted call).
- **Vague critic.** "Make it better" produces useless feedback. Give the critic explicit, checkable criteria.
- **No iteration cap.** A perfectionist critic never approves and loops forever — cap it (see [infinite-loops.md](infinite-loops.md)).
- **Over-critiquing simple tasks.** For a one-line output, the extra critic pass is wasted cost.

## Interview tip
Say: *"Generator-critic — the evaluator-optimizer pattern — splits producing from judging into two agents. The critic isn't defensive about a draft it didn't write, so with a concrete checklist it catches real flaws, and the generator revises until approval or an iteration cap. I use it wherever output quality beats a single fast pass, and I always cap the loop."* Naming evaluator-optimizer and the cap is what interviewers listen for.
