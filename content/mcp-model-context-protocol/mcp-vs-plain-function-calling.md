# MCP vs Plain Function Calling

**What it is:** function calling is *how one model invokes one tool you hand-wired into your code*; MCP is *the standard that makes those tools reusable across apps, teams, and vendors*. MCP sits on top of function calling — it doesn't replace it.

## Why it matters for an AI Engineer

This is the most common MCP interview trap: candidates say "MCP is just function calling with extra steps" and lose the plot. The truth is they operate at different layers — function calling is the *low-level mechanism*, MCP is the *distribution and standardization layer*. Knowing exactly where one ends and the other begins is what separates someone who's read the marketing from someone who's shipped both.

## The mechanism / how it works

**Function calling** is a model capability. You give the model a JSON schema of a function; the model, mid-response, emits a structured request like `{"name":"get_weather","arguments":{"city":"Dubai"}}`. *Your* code parses that, runs the actual function, and feeds the result back. The model never runs code — it only *decides which function and with what arguments*. The wiring — schema definition, execution, result plumbing — is all in your application, hand-written, and lives only in that app.

**MCP** wraps that wiring in a reusable, discoverable package. Instead of hard-coding the weather function inside every app, you build one weather **server**. Any MCP host connects, calls `tools/list` to *discover* what's available at runtime, and calls `tools/call` to run one. Under the hood the host still turns that into an ordinary function-calling exchange with its own LLM — but the tool definition, execution, and credentials now live in a standalone server that *every* app can share.

So the relationship is a stack, not a rivalry:

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple wide">🔌 MCP — standardization + distribution layer<span class="sub">discover, share across apps/vendors, auth, transports</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange wide">🛠️ Function calling — the per-call mechanism<span class="sub">model picks a function + arguments; your code runs it</span></span>
  </div>
  <div class="dcap">Every MCP tool call still bottoms out in a function call — MCP is the reusable layer on top.</div>
</div>

## Side-by-side

| | Plain function calling | MCP |
|---|---|---|
| **Scope** | one app, hard-wired tools | tools shared across many apps/hosts |
| **Discovery** | static — coded at build time | dynamic — `tools/list` at runtime |
| **Who maintains the tool** | every app re-implements it | one server, reused everywhere |
| **Auth / credentials** | scattered in each app | centralized in the server ([auth](auth.md)) |
| **Vendor coupling** | tied to one model's format | vendor-neutral ([open standard](open-standard.md)) |
| **Best for** | one quick tool in one app | org-wide, reusable, multi-app tooling |

## Concrete example

Raw function calling in one app — the definition and execution are inline and local:

```python
tools = [{"type":"function","function":{
    "name":"eligibility",
    "parameters":{"type":"object","properties":{"salary_aed":{"type":"integer"}}}}}]
resp = client.chat.completions.create(model="...", messages=msgs, tools=tools)
# YOU parse resp, run eligibility(), feed the result back — all inside THIS app.
```

The same capability as an MCP tool — defined once, discoverable by any host:

```python
from fastmcp import FastMCP
mcp = FastMCP("golden-visa")

@mcp.tool()
def eligibility(salary_aed: int) -> str:
    "Check UAE Golden Visa eligibility by monthly salary."
    return "eligible" if salary_aed >= 30000 else "not eligible"
```

The MCP host handles discovery and turns `eligibility` into a function-calling request to *its* model — you wrote zero client glue, and a second app gets the tool for free.

## How a company uses this

A Dubai SaaS team started with function calling: each of their three products hard-coded a `lookup_customer` tool against the CRM. Three copies, three bugs, three security reviews. They kept function calling *inside* each product (nothing wrong with it there) but moved the shared CRM tools into one MCP server. Now function calling is still the runtime mechanism, but the *definition* lives once. When the CRM API changed, they patched one server instead of three products — and a brand-new internal assistant picked up all the tools with no glue code.

## Common mistakes

- **"MCP replaces function calling."** It doesn't — MCP tools *become* function calls at execution. They're different layers.
- **Reaching for MCP for a single throwaway tool in one app.** That's over-engineering; plain function calling is the lazy right answer there.
- **Thinking discovery is free with function calling.** It's static; MCP's `tools/list` is what enables runtime discovery.

## Interview tip

Say: *"Function calling is the mechanism — the model picks a function and arguments, my code runs it. MCP is the standardization layer on top: the tool lives in a shared server, hosts discover it at runtime, and it's reusable across apps and vendors. Every MCP tool call still bottoms out in a function call."* Then add the judgment: *"For one tool in one app I'd just use function calling — MCP earns its keep when tools are shared across surfaces."*
