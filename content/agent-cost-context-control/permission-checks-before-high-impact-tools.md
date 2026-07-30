# Permission checks before high-impact tools

**What it is:** Gating an agent's *dangerous* tools — anything that deletes, spends, sends, or writes — behind a check (a human approval, a policy rule, or a limit) that must pass before the action runs.

## Why it matters for an AI Engineer

An agent is a program that decides its own actions from probabilistic model output. That's fine when the worst case is "a wrong sentence." It is *not* fine when the worst case is "dropped the production table," "wired $40 K," or "emailed 10,000 customers." This maps directly to the OWASP LLM risk **"Excessive Agency."** Permission checks are how you let an agent be *useful* (it can act) without letting it be *catastrophic* (it can't act *irreversibly* without a gate). Any enterprise or finance role in Dubai will ask how you stop an agent from doing real-world damage — this is the answer.

## The mechanism — classify, gate, log

1. **Classify every tool by blast radius.**
   - **Read-only / safe:** search, fetch, read a doc. No gate.
   - **Reversible writes:** create a draft, add a label. Light gate (policy check, maybe log).
   - **High-impact / irreversible:** delete, pay, send email, deploy, `DROP`, external API with side effects. **Hard gate.**
2. **Gate the high-impact ones** with one or more of:
   - **Human-in-the-loop (HITL):** pause the run, surface the proposed action + args to a person, resume only on approval. The gold standard for irreversible actions.
   - **Policy checks in code:** deterministic rules the model can't argue past — "refunds > 500 AED require approval," "can only email addresses on the allow-list," "delete only within `/tmp`."
   - **Limits & least privilege:** the tool's own credentials can't exceed a cap (a payment key with a $100/day ceiling; a DB role with no `DELETE` grant). Defense that doesn't rely on the agent behaving.
3. **Log the decision** — who/what approved, the exact args — so every high-impact action is auditable ([replayable trajectories](replayable-debuggable-trajectories.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 agent wants tool</span>
    <span class="darr">→</span>
    <span class="dbox yellow">classify blast radius</span>
    <span class="darr">→</span>
    <span class="dbox orange">high-impact?</span>
    <span class="darr">→</span>
    <span class="dbox blue">🙋 approval / policy / limit</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ run &amp; log</span>
  </div>
  <div class="dcap">Safe tools run freely; high-impact ones pass through an approval, a policy rule, and a credential limit before executing.</div>
</div>

The layered principle: **the model *proposes*, but a deterministic gate *disposes*.** Never let a probabilistic decision be the only thing standing between the agent and an irreversible action.

## Concrete example

```python
HIGH_IMPACT = {"send_email", "issue_refund", "delete_file", "deploy"}

def guarded_call(tool, args, approver):
    if tool in HIGH_IMPACT:
        if not policy_ok(tool, args):                 # deterministic rules
            return {"error": "blocked by policy", "tool": tool, "args": args}
        if not approver.confirm(tool, args):          # human-in-the-loop
            return {"error": "human declined", "tool": tool, "args": args}
    result = TOOLS[tool](**args)                       # credentials are least-privilege
    audit_log.write(tool=tool, args=args, approved_by=approver.id)
    return result

def policy_ok(tool, args):
    if tool == "issue_refund":  return args["amount_aed"] <= 500
    if tool == "send_email":    return args["to"].endswith("@ourbank.ae")
    if tool == "delete_file":   return args["path"].startswith("/tmp/")
    return True
```

## How a company uses this

A Dubai bank's dispute-resolution agent can auto-issue refunds — a genuinely high-impact action. Their gate: refunds **≤ 500 AED** with a matching transaction record run automatically (policy check only); refunds **> 500 AED or without a clean match** pause for a **human agent's one-click approval** in the ops console. On top, the refund tool's payment credential is **capped at 2,000 AED/day** at the provider — so even a bug or a prompt-injection can't exceed that ceiling. This caught a real incident: a prompt-injection in a customer's dispute message tried to steer the agent to refund 50,000 AED to an external account. The policy check blocked the amount, the allow-list blocked the external destination, and the credential cap was the final backstop — three independent gates, and the attack netted nothing but an alert. That defense-in-depth is exactly what auditors and interviewers want to hear.

## Common mistakes
- **Trusting the prompt as the guardrail** — "please don't delete anything important" is not a control; the model can be talked past it. Gates must be deterministic code.
- **Gating everything** — approval fatigue makes humans rubber-stamp; gate only genuinely high-impact tools so approvals stay meaningful.
- **No least-privilege backstop** — if the only defense is the approval step, a bug that skips it does full damage. Cap the credentials too.
- **Not logging the approval** — an unaudited high-impact action is a compliance failure waiting to happen.
- **Approving a summary, not the exact args** — the human must see the *actual* recipient/amount/path, or they're approving blind.

## Interview tip
Say: *"I classify tools by blast radius: read-only runs free, but anything irreversible — pay, delete, send, deploy — passes through a deterministic gate before it executes: a policy rule the model can't argue past, human approval for the risky cases, and least-privilege credentials capped at the tool level as a backstop. The model proposes, code disposes, and every high-impact action is logged. This is the answer to Excessive Agency — and defense-in-depth is what stops a prompt-injection from turning into a real-world loss."* Citing Excessive Agency and layering three independent gates is the enterprise signal.
