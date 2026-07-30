# Agent Reliability

**The one-line idea:** Agent reliability is the set of controls that keep an autonomous LLM agent from going rogue — measuring whether it actually finished the task, stopping it before it does damage or spends a fortune, and being able to replay exactly what it did when something goes wrong.

## Why we even need it

A single LLM call is easy to reason about: one prompt in, one answer out, one clear cost. An **agent** is different — it loops. It decides which tool to call, reads the result, decides the next step, and repeats, sometimes for dozens of turns, with no human watching. That autonomy is the whole point, and also the whole problem. Three things can go wrong that never happen with a single call:

1. **It can be confidently wrong the whole way.** The agent picks a bad first step, and every step after builds on that mistake. The final answer looks polished but the *path* was garbage — and if you only grade the final answer, you'll never see it.
2. **It can do real damage or burn real money.** Agents call tools: send emails, run code, hit paid APIs, delete rows. A loop that should take 4 steps takes 400. A refund tool gets called twice. Nobody set a limit, so nobody stopped it.
3. **It's non-deterministic and invisible.** Run the same agent twice, get two different paths. When one run fails in production, you have no idea *why* unless you recorded every step.

Reliability engineering is what turns a flashy demo into something a Dubai bank will actually put in front of customers.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 Agent loop<span class="sub">plan → tool → observe → repeat</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🛡️ Reliability layer<span class="sub">eval · guardrails · caps · traces</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Safe, measured, replayable run</span>
  </div>
  <div class="dcap">Reliability wraps the agent loop: prove it worked, stop it before it harms, and record it so you can replay.</div>
</div>

## Why it matters for an AI Engineer

"I built an agent" is a junior line. "I made an agent *safe to deploy*" is the senior one. Interviewers and enterprise clients don't ask whether your agent can browse the web — they ask what happens when it loops forever, when a tool errors, when a user tries to make it wire money, and how you'd debug a failed run at 2am. Every item on this node is a direct answer to one of those questions. This is also where most real agent projects die: not because the model can't reason, but because nobody built the controls, so the project never cleared a security or finance review.

## The controls you'll learn (and when to reach for each)

| Control | What it does | Reach for it when |
|---|---|---|
| **[Trajectory eval](agent-reliability/trajectory-eval.md)** | grades the *path* — did it pick the right steps/tools | the final answer looks fine but you don't trust *how* it got there |
| **[Task-completion eval](agent-reliability/task-completion-eval.md)** | grades the *outcome* — did the goal actually get done | you need a single pass/fail number for regression testing |
| **[Guardrails](agent-reliability/guardrails.md)** | block bad inputs/outputs/actions before they land | agent touches money, PII, or destructive tools |
| **[Human approval](agent-reliability/human-approval.md)** | pause and ask a person before a high-impact action | the action is irreversible or high-stakes |
| **[Retry / backoff](agent-reliability/retry-backoff.md)** | re-attempt a flaky call with growing delays | tools fail transiently (rate limits, timeouts) |
| **[Error recovery](agent-reliability/error-recovery.md)** | feed the error back so the agent adapts | a step fails in a way retrying alone won't fix |
| **[Sandboxing & agent security](agent-reliability/sandboxing-agent-security.md)** | run agent actions in a locked-down box | the agent executes code or untrusted tools |
| **[Step / spend budget caps](agent-reliability/step-spend-budget-caps.md)** | hard ceiling on steps and dollars per run | any production agent — this is the kill-switch |
| **[Loop / iteration limits](agent-reliability/loop-iteration-limits.md)** | stop the loop after N turns / on repetition | agents that can get stuck repeating themselves |
| **[Determinism & reproducibility](agent-reliability/determinism-reproducibility.md)** | make a run repeatable enough to test/debug | you need CI tests or to reproduce a bug |
| **[Replayable traces](agent-reliability/replayable-traces.md)** | record every step to replay/inspect later | debugging a production failure after the fact |

They split into three jobs: **Evaluation** (did it work?), **Safety** (can it hurt anyone?), and **Cost & determinism** (can it be controlled and understood?).

## Real world: how a company uses this

> **A Dubai fintech** shipped a support agent that could issue refunds. The demo was flawless. In week one it hit an edge case, looped on a failing payments API, retried 90 times, and issued the same refund three times before anyone noticed — because there was no step cap, no idempotency guard, and no trace to see it happening. The fix wasn't a smarter model. It was **a 15-step budget cap, a spend cap of AED 500/run, human approval for any refund over AED 1000, retries with backoff and a max, and full replayable traces** into their observability stack. Same agent, same model — the reliability layer is what let it stay in production.

## Interview tip
Say: *"An agent isn't done when it works in the demo — it's done when it's safe to leave running unattended. I grade both the trajectory and the task completion, put guardrails and human-in-the-loop on high-impact tools, cap steps and spend with a hard kill-switch, add retry-with-backoff and error recovery for flaky tools, sandbox any code execution, and record replayable traces so I can debug and reproduce any failure. Most agent projects die on reliability, not capability."* That framing signals you've actually run agents in production, not just built demos.

---

*Below: deep-dive articles on each reliability control.*
