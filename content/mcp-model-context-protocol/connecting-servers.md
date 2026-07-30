# Connecting Servers

**What it is:** the practical act of **wiring a host to a server** — declaring how to reach it ([STDIO](stdio-local.md) command or [Streamable HTTP](streamable-http.md) URL), running the [initialize](json-rpc.md) handshake, and discovering its capabilities so its tools appear.

## Why it matters for an AI Engineer

"It doesn't connect" is the single most common MCP failure, and it's almost always in this wiring step: wrong command, unreachable URL, missing [auth](auth.md), or a version mismatch. Being able to reason through the connection lifecycle — and read the handshake — is what turns a frustrating hour into a two-minute fix. It's the debugging backbone of everything else in this node.

## The mechanism / how it works

Connecting is the same lifecycle regardless of host ([Claude Desktop](claude-desktop.md), [IDE](ide-claude-code.md), or a [custom client](custom-clients.md)):

1. **Declare how to reach the server.**
   - **Local ([STDIO](stdio-local.md)):** a `command` + `args`. The host *spawns* it as a subprocess. Failure modes: command not on PATH, wrong interpreter, relative path.
   - **Remote ([Streamable HTTP](streamable-http.md)):** a URL like `https://crm.internal/mcp`, plus [auth](auth.md) headers. Failure modes: unreachable host, TLS, 401, or the deprecated transport.
2. **`initialize` handshake.** The client sends its `protocolVersion` + capabilities; the server replies with its version + capabilities. If versions differ, they **negotiate a common one**. A mismatch that can't be reconciled is a connection error — not a runtime bug.
3. **`notifications/initialized`.** The client signals it's ready.
4. **Discovery.** The client calls `tools/list`, `resources/list`, `prompts/list`. Now the capabilities surface in the host.

If any step fails, the tools simply never appear — which is why "no tools showed up" is a *connection* diagnosis, not a tool bug.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📋 declare command/URL + auth</span>
    <span class="darr">→</span>
    <span class="dbox orange">🤝 initialize<span class="sub">negotiate version</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">✅ initialized</span>
    <span class="darr">→</span>
    <span class="dbox green">🔍 tools/resources/prompts appear</span>
  </div>
  <div class="dcap">Connect = declare reachability → handshake + version negotiation → discovery. Any break and no tools show up.</div>
</div>

## Concrete example

Same server, two hosts. Local via [Claude Desktop](claude-desktop.md) config:

```json
{ "mcpServers": {
    "crm": { "command": "python", "args": ["/abs/path/crm_server.py"] } } }
```

Remote via the CLI in [Claude Code](ide-claude-code.md):

```bash
claude mcp add --transport http crm https://crm.internal/mcp \
  --header "Authorization: Bearer $CRM_TOKEN"
```

Debugging when it doesn't connect — check the handshake actually completed:

```bash
# does the server even start and speak MCP?
python /abs/path/crm_server.py   # STDIO: should wait on stdin, not crash
curl -i https://crm.internal/mcp # HTTP: expect a JSON-RPC-capable endpoint, not 404/401
```

If the server starts but no tools appear, the break is in `initialize`/discovery — read the raw [JSON-RPC](json-rpc.md) for a version mismatch or an error response.

## How a company uses this

A Dubai enterprise standardized *connection* config across its fleet so onboarding a new server is a checklist, not a mystery: absolute paths for local servers, a health-checkable `/mcp` URL for remote ones, bearer [auth](auth.md) via env vars, and a required protocol-version field. Their most common production incident wasn't a tool bug — it was **connection drift**: a remote server's token expired (401 at `initialize`), so every dependent assistant silently lost that server's tools. They fixed it by monitoring the handshake itself — an automated client that periodically initializes against each server and alerts if discovery returns zero tools — turning "why did the agent get dumber?" into a paged alert with a clear cause. Version negotiation also matters at their scale: rolling out a new spec revision, they lean on the handshake so newer clients still connect to not-yet-upgraded servers.

## Common mistakes

- **Relative paths / missing runtimes for STDIO.** The spawned command must resolve; use absolute paths and the right interpreter.
- **Assuming "no tools" is a tool bug.** It's almost always a broken connection — check the handshake first.
- **Ignoring auth on remote servers.** A 401 at `initialize` means no tools, silently.
- **Editing config without restarting.** Many hosts read connection config only at launch.
- **Not monitoring the handshake in prod.** An expired token silently strips tools; health-check the `initialize`+discovery, not just server uptime.

## Interview tip

Say: *"Connecting a server is: declare how to reach it — a command for STDIO or a URL plus auth for HTTP — then the initialize handshake negotiates a protocol version, then the client discovers tools, resources, and prompts. When tools don't show up, I don't debug the tool — I check the connection: does the server start, does the handshake complete, is auth valid, do the versions reconcile. In prod I monitor the handshake itself, because an expired token silently strips a server's tools."* That diagnostic framing signals you've actually debugged this.
