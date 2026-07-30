# FastMCP

**What it is:** the high-level Python framework for building MCP servers — decorate a function with `@mcp.tool()` and it becomes a fully-specified MCP tool, schema and all. It's the fastest way from "a Python function" to "a server any host can call."

## Why it matters for an AI Engineer

FastMCP is what you'll actually type. It hides the [JSON-RPC](json-rpc.md) plumbing, generates schemas from your type hints, and handles every [transport](stdio-local.md) with one argument. Being able to stand up a working server in ten lines in an interview — and knowing what FastMCP does *for* you under the hood — is a concrete, demonstrable skill.

## The mechanism / how it works

Writing an MCP server by hand means implementing the JSON-RPC methods (`initialize`, `tools/list`, `tools/call`, `resources/read`, …), generating JSON Schemas, and wiring a transport. FastMCP collapses all of that into decorators:

- **`@mcp.tool()`** — registers a [tool](tools.md). FastMCP reads the function's **type hints** to build the `inputSchema` and the **docstring** to build the `description`. When a client calls `tools/list`, FastMCP answers from this registry; when it calls `tools/call`, FastMCP validates arguments against the schema, runs your function, and formats the result.
- **`@mcp.resource(uri)`** — registers a [resource](resources.md), including templated URIs like `customer://{id}`.
- **`@mcp.prompt()`** — registers a [prompt](prompts.md) template.
- **`mcp.run(transport=...)`** — picks the transport: `"stdio"` for local, `"streamable-http"` for remote, with `stateless_http=True` for the [stateless](stateless-servers-modern-default.md) default.

You write business logic; FastMCP owns the protocol. It also gives you a `Context` object (`ctx`) for advanced primitives — `ctx.sample()` for [sampling](sampling.md), `ctx.elicit()` for [elicitation](elicitation.md), `ctx.list_roots()` for [roots](roots.md), and progress/log helpers.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🐍 plain Python fn + type hints</span>
    <span class="darr">→<span class="lbl">@mcp.tool()</span></span>
    <span class="dbox purple">⚙️ FastMCP<span class="sub">auto schema + JSON-RPC + transport</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ MCP server any host can call</span>
  </div>
  <div class="dcap">Decorators turn ordinary functions into MCP primitives — FastMCP generates the schema and owns the protocol.</div>
</div>

## Concrete example

A complete, runnable server — tool, resource, and transport in ~12 lines:

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
    mcp.run(transport="streamable-http", stateless_http=True, json_response=True)
```

The `salary_aed: int` hint becomes the tool's input schema automatically; the docstring becomes the description the model reads. You never wrote a line of JSON-RPC.

## How a company uses this

A Dubai enterprise's platform team standardized on FastMCP for every internal server. The payoff is *consistency at scale*: because the framework auto-generates schemas and handles transport, a backend team wrapping their service in an MCP server writes only the tool logic — and every server behaves identically for [auth](auth.md), [logging](log-progress-notifications.md), and transport. They flipped their whole fleet from session-based to [stateless](stateless-servers-modern-default.md) by changing one argument per server. FastMCP's uniformity is also an audit win: security reviews a known framework once, not a dozen bespoke JSON-RPC implementations. (FastMCP is Python; there are official SDKs in TypeScript and other languages that follow the same decorator-style pattern for teams not on Python.)

## Common mistakes

- **Skipping type hints.** No hints = no schema = the model can't tell what arguments are valid. Always annotate.
- **Weak docstrings.** The docstring *is* the tool description the model reads — vague docstrings cause wrong calls.
- **Blocking the event loop.** In an async server, a synchronous slow call (a big DB query) stalls everything; use async I/O for remote servers under load.
- **Hardcoding the transport.** Take it from config so the same code runs STDIO in dev and stateless HTTP in prod.

## Interview tip

Say: *"FastMCP is the Python framework for MCP servers — I decorate a function with @mcp.tool() and it derives the JSON Schema from the type hints and the description from the docstring, then mcp.run() handles the transport, including stateless HTTP with one flag. It gives me a Context for sampling, elicitation, and roots. It means I write business logic, not JSON-RPC."* Then actually offer to write the ten-line server — showing you can is more convincing than describing it.
