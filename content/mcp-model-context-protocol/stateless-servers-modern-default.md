# Stateless Servers (modern default)

**What it is:** the 2026-07-28 spec change that makes MCP's protocol core **stateless** — no session handshake, no `Mcp-Session-Id` to pin — so each request is self-contained and *any* request can hit *any* server instance, enabling trivial horizontal scaling.

## Why it matters for an AI Engineer

This is the single most important "are you current?" MCP fact in 2026. Stateless is what lets an MCP server deploy on the same serverless/container infra as the rest of your stack and autoscale behind a plain load balancer. Naming this change — and the mechanism that replaced held-open streams — is the strongest signal that you track the spec, not a year-old tutorial.

## The mechanism / how it works

Earlier ([Streamable HTTP](streamable-http.md), 2025-11-25) was **session-based**: a client ran an `initialize` handshake, the server issued an `Mcp-Session-Id`, and every later request had to carry that id back — so it had to return to the *same* server instance that held that session's state. That's **sticky sessions**, and sticky sessions are the enemy of horizontal scaling: a load balancer can't freely spread requests, autoscaling can't add/remove instances cleanly, and a server restart drops every live session.

The **2026-07-28** revision drops the session. The protocol core goes **stateless**:

- **No `initialize` handshake required** and **no `Mcp-Session-Id`.** Each request carries everything it needs — it's self-contained.
- **Held-open SSE streams are replaced by Multi-Round-Trip Requests (MRTR).** Instead of keeping a connection open to ask the user something (as [elicitation](elicitation.md) needs), the server returns an **`InputRequiredResult`**, and the client simply **re-issues the call** with the answer. Pause-and-resume becomes two ordinary independent requests.

The payoff: with no session to pin and no long-lived connection, **any request can land on any instance**. That's the exact property serverless and load-balanced containers need.

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Session-based (2025-11-25) — sticky</span>
    <div class="flow">
      <span class="dbox gray">🤖 client<span class="sub">Mcp-Session-Id</span></span>
      <span class="darr">→ must return to</span>
      <span class="dbox orange">🗄️ same instance</span>
    </div>
  </div>
  <div class="dgroup">
    <span class="dgt">Stateless (2026-07-28) — any instance</span>
    <div class="flow">
      <span class="dbox gray">🤖 client<span class="sub">self-contained request</span></span>
      <span class="darr">→ load balancer</span>
      <span class="dbox green">🗄️ instance 1</span>
      <span class="dbox green">🗄️ instance 2</span>
      <span class="dbox green">🗄️ instance N</span>
    </div>
  </div>
  <div class="dcap">Dropping the session id lets any request hit any instance — trivial horizontal scaling on serverless/containers.</div>
</div>

## Concrete example

One flag turns it on:

```python
from fastmcp import FastMCP
mcp = FastMCP("golden-visa")

@mcp.tool()
def eligibility(salary_aed: int) -> str:
    "Check UAE Golden Visa eligibility by monthly salary."
    return "eligible" if salary_aed >= 30000 else "not eligible"

if __name__ == "__main__":
    # no sessions -> scales behind a plain load balancer
    mcp.run(transport="streamable-http", stateless_http=True, json_response=True)
```

The rule that makes this correct: **keep no per-client state in server memory between requests.** If you need state (a conversation cursor, a partial workflow), put it in the request payload or a shared store (Redis/DB) that every instance can read — never in a local variable that only instance-3 has.

## How a company uses this

A Dubai enterprise runs its MCP servers on AWS Lambda and ECS Fargate. Stateless is what makes that work: there's no session to pin, so the ALB round-robins requests across however many instances autoscaling has spun up — from 2 at 3am to 40 at peak — and a cold Lambda serving request #500 needs nothing from the instance that served #1. Elicitation confirmations survive because they're re-issued requests (MRTR), not held-open streams that would die when a function times out. The operational win is concrete: they run MCP on the *same* serverless platform as the rest of their APIs, with the same autoscaling, the same cost model (pay per request, scale to zero), and no special sticky-session infrastructure.

## Common mistakes

- **Keeping per-client state in memory.** On stateless servers the next request may hit a different instance that never saw it. Externalize state.
- **Still relying on `Mcp-Session-Id`.** That's the 2025-11-25 model; the 2026-07-28 core drops it.
- **Expecting held-open streams for interaction.** Elicitation now uses re-issued requests (MRTR), not a persistent connection.
- **Assuming stateful is "more powerful."** For most tool servers, stateless is strictly better operationally — reach for stateful only when a genuine long-lived session is unavoidable ([stateful/SSE legacy](stateful-sse-legacy.md)).

## Interview tip

Say: *"As of the 2026-07-28 spec the protocol core is stateless — no initialize handshake, no Mcp-Session-Id — so requests are self-contained and any request can hit any instance behind a plain load balancer. Held-open SSE streams are replaced by Multi-Round-Trip Requests: the server returns InputRequiredResult and the client re-issues the call. The catch is I keep zero per-client state in server memory — anything durable goes in the request or a shared store."* That's the current-spec answer that lands.
