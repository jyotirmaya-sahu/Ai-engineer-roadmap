# Auth

**What it is:** how a **remote** MCP server verifies *who* is calling before running tools — in modern MCP, OAuth 2.1 with the server acting as an OAuth **resource server** that validates bearer tokens.

## Why it matters for an AI Engineer

The moment a server leaves your laptop, "anyone who finds the URL can run my tools" is unacceptable — especially for Dubai finance/gov roles where every tool touches regulated data. Auth is the primitive that makes remote MCP shippable. Knowing the current model (OAuth 2.1, bearer tokens, scopes) rather than a hand-rolled API key is a real enterprise-readiness signal.

## The mechanism / how it works

[STDIO](stdio-local.md) servers barely need auth — they're a local subprocess already inside the user's trust boundary. **Remote** ([Streamable HTTP](streamable-http.md)) servers do, because they're reachable over the network. MCP's authorization model is built on **OAuth 2.1**:

- The MCP server is an **OAuth resource server**: it doesn't issue credentials, it *validates* them. Every request carries an `Authorization: Bearer <token>` header.
- Tokens come from an **authorization server** (your identity provider — Entra ID, Auth0, Cognito, etc.). The MCP server publishes **protected-resource metadata** so a client can *discover* which authorization server to use and what **scopes** exist.
- On each request the server **validates the token**: signature, expiry, audience, and scopes. Scopes are the fine-grained part — a token might grant `crm:read` but not `crm:write`, so a read tool succeeds and a write tool is rejected.
- This rides on the [stateless](stateless-servers-modern-default.md) model cleanly: the bearer token is *in every request*, so any instance behind a load balancer can validate it independently — no session needed.

Auth answers *who are you and what may you do*. It pairs with [roots enforcement](roots-enforcement-security.md), which bounds *where* a tool may act. You want both.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🤖 client</span>
    <span class="darr">→<span class="lbl">Bearer token</span></span>
    <span class="dbox blue">🗄️ MCP server (resource server)</span>
    <span class="darr">→<span class="lbl">validate: sig · exp · audience · scope</span></span>
    <span class="dbox green">✅ scoped tool runs</span>
    <span class="dbox orange">🚫 else 401 / 403</span>
  </div>
  <div class="dcap">The server validates a bearer token per request and checks scopes — stateless-friendly, since the token is self-contained.</div>
</div>

## Concrete example

A server that validates a bearer token and enforces a scope per tool:

```python
from fastmcp import FastMCP
mcp = FastMCP("crm")

def require(scope, ctx):
    claims = validate_jwt(ctx.request.headers["authorization"])  # sig, exp, audience
    if scope not in claims.get("scopes", []):
        raise PermissionError(f"missing scope {scope}")   # -> 403
    return claims

@mcp.tool()
def lookup(customer_id: str, ctx) -> str:
    require("crm:read", ctx)                # read scope
    return crm_api.fetch(customer_id)

@mcp.tool()
def refund(customer_id: str, amount_aed: int, ctx) -> str:
    require("crm:write", ctx)               # stricter scope for a mutation
    return crm_api.refund(customer_id, amount_aed)
```

A token with only `crm:read` can look up customers but is rejected (403) if the model tries to `refund` — least privilege enforced at the tool level.

## How a company uses this

A Dubai bank runs its MCP servers behind OAuth 2.1 tied to corporate Entra ID. Auth carries the whole enterprise-readiness story: every tool call is attributable to a real identity (audit), scopes give **least privilege** (the customer-support assistant's token has `read` scopes but not `refund`), and short-lived tokens limit blast radius if one leaks. Because the servers are [stateless](stateless-servers-modern-default.md), token validation happens independently on whichever autoscaled instance gets the request — no shared session store for auth. Their hard rules: **no long-lived static API keys** (rotation nightmare, no per-tool scoping), tokens scoped to the *narrowest* set of tools that job needs, and 401/403 responses logged so a spike of auth failures pages someone. This scope discipline is also a defense against [excessive agency](../llm-security-guardrails/excessive-agency.md) — even a hijacked agent can't call tools its token lacks scope for.

## Common mistakes

- **Hand-rolled static API keys instead of OAuth 2.1.** No expiry, no per-tool scopes, painful rotation.
- **No scope granularity.** One all-powerful token means a compromised read-only assistant can suddenly write.
- **Not validating audience/expiry.** Accepting any signed token, or an expired one, defeats the point.
- **Auth on the client instead of the server.** The server owns validation — it's the resource server. The client just presents the token.
- **Leaking tokens in logs.** Never log the `Authorization` header.

## Interview tip

Say: *"Remote MCP auth is OAuth 2.1 — the server is a resource server that validates a bearer token per request, checking signature, expiry, audience, and scopes, and publishes protected-resource metadata so clients discover the authorization server. Scopes give least privilege: a support assistant's token has crm:read but not crm:write. It rides the stateless model perfectly because the token is self-contained, so any instance can validate it."* Naming OAuth 2.1 + scopes (not "an API key") is the enterprise-ready signal.
