# Agents / Tools / MCP

**What it is:** the drill for the "build me an agent" interview question — designing an LLM that *does things* by calling tools in a loop, knowing when an agent beats a plain pipeline, and speaking fluently about MCP (Model Context Protocol), the 2026 standard for wiring tools to models.

## Why it matters for an AI Engineer

Agents appear in ~24% of Dubai AI Engineer JDs and are the fastest-growing category. Interviewers love the topic because it separates people who've *shipped* agents from people who've watched a demo. The trap they're testing for: candidates who reach for a multi-step autonomous agent when a simple deterministic pipeline would be cheaper, faster, and more reliable. Showing **judgment about when *not* to use an agent** is a strong senior signal.

## The mechanism: the agent loop

An "agent" is a loop, not magic. The LLM is given (1) a goal, (2) a list of tools it can call, each with a name, description, and JSON schema of arguments. Then:

1. The model reads the goal + available tools and **decides** whether to call a tool or answer.
2. If it calls a tool, your code **executes** the real function (search, DB query, API call) and returns the result.
3. The result is appended to the conversation and the model **loops** — deciding the next action.
4. It stops when it produces a final answer or hits a step/cost limit.

That's the whole pattern: **think → act → observe → repeat**. The LLM never runs code itself; it *requests* actions and your runtime performs them. This is why agents need **guardrails** — a max-steps cap, a cost cap, and tool-level permissions — or they loop forever or call an expensive tool 50 times.

**MCP (Model Context Protocol)** standardizes step 2. Instead of hand-wiring each tool per app, you run an **MCP server** that exposes tools (and resources/prompts) over a standard protocol; any MCP-aware client (Claude, IDEs, your app) can discover and call them. It's "USB-C for tools" — write the tool once, plug it into any model. In interviews, mentioning MCP signals you're current on 2026 tooling, not stuck on bespoke function-calling glue.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🎯 Goal + tool schemas</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🧠 LLM decides: act or answer?</span>
    <span class="darr">↓<span class="lbl">tool call (JSON)</span></span>
    <span class="dbox orange">🔧 Your runtime executes tool</span>
    <span class="darr">↓<span class="lbl">result → loop back</span></span>
    <span class="dbox purple">🧠 LLM observes, decides next</span>
    <span class="darr">↓<span class="lbl">done / max-steps</span></span>
    <span class="dbox green">✅ Final answer</span>
  </div>
  <div class="dcap">think → act → observe → repeat, bounded by a step and cost cap.</div>
</div>

## Concrete example: a tool-calling loop

```python
from anthropic import Anthropic
client = Anthropic()

tools = [{
    "name": "get_order_status",
    "description": "Look up an order's status by ID.",
    "input_schema": {"type": "object",
        "properties": {"order_id": {"type": "string"}},
        "required": ["order_id"]},
}]

def get_order_status(order_id):        # the real tool
    return {"order_id": order_id, "status": "shipped", "eta": "2 days"}

msgs = [{"role": "user", "content": "Where is order A123?"}]
for _ in range(5):                     # step cap = guardrail
    resp = client.messages.create(model="claude-sonnet-4-5",
        max_tokens=1024, tools=tools, messages=msgs)
    msgs.append({"role": "assistant", "content": resp.content})
    tool_calls = [b for b in resp.content if b.type == "tool_use"]
    if not tool_calls:                 # model gave final answer
        print(resp.content[0].text); break
    results = []
    for call in tool_calls:
        out = get_order_status(**call.input)
        results.append({"type": "tool_result",
            "tool_use_id": call.id, "content": str(out)})
    msgs.append({"role": "user", "content": results})
```

The `for _ in range(5)` is the guardrail — never run an unbounded agent loop.

## How a company uses this (production lens)

A Dubai logistics firm built a customer-support agent with three tools: order lookup, refund initiation, and escalation-to-human. In production it runs with a **hard 6-step cap** and a **$0.05 per-conversation cost ceiling**; refunds above AED 500 require the escalation tool (the agent can't refund large amounts autonomously — a permission guardrail). They found ~15% of conversations hit an unnecessary tool call, so they added few-shot examples of "answer directly" cases, cutting tool calls 40% and shaving latency from ~4s to ~2.3s. Tools are exposed via an internal **MCP server**, so the same order-lookup tool serves the agent, an internal IDE assistant, and an ops dashboard — written once.

## Common mistakes
- **Reaching for an agent when a pipeline works.** If the steps are fixed and known, a deterministic chain is cheaper, faster, and testable. Say so.
- **No step/cost cap.** Unbounded loops burn money and hang. Always name the guardrail.
- **Vague tool descriptions.** The model picks tools from their descriptions; sloppy descriptions cause wrong calls.
- **Confusing MCP with function-calling.** Function-calling is the model *deciding* to call; MCP is the *transport/standard* for exposing tools. Know the difference.

## Interview tip
When handed "design an agent," first ask: *"Are the steps dynamic and open-ended, or fixed?"* If fixed, propose a pipeline and explain why it's better. If dynamic, describe the think-act-observe loop, name your guardrails (max-steps, cost cap, tool permissions), and mention MCP for tool wiring. Leading with "when *not* to use an agent" is the line that reads as senior. See [Trade-off defense](trade-off-defense.md) and [Failure-mode analysis](failure-mode-analysis.md).
