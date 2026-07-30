# Roots

**What it is:** the MCP primitive that tells a server **which locations it's allowed to operate in** — a set of folders or URIs the client hands the server as its permitted scope.

## Why it matters for an AI Engineer

Roots are MCP's answer to "how do I stop a server from wandering the whole filesystem?" They're a *security and scoping* boundary, and enterprise interviewers (especially Dubai finance/gov roles) care that you can articulate least-privilege for AI tools. Roots are where that starts.

## The mechanism / how it works

A **root** is a URI — usually a directory like `file:///Users/me/project` — that the **client** declares to the server during setup. It's the client saying: "here are the boundaries you should work within." The lifecycle:

1. During `initialize`, the client advertises the `roots` capability.
2. The server calls **`roots/list`** to learn its permitted scope.
3. When roots change (user opens a different folder), the client sends **`notifications/roots/list_changed`**, and the server re-fetches.

The direction matters: **roots flow client → server**. The client (which represents the user and the host) is the authority; it *grants* scope to the server. This is the inverse of tools/resources, where the server advertises capabilities up to the client. Here the client constrains the server *down*.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 host / client<span class="sub">the authority</span></span>
    <span class="darr">→<span class="lbl">roots/list</span></span>
    <span class="dbox orange">📁 file:///project only</span>
    <span class="darr">→</span>
    <span class="dbox blue">🗄️ server works within scope</span>
  </div>
  <div class="dcap">Roots flow client→server: the client grants the server its permitted boundary — least privilege by default.</div>
</div>

Crucially, roots are a **declaration**, not an enforced sandbox by themselves — the server is *told* its scope and is expected to respect it. Actually *enforcing* that boundary (rejecting a read outside the roots) is a server-side responsibility, covered in [roots enforcement (security)](roots-enforcement-security.md). Roots the primitive = communicating the boundary; roots enforcement = the server refusing to cross it.

## Concrete example

A client (e.g. an IDE) advertises the open project as the root; the server reads it and refuses anything outside:

```python
from fastmcp import FastMCP
from pathlib import Path
mcp = FastMCP("code-search")

@mcp.tool()
async def read_file(path: str, ctx) -> str:
    "Read a file, but only within the client's declared roots."
    roots = await ctx.list_roots()                       # client → server
    allowed = [Path(r.uri.replace("file://", "")) for r in roots]
    target = Path(path).resolve()
    if not any(target.is_relative_to(a) for a in allowed):
        raise PermissionError(f"{target} is outside declared roots")
    return target.read_text()
```

The `.resolve()` + `is_relative_to` check is what stops a `../../etc/passwd` traversal escaping the root.

## How a company uses this

A Dubai software house runs an internal code-assistant MCP server used across dozens of repos. Roots scope each session to *the one repo the developer has open* — so the assistant physically cannot read a sibling client's proprietary code even though the same server process could technically reach it. When a developer switches projects, the client fires `list_changed` and the server's scope moves with them. In a shared, multi-tenant setup this is a hard requirement: without roots, one leaked path traversal could cross-contaminate customer code. Roots turn "please don't" into a declared, checkable boundary — and the enforcement check above is what an auditor actually wants to see.

## Common mistakes

- **Assuming roots enforce by themselves.** They *communicate* scope; the server must actually check paths against them. See [roots enforcement](roots-enforcement-security.md).
- **Getting the direction wrong.** Roots go client→server, unlike tools/resources which advertise server→client.
- **Skipping path normalization.** Checking the raw string instead of the resolved path lets `../` traversal escape.
- **Forgetting `list_changed`.** A long-lived server that caches roots once will operate on a stale scope after the user switches folders.

## Interview tip

Say: *"Roots are the client telling the server which folders it may touch — a client→server scoping declaration, the inverse direction of tools and resources. On its own it's a *stated* boundary; the server has to enforce it by resolving paths and rejecting anything outside the roots. That's how I give an AI tool least-privilege filesystem access."* Distinguishing the *declaration* (roots) from the *enforcement* is exactly the nuance a security-minded interviewer probes for.
