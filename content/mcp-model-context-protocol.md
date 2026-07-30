# MCP — Model Context Protocol

**The one-line idea:** MCP is **"USB-C for AI tools."** Before MCP, every time you wanted an LLM to use a tool (Slack, a database, GitHub), you wrote custom glue code for *that model* and *that tool*. MCP is an open standard so any MCP-speaking model can plug into any MCP-speaking tool — write the tool once, every client can use it.

## The problem it solves: M×N → M+N

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Without MCP — M×N custom integrations</span>
    <div class="flow">
      <span class="dbox green">🤖 Claude</span>
      <span class="darr">→</span>
      <span class="dbox gray">🗄️ GitHub</span>
    </div>
    <div class="flow">
      <span class="dbox green">🤖 Claude</span>
      <span class="darr">→</span>
      <span class="dbox gray">🗄️ Postgres</span>
    </div>
    <div class="flow">
      <span class="dbox green">🤖 Cursor</span>
      <span class="darr">→</span>
      <span class="dbox gray">🗄️ GitHub</span>
    </div>
    <div class="flow">
      <span class="dbox green">🤖 Cursor</span>
      <span class="darr">→</span>
      <span class="dbox gray">🗄️ Postgres</span>
    </div>
  </div>
  <div class="dgroup">
    <span class="dgt">With MCP — M + N</span>
    <div class="flow">
      <span class="dbox green">🤖 Claude</span>
      <span class="darr">→</span>
      <span class="dbox purple wide">🔌 MCP</span>
      <span class="darr">→</span>
      <span class="dbox blue">🗄️ GitHub server</span>
    </div>
    <div class="flow">
      <span class="dbox green">🤖 Cursor</span>
      <span class="darr">→</span>
      <span class="dbox purple wide">🔌 MCP</span>
      <span class="darr">→</span>
      <span class="dbox blue">🗄️ Postgres server</span>
    </div>
  </div>
  <div class="dcap">Each app is one MCP client, each tool is one MCP server — integrations go from M×N to M+N.</div>
</div>

With **M** apps and **N** tools you used to need **M×N** integrations. MCP makes it **M+N**: each tool exposes one MCP server, each app is one MCP client.

## The pieces

- **Host** — the app the user is in (Claude Desktop, Claude Code, your IDE).
- **Client** — lives inside the host, speaks MCP to one server.
- **Server** — wraps a tool/data source and exposes capabilities.

### Server capabilities (the primitives)
| Primitive | What it is | Example |
|---|---|---|
| **Tools** | actions the model can call | `create_github_issue()` |
| **Resources** | read-only data/context | a file, a DB row |
| **Prompts** | reusable prompt templates | "/summarize-pr" |
| **Roots** | folders the server may touch (security boundary) | `/repo/src` only |
| **Sampling** | the server asks the *client's* LLM to run a completion — so the client keeps control of model choice, cost, and consent | a server that needs to reason without its own API key |
| **Elicitation** | the server pauses mid-tool-call to ask the *user* for input | "which repo?" before creating an issue |

## Latest (know the version timeline — this is moving fast)

MCP's transport has evolved in three steps. Getting the *versions* right is what proves you track the spec:

| Spec revision | What changed |
|---|---|
| **2025-03-26** | introduced **Streamable HTTP**, replacing the original HTTP+SSE transport |
| **2025-11-25** (stable) | Streamable HTTP is **session-based**: an `initialize` handshake + an `Mcp-Session-Id`. It *can* still stream over SSE, optionally. |
| **2026-07-28** (newest) | protocol core goes **stateless** — drops the handshake and `Mcp-Session-Id`, and replaces held-open SSE streams with **Multi-Round-Trip Requests (MRTR)**: instead of keeping a connection open, the server returns an `InputRequiredResult` and the client simply re-issues the call. |

**Why stateless is a big deal:** with no session to pin, *any* request can hit *any* server instance behind a plain load balancer. That means trivial horizontal scaling on serverless/containers (AWS Lambda, App Runner, ECS) — the same infra as the rest of your stack.

- **STDIO** — local server, same machine (great for dev tools).
- **Streamable HTTP** — remote; session-based in 2025-11-25, **stateless from 2026-07-28**.

## Build a server in ~10 lines (FastMCP)

```python
from fastmcp import FastMCP

mcp = FastMCP("golden-visa")

@mcp.tool()
def eligibility(salary_aed: int) -> str:
    "Check UAE Golden Visa eligibility by monthly salary."
    return "eligible" if salary_aed >= 30000 else "not eligible"

@mcp.resource("policy://golden-visa")
def policy() -> str:
    "The current Golden Visa policy text."
    return open("golden_visa.md").read()

if __name__ == "__main__":
    # stateless_http + json_response = no sessions -> scales behind a load balancer
    mcp.run(transport="streamable-http", stateless_http=True, json_response=True)
```

Any MCP client (Claude Desktop, your agent) can now discover `eligibility` and call it — you never wrote client-side glue.

## MCP vs plain function calling
Function calling is *how one model calls one tool you hand-wired into your code*. MCP is the *standard that makes tools reusable across apps and teams*. Under the hood an MCP tool still becomes a function call — MCP is the **distribution/standardization layer** on top.

## Real world: how a company uses this

> **An enterprise in Dubai** exposes its internal systems — CRM, ticketing, knowledge base — each as an MCP server behind auth. Their AI assistant (and their developers' Claude Code) plug into *all* of them through one protocol. Add a new system? Ship one MCP server; every existing assistant gains it instantly. Because servers are **stateless HTTP**, they deploy on the same ECS/Lambda infra as the rest of the company and scale automatically.

## Interview tip
Say the three things that signal you're current: (1) "USB-C for tools / M×N→M+N," (2) the primitives (tools, resources, prompts, roots, sampling, elicitation), (3) the **transport timeline** — *"2025-03-26 introduced Streamable HTTP, 2025-11-25 was still session-based, and the 2026-07-28 revision makes it stateless with Multi-Round-Trip Requests, so servers scale behind a plain load balancer."* Naming the versions is the real "I track the spec" signal, not just saying "it's stateless now."
