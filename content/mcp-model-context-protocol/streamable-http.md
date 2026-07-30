# Streamable HTTP

**What it is:** MCP's transport for **remote servers** — a single HTTP endpoint that carries JSON-RPC and, when needed, can stream a response. It **replaced the deprecated HTTP+SSE two-endpoint transport**.

## Why it matters for an AI Engineer

Streamable HTTP is how MCP goes from "a tool on my laptop" to "a service the whole company calls." Every remote, multi-user, or cloud-deployed MCP server uses it. Interviewers ask about it to check you know the *transport timeline* — that it replaced the old SSE design, and that its own default (stateful vs [stateless](stateless-servers-modern-default.md)) has since shifted. Getting the versions right is the "I track the spec" signal.

## The mechanism / how it works

The old transport (HTTP+SSE, pre-2025-03-26) used **two** endpoints: one HTTP POST endpoint for the client's requests, plus a *separately-held-open* Server-Sent-Events stream for the server's messages. Two endpoints, a long-lived connection to babysit, awkward behind proxies and load balancers. It's **deprecated** — don't build on it (see [stateful/SSE legacy](stateful-sse-legacy.md)).

**Streamable HTTP** (introduced in spec revision **2025-03-26**) collapses it to **one endpoint** (conventionally `/mcp`). The client POSTs a JSON-RPC request there. The server responds one of two ways:

- **A plain JSON response** — for a normal request/reply. Simple, stateless-friendly, load-balancer-friendly.
- **An SSE stream on that same response** — when the server wants to send *multiple* messages back for one request (progress updates, [log notifications](log-progress-notifications.md), or interim data). The streaming is *optional and per-response*, not a permanently-open side channel.

That's the "streamable" in the name: the same endpoint can return a single JSON body *or* upgrade to a stream when useful. This one-endpoint design is what makes remote MCP deployable on ordinary web infrastructure.

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Deprecated: HTTP+SSE — two endpoints</span>
    <div class="flow">
      <span class="dbox gray">🤖 client</span>
      <span class="darr">POST → /messages</span>
      <span class="dbox orange">held-open /sse</span>
    </div>
  </div>
  <div class="dgroup">
    <span class="dgt">Streamable HTTP — one endpoint</span>
    <div class="flow">
      <span class="dbox gray">🤖 client</span>
      <span class="darr">POST → /mcp</span>
      <span class="dbox blue">plain JSON <em>or</em> optional SSE stream</span>
    </div>
  </div>
  <div class="dcap">Streamable HTTP replaces the two-endpoint SSE design with one endpoint that streams only when needed.</div>
</div>

## Concrete example

```python
from fastmcp import FastMCP
mcp = FastMCP("crm")

@mcp.tool()
def lookup(customer_id: str) -> str:
    "Look up a customer."
    return crm_api.fetch(customer_id)

if __name__ == "__main__":
    # one endpoint; json_response=True forces plain JSON (no SSE) — simplest & most LB-friendly
    mcp.run(transport="streamable-http", stateless_http=True, json_response=True)
```

A remote client points at `https://crm.internal/mcp` and speaks MCP — no subprocess, unlike [STDIO](stdio-local.md). Setting `json_response=True` keeps every reply a plain JSON body; drop it if you want the server to be able to stream progress on long calls.

## How a company uses this

A Dubai enterprise deploys its CRM MCP server as a containerized HTTP service on ECS behind an ALB, serving its whole assistant fleet. Streamable HTTP is what makes this ordinary: it's just an HTTPS endpoint, so their existing tooling — TLS termination, WAF, load balancer, autoscaling, [auth](auth.md) via bearer tokens — all applies unchanged. For a long-running report tool they *do* use the optional SSE mode to stream progress so the UI shows a live bar; for quick lookups they return plain JSON. They explicitly avoid the deprecated HTTP+SSE transport because its held-open second connection fought their load balancer's idle timeouts. Pairing Streamable HTTP with the [stateless](stateless-servers-modern-default.md) mode is what lets any request hit any instance.

## Common mistakes

- **Building on deprecated HTTP+SSE.** It's replaced; new remote servers use Streamable HTTP.
- **Thinking it *always* streams.** Streaming is optional per response — most calls are plain JSON.
- **Confusing the transport with statefulness.** Streamable HTTP can run stateful *or* stateless; they're separate choices (see [stateless servers](stateless-servers-modern-default.md)).
- **Ignoring proxy/idle-timeout behavior.** If you do stream, long SSE responses need proxy timeouts tuned.

## Interview tip

Say: *"Streamable HTTP is the remote transport, introduced in the 2025-03-26 spec to replace the deprecated two-endpoint HTTP+SSE design. It's one endpoint that returns plain JSON normally and can optionally upgrade to an SSE stream for progress. Because it's ordinary HTTP, it deploys on standard cloud infra — and paired with the stateless mode from 2026-07-28, any request can hit any instance behind a load balancer."* Naming the revision dates is what proves you're current.
