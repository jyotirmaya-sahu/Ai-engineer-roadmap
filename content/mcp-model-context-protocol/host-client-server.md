# Host / Client / Server

**What it is:** MCP's three-role architecture — the **host** is the app you're in, the **client** is the connector inside it, and the **server** wraps a tool or data source.

## Why it matters for an AI Engineer

Almost every MCP bug is really a "which layer owns this?" confusion. Auth, model choice, tool discovery, and user consent each live in a *specific* role, and if you don't know which, you'll debug in the wrong place. Interviewers use this to check you can reason about responsibility boundaries — the same skill that makes you good at any distributed system.

## The mechanism / how it works

Think of it like a web browser. The **browser app** is the host, each **tab's connection** to one website is a client, and each **website** is a server. MCP mirrors that exactly:

- **Host** — the user-facing application: [Claude Desktop](claude-desktop.md), [Claude Code / an IDE](ide-claude-code.md), or a [custom app](custom-clients.md) you built. The host owns the LLM, the conversation, and the *user's trust*. It decides which servers to connect to and asks the user for consent before running tools.
- **Client** — a lightweight connector that lives *inside* the host. Crucially, it's **one client per server** — a 1:1 link. If the host connects to three servers, it spins up three clients. Each client speaks pure MCP ([JSON-RPC](json-rpc.md)) to its one server and translates responses back for the host.
- **Server** — a standalone program that wraps a capability: a GitHub server, a Postgres server, your CRM. It exposes [tools](tools.md), [resources](resources.md), and [prompts](prompts.md), and it holds the credentials and logic for *that one system*. A server never talks to the model directly — it can only *ask* the host's model via [sampling](sampling.md).

<div class="diagram">
  <div class="dgroup">
    <span class="dgt">HOST (Claude Desktop) — owns the LLM + user consent</span>
    <div class="flow v">
      <span class="dbox purple">🧠 LLM + conversation</span>
      <div class="flow">
        <span class="dbox orange">client A</span>
        <span class="darr">↔</span>
        <span class="dbox blue">🗄️ GitHub server</span>
      </div>
      <div class="flow">
        <span class="dbox orange">client B</span>
        <span class="darr">↔</span>
        <span class="dbox blue">🗄️ Postgres server</span>
      </div>
    </div>
  </div>
  <div class="dcap">One host holds the model; each server gets its own dedicated client — a 1:1 link speaking JSON-RPC.</div>
</div>

## Why the split matters (who owns what)

| Concern | Owned by |
|---|---|
| The LLM, model choice, cost | **Host** |
| User consent before a tool runs | **Host** |
| Discovering + routing to one server | **Client** |
| Tool logic + that system's credentials | **Server** |
| Which folders may be touched | negotiated: [Roots](roots.md) host→server |

This is why a server can't silently spend your money on model calls: it must go *up* through the client to the host, which asks the user. Control of the model stays with the host by design.

## Concrete example

When you type "create a GitHub issue" in Claude Desktop:

1. The **host** (Claude Desktop) runs the LLM, which decides to call the `create_issue` tool.
2. The host routes that call through **client A**, the connector bound to the GitHub server.
3. The **GitHub server** executes the API call with *its own* stored token and returns the result.
4. Client A hands the result back to the host, which feeds it to the LLM to write your reply.

The Postgres server (client B) was never involved — each client only knows its own server.

## How a company uses this

A Dubai enterprise runs one host surface — their internal assistant — connecting to a dozen servers (CRM, HR, ticketing, each behind [auth](auth.md)). The host is where their security team enforces consent and logging *once*; the servers are owned by whichever team owns that backend. This clean split lets the platform team and the backend teams ship independently: a backend team updates its server without ever touching the host, and the host adds a new connection without knowing that server's internals. At scale, hosts also load-balance across [remote](remote-load-balanced.md) server instances — the client-per-server model makes each connection independently routable.

## Common mistakes

- **Thinking the server calls the model.** It can't directly — it uses [sampling](sampling.md) to request a completion *from the host*, keeping model control and cost with the host.
- **Expecting one client to multiplex many servers.** It's strictly one client per server.
- **Putting auth on the host.** Credentials for a backend live on *that backend's server*, not the host.

## Interview tip

Use the browser analogy: *"Host is the browser, client is a tab's connection, server is the website — one client per server. The host owns the LLM and user consent; the server owns the tool logic and its credentials; the server can only reach the model by asking the host via sampling."* Naming *who owns model control and consent* is the detail that shows real understanding.
