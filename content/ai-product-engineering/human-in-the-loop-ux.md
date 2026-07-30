# Human-in-the-loop UX

**What it is:** designing the product so a human reviews, approves, or corrects the AI's output *before* it causes a consequence — turning an unreliable model into a reliable feature by keeping a person in control of the risky moment.

## Why it matters for an AI Engineer

An LLM will be wrong some percentage of the time — you cannot engineer that to zero. So the real design question isn't "how do we make it never wrong?" but "what happens *when* it's wrong?" For low-stakes outputs (a suggested email draft) a wrong answer costs a second of the user's time. For high-stakes outputs (approving a loan, sending money, a medical note) a wrong answer is a disaster. Human-in-the-loop (HITL) is how you deploy AI on high-stakes tasks *safely*: the model does the heavy lifting, a human makes the final call. Getting this boundary right is what lets AI ship in regulated industries — banking, healthcare, legal — which is exactly where the well-paid Dubai roles are.

## The mechanism: matching autonomy to stakes

Think of a dial from "AI suggests" to "AI acts alone." You set it per task by the **cost and reversibility of an error**:

- **Human-in-the-loop (approve each one):** AI proposes, human must approve before anything happens. For irreversible/high-stakes actions — payments, contract terms, clinical text.
- **Human-on-the-loop (spot-check + intervene):** AI acts automatically, human monitors a stream and can override. For medium-stakes, high-volume work — content moderation, ticket triage.
- **Human-out-of-the-loop (full autonomy):** AI acts alone; errors are cheap and reversible. For low-stakes — autocomplete, tag suggestions.

The UX craft is making review *fast and honest*. Three levers:

1. **Surface uncertainty** — route only low-confidence or high-risk cases to a human; auto-approve the easy 90%. Otherwise reviewers rubber-stamp everything (approval fatigue) and the loop is theater.
2. **Make correction effortless** — edit-in-place, a clear diff of what the AI proposes, one-click accept/reject. If reviewing is slower than doing it manually, users abandon the feature.
3. **Show the "why"** — sources, the input it saw, its reasoning — so the human can judge quickly. (See [Trust & transparency](trust-transparency.md).)

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 AI proposes</span>
    <span class="darr">→<span class="lbl">confidence?</span></span>
    <span class="dbox green">✅ High → auto-apply</span>
    <span class="darr">→</span>
    <span class="dbox orange">🧑 Low/risky → human reviews</span>
    <span class="darr">→<span class="lbl">edit/approve</span></span>
    <span class="dbox blue">🔁 Correction → training data</span>
  </div>
  <div class="dcap">Auto-handle the confident majority; route the risky minority to a fast human review whose corrections feed the flywheel.</div>
</div>

## Concrete example

An AI drafts responses to customer complaints. Naive design: AI auto-sends. Result: one hallucinated policy promise becomes a legal problem. HITL design:

```python
def handle_complaint(msg):
    draft = llm_draft_reply(msg)
    risk = assess_risk(msg, draft)   # mentions refund/legal/compensation?

    if risk == "low" and draft.confidence > 0.85:
        send(draft)                        # out-of-the-loop: safe, high volume
        log_for_review(draft, mode="spot") # human-on-the-loop sampling
    else:
        queue_for_agent(                   # in-the-loop: agent must approve
            draft,
            highlights=risk_terms(draft),  # show WHY it was flagged
            editable=True,                 # one-click edit + send
        )
```

The agent only sees the ~15% risky cases, each pre-drafted and pre-highlighted, so they're 5x faster than writing from scratch — and no unreviewed promise ever leaves the building.

## How a company uses this

A Dubai insurance company uses AI to pre-fill claims decisions. Fully automating was legally impossible — a wrongly denied claim is a regulatory and reputational hit. Their HITL design: the model reads the claim, proposes approve/deny *with the exact policy clauses cited*, and an adjuster confirms with one click. Straightforward claims (~65%) come pre-approved and the adjuster just glances and confirms; ambiguous ones get flagged with the AI's uncertainty shown. Throughput per adjuster roughly tripled, decision consistency improved, and — critically — every decision has a human signature on it, satisfying the regulator. The AI didn't replace the adjuster; it made each adjuster far faster while keeping accountability human.

## Common mistakes
- **Approval fatigue** — routing *everything* to humans so they reflexively click "approve" and the review is meaningless. Auto-clear the confident cases.
- **Making review slower than manual work** — if correcting the AI takes longer than doing the task, the feature dies. Invest in the edit UX.
- **No feedback capture** — the human's correction is gold [training/eval data](feedback-capture-the-data-flywheel.md); throwing it away wastes the loop.
- **Fake autonomy** — auto-acting on high-stakes output to seem "advanced." Stakes, not ambition, set the dial.

## Interview tip
Say: *"I set the autonomy dial by error cost and reversibility — full auto for cheap reversible outputs, human-on-the-loop for high-volume medium stakes, human-in-the-loop approval for anything irreversible or regulated. And I route only low-confidence cases to humans so review stays fast and meaningful, capturing their corrections as training data."* This shows you can deploy AI in regulated Dubai sectors safely — a direct hiring signal.
