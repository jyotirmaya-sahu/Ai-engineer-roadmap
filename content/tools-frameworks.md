# Tools & Frameworks

**The one-line idea:** an LLM on its own can only *talk*. **Tools** give it hands — the ability to call a function, hit an API, run code, or search your data — and **frameworks** are the scaffolding that wires many tool-using LLM calls into a reliable agent or team of agents.

## Why we even need it

A raw LLM is a text-in, text-out box. Ask it "what's the weather in Dubai right now?" and it either refuses or hallucinates — it has no live data and can't *do* anything. Two capabilities turn that box into a working product:

1. **Tool use** — you describe some functions to the model (their names, arguments, what they do). The model can then *ask* to call one, you run it, and feed the result back. Now the LLM can look up a live price, query a database, send an email, or execute Python. This is the single mechanism behind every "agent."
2. **Frameworks** — once you're doing tool-call → run → feed-back in a loop, across multiple steps, with memory and error handling, hand-writing that plumbing gets painful. LangChain, LangGraph, CrewAI and AutoGen give you the loop, the state, the retries, and the multi-agent coordination for free (or at least cheaper).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">❓ "Weather in Dubai?"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 LLM</span>
    <span class="darr">→<span class="lbl">tool call</span></span>
    <span class="dbox orange">🔧 get_weather("Dubai")</span>
    <span class="darr">→</span>
    <span class="dbox blue">🌡️ 41°C</span>
    <span class="darr">→<span class="lbl">fed back</span></span>
    <span class="dbox green">✅ "It's 41°C in Dubai."</span>
  </div>
  <div class="dcap">Tool use: the model requests a call, YOUR code runs it, the result goes back into the prompt.</div>
</div>

## Why it matters for an AI Engineer

This node is where "chatbot" becomes "software that acts." Almost every 2026 AI Engineer job description asks for **agents + tool calling + a framework** — it's the applied-GenAI core of the role. If you can explain how a function call actually round-trips, write a clean tool schema, and pick LangGraph vs CrewAI for a given problem, you can build the products companies actually pay for. Get it wrong — vague schemas, no loop control, the wrong framework — and you get agents that pick the wrong tool, loop forever, or burn the token budget.

## The pieces you'll learn (and when to reach for each)

| Tile | What it is | Reach for it when |
|---|---|---|
| [Function calling](tools-frameworks/function-calling.md) | the round-trip: model asks, you run, you feed back | any time the LLM needs to *do* something, not just talk |
| [Tool schemas](tools-frameworks/tool-schemas.md) | the JSON description that tells the model *how* to call a tool | designing any tool — this is where reliability is won or lost |
| [API tools](tools-frameworks/api-tools.md) | wrapping external REST/web APIs as callable tools | the model needs live/private data (weather, CRM, prices) |
| [Code execution](tools-frameworks/code-execution.md) | letting the model run code in a sandbox | math, data analysis, charts — anything better computed than guessed |
| [Retrieval / MCP tools](tools-frameworks/retrieval-mcp-tools.md) | search-your-data as a tool, standardized via MCP | grounding answers in docs; reusing tools across apps |
| [LangChain agents](tools-frameworks/langchain-agents.md) | the original batteries-included agent framework | fast prototypes, huge integration library |
| [LangGraph (nodes/edges/state)](tools-frameworks/langgraph-nodes-edges-state.md) | agents as an explicit state graph | production agents needing control, loops, checkpoints |
| [CrewAI](tools-frameworks/crewai.md) | role-based crews of agents | "give me a team: researcher + writer + reviewer" |
| [AutoGen](tools-frameworks/autogen.md) | conversational multi-agent, group chat | agents that solve by *talking to each other* / heavy code tasks |

Roughly: the first five are **tool use** (the hands), the last four are **frameworks** (the team and the plumbing).

## Real world: how a company uses this

> **A Dubai logistics company** builds a shipment-support agent. It has three tools: `track_shipment(id)` (their internal API), a **retrieval tool** over the customs-rules PDFs (an MCP server, reused by two other apps), and a **code-execution** tool to compute duties. They wire it with **LangGraph** because they need a hard step-cap and a human-approval node before anything customer-facing is sent. When a customer asks "where's order 4471 and what duty do I owe?", the agent calls `track_shipment`, retrieves the relevant customs rule, runs the duty math in the sandbox, and returns one grounded answer — with a replayable trace their ops team can audit. Every concept in this node shows up in that one flow.

## Interview tip
Say: *"Tool calling is the core mechanism — the model emits a structured request, my code executes it, and the result goes back into context. Everything an agent does is that loop. I write tight tool schemas because the model is only as reliable as the descriptions I give it. For orchestration I default to LangGraph when I need control and checkpoints, CrewAI when the mental model is a team of roles, and I standardize reusable tools behind MCP."* That shows you understand both the primitive and the tradeoffs — exactly what the role needs.

---

*Below: deep-dive articles on each tool type and framework.*
