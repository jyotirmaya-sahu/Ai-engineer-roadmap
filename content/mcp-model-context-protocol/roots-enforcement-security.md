# Roots Enforcement (security)

**What it is:** the server-side discipline of **actually refusing** any operation outside its declared [roots](roots.md) — turning "here's your permitted scope" from a polite suggestion into a hard, checked boundary.

## Why it matters for an AI Engineer

[Roots](roots.md) the primitive only *communicates* a boundary; a server that ignores it can still read `/etc/passwd`. Enforcement is what makes least-privilege real — and it's exactly what a security-minded interviewer (Dubai finance/gov) drills into. An LLM can be tricked ([prompt injection](../llm-security-guardrails/prompt-injection.md)) into requesting an out-of-scope path; enforcement is the wall that holds even when the model is fooled.

## The mechanism / how it works

The client declares roots (e.g. `file:///repo`) via `roots/list`. Enforcement is the server, on *every* filesystem-touching operation, checking the target against those roots and rejecting anything outside. Done right it has three parts:

1. **Canonicalize the path.** Resolve symlinks and `..` *before* checking — `resolve()` / `realpath()`. This defeats **path traversal** (`/repo/../../etc/passwd`) and symlink escapes. Checking the raw string is the classic bug.
2. **Verify containment.** Confirm the resolved path is *inside* an allowed root (`is_relative_to`). Reject otherwise with a clear error.
3. **Deny by default.** No matching root → refuse. Never fall back to "allow."

This is **defense in depth** with [auth](auth.md): auth decides *who* you are and *what* you may do; roots enforcement decides *where* you may do it. A valid, scoped token still shouldn't let a tool read outside the project. And it must be **server-side** — a client-side check is trivially bypassed by anything that talks to the server directly.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 requested path</span>
    <span class="darr">→<span class="lbl">canonicalize (resolve .. + symlinks)</span></span>
    <span class="dbox orange">📁 inside a root?</span>
    <span class="darr">→ yes</span>
    <span class="dbox green">✅ allow</span>
    <span class="darr">→ no</span>
    <span class="dbox blue">🚫 reject (deny by default)</span>
  </div>
  <div class="dcap">Resolve the path first, then check containment. No matching root means refuse — never fall through to allow.</div>
</div>

## Concrete example

The enforcement check, with the traversal defense that matters most:

```python
from pathlib import Path
from fastmcp import FastMCP
mcp = FastMCP("code-search")

def enforce(path: str, roots: list[str]) -> Path:
    target = Path(path).resolve()                       # resolves .. and symlinks
    allowed = [Path(r.replace("file://", "")).resolve() for r in roots]
    if not any(target.is_relative_to(a) for a in allowed):
        raise PermissionError(f"{target} is outside declared roots")   # deny by default
    return target

@mcp.tool()
async def read_file(path: str, ctx) -> str:
    roots = [r.uri for r in await ctx.list_roots()]
    return enforce(path, roots).read_text()
```

`read_file("/repo/../../etc/passwd")` resolves to `/etc/passwd`, fails containment, and is rejected — even though the raw string *starts* with `/repo`. The `.resolve()` before the check is the whole game.

## How a company uses this

A Dubai software house runs a shared code-search MCP server across many client repos. Roots enforcement is the load-bearing control: each session's root is one client's repo, and the server *rejects* any read outside it — so even if an agent is [prompt-injected](../llm-security-guardrails/prompt-injection.md) into requesting `../other-client/secrets.env`, the path resolves outside the root and is denied. They treat it as defense in depth: [OAuth](auth.md) scopes gate *which tools* a session can call, roots enforcement bounds *what those tools can reach*, and both are logged. Their red-team specifically tests traversal and symlink escapes, because a single missing `.resolve()` would turn a code-search tool into an arbitrary-file-read primitive across tenants. Deny-by-default is non-negotiable: a bug that *fails open* is a cross-tenant breach.

## Common mistakes

- **Checking the raw string, not the resolved path.** `startswith("/repo")` is bypassed by `/repo/../../etc`. Always `resolve()` first.
- **Forgetting symlinks.** A symlink inside the root pointing out escapes unless you resolve real paths.
- **Fail-open on error.** If the check throws, refuse — don't default to allow.
- **Client-side-only enforcement.** Anything talking directly to the server skips a client check; enforce on the server.
- **Treating roots as enough alone.** Pair with [auth](auth.md) scopes — who/what and where are different questions.

## Interview tip

Say: *"Roots the primitive just states the boundary; enforcement is the server rejecting anything outside it. The critical detail is canonicalizing the path — resolve() to collapse .. and symlinks — before checking containment, and denying by default. It's server-side and it's defense in depth with OAuth scopes: auth decides who and what, roots enforcement decides where. It has to hold even when the model is prompt-injected into asking for a bad path."* Naming the resolve-before-check traversal defense is the concrete detail that proves you'd actually get it right.
