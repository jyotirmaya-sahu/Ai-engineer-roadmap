# Log / Progress Notifications

**What it is:** the way an MCP server sends **updates back to the client mid-task** — progress ("42% done") and log messages ("fetched 300 rows") — using [JSON-RPC](json-rpc.md) notifications so long-running tools don't look frozen.

## Why it matters for an AI Engineer

Real tools take seconds or minutes — a report, a big query, a crawl. Without progress, the UI hangs and users (and agents) assume it broke. Progress/log notifications are what make long-running MCP tools *feel* alive and what make them *debuggable* in production. It's a small feature with an outsized effect on perceived reliability.

## The mechanism / how it works

Notifications are [JSON-RPC](json-rpc.md) messages with **no `id`** — fire-and-forget, no response expected. MCP defines two kinds flowing server→client:

- **Progress notifications** (`notifications/progress`) — sent while a tool runs, carrying a `progress` value (and optionally `total`) tied to a **progress token** the client attached to the original request. The client renders a live bar. You call this repeatedly as work advances.
- **Log notifications** (`notifications/message`) — structured log entries with a **level** (`debug`, `info`, `warning`, `error`) and text. These surface in the host's logs, not necessarily the user's face — they're for observability and debugging.

The transport detail matters: to deliver *multiple* messages during one request, the server needs a channel that can send more than one reply. Over [Streamable HTTP](streamable-http.md) that's the optional **SSE stream** on the response. Over pure JSON (or a [stateless](stateless-servers-modern-default.md) `json_response=True` server), a single request returns a single body — so long-lived interactive progress is better modeled as [elicitation](elicitation.md)/re-issued requests, while quick log lines still work. In [FastMCP](fastmcp.md) you emit both via the `Context` object.

<div class="diagram">
  <div class="flow v">
    <span class="dbox purple">🛠️ long-running tool</span>
    <span class="darr">↓ notifications/progress (no id)</span>
    <span class="dbox orange">📊 25% → 50% → 75%</span>
    <span class="darr">↓ notifications/message (info/warn)</span>
    <span class="dbox blue">📝 "fetched 300 rows"</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ final result</span>
  </div>
  <div class="dcap">The server streams id-less progress and log notifications while working, then returns the final result.</div>
</div>

## Concrete example

```python
from fastmcp import FastMCP
mcp = FastMCP("reports")

@mcp.tool()
async def build_report(quarter: str, ctx) -> str:
    "Build a quarterly report (slow) with live progress and logs."
    rows = fetch_rows(quarter)
    total = len(rows)
    await ctx.info(f"fetched {total} rows for {quarter}")      # log notification
    for i, row in enumerate(rows):
        process(row)
        if i % 100 == 0:
            await ctx.report_progress(progress=i, total=total)  # progress notification
    await ctx.report_progress(progress=total, total=total)
    return f"report ready: {total} rows processed"
```

`ctx.report_progress` fires id-less progress messages the client turns into a bar; `ctx.info` writes a structured log line for observability. The tool no longer looks frozen for the minute it runs.

## How a company uses this

A Dubai enterprise's analytics MCP server runs report tools that take 30–90 seconds. Progress notifications drove a real UX win: before, users cancelled long reports thinking the agent had hung; after adding a live progress bar, cancellations dropped sharply and support tickets about "stuck" reports mostly disappeared. The **log** notifications feed their observability stack — every tool run emits `info`/`warning` lines with timing, so when a report is slow they can see *which phase* (fetch vs process) blew the budget instead of guessing. In production these logs, keyed by the JSON-RPC method, become a per-tool latency dashboard. They keep log volume disciplined (`debug` off in prod) so notifications don't drown the channel.

## Common mistakes

- **No progress on slow tools.** A 60-second tool with no feedback reads as broken and gets cancelled.
- **Expecting a reply to a notification.** Notifications have no `id`; don't await one.
- **Over-logging at `debug` in production.** Floods the channel and adds overhead; gate verbosity by level.
- **Assuming progress streams work on a plain JSON stateless server.** Multi-message progress needs the SSE mode; on stateless `json_response` servers, model long interactions as re-issued requests instead.
- **Logging secrets.** Log lines can surface in host logs — never emit tokens or PII.

## Interview tip

Say: *"Progress and log notifications are id-less JSON-RPC messages the server sends mid-tool-call — progress for a live bar, leveled logs for observability. They keep long-running tools from looking frozen and give me per-phase timing to debug latency. Delivering multiple messages needs the streaming SSE mode; on a plain-JSON stateless server I model long interactions as re-issued requests instead."* Tying the delivery mechanism to the transport choice shows you understand how notifications actually reach the client.
