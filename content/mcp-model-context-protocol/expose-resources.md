# Expose Resources

**What it is:** the server-side task of publishing read-only data as MCP [resources](resources.md) — giving each piece a URI, a MIME type, and (when many share a shape) a templated URI so clients can pull grounding context in.

## Why it matters for an AI Engineer

Exposing resources well is how you feed an LLM the *right* context without turning every read into a tool call. Done poorly — no MIME types, one hard-coded resource per record, sensitive data readable by default — it becomes a data-leak and rendering mess. Done well, it's a clean, cacheable, auditable read layer. This is the "build the RAG/context side of MCP" skill.

## The mechanism / how it works

To expose a resource you provide three things:

1. **A URI** — a scheme + path *you* design: `policy://golden-visa`, `file:///repo/README.md`, `customer://4821`. The scheme groups related resources.
2. **Contents + a `mimeType`** — the actual bytes/text plus a MIME type (`text/markdown`, `application/json`, `image/png`) so the client renders/handles it correctly.
3. **Discovery metadata** — a `name` and `description` returned by `resources/list`.

Two patterns do most of the work:

- **Fixed resources** — one URI, one function: `policy://golden-visa`. Good for singletons.
- **Resource templates** — a parameterized URI like `customer://{id}`. You write *one* function; the client fills in `{id}` to read any customer. This is how you expose a whole table without a function per row.

You can also **notify on change**: send `notifications/resources/updated` (a [JSON-RPC notification](json-rpc.md)) when the underlying data changes, and subscribed clients re-read. Because [FastMCP](fastmcp.md) wires the JSON-RPC for you, exposing a resource is just a decorated function.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ data source</span>
    <span class="darr">→<span class="lbl">@mcp.resource("customer://{id}")</span></span>
    <span class="dbox purple">🔌 URI + mimeType + template</span>
    <span class="darr">→<span class="lbl">resources/read</span></span>
    <span class="dbox green">🧠 pulled into model context</span>
  </div>
  <div class="dcap">You give data a URI and a MIME type; a template exposes a whole table with one function.</div>
</div>

## Concrete example

```python
import json
from fastmcp import FastMCP
mcp = FastMCP("crm")

# Fixed singleton resource
@mcp.resource("policy://golden-visa", mime_type="text/markdown")
def policy() -> str:
    "Current UAE Golden Visa policy."
    return open("golden_visa.md").read()

# Template: one function serves every customer id, returned as JSON
@mcp.resource("customer://{customer_id}", mime_type="application/json")
def customer(customer_id: str) -> str:
    "Read-only customer profile (no PII fields)."
    row = crm_api.fetch(customer_id)
    safe = {k: row[k] for k in ("id", "name", "tier", "region")}   # drop PII
    return json.dumps(safe)
```

The template means one function exposes the whole customer table; the explicit field allow-list keeps sensitive columns out of the model's context by construction.

## How a company uses this

A Dubai bank exposes regulatory circulars (`circular://sama/{id}`, `text/markdown`) and account summaries (`account://{iban}`, `application/json`) as resources to its compliance assistant. Three production decisions shaped it: (1) **field-level allow-listing** in the resource function so PII never enters the prompt — a read-side guardrail that satisfies auditors; (2) **caching** the hot policy resources at the server so a spike of thousands of reads/hour doesn't hammer the source system (policy text changes rarely, so a short TTL is safe); and (3) **change notifications** so when a circular is updated, subscribed assistants re-read within seconds instead of serving stale guidance. The clean read/write split — resources are read-only, mutations are separate [tools](tools.md) — means the assistant can *read* an account without any path to *modify* it.

## Common mistakes

- **Omitting `mimeType`.** Clients render by MIME type; missing it breaks JSON/image resources.
- **A function per record instead of a template.** Use `{id}` templates — hard-coding one resource per row is copy-paste at scale.
- **Leaking sensitive fields.** A resource read dumps whatever you return into the model's context. Allow-list fields; don't return raw rows.
- **Putting side effects in a read.** `resources/read` must be safe to repeat — no writes, no charges. Actions belong in tools.
- **No caching on hot resources.** Frequently-read, rarely-changing data should be cached at the server.

## Interview tip

Say: *"To expose a resource I give it a URI and a MIME type, and use templated URIs like customer://{id} so one function serves a whole table. I keep resources strictly read-only — mutations are separate tools — allow-list fields so PII never enters the prompt, cache hot resources, and fire resources/updated notifications when data changes so clients re-read."* The PII allow-listing and caching points show you're thinking about the *production* read path, not just the API.
