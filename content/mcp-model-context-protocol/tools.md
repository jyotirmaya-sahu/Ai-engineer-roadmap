# Tools

**What it is:** the MCP primitive for **actions** — functions the model can *call* to do something with side effects: create an issue, run a query, send a message.

## Why it matters for an AI Engineer

Tools are the primitive you'll use 90% of the time — they're how an LLM stops being a chatbot and starts *acting* on real systems. Getting tool design right (clear names, tight schemas, honest error handling) is the difference between an agent that reliably ships work and one that flails. This is bread-and-butter for the job.

## The mechanism / how it works

A tool is a named function the server advertises, described by a JSON Schema for its inputs. The lifecycle is two calls:

1. **`tools/list`** — the client asks the server what tools exist. The server returns each tool's `name`, `description`, and `inputSchema`. The host injects these into the model's function-calling context so the LLM knows what it can call.
2. **`tools/call`** — when the model decides to use a tool, the client sends `{"name": ..., "arguments": {...}}`. The server executes and returns a result (text, structured JSON, or an error).

The critical property: **tools are model-controlled**. The LLM decides *when* to call one and *with what arguments*. Because tools have side effects, the host should ask the **user** for consent before executing — that's why the host, not the server, owns the trust boundary (see [host/client/server](host-client-server.md)).

Contrast the other data-shaped primitive: [resources](resources.md) are *read-only context the app pulls in*, controlled by the app; tools are *actions the model triggers*. If it changes the world or the model chooses to invoke it, it's a tool.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 model decides</span>
    <span class="darr">→<span class="lbl">tools/call</span></span>
    <span class="dbox orange">🛠️ server executes</span>
    <span class="darr">→</span>
    <span class="dbox blue">🗄️ real system</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ result back to model</span>
  </div>
  <div class="dcap">Tools are model-controlled actions with side effects — the host asks the user before executing.</div>
</div>

## Concrete example

A tool with a typed input and honest errors:

```python
from fastmcp import FastMCP
mcp = FastMCP("crm")

@mcp.tool()
def create_ticket(customer_id: str, subject: str, priority: str = "normal") -> str:
    """Open a support ticket. priority: low | normal | high."""
    if priority not in {"low", "normal", "high"}:
        raise ValueError(f"invalid priority: {priority}")
    ticket_id = crm_api.open(customer_id, subject, priority)
    return f"created ticket {ticket_id}"
```

The type hints (`str`, default `"normal"`) become the JSON Schema automatically, so the model sees exactly what arguments are valid. The docstring becomes the tool `description` — this is the *only* thing the model reads to decide when to call it, so write it for the model, not for humans.

## How a company uses this

A Dubai logistics firm exposes a `reschedule_delivery` tool on its ops MCP server. It's used inside a customer-facing agent handling thousands of chats a day. Two production realities shaped the design: (1) the tool is **idempotent** — calling it twice with the same delivery ID doesn't double-book, because LLMs retry — and (2) it returns a **structured, machine-readable result** (`{"status":"rescheduled","new_slot":"..."}`) so downstream code can act without re-parsing prose. Consent is enforced at the host: a high-value action like a refund tool requires an explicit user click, logged for audit. Bad tool descriptions were their #1 source of wrong calls — tightening one ambiguous description cut mis-fires noticeably.

## Common mistakes

- **Vague descriptions.** "Handles orders" tells the model nothing about *when* to call it. Be specific and action-oriented.
- **Loose schemas.** No enum on `priority` means the model invents values. Constrain inputs.
- **Non-idempotent side effects.** Models retry; a `send_email` tool that fires twice will embarrass you. Design for at-least-once.
- **Returning raw prose when structure is needed.** Downstream automation needs parseable output.
- **Treating read-only data as a tool.** Use [resources](resources.md) for that.

## Interview tip

Say: *"Tools are model-controlled actions with side effects — the model picks the tool and arguments, the host gets user consent, the server executes. The three things I get right are a crisp description (that's all the model reads), a tight input schema with enums, and idempotency because models retry."* Contrasting tools (model-controlled actions) with resources (app-controlled read-only data) in one breath shows you know the primitive taxonomy cold.
