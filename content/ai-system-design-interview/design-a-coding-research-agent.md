# Design a coding / research agent

**What it is:** the *autonomy-first* design prompt — *"build an agent that can research a question (or fix a bug) across multiple tools and steps on its own"* — worked through the [framework](clarify-requirements.md), where the hard problems are control, cost, and reliability of a multi-step loop, not a single call.

## Why it matters for an AI Engineer

Agents are the frontier of AI product work and the prompt that most exposes weak candidates. A RAG bot is one call; an agent is a **loop that decides its own next action, calls tools, and can spin forever, blow your budget, or take a destructive action.** This prompt tests whether you understand the agent loop *and* the guardrails that make it safe to run in production — the difference between a cool demo and a system you'd actually deploy at a company.

## Step 1 — Clarify

Buckets → **internal engineers/analysts, ~50 users, dozens of runs/day; a research agent needs web search + internal-docs retrieval + a code sandbox; "good" = a correct, sourced answer (or a passing bug fix), and a wrong/unsourced answer wastes trust; latency is flexible (a run can take 1–2 min) but **cost per run and safety are critical** — the agent must not loop forever or take irreversible actions; tools touch internal systems, so permissions matter.** Restate.

## Step 2 — SLAs

- **Latency:** loose — a run may take 60–120s. Stream progress so it *feels* alive.
- **Cost:** the danger. An agent makes **many** LLM calls per run (each loop step = a call, and context grows each step). Budget **per run**, e.g. ≤ $0.50, with a hard **max-step cap** so a runaway loop can't cost $50.
- **Accuracy / safety:** answers must be sourced; actions must be reversible or approved; a low-confidence result says so rather than fabricating.

## Step 3 — Sketch

The core is the **agent loop**: the LLM reasons, picks a tool, the tool runs, the result feeds back, repeat until done or capped.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🎯 Task</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM: plan / pick tool</span>
    <span class="darr">→</span>
    <span class="dbox orange">🛠️ Tool exec<span class="sub">search · docs · sandbox</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">📋 Observe result</span>
    <span class="darr">→<span class="lbl">not done + under cap</span></span>
    <span class="dbox purple">↺ loop</span>
  </div>
  <div class="flow">
    <span class="dbox purple">🧠 LLM</span>
    <span class="darr">→<span class="lbl">done / step-cap</span></span>
    <span class="dbox green">✅ Answer + sources</span>
  </div>
  <div class="dgroup"><span class="dgt">GUARDRAILS around the loop</span>
    <div class="flow">
      <span class="dbox yellow">⏱️ Max steps</span>
      <span class="dbox yellow">💰 Cost cap</span>
      <span class="dbox yellow">🔒 Tool permissions</span>
      <span class="dbox yellow">🙋 Human approval<span class="sub">for risky actions</span></span>
    </div>
  </div>
  <div class="dcap">Agent = LLM ↔ tools loop, wrapped in guardrails that cap steps, cost, and dangerous actions.</div>
</div>

Components: an **orchestrator** running the loop; a **tool layer** (web search, internal-docs RAG, a **sandboxed** code runner — critical, so generated code can't touch prod); **context/memory management** to keep the growing scratchpad under the token limit (summarize old steps); and the **guardrail wrapper** — a max-step counter, a running cost meter, per-tool permissions, and a **human-approval gate** before any irreversible action (writing files, running shell commands, sending anything).

For a *coding* agent, swap tools: read-repo, run-tests, edit-files-in-sandbox — and gate "open a PR" behind human approval.

## Step 4 — Find bottlenecks & iterate

- **Cost / runaway loops** (tightest): the loop can call the LLM 20+ times and context balloons. Relieve → **hard max-step cap** (e.g. 15), a **per-run cost budget** that aborts if exceeded, **context summarization** so token cost doesn't grow quadratically, and a **cheaper model for routine steps**, frontier only for planning.
- **Reliability:** LLMs pick wrong tools or loop in circles. Relieve → structured tool-calling (not free-text parsing), a "reflect / are-we-stuck?" check, retries with backoff on tool failures, and a **verification step** on the final answer (is it sourced? do tests pass?).
- **Safety:** an agent with real tools can do real damage. Relieve → sandbox everything, least-privilege tool permissions, and human-in-the-loop approval for anything irreversible.
- **Latency perception:** stream each step ("searching…", "reading docs…") so a 90s run feels like progress, not a hang.

## How a company uses this

> **A Dubai consultancy** built an internal research agent to compile market briefs from web + their proprietary reports. The two production lessons were **cost control and grounding.** Early runs occasionally looped — the agent kept "refining" a search and burned **$8 in one run** before anyone noticed; a hard 12-step cap and a $0.60 per-run budget that aborts-and-summarizes ended that overnight. And because early briefs cited things that didn't exist, they added a **verification pass** that checked every claim against a retrieved source and dropped unsupported ones — turning a flashy-but-untrustworthy demo into something analysts actually shipped to clients. Latency (~90s/run) never mattered; the step-cap, cost budget, and source-verification were the entire difference between usable and not.

## Common mistakes
- **No step/cost cap.** An uncapped agent loop is a blank cheque and a potential infinite loop. This is the *first* thing a senior adds — mention it before being asked.
- **Unsandboxed tools.** Letting a coding agent run shell commands against prod is an incident waiting to happen. Sandbox + approval gates for irreversible actions.
- **Ignoring context growth.** Each step appends to the prompt; without summarization you hit the token limit and cost grows fast. Manage the scratchpad.
- **Using an agent when a workflow would do.** If the steps are fixed, a scripted [workflow](../architecting-ai-solutions/single-call-vs-workflow-vs-agent-vs-multi-agent.md) is cheaper and more reliable. Reach for an agent only when the path is genuinely dynamic.

## Interview tip
Lead with control: *"An agent is an LLM-plus-tools loop, so before anything else I'd wrap it in guardrails — a max-step cap, a per-run cost budget that aborts, sandboxed least-privilege tools, and human approval for irreversible actions. Cost is the real risk because each loop step is another LLM call on a growing context, so I'd summarize context and use a cheap model for routine steps."* Naming the guardrails *unprompted* is the strongest possible agent-design signal — it says you've watched an agent misbehave in production. Contrast the loose-latency/high-safety profile here with the latency-first [support RAG](design-a-support-rag-assistant.md) and throughput-first [doc pipeline](design-a-doc-processing-pipeline-at-scale.md).
