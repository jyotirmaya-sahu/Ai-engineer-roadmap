# Stateful / SSE (legacy)

**What it is:** the older MCP transport modes that keep **per-client server state** — the deprecated two-endpoint HTTP+SSE design, and the session-based Streamable HTTP that carried an `Mcp-Session-Id`. Both are being superseded by the [stateless](stateless-servers-modern-default.md) core.

## Why it matters for an AI Engineer

You need to recognize legacy modes for two reasons: you'll meet servers still running them, and interviewers test whether you know *why* they were replaced. Being able to say "that's the old sticky-session model, here's why stateless beat it" is the contrast that makes your understanding of the current spec credible.

## The mechanism / how it works

There are two "stateful/legacy" things people mean:

**1. HTTP+SSE (the original remote transport, pre-2025-03-26 — now deprecated).** It used **two endpoints**: a POST endpoint for client→server requests, plus a *separately held-open* Server-Sent-Events connection for server→client messages. The open SSE stream *is* per-connection state. Problems: two endpoints to coordinate, a long-lived connection that proxies and load balancers kill on idle timeout, and no clean horizontal scaling. It was replaced by [Streamable HTTP](streamable-http.md) in spec 2025-03-26.

**2. Session-based Streamable HTTP (2025-11-25).** One endpoint, but **stateful**: an `initialize` handshake minted an `Mcp-Session-Id`, and every later request had to carry it back — so requests were **sticky** to the instance holding that session's state. Cleaner than HTTP+SSE, but the session pin still blocks free horizontal scaling.

The **2026-07-28** revision made the core [stateless](stateless-servers-modern-default.md), turning both of these into the "before" picture. Held-open streams gave way to Multi-Round-Trip Requests; the session id went away.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">HTTP+SSE (deprecated)<span class="sub">two endpoints + held-open SSE</span></span>
    <span class="darr">↓ replaced 2025-03-26</span>
    <span class="dbox orange">Session-based Streamable HTTP<span class="sub">one endpoint, Mcp-Session-Id, sticky</span></span>
    <span class="darr">↓ superseded 2026-07-28</span>
    <span class="dbox green">Stateless core<span class="sub">no session, any instance, MRTR</span></span>
  </div>
  <div class="dcap">The transport evolved twice — each step shed per-client state to make scaling easier.</div>
</div>

## When stateful still has a legitimate use

Stateless is the modern default, but a genuinely **long-lived, high-frequency interactive session** can still justify keeping a connection or session — e.g. a server streaming continuous real-time updates where re-establishing context per request is wasteful. Even then, prefer externalizing state (Redis/DB) so you get statefulness *without* pinning to one instance. Pure in-memory sticky sessions are the thing to avoid.

## Concrete example

Session-based (legacy) vs stateless is one flag:

```python
# Legacy: session-based — server holds per-client state, requests are sticky
mcp.run(transport="streamable-http", stateless_http=False)

# Modern: stateless — self-contained requests, any instance
mcp.run(transport="streamable-http", stateless_http=True, json_response=True)
```

If you find yourself needing `stateless_http=False`, ask *why* you need per-client memory — usually the answer is "I don't," and moving that state into the request or a shared store lets you go stateless.

## How a company uses this

A Dubai enterprise inherited an early remote MCP server built on the deprecated HTTP+SSE transport. In production it was a constant headache: their ALB's 60-second idle timeout killed the held-open SSE stream mid-session, dropping tool calls, and they'd bolted on sticky-session routing that broke every time autoscaling replaced an instance. Migrating to [stateless](stateless-servers-modern-default.md) Streamable HTTP deleted both problems — no held-open stream to time out, no session to pin — and let the server run on plain autoscaled Fargate. They keep one legacy-mode server alive only for a real-time telemetry feed that genuinely benefits from a persistent stream, and even that stores its cursor in Redis so a restart doesn't lose it.

## Common mistakes

- **Building new servers on HTTP+SSE.** It's deprecated — use Streamable HTTP.
- **Reaching for sticky sessions by habit.** Most tool servers need no per-client state; sticky sessions block scaling for no benefit.
- **Confusing "stateful transport" with "stateful app logic."** You can have durable app state (in Redis/DB) *and* a stateless transport — that's the goal.
- **Ignoring proxy idle timeouts.** If you do keep an SSE stream, tune load-balancer/proxy timeouts or it'll be silently killed.

## Interview tip

Say: *"Legacy MCP came in two stateful flavors — the deprecated two-endpoint HTTP+SSE, and session-based Streamable HTTP with an Mcp-Session-Id that made requests sticky. The 2026-07-28 stateless core replaced both because sticky sessions and held-open streams block horizontal scaling and get killed by load-balancer timeouts. I only keep state when a genuine long-lived stream demands it, and even then I externalize it to Redis rather than pinning to an instance."* Framing legacy as the "before" of the scaling story shows you understand *why* the spec moved, not just *that* it did.
