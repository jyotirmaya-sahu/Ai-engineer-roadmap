# Claude Code: MCP Integration

**What it is:** MCP (Model Context Protocol) is a standard way to connect external tools and data sources to an AI. Connecting an MCP server to Claude Code gives Claude new powers — like querying your database, reading Notion, or hitting an API.

## Why it matters for an AI Engineer

Out of the box, Claude Code can read and edit files and run shell commands. That is a lot, but it does not know your production database, your Slack, your issue tracker, or your internal API. MCP is the bridge. Connect an MCP server and Claude can *use* those systems directly — "look up this order in the database," "check the open Sentry errors." As an AI Engineer, MCP is doubly important: you will connect servers to Claude Code to work faster, and you will *build* MCP servers so your own AI apps can safely reach tools and data. It is a core 2026 skill for agent-based systems.

## How MCP works, plainly

MCP has two sides:

- An **MCP server** exposes some capability — tools (actions the AI can call), resources (data it can read), or prompts.
- An **MCP client** (Claude Code is one) connects to servers and lets the AI use what they offer.

You do not write the protocol by hand. You point Claude Code at a server; Claude discovers the tools it offers and can call them when relevant. As of the 2026-07-28 spec, MCP servers can run **stateless** — no long-lived session needed per connection — which makes them easier to host behind ordinary web infrastructure and to scale. For your day-to-day Claude Code use, the effect is simply that connecting to hosted servers is smoother; the usage below is the same either way.

## Connecting a server to Claude Code

The simplest way is the CLI:

```bash
# Add a local filesystem server (stdio transport)
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem /Users/you/projects

# Add a remote/hosted server over HTTP
claude mcp add --transport http company-api https://mcp.mycompany.com

# List and check what's connected
claude mcp list
```

Or configure servers in `.mcp.json` at your project root (shareable with your team):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://localhost/appdb"]
    },
    "company-api": {
      "type": "http",
      "url": "https://mcp.mycompany.com"
    }
  }
}
```

Note the two shapes: a `command` server runs a local process (stdio); an `http` server is a hosted URL. Put secrets like connection strings in environment variables, not hardcoded — more below.

## Using it

Once connected, just ask in plain English. Claude sees the server's tools and uses them:

```
> Using the postgres server, how many orders were placed in Dubai last week?
```

Claude calls the database tool, runs the query, and answers. You never wrote SQL by hand. The MCP tools show up namespaced (for example `mcp__postgres__query`) so you can see exactly which server did what.

## A real company example

A Dubai retail team connects two MCP servers to Claude Code: their Postgres analytics database and their internal inventory API. An engineer debugging a recommendation feature asks, "check the last 5 orders for user 8821 and whether those items are still in stock." Claude queries the database via the Postgres server, then calls the inventory API via the second server, and gives one combined answer — no context-switching between a SQL client and Postman. The same MCP inventory server also powers their customer-facing chatbot. One integration, reused by both the engineers and the product.

## Common mistakes and gotchas

- **Hardcoding credentials in `.mcp.json`.** That file often gets committed. Use environment variables for connection strings and keys.
- **Over-permissioned servers.** A database MCP server with write access can let the AI change production data. Give read-only where possible.
- **Assuming a server is safe because it is easy to add.** Only connect servers you trust; they can run code and touch data.
- **Confusing MCP with the SDK.** MCP connects *tools to* an AI. The SDK builds *the AI agent itself*. They pair well but are different.
- **Forgetting to check `claude mcp list`.** If a tool is not working, confirm the server actually connected.

## Interview / practical tip

Explain MCP as "the USB port for AI tools — one standard way to plug databases, APIs, and services into an agent." Mention that you have connected a server to Claude Code (say, a Postgres one) and, ideally, that you understand you can build your own MCP server to expose tools to an AI safely, read-only where it matters. Talking about MCP with correct security instincts — least privilege, no hardcoded creds — signals you can build real agent systems, not just demos.
