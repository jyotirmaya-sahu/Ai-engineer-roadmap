# Remote / Load-Balanced MCP Servers

**The one-line idea:** a production remote MCP server is an authenticated Streamable HTTP service behind ordinary gateways and load balancers, designed so any healthy instance can handle a request.

## Why it matters

Local `stdio` is ideal for developer tools, but company integrations need remote access, centralized authorization, autoscaling, observability, and high availability. The 2026-07-28 MCP revision makes Streamable HTTP stateless at the protocol layer: it removes the HTTP session ID and initialization handshake for that revision, making horizontal routing straightforward.

## Architecture

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">MCP clients</span>
    <span class="darr">→</span>
    <span class="dbox orange">Gateway<span class="sub">TLS · auth · WAF · rate limit</span></span>
    <span class="darr">→</span>
    <span class="dbox green">Stateless instances<span class="sub">A · B · C</span></span>
    <span class="darr">→</span>
    <span class="dbox gray">Shared systems<span class="sub">DB · cache · queue</span></span>
  </div>
</div>

The current revision uses self-contained requests. `Mcp-Method` and `Mcp-Name` headers mirror routing information so gateways can route, rate-limit, and observe calls without parsing the JSON-RPC body; components that inspect both must reject header/body mismatches. Durable state belongs in shared databases, object storage, or queues—not instance memory.

Operational checklist:

- TLS and OAuth/token validation at the edge and service;
- per-user and per-tool authorization;
- strict tool input/output schemas and payload limits;
- timeouts, concurrency controls, circuit breakers, and idempotency;
- distributed tracing with tool name, result status, and latency;
- health/readiness probes and graceful shutdown;
- version compatibility and conformance tests;
- regional placement based on data-residency requirements.

Remote server metadata can advertise a Streamable HTTP endpoint:

```json
{
  "name": "com.example/analytics",
  "version": "2.0.0",
  "remotes": [{
    "type": "streamable-http",
    "url": "https://analytics.example.com/mcp"
  }]
}
```

## How a company uses this

A UAE enterprise exposes approved CRM and analytics tools through an MCP gateway. The gateway validates employee identity, injects tenant scope, blocks unauthorized tool names, and routes calls across several instances. Database row-level security remains the final enforcement layer.

## Common mistakes

- Trusting tool descriptions as authorization.
- Keeping user state only in one instance’s memory.
- Logging bearer tokens or sensitive tool results.
- Treating legacy HTTP+SSE as the recommended remote transport.
- Autoscaling without downstream database and rate-limit protection.

## Interview tip

Say: *“I deploy remote MCP as a stateless Streamable HTTP service behind an authenticated gateway. Authorization is per user and tool, requests are schema-validated and observable, durable state is external, and instances are interchangeable. For 2026-07-28 traffic I account for the stateless protocol and routable MCP headers.”*

