# Generate → critique → revise

**What it is:** A three-step loop where the model writes a draft, then *reviews its own draft* against criteria, then rewrites it to fix the flaws it found — self-correction instead of one-shot answering.

## Why it matters for an AI Engineer

A model's first attempt is a fast, single pass — it commits to an answer before "thinking" about whether it's right. On hard tasks (multi-step reasoning, code, long structured answers) that first draft often has a fixable error the model can *spot* if you make it look. Generate-critique-revise trades extra tokens and latency for a meaningful accuracy jump on exactly the tasks where one-shot fails. For an AI Engineer it's the go-to lever when the answer is complex enough that a critic step pays for itself, and it's the backbone of "agentic" self-improving workflows.

## The mechanism

The loop has three distinct roles, and the trick is keeping them *separate*:

1. **Generate.** Produce a normal first draft.
2. **Critique.** In a *fresh* prompt, give the model the draft and a **specific rubric** — not "is this good?" but "check each claim against the sources; list any unsupported statements, logic errors, or unmet requirements." A vague critique prompt produces a useless "looks great!"; a checklist produces actionable findings.
3. **Revise.** Feed the draft *plus* the critique back and ask for a corrected version addressing each point.

Why it works: critiquing is an *easier* task than generating. Spotting "this step divided instead of multiplied" is simpler than getting the whole chain right first try — so the critic catches errors the generator made.

Two crucial guardrails:
- **Separate the critic from the generator's context** where possible (fresh message, or even a different/stronger model as critic). If the critic just continues the generator's stream, it rationalizes the draft instead of attacking it.
- **Ground the critique in something external** — sources, a spec, test results. Pure self-critique with no external anchor plateaus fast; the model can't reliably catch errors it has no way to check. This is why [Verification & validators](./verification-validators.md) (external checkers) often beats pure self-critique.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ task</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 draft</span>
    <span class="darr">→<span class="lbl">rubric</span></span>
    <span class="dbox orange">🔍 critique (list flaws)</span>
    <span class="darr">→<span class="lbl">flaws found</span></span>
    <span class="dbox purple">✏️ revise</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ corrected</span>
  </div>
  <div class="dcap">Draft → critique against a checklist → revise. Loop until the critic finds nothing (cap the iterations).</div>
</div>

## Concrete example

```python
from anthropic import Anthropic
c = Anthropic()

def ask(prompt, system=""):
    return c.messages.create(model="claude-sonnet-4-6", max_tokens=800,
        system=system, messages=[{"role": "user", "content": prompt}]).content[0].text

task = "Write a Python function median(nums) handling empty lists and even lengths."
draft = ask(task)

critique = ask(
    f"Review this code against a checklist: empty-list handling, even-length "
    f"averaging, off-by-one in indexing. List each concrete bug or 'none'.\n\n{draft}"
)

if "none" not in critique.lower():
    final = ask(f"Original task: {task}\n\nDraft:\n{draft}\n\n"
                f"Critique:\n{critique}\n\nRewrite fixing every point.")
else:
    final = draft
print(final)
```

The checklist in the critique step is what makes it work — swap it for "is this good?" and the loop does nothing.

## How a company uses this

A Dubai fintech generates reconciliation SQL from analysts' plain-English requests. One-shot SQL was right ~80% of the time — the rest had subtle join or date-boundary bugs that returned *plausible wrong numbers* (the dangerous kind). They added a critique-revise loop: a stronger model critiques the draft SQL against a checklist (correct joins, timezone handling, null treatment) *and* the query is dry-run on a sample to feed real errors into the critique. Accuracy rose to ~94%, at roughly 2.5x the token cost and +3s latency per request — a trade they happily make because a wrong financial number costs far more than a few cents of tokens. They cap the loop at 2 revisions to bound cost and latency.

## Common mistakes

- **Vague critique prompts.** "Improve this" yields sycophantic praise. Give a concrete checklist tied to the failure modes you actually see.
- **Same-context self-critique.** If the critic continues the generator's stream it defends the draft. Use a fresh prompt or a separate model.
- **No external anchor.** Pure self-critique plateaus; feed the critic sources, a spec, or real test/execution results (that's where this blurs into [verification](./verification-validators.md)).
- **Unbounded loops.** Cap iterations (2–3) — cost and latency scale with each pass and gains diminish fast.

## Interview tip
Say: *"Generate-critique-revise works because critiquing is easier than generating — but only if the critique is grounded and specific. I give the critic a concrete checklist, run it in a fresh context or with a stronger model so it attacks rather than defends the draft, anchor it in sources or real test output, and cap iterations at two or three since gains diminish and cost is linear in passes."* Mentioning the external-anchor requirement and the cost cap shows you've actually run the loop, not just heard of reflection.
