# Resources

**What it is:** the MCP primitive for **read-only data** — files, DB rows, documents, API payloads the app pulls in as context. No side effects; nothing changes the world.

## Why it matters for an AI Engineer

Resources are how you feed an LLM *grounding context* through MCP without turning everything into a tool call. Knowing when data should be a resource vs a tool is a design decision interviewers watch for — it signals you understand the control model (who decides what enters the prompt) rather than reaching for tools reflexively.

## The mechanism / how it works

A resource is identified by a **URI** — a scheme + path the server defines, like `file:///repo/README.md`, `policy://golden-visa`, or `db://customers/4821`. The lifecycle:

1. **`resources/list`** — the client asks what resources exist. The server returns each one's `uri`, `name`, `description`, and `mimeType`.
2. **`resources/read`** — the client fetches a specific URI; the server returns its contents (text or binary blob).

The defining property: **resources are application-controlled**, not model-controlled. This is the key contrast with [tools](tools.md). A tool is invoked when the *model* decides to. A resource is pulled into context when the *host app (or user)* decides to — for example, when you `@`-mention a file in Claude Desktop, or the app attaches the current document automatically. The model doesn't "call" a resource; the app hands it the content.

Servers can also expose **resource templates** — parameterized URIs like `db://customers/{id}` — so the client can construct a specific resource on demand. And resources can be **subscribed to**: the server sends a `notifications/resources/updated` message when the underlying data changes, so long-lived clients stay fresh.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 app / user picks</span>
    <span class="darr">→<span class="lbl">resources/read</span></span>
    <span class="dbox blue">🗄️ server returns contents</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 dropped into model context</span>
  </div>
  <div class="dcap">Resources are app-controlled read-only context — the app decides what enters the prompt, not the model.</div>
</div>

## Concrete example

```python
from fastmcp import FastMCP
mcp = FastMCP("golden-visa")

@mcp.resource("policy://golden-visa")
def policy() -> str:
    "The current UAE Golden Visa policy text."
    return open("golden_visa.md").read()

# Parameterized template: one definition serves every customer id
@mcp.resource("customer://{customer_id}")
def customer(customer_id: str) -> str:
    "Read-only customer profile."
    return crm_api.fetch(customer_id)   # returns text/JSON, no mutation
```

`policy://golden-visa` is a fixed resource; `customer://{id}` is a template the client fills in. Neither *does* anything — they only return data.

## How a company uses this

A Dubai bank's compliance assistant exposes regulatory circulars as resources (`circular://sama/2026-14`) and account data as templated resources (`account://{iban}`). The distinction matters in production: because resources are *read-only and app-controlled*, the security team can allow the assistant to *read* an account without ever letting the model *mutate* it — mutations are separate, consent-gated [tools](tools.md). This clean read/write split is a real audit win: read paths and write paths are different primitives with different approval flows. At scale, hot resources (frequently-read policy docs) are cached at the server so a spike in reads doesn't hammer the source system.

## Common mistakes

- **Making read-only data a tool.** If nothing changes and the *app* decides to pull it in, it's a resource. Forcing it into a tool gives the model needless control and muddies audit.
- **Putting side effects in a resource read.** A `resources/read` must be safe to call repeatedly — no writes, no charges.
- **Forgetting `mimeType`.** Clients render/handle content by MIME type; omitting it breaks non-text resources.
- **Not using templates.** Defining one resource per customer id instead of a `{id}` template is the resource version of copy-paste.

## Interview tip

Say: *"Resources are read-only, app-controlled context identified by a URI — the app or user decides what enters the prompt, not the model. That's the exact opposite of tools, which are model-controlled actions with side effects. The split lets me give an assistant read access to sensitive data while keeping every mutation behind a separate consent-gated tool."* Naming the *control direction* (app vs model) is the insight interviewers want.
