# IDE / Claude Code

**What it is:** coding-agent hosts — Claude Code, and IDE integrations like Cursor/VS Code — that act as MCP **hosts** so your AI pair-programmer can call MCP [tools](tools.md) against your repo, your build, your database.

## Why it matters for an AI Engineer

This is where MCP directly boosts *your own* productivity and where [roots](roots.md) (scoping the agent to the open project) really earns its keep. Knowing how to wire a server into Claude Code — and why the coding context makes roots and least-privilege non-negotiable — is both a daily-workflow skill and an interview signal that you use these tools, not just read about them.

## The mechanism / how it works

A coding host is still a **host** (see [host/client/server](host-client-server.md)): it holds the LLM, connects a [client](custom-clients.md) per server, and surfaces tools/resources/prompts. What's specific to the IDE/coding context:

- **Project-scoped [roots](roots.md).** The host declares the open workspace as the server's root, so the agent's file access is bounded to *this* project. Switch projects and the host fires `notifications/roots/list_changed`; the server's scope moves with you.
- **Config lives with the repo.** Claude Code reads MCP server definitions from files like `.mcp.json` (project-level) or a user-level config, so a team can **check server config into the repo** — everyone who clones gets the same tools.
- **Mostly [STDIO](stdio-local.md) local servers.** Coding tools (build runner, git, a local DB) run on the developer's machine, so they're spawned subprocesses — fast, no network, and touching *the developer's* credentials.
- **The agent chains tools autonomously.** Unlike a chat host where a human drives each step, a coding agent may call many tools in a loop (read file → run tests → edit → re-run), which raises the stakes on scoping and idempotency.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Claude Code (host)</span>
    <span class="darr">→<span class="lbl">roots = open project</span></span>
    <span class="dbox orange">📁 scoped to /repo</span>
    <span class="darr">↔</span>
    <span class="dbox blue">🗄️ local STDIO servers<span class="sub">build, git, db</span></span>
  </div>
  <div class="dcap">The coding host scopes the agent to the open project via roots, then chains local tools autonomously.</div>
</div>

## Concrete example

A project-level `.mcp.json` checked into a repo so the whole team gets the same tools:

```json
{
  "mcpServers": {
    "tests": { "command": "python", "args": ["tools/test_server.py"] },
    "db":    { "command": "python", "args": ["tools/db_server.py"],
               "env": { "DATABASE_URL": "postgres://localhost/dev" } }
  }
}
```

Or add one from the CLI:

```bash
claude mcp add tests -- python tools/test_server.py
```

Now Claude Code can call the `run_tests` and `query_db` tools while editing — scoped to the repo it's open in, using the developer's local database.

## How a company uses this

A Dubai software house ships a repo-committed `.mcp.json` so every developer's Claude Code has identical, vetted tools: a test runner, a migration checker, a local-DB query tool. Two production realities dominate. First, **roots scoping is a hard requirement** — the agent is bounded to the one repo the developer has open, so it physically can't read a sibling client's proprietary code even though the same server binary could reach it. Second, because the agent **chains tools autonomously** (read → test → edit → re-test), tools are built idempotent and side effects are gated: a `run_migration` tool refuses to touch anything outside the dev database. The result is an AI pair-programmer that's genuinely useful *and* can't wander outside its lane — the [roots enforcement](roots-enforcement-security.md) is what makes leadership comfortable turning it on across teams.

## Common mistakes

- **No roots scoping in a coding host.** An unscoped agent can read/write outside the project — a real security and blast-radius problem given it chains tools on its own.
- **Non-idempotent tools in an autonomous loop.** The agent retries; a tool with un-guarded side effects will fire twice.
- **Not committing config to the repo.** Per-developer manual setup drifts; `.mcp.json` in the repo keeps the team consistent.
- **Pointing a coding tool at prod.** Dev tools should target dev resources; a `query_db` wired to production is a foot-gun.

## Interview tip

Say: *"In a coding host like Claude Code, MCP servers are usually local STDIO tools — build, git, DB — and the host scopes them to the open project via roots, so the agent can't wander outside the repo. Config lives in a repo-committed .mcp.json so the team shares vetted tools. Because the agent chains tools autonomously, I make them idempotent and gate side effects to dev resources."* The roots-scoping-plus-idempotency combo shows you understand the *autonomous* risk profile of coding agents.
