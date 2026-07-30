# Human Approval

**The one-line idea:** Human approval (human-in-the-loop) pauses the agent right before a high-impact action, shows a person exactly what it's about to do, and waits for a yes/no — so an irreversible step never happens fully autonomously.

## Why it matters for an AI Engineer

Some actions you can't take back: wiring money, sending an email to a client, deleting a database, publishing a post. For those, "the model is usually right" isn't good enough — one wrong call is a real-world incident. Human approval is the pattern that lets an agent be autonomous for the 95% of low-risk steps while a human gatekeeps the 5% that matter. It's the control that makes agents *acceptable* to legal, finance, and compliance — and in a Dubai enterprise setting, it's often the difference between a project getting approved and getting shelved. Knowing *where* to place the approval gate (not everywhere, not nowhere) is a senior judgment call interviewers probe for.

## The mechanism — how it works

The agent runs normally until it proposes a **gated action** — one you've flagged as high-impact. At that point the framework **interrupts**: it serializes the agent's current state, surfaces the proposed action (tool name + arguments) to a human, and *stops*. The human sees "Agent wants to: `issue_refund(order=42, amount=5000)`" and can:

- **Approve** → the action executes and the agent resumes.
- **Reject** → the action is skipped; the agent is told and re-plans.
- **Edit** → the human fixes the arguments (change 5000 → 500) and approves the corrected call.

The technical trick is that the agent must be **pausable and resumable**. Modern frameworks (LangGraph, etc.) checkpoint the graph state to a store, so the run can suspend for seconds or *days* — the human approves via a UI or Slack whenever they get to it — and then resume from the exact same point, not restart. Gating is **selective**: you tag which tools/thresholds require approval, so cheap read-only steps flow freely and only the dangerous ones wait.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🤖 Agent proposes: issue_refund(AED 5000)</span>
    <span class="darr">↓<span class="lbl">gated tool → interrupt</span></span>
    <span class="dbox orange">⏸️ Pause · state checkpointed</span>
    <span class="darr">↓</span>
    <span class="dbox yellow">👤 Human: approve / reject / edit</span>
    <span class="darr">↓<span class="lbl">approved</span></span>
    <span class="dbox green">✅ Execute · agent resumes</span>
  </div>
  <div class="dcap">High-impact action → interrupt → human decides → resume from the exact checkpoint.</div>
</div>

## Concrete example

LangGraph's `interrupt` pauses a run mid-graph and resumes from a checkpoint:

```python
from langgraph.types import interrupt, Command

def refund_node(state):
    amount = state["refund_amount"]
    if amount > 1000:                      # only gate high-value refunds
        decision = interrupt({             # pauses the graph, surfaces this to a human
            "action": "issue_refund",
            "amount": amount,
            "order": state["order_id"],
        })
        if decision["approve"] is False:
            return {"result": "refund rejected by human"}
        amount = decision.get("amount", amount)   # human may have edited it down
    issue_refund(state["order_id"], amount)
    return {"result": "refund issued"}

# elsewhere, after the human clicks approve in your UI:
graph.invoke(Command(resume={"approve": True, "amount": 500}), config=thread_config)
```

The graph state is checkpointed to a store (Postgres, etc.), so the pause can last as long as the human needs.

## How a company uses this

A **Dubai fintech**'s agent handles refunds and disputes end-to-end. Refunds under AED 1000 execute autonomously; anything above pauses and pings a support lead in Slack with the order details and a one-click approve/edit. This kept throughput high (most refunds are small and auto-approved) while ensuring no large payout ever left without a human eye. When the agent once mis-parsed "1,500" as "15,000", the approval gate caught it — the lead edited it back and approved. Without the gate, that's a AED 13,500 erroneous payout and an incident report.

## Common mistakes / misconceptions

- **Gating everything.** Approval on every step destroys the point of an agent and exhausts your reviewers. Gate only irreversible/high-value actions.
- **Gating nothing.** The opposite failure — full autonomy on money/deletes is how demos become incidents.
- **Restarting instead of resuming.** If your agent can't checkpoint and resume, a pause means re-running from scratch (re-doing tool calls, re-paying). Use a framework with durable interrupts.
- **No edit path.** Approve/reject alone is clumsy; letting the human *correct* the arguments is far more useful.

## Interview tip
Say: *"Human-in-the-loop pauses the agent before irreversible or high-value actions — I gate selectively so cheap steps flow and only money/deletes/sends wait. The agent state is checkpointed so it can suspend for hours and resume from the exact point, not restart, and the human can approve, reject, or edit the arguments. Knowing where to place the gate is the judgment call — too many and it's useless, too few and it's dangerous."* The "selective gating + resume-not-restart" pair is the strong answer.

See also: **[Guardrails](guardrails.md)** (the escalate policy that triggers this) and **[Step / spend budget caps](step-spend-budget-caps.md)** (the automatic ceiling for when no human is watching).
