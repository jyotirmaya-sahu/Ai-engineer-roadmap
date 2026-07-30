# Claude Desktop

**What it is:** Anthropic's desktop app — the reference **MCP host** most people meet MCP through. You add servers in a JSON config, and their [tools](tools.md), [resources](resources.md), and [prompts](prompts.md) appear inside the chat.

## Why it matters for an AI Engineer

Claude Desktop is where you'll *first test* almost any MCP server you build — it's the fastest end-to-end loop. Knowing its config format, how it launches [STDIO](stdio-local.md) servers, and where it shows tools/consent is practical, demonstrable knowledge. It's also the concrete example of a **host** owning the LLM and user consent (see [host/client/server](host-client-server.md)).

## The mechanism / how it works

Claude Desktop is a **host**: it holds the LLM and the conversation, and it spins up an internal [client](custom-clients.md) per server you configure. You declare servers in a JSON config file (`claude_desktop_config.json`):

- For a **local** ([STDIO](stdio-local.md)) server, you give a `command` and `args`. On launch, Claude Desktop **spawns that subprocess** and pipes JSON-RPC over stdin/stdout.
- For a **remote** server, you point at its [Streamable HTTP](streamable-http.md) URL (increasingly via a connector/`mcp-remote` bridge), with [auth](auth.md) as needed.

Once connected, the host calls `tools/list`, `resources/list`, and `prompts/list`, then surfaces them: tools become callable by the model, resources become `@`-mentionable context, prompts become slash commands. Critically, the host **owns consent** — before a tool with side effects runs, Claude Desktop asks you to approve it. That approval gate lives in the host by design, not in the server.

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">Claude Desktop (HOST) — owns LLM + consent</span>
    <div class="flow">
      <span class="dbox purple">🧠 Claude + chat</span>
      <span class="darr">→ spawns / connects</span>
      <span class="dbox orange">client per server</span>
      <span class="darr">↔</span>
      <span class="dbox blue">🗄️ your MCP server</span>
    </div>
  </div>
  <div class="dcap">You list servers in JSON; the host launches them, discovers their capabilities, and gates tool use behind consent.</div>
</div>

## Concrete example

A config wiring one local and one remote server:

```json
{
  "mcpServers": {
    "golden-visa": {
      "command": "python",
      "args": ["/Users/me/servers/golden_visa.py"]
    },
    "crm": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://crm.internal/mcp",
               "--header", "Authorization: Bearer ${CRM_TOKEN}"]
    }
  }
}
```

Restart Claude Desktop and both servers' tools appear. `golden-visa` runs locally as a spawned subprocess; `crm` is a remote HTTP server reached through the `mcp-remote` bridge with a bearer token. Ask "am I eligible at 32000 AED?" and Claude calls the `eligibility` tool — after you approve it.

## How a company uses this

At a Dubai firm, Claude Desktop is the daily driver for analysts and knowledge workers, wired to internal servers (CRM, policy KB, ticketing) behind [auth](auth.md). The host-owns-consent property is the reason security signed off: even though the assistant *can* reach a refund tool, every side-effecting call surfaces an approval prompt that's logged — a human is in the loop for anything that changes state. It's also the team's server test-bed: an engineer building a new server points a local Claude Desktop at it, confirms the tools and schemas behave, *then* promotes it to a shared remote deployment. That local-first loop catches bad schemas and vague descriptions before they reach production.

## Common mistakes

- **Editing config while the app runs.** Claude Desktop reads the config at launch — restart it after changes.
- **Relative paths / missing runtimes.** The spawned `command` must be resolvable (absolute paths, correct `python`/`node` on PATH), or the server silently fails to start.
- **Expecting remote servers to "just work" like local.** Remote servers need a reachable HTTPS URL and auth; a raw remote endpoint often goes through an `mcp-remote` bridge.
- **Assuming the server enforces consent.** Consent is the *host's* job — don't rely on the server to gate risky actions for the user.

## Interview tip

Say: *"Claude Desktop is the reference MCP host — I declare servers in JSON, and it spawns local STDIO servers as subprocesses or connects to remote Streamable HTTP ones, then surfaces their tools, resources, and prompts. The host owns the LLM and user consent, so side-effecting tools prompt for approval. It's my first test surface for any server I build before promoting it to a shared remote deployment."* Mentioning the local-test-then-promote workflow reads as real experience.
