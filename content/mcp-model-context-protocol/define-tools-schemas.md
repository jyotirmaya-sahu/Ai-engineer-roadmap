# Define Tools & Schemas

**What it is:** the craft of declaring an MCP [tool](tools.md) so the model calls it *correctly* — a precise name, a description written for the model, and a tight input **JSON Schema** that constrains what arguments are valid.

## Why it matters for an AI Engineer

The schema and description are the *entire* interface the model sees. If they're loose, the model invents bad arguments and calls tools at the wrong time — and no amount of prompt engineering fixes a badly-defined tool. In practice, tool definition quality is the biggest lever on agent reliability, and it's something you fully control. Interviewers probe this because it's where good AI Engineers separate from people who just glued a library together.

## The mechanism / how it works

Every tool exposes an **`inputSchema`** — a JSON Schema object describing its arguments. With [FastMCP](fastmcp.md) you rarely hand-write it; the framework derives it from your **type hints**, so the schema quality *is* your annotation quality. What you control:

- **Types** — `int`, `str`, `bool`, `list[str]` map to JSON Schema types. The model gets a hard signal about shape.
- **Enums** — the highest-value constraint. `Literal["low","normal","high"]` tells the model the *only* valid values, killing invented ones.
- **Required vs optional** — a default value makes an argument optional; no default makes it required.
- **Descriptions** — per-field docs, and the function docstring becomes the *tool* description. This is the only text the model reads to decide **when** to call the tool. Write it action-first: "Open a support ticket for a customer," not "ticket handler."
- **Structured output** — declare a return type so the tool returns machine-readable JSON, not prose, for downstream code.

The rule of thumb: **constrain everything you can.** Every value the schema *doesn't* forbid is a value the model *can* get wrong.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🐍 typed function<span class="sub">int, Literal[...], defaults</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">📋 JSON Schema<span class="sub">types + enums + required</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🧠 model sees exactly what's valid</span>
  </div>
  <div class="dcap">Tight types become a tight schema — the model can only produce arguments the schema allows.</div>
</div>

## Concrete example

Loose vs tight — same tool, very different reliability:

```python
from typing import Literal
from fastmcp import FastMCP
mcp = FastMCP("crm")

# ❌ loose: model can pass any string for priority, dates in any format
@mcp.tool()
def bad_ticket(customer, subject, priority): ...

# ✅ tight: types, enum, required/optional, model-facing description
@mcp.tool()
def create_ticket(
    customer_id: str,
    subject: str,
    priority: Literal["low", "normal", "high"] = "normal",
) -> dict:
    """Open a support ticket for a customer. Use when the user reports a problem.
    Returns {"ticket_id": str, "status": str}."""
    tid = crm_api.open(customer_id, subject, priority)
    return {"ticket_id": tid, "status": "open"}
```

The `Literal` enum means the model *cannot* send `priority="urgent"` — the schema won't allow it. The docstring tells it *when* to call. The `dict` return gives downstream code structured data.

## How a company uses this

A Dubai logistics firm running an agent over thousands of daily chats traced most of its wrong tool calls to two schema gaps: a free-string `status` field the model filled with invented values, and a vague description that made the model call `reschedule_delivery` when the user only *asked about* a delivery. Adding an `enum` on `status` and rewriting the description to be action-first ("Use only when the user explicitly requests a new delivery time") cut mis-fires sharply — with zero model or prompt changes. Their internal rule now: **every string field that has a fixed set of values must be an enum**, enforced in code review. That single policy did more for agent reliability than any prompt tweak.

## Common mistakes

- **Free-text where an enum belongs.** The #1 cause of invented arguments.
- **Human-flavored descriptions.** "Handles orders" means nothing to the model. Say *what it does and when to call it.*
- **No required/optional discipline.** Missing defaults where things are optional forces the model to guess values it shouldn't provide.
- **Returning prose when structure is needed.** Downstream automation needs a typed return, not a sentence.
- **Kitchen-sink tools.** One tool with fifteen loosely-typed args is harder for the model than three focused tools.

## Interview tip

Say: *"The schema and description are the whole interface the model sees, so I constrain everything I can — enums for fixed-value fields, required vs optional via defaults, and an action-first description that says when to call the tool. Every value the schema doesn't forbid is one the model can get wrong. Most wrong tool calls I've seen were loose schemas, not a weak model."* Naming the enum discipline specifically is the detail that reads as hands-on.
