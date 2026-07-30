# Workflow vs autonomous agent

**What it is:** the single most important architecture decision in agentic AI — **who controls the flow?** In a *workflow*, you wrote the steps in code and the LLM fills them in. In an *autonomous agent*, the LLM decides the steps itself, in a loop, until it thinks it's done.

## Why it matters for an AI Engineer

This is the decision every other pattern in this node hangs off. Get it wrong in the "too autonomous" direction and you ship something slow, expensive, and unpredictable — a demo that impresses in the meeting and falls over in production. Get it wrong in the "too rigid" direction and your system can't handle the messy, open-ended tasks it was supposed to.

The 2026 industry consensus — crystallized in Anthropic's *Building Effective Agents* — is blunt: **most tasks that people build as agents should be workflows.** Autonomy is a cost you pay only when the task genuinely requires the model to decide the path. For an AI Engineer, being the person in the room who says *"this doesn't need an agent, a two-step chain does it"* is worth more than being the person who wires up the fanciest agent framework. Interviewers test for exactly this restraint.

## The mechanism / how it works

The spectrum, left (rigid) to right (autonomous):

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">⛓️ Single call</span>
    <span class="darr">→</span>
    <span class="dbox blue">🧩 Chain / route<span class="sub">workflow</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🧭 Orchestrator<span class="sub">semi-agentic</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 Autonomous agent<span class="sub">model-driven loop</span></span>
  </div>
  <div class="dcap">Left = you control the flow (predictable, cheap). Right = the model controls it (flexible, risky). Move right only when forced.</div>
</div>

**Workflow:** the control flow is code you wrote. [Chains](prompt-chaining.md), [routing](routing.md), [parallelization](parallelization.md) are all workflows. Predictable, testable, cheap, debuggable — you can point at exactly which step failed. Limitation: it can only handle paths you anticipated.

**Autonomous agent:** the model runs a [planning](planning.md) loop — reason, pick a tool, observe, repeat — and decides for itself when to stop. Flexible enough for tasks with no fixed path. But it's slower (many LLM calls), costlier, harder to debug (the path differs every run), and can loop or go off-track.

The decision rule: **can you write down the steps in advance?** If yes → workflow. If the steps genuinely depend on what the model discovers along the way → agent. And even when you do go autonomous, you **bound it** — step caps, spend caps, human approval on high-impact actions — so "autonomous" never means "unsupervised."

## A concrete example — the same task, both ways

Task: *"Answer a customer's question about their order."*

```python
# WORKFLOW: you know the steps → code them. Fast, cheap, predictable.
def workflow(question, order_id):
    order = db.get_order(order_id)                 # step 1 (code decides)
    return llm(f"Answer using this order:\n{order}\n\nQ: {question}")  # step 2

# AGENT: model decides which tools to call, in what order, when to stop.
def agent(question, max_steps=6):                  # bounded!
    history = f"Q: {question}\nTools: get_order, get_shipping, refund, finish"
    for _ in range(max_steps):
        action = llm_decide_next_tool(history)     # model picks the step
        if action.tool == "finish":
            return action.answer
        history += run_tool(action)                # observe, loop
    return "Escalating to a human."
```

For a plain order question the workflow wins outright — two calls, deterministic, ~$0.01. The agent is only worth its extra cost and unpredictability when the question might need *any* of several tools in an order you can't predict (e.g. "my order's late, I might want a refund, can you sort it?").

## How a company uses this

A **Dubai travel-tech company** first built its trip-planning assistant as a fully autonomous agent. It worked in demos but averaged 9 LLM calls, ~14s latency, and ~$0.30 per request, and ~5% of sessions looped or produced incoherent itineraries. They re-drew the line: a [router](routing.md) sends simple requests ("change my seat") through fixed workflows, and only genuinely open-ended planning ("build me a 5-day Dubai + Abu Dhabi itinerary under AED 6,000") hits a *bounded* autonomous agent (max 8 steps, $0.40 cap). Result: ~80% of traffic now runs as cheap deterministic workflows, blended cost dropped ~75%, and the loop incidents vanished from the fast path. The lesson they'd give any new hire: *start with a workflow, earn your way to autonomy.*

## Common mistakes / misconceptions

- **Reaching for an agent by default.** The most expensive mistake in the field. Try the simplest workflow first; add autonomy only when a workflow provably can't do it.
- **Thinking "agent" means "no rules."** Production agents are always bounded — step caps, spend caps, permission checks on dangerous tools. Unbounded autonomy is a bug, not a feature.
- **Believing agents are strictly "better."** They're *more flexible*, and worse on cost, latency, and predictability. It's a tradeoff, not an upgrade.
- **All-or-nothing thinking.** Best real systems are hybrids: workflows for the predictable majority, a bounded agent only for the open-ended tail.

## Interview tip
Say: *"My first question on any agentic project is: can I write the steps in advance? If yes, it's a workflow — a chain or router — and I keep it deterministic, cheap, and debuggable. I only go autonomous when the path genuinely depends on what the model discovers, and even then I bound it with step and spend caps and human approval on risky actions. Most 'agents' should be workflows — that's straight from Anthropic's *Building Effective Agents*, and it's usually a 3–5x cost win in practice."* Leading with restraint, not enthusiasm, is exactly the seniority signal interviewers look for.
