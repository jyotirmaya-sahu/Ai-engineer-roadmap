# Custom Clients

**What it is:** building your **own** MCP host/client — your app connects to MCP servers programmatically instead of using Claude Desktop or an IDE — so your product's AI features get the same reusable tools.

## Why it matters for an AI Engineer

Shipping a *product* means you're not living inside Claude Desktop — you're building your own assistant, support bot, or agent. Writing a custom client is how your app consumes MCP servers (yours and third-party) with zero bespoke glue per tool. It's also the moment you take on the **host responsibilities**: model choice, user consent, and cost control (see [host/client/server](host-client-server.md)). This is core product-engineering work for an AI role.

## The mechanism / how it works

A custom client uses an MCP SDK to do what Claude Desktop does under the hood:

1. **Connect + `initialize`** — open a [transport](stdio-local.md) (spawn a STDIO subprocess, or open a [Streamable HTTP](streamable-http.md) connection) and run the capability-negotiation handshake.
2. **Discover** — call `tools/list` / `resources/list` / `prompts/list`.
3. **Bridge to your LLM** — convert the discovered tool schemas into *your* model's function-calling format and pass them on each completion. This is the key step: MCP tools become ordinary function-calling tools for whatever model you use.
4. **Route calls** — when the model emits a tool call, translate it to `tools/call`, send it to the right server's client, and feed the result back to the model.
5. **Own the host duties** — enforce user **consent** before side-effecting tools, apply **budget/rate limits**, handle [sampling](sampling.md) and [elicitation](elicitation.md) requests coming *up* from servers, and log everything.

The payoff mirrors the whole point of MCP: you write the client *once*, and every MCP server — yours or the ecosystem's — plugs in without per-tool code.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🧠 your app's LLM</span>
    <span class="darr">↓ your MCP client (SDK)</span>
    <div class="flow">
      <span class="dbox orange">discover → bridge schemas</span>
      <span class="darr">→</span>
      <span class="dbox blue">🗄️ any MCP server</span>
    </div>
    <span class="darr">↓ you own: consent · budget · logging</span>
    <span class="dbox green">✅ tool result → model</span>
  </div>
  <div class="dcap">A custom client discovers servers, bridges their schemas to your model, and takes on the host's consent/cost duties.</div>
</div>

## Concrete example

Connecting to a server and exposing its tools to your model (using the MCP SDK's client):

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def run(user_msg):
    async with streamablehttp_client("https://crm.internal/mcp") as (r, w, _):
        async with ClientSession(r, w) as session:
            await session.initialize()
            tools = (await session.list_tools()).tools
            # bridge MCP schemas -> your model's function-calling format
            fc = [{"name": t.name, "description": t.description,
                   "parameters": t.inputSchema} for t in tools]
            call = your_llm(user_msg, tools=fc)          # model picks a tool
            if call:
                # enforce consent/budget HERE (host duty) before executing
                result = await session.call_tool(call.name, call.arguments)
                return your_llm(user_msg, tool_result=result.content)
```

The client discovers tools, hands their schemas to *your* model, and routes the chosen call — the same server that works in Claude Desktop now works in your product.

## How a company uses this

A Dubai SaaS builds its customer-facing assistant as a custom MCP host over its own model stack, connecting to internal servers (billing, account, ticketing) it also exposes to Claude Code internally — one set of servers, two hosts. Owning the client is what lets them enforce *their* rules centrally: a per-tenant token budget, a consent gate that requires a UI confirmation for refunds, structured audit logs on every `tools/call`, and model routing (cheap model for lookups, strong model for reasoning). Because the client bridges MCP schemas to their model's function-calling format, adding a third-party MCP server (say, a mapping service) is a connection string, not an integration project. The host duties — consent, budget, logging — are code *they* own, which is exactly what a regulated environment requires.

## Common mistakes

- **Skipping consent/budget.** A custom host that auto-runs every tool call the model emits is a security and cost hazard — those gates are *your* responsibility now.
- **Not handling server→client requests.** Servers may send [sampling](sampling.md) or [elicitation](elicitation.md) requests up; a client that ignores them breaks those servers.
- **Re-inventing per-tool glue.** The whole point is to bridge schemas generically — don't hard-code each tool.
- **Ignoring version negotiation.** Handle the `initialize` protocol-version exchange so you interoperate with older servers.

## Interview tip

Say: *"A custom client is my app being its own MCP host: it initializes, discovers tools, bridges their JSON schemas to my model's function-calling format, and routes tools/call. Building it means I take on the host duties — consent gates, per-tenant budget, audit logging, and handling sampling/elicitation coming up from servers. Written once, it consumes any MCP server with no per-tool glue."* Emphasizing that *you now own consent and cost* is the senior read most candidates miss.
