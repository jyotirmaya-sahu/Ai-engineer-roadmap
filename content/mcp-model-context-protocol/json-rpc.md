# JSON-RPC

**What it is:** the **message format underneath every MCP interaction** — JSON-RPC 2.0, a small, decades-old convention for "call a remote method with these params, get a result or an error back."

## Why it matters for an AI Engineer

JSON-RPC is the wire format you'll see in every MCP log, every debug trace, every packet capture. When a server "doesn't work," reading the raw JSON-RPC is how you find out whether the request even arrived, what method was called, and what error came back. It's also *why* MCP is transport-agnostic — the same messages ride [STDIO](stdio-local.md) or [Streamable HTTP](streamable-http.md) unchanged.

## The mechanism / how it works

JSON-RPC 2.0 defines just a few message shapes, all plain JSON objects with `"jsonrpc": "2.0"`:

- **Request** — has a `method`, optional `params`, and an `id`. Expects a reply.
  ```json
  {"jsonrpc":"2.0","id":7,"method":"tools/call",
   "params":{"name":"lookup","arguments":{"customer_id":"4821"}}}
  ```
- **Response** — carries the matching `id` and *either* a `result` *or* an `error` (never both).
  ```json
  {"jsonrpc":"2.0","id":7,"result":{"content":[{"type":"text","text":"Acme Corp"}]}}
  ```
- **Error** — a structured failure with a `code` and `message`.
  ```json
  {"jsonrpc":"2.0","id":7,"error":{"code":-32602,"message":"invalid params"}}
  ```
- **Notification** — a request with **no `id`** — fire-and-forget, no reply expected. MCP uses these for [progress and log notifications](log-progress-notifications.md) and for `notifications/roots/list_changed`.

The `id` is what lets responses match requests even when many are **in flight at once** — JSON-RPC is inherently async and can multiplex. Every MCP method name is just a JSON-RPC `method` string: `initialize`, `tools/list`, `tools/call`, `resources/read`, `prompts/get`, `sampling/createMessage`, `elicitation/create`. Once you see that, MCP stops being magic — it's a fixed menu of JSON-RPC calls.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🤖 client</span>
    <span class="darr">→<span class="lbl">request {id, method, params}</span></span>
    <span class="dbox blue">🗄️ server</span>
    <span class="darr">→<span class="lbl">response {same id, result|error}</span></span>
    <span class="dbox green">✅ matched by id</span>
  </div>
  <div class="dcap">Every MCP call is a JSON-RPC message; the id pairs each response to its request, so many can be in flight.</div>
</div>

## Concrete example: a full initialize exchange

The very first messages of any MCP session are just JSON-RPC:

```json
// client → server
{"jsonrpc":"2.0","id":1,"method":"initialize",
 "params":{"protocolVersion":"2026-07-28",
           "capabilities":{"roots":{}},
           "clientInfo":{"name":"claude-desktop","version":"1.0"}}}

// server → client
{"jsonrpc":"2.0","id":1,
 "result":{"protocolVersion":"2026-07-28",
           "capabilities":{"tools":{},"resources":{}},
           "serverInfo":{"name":"crm","version":"0.1"}}}

// client → server (a notification — no id, no reply)
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

You'll almost never hand-write this — the SDK does — but being able to *read* it is what makes debugging fast.

## How a company uses this

A Dubai platform team debugging a flaky remote MCP server captured the raw JSON-RPC at their gateway. The tool "wasn't being called," but the trace showed the `tools/call` request *did* arrive — the server returned `error: -32602 invalid params` because the model sent `customerId` while the schema declared `customer_id`. Reading the wire format turned a vague "the agent is broken" ticket into a one-line schema fix in minutes. In production they log every JSON-RPC `method` + `id` + latency, which gives them a clean per-method dashboard (call counts, error codes, p95 latency) for free — because the protocol is uniform, one log format covers every server.

## Common mistakes

- **Returning both `result` and `error`.** A response has exactly one. Malformed responses break clients.
- **Expecting a reply to a notification.** No `id` means no response — don't await one.
- **Assuming request order = response order.** They're matched by `id`, not sequence; responses can arrive out of order.
- **Using a non-standard error code.** JSON-RPC reserves a range (e.g. `-32600`..`-32603`); use sensible codes so clients can react.

## Interview tip

Say: *"MCP rides on JSON-RPC 2.0 — every interaction is a request with a method, params, and an id, answered by a response carrying that id with a result or an error, plus id-less notifications for fire-and-forget events. The id lets calls multiplex, and the format is transport-agnostic, so the same messages work over STDIO or HTTP. When a server misbehaves, I read the raw JSON-RPC first — the method and error code usually pinpoint it."* That last line signals real debugging experience.
