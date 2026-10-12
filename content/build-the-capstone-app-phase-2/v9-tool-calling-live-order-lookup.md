# v9 · Tool Calling & Live Order Lookup

**What you'll build:** HelpDesk can answer “Where is order DXB-1042?” by asking your backend for current order data. The model may request a tool, but only your server validates and executes it.

## Why this version

Through v8, HelpDesk can talk convincingly but cannot know changing business facts. Putting order data in the prompt would become stale and could expose another customer's information. Tool calling gives the model a controlled doorway into live systems. The model proposes a structured call; your application remains the authority.

## The mechanism

Define a narrow tool schema named `get_order_status` with one required `order_id`. Send that schema with the conversation. The model either returns normal text or a tool call containing JSON arguments. Your server then performs four steps: parse the JSON, validate it, authorize the requested order against the signed-in user, and execute the lookup. Finally, append the tool result to the conversation and ask the model to explain it.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">customer question</span><span class="darr">→</span><span class="dbox purple">model proposes tool call</span><span class="darr">→</span><span class="dbox orange">validate + authorize</span><span class="darr">→</span><span class="dbox blue">orders database</span><span class="darr">→</span><span class="dbox green">grounded answer</span>
  </div>
  <div class="dcap">The model chooses a capability; trusted application code decides whether it may run.</div>
</div>

## Concrete implementation

```python
from pydantic import BaseModel, Field

class OrderLookup(BaseModel):
    order_id: str = Field(pattern=r"^DXB-[0-9]{4,10}$")

ORDER_TOOL = {
    "type": "function",
    "name": "get_order_status",
    "description": "Return status for one order owned by the signed-in user.",
    "parameters": {
        "type": "object",
        "properties": {"order_id": {"type": "string"}},
        "required": ["order_id"],
        "additionalProperties": False,
    },
    "strict": True,
}

def execute_order_lookup(raw_args: str, user_id: str) -> dict:
    args = OrderLookup.model_validate_json(raw_args)
    order = load_order(args.order_id)
    if not order or order.user_id != user_id:
        return {"error": "order_not_found"}  # never reveal ownership
    return {"order_id": order.id, "status": order.status,
            "eta": order.eta.isoformat() if order.eta else None}
```

This phase standardizes HelpDesk on the Responses API. Send `ORDER_TOOL` in `tools`, set `parallel_tool_calls=False` for the beginner implementation, find the `function_call` item in `response.output`, validate/execute it, then make the second call with the first output plus one `function_call_output` item containing the same `call_id`. Cap the flow at two model round trips and one tool execution. Keep `load_order` deterministic and tenant-scoped through the v8.1 `TenantContext`; it must not call another model.

The endpoint is `POST /api/chat`; it keeps the existing streaming UI but emits a safe `tool_status` event while the order lookup runs. Acceptance requires a successful owned-order lookup, an indistinguishable not-found response for another user's order, malformed-argument rejection, and a simulated tool timeout.

## How a company uses this

A support product may expose dozens of internal actions, but each should be small and permission-scoped: check order status, read return eligibility, or create a draft ticket. A read tool can return only the fields needed for an answer. A write tool such as “issue refund” should require a confirmation screen and idempotency key. Log the user, tool name, validated arguments, outcome, and duration without logging sensitive payloads.

## Common mistakes

- Executing model-produced JSON without schema validation.
- Trusting an `order_id` without checking ownership for the authenticated user.
- Letting the tool return an entire database record containing addresses or payment data.
- Treating tool descriptions as security controls; authorization belongs in code.
- Allowing an unbounded model→tool loop.

## Interview tip

Explain the trust boundary: *“The model can request a tool, but it never receives database credentials and never authorizes itself. My server validates arguments, checks object ownership, executes a narrow function, and returns a minimal result.”*

## Practice — assignments

1. Add the order-status tool and render its answer in the existing chat.
2. Reject malformed order identifiers before querying the database.
3. Prove that one user cannot retrieve another user's order.
4. Add a read-only return-eligibility tool.
5. Add an audit event for every attempted tool execution.
6. Simulate a tool timeout and return a useful customer-facing response.
7. Add a confirmation step before any state-changing tool.
