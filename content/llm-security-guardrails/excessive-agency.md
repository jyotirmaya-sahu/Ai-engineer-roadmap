# Excessive agency

**What it is:** giving an LLM agent more power than the task needs — too many tools, too-broad permissions, or the ability to take irreversible actions without a human check — so that when it's wrong or hijacked, the damage is large.

## Why it matters for an AI Engineer

Prompt injection and jailbreaks are how an attacker gets *in*; excessive agency is what decides how much they can *do* once in. It's OWASP LLM08, and it's the single biggest reason autonomous agents are scary to ship. An AI Engineer's job is to make the blast radius small: even a fully-compromised agent should be unable to cause a catastrophe. In Dubai's regulated sectors, "the agent can only read, never write, and any payment needs human approval" is often the sentence that gets a project past the risk committee. Interviewers love this topic because it separates people who've built *agents* from people who've built *safe agents*.

## The mechanism

Excessive agency has three sub-problems:

- **Excessive permissions** — the tool runs with a broad service account. A "look up a balance" tool that can query *any* account (not just the caller's) means one injection reads everyone's data.
- **Excessive functionality** — you gave the agent a Swiss-army toolbox "just in case." It has `delete_file`, `send_email`, `execute_sql` when the task only needs `read_ticket`. Every extra tool is extra attack surface.
- **Excessive autonomy** — the agent can take high-impact, irreversible actions (send money, delete records, email customers) with no human in the loop.

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">⚠️ Compromised agent (injection succeeded)</span>
    <span class="darr">↓</span>
    <span class="dbox gray">🧰 tools: read • write • pay • delete • email</span>
    <span class="darr">↓<span class="lbl">too much power</span></span>
    <span class="dbox orange">💥 wires money, deletes data, exfiltrates</span>
  </div>
  <div class="dcap">Same injection, huge damage — because the agent had broad tools and no human gate.</div>
</div>

The three fixes map one-to-one: **least privilege** (scope each tool to the minimum data/action), **minimal functionality** (only expose tools the task requires), and **human-in-the-loop** (require confirmation before any irreversible or high-value action). Add **spending/rate limits** so even automated actions have a ceiling.

## Concrete example

Scoping a tool to the authenticated user and gating a risky action behind approval:

```python
# BAD: tool can read any account — an injection reads everyone's data
def get_balance(account_id: str) -> str:
    return db.balance(account_id)

# GOOD: least privilege — the tool ignores model-supplied IDs and uses the
# authenticated session, so it can ONLY ever read the current user's account.
def get_balance(session) -> str:
    return db.balance(session.authenticated_account_id)

# GOOD: high-impact action requires explicit human approval, not model autonomy
def transfer_money(session, to_account: str, amount: float):
    if amount > 1000 or not to_account.startswith(session.linked_accounts):
        return request_human_approval(session, to_account, amount)  # breaks the auto-chain
    return db.transfer(session.authenticated_account_id, to_account, amount)
```

Notice `get_balance` no longer takes an `account_id` from the model at all — the most powerful defense is designing tools so the model *can't* express a dangerous request in the first place.

## How a company uses this

**A Dubai logistics firm** built an ops agent to handle shipment exceptions. The first design gave it a generic `run_sql` tool against the operations DB "for flexibility." Security killed it: `run_sql` with write access meant one poisoned customer note could `UPDATE` any shipment. The rebuilt version replaced `run_sql` with four narrow, read-mostly tools (`get_shipment`, `list_delays`, `reschedule_pickup`, `notify_customer`), each scoped to the agent's assigned region and running under a role with no `DELETE`/`DROP` rights. `reschedule_pickup` and `notify_customer` were rate-limited (max N/hour) and any refund over AED 500 routed to a human. Result: even if the agent were fully hijacked, the worst it could do is reschedule a few pickups in one region — annoying, not catastrophic. That's excessive-agency thinking in practice: shrink the toolbox, scope every tool, gate the dangerous ones.

## Common mistakes

- **A generic `run_sql`/`run_code`/`http_request` tool.** Convenient and catastrophic — replace with narrow, purpose-built tools.
- **One broad service account** shared by all tools instead of per-tool least privilege.
- **Full autonomy on irreversible actions.** Money, deletes, and outbound comms should need approval or hard limits.
- **No rate/spend limits**, so a looping or hijacked agent can act thousands of times.

## Interview tip
Say: *"I assume an agent can be compromised and design so the blast radius is tiny: least-privilege tools scoped to the authenticated user, only the functions the task needs (no generic run-SQL), human approval or hard limits on irreversible/high-value actions, and rate/spend caps. The strongest move is making dangerous requests inexpressible — e.g. the balance tool uses the session identity, not a model-supplied account ID."* Framing it as *blast-radius containment* (OWASP LLM08) is exactly the senior signal interviewers want.
