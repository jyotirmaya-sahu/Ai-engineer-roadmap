# STDIO (local)

**What it is:** the MCP transport where the client launches the server as a **child process on the same machine** and talks to it over standard input/output — the simplest, fastest wiring, ideal for local dev tools.

## Why it matters for an AI Engineer

STDIO is the transport you'll hit first — nearly every local MCP server (filesystem, git, a database on your laptop) uses it. Knowing *why* it's the default for local tools and *where it stops working* (it can't be remote or shared) is a basic competency, and the contrast sets up why [Streamable HTTP](streamable-http.md) exists at all.

## The mechanism / how it works

With STDIO, there's no network. The host **spawns the server as a subprocess** and pipes [JSON-RPC](json-rpc.md) messages through it:

- The client writes requests to the subprocess's **stdin**.
- The server writes responses to its **stdout**.
- Messages are newline-delimited JSON — one JSON-RPC object per line.
- The server uses **stderr** for logging (never stdout — stdout is the protocol channel; logging there corrupts messages).

Because it's just pipes between parent and child, there's no port, no HTTP, no auth handshake, and effectively zero network latency. The server's lifetime is tied to the client: when the host closes the connection, it kills the subprocess. It is inherently **single-client** — one parent, one child — so STDIO servers can't be shared across users or scaled horizontally. That's the fundamental limit, and the reason remote deployments use HTTP instead.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 host process</span>
    <span class="darr">→<span class="lbl">stdin (JSON-RPC)</span></span>
    <span class="dbox blue">🗄️ server subprocess</span>
    <span class="darr">→<span class="lbl">stdout</span></span>
    <span class="dbox green">✅ response</span>
  </div>
  <div class="dcap">The host spawns the server as a child process and pipes JSON-RPC over stdin/stdout — no network, one client.</div>
</div>

## Concrete example

Server side is trivial — just pick the STDIO transport:

```python
from fastmcp import FastMCP
mcp = FastMCP("local-files")

@mcp.tool()
def read_note(name: str) -> str:
    "Read a note from the local notes folder."
    return open(f"/notes/{name}.md").read()

if __name__ == "__main__":
    mcp.run(transport="stdio")     # host will spawn THIS as a subprocess
```

The host is told how to launch it — a command and args, e.g. in [Claude Desktop's](claude-desktop.md) config:

```json
{"mcpServers": {"local-files": {"command": "python", "args": ["server.py"]}}}
```

The host runs that command, connects to the child's stdin/stdout, and the tools appear. Logging goes to stderr:

```python
import sys
print("loaded 42 notes", file=sys.stderr)   # ✅ stderr, not stdout
```

## How a company uses this

A Dubai software team ships an internal STDIO MCP server that wraps their build system and test runner, distributed to every developer's [Claude Code](ide-claude-code.md). STDIO is exactly right here: the server runs *on the developer's machine*, touches *their* local repo, needs *their* local credentials, and has zero network attack surface — there's no port to secure because there's no port. Latency is negligible, so a tight edit-run-fix loop feels instant. The moment they needed the *same* capability as a shared, multi-user service — e.g. a central code-search over all repos — they switched that one to [Streamable HTTP](streamable-http.md), because STDIO's one-process-per-client model can't serve many users or sit behind a load balancer.

## Common mistakes

- **Logging to stdout.** stdout is the JSON-RPC channel; any stray print corrupts the protocol. Use stderr.
- **Trying to make STDIO remote or shared.** It's single-client, same-machine by design — reach for HTTP instead.
- **Forgetting the host controls lifetime.** The server dies when the client disconnects; don't expect it to persist state across sessions.
- **Blocking stdout with buffered writes.** Unflushed buffers can deadlock the pipe; ensure line-buffered output.

## Interview tip

Say: *"STDIO is the local transport — the host spawns the server as a subprocess and pipes newline-delimited JSON-RPC over stdin/stdout, with stderr for logs. Zero network, zero auth, near-zero latency, but strictly one client per process. It's the right default for local dev tools; the second I need a shared or scalable server I switch to Streamable HTTP."* Naming the stdout-is-the-channel gotcha shows you've actually run one.
