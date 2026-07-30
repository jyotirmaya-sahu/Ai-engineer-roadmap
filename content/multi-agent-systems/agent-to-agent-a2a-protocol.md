# Agent-to-Agent (A2A) Protocol

**What it is:** an open standard (originally from Google, now under the Linux Foundation) that lets agents *built by different teams, in different frameworks, running on different servers* discover and talk to each other — a common language for cross-vendor agent collaboration.

## Why it matters for an AI Engineer

Everything else on this node assumes your agents live in *one* codebase. A2A is for the next problem: your company's CrewAI agent needs to hand a task to a partner company's LangGraph agent it has never seen. Without a standard, every such integration is bespoke glue. A2A is to *agents* what [MCP](../mcp-model-context-protocol.md) is to *tools* — MCP standardizes model↔tool wiring; A2A standardizes agent↔agent wiring. For an AI Engineer in 2026, knowing this distinction is a current, differentiating signal: interoperability is the frontier problem, and naming the right protocol for it shows you're tracking the field.

## The mechanism / how it works

A2A defines a few standard pieces so any compliant agent can work with any other:

1. **Agent Card** — a public JSON descriptor (served at a well-known URL) advertising what an agent can do, its endpoint, and how to authenticate. This is how agents *discover* each other's capabilities without prior coordination.
2. **Tasks** — a client agent sends a task to a remote agent; the task has a lifecycle (submitted → working → completed/failed) so long-running work can be tracked.
3. **Messages & Artifacts** — structured turns and outputs (text, files, structured data) exchanged over the task.
4. **Transport** — HTTP with JSON-RPC, and streaming (SSE) for progress updates on long tasks, plus push notifications.

The key idea: agents stay **opaque**. The remote agent doesn't expose its internal tools, prompts, or model — it just advertises *capabilities* via its Agent Card and accepts *tasks*. That opacity is deliberate: two companies can collaborate through their agents without leaking their internal implementations.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 My agent<span class="sub">client</span></span>
    <span class="darr">→<span class="lbl">reads Agent Card</span></span>
    <span class="dbox blue">🪪 Agent Card<span class="sub">capabilities · endpoint</span></span>
    <span class="darr">→<span class="lbl">send Task (JSON-RPC/HTTP)</span></span>
    <span class="dbox green">🤖 Remote agent<span class="sub">opaque</span></span>
  </div>
  <div class="dcap">A2A: discover via Agent Card, delegate via Task — agents interoperate without exposing internals.</div>
</div>

## A concrete example

An A2A client sending a task to a remote agent (sketch with the a2a Python SDK, 2026):

```python
from a2a.client import A2AClient

# 1. Discover the remote agent by fetching its Agent Card
client = await A2AClient.from_url("https://partner.example.com/.well-known/agent.json")
print(client.agent_card.name, client.agent_card.skills)  # what it can do

# 2. Send a task — the remote agent runs it however it likes, internals hidden
task = await client.send_task(message="Translate this contract clause to Arabic: ...")

# 3. Stream status until the task completes
async for update in client.subscribe(task.id):
    if update.status == "completed":
        print(update.artifacts)   # the result comes back as structured artifacts
```

Note what's *absent*: no knowledge of the remote agent's framework, model, or tools. You discovered a capability and delegated a task — that's the whole point.

## How a company uses this

A Dubai logistics platform integrates with a customs-brokerage partner. Rather than building a custom API against the broker's system, the broker exposes an A2A agent; the logistics platform's own agent reads its Agent Card, learns it can "classify goods and estimate duties," and sends it tasks as shipments come in. Each side upgrades its internal agent freely — different frameworks, different models — and the integration keeps working as long as the Agent Card contract holds. This is exactly the multi-company interoperability A2A exists for, and it's why it's gaining traction as agents cross organizational boundaries.

## Common mistakes / misconceptions

- **Confusing A2A with MCP.** MCP connects a model to *tools*; A2A connects an agent to *other agents*. They're complementary, not competing — an A2A agent often uses MCP internally.
- **Reaching for A2A inside one codebase.** If all your agents are in one app, [handoffs](delegation-handoffs.md) and [shared state](shared-state-memory.md) are far simpler. A2A earns its complexity only across teams/orgs/frameworks.
- **Ignoring auth.** Cross-org agent calls are a real attack surface — the Agent Card's auth scheme isn't optional.
- **Assuming it's mature/stable.** It's a fast-moving 2025–26 standard; pin versions and expect churn.

## Interview tip
Say: *"A2A is an open protocol for agents from different teams or vendors to discover and delegate to each other — Agent Cards advertise capabilities, Tasks carry the work, and agents stay opaque so nobody leaks internals. It's the agent-to-agent analog of MCP's model-to-tool standardization. I'd only reach for it across organizational or framework boundaries; inside one codebase, handoffs and shared state are simpler."* Drawing the MCP parallel and the boundary line is the senior signal.
