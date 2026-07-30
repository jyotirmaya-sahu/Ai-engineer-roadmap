# Open Standard

**What it is:** MCP is a publicly-specified, vendor-neutral protocol — not a Claude-only feature — so any model and any tool can interoperate without asking permission.

## Why it matters for an AI Engineer

"Open standard" is the reason your MCP skills transfer across employers and the reason a tool you build today won't be orphaned when you switch model providers. Interviewers probe this to check you understand *lock-in risk*: an AI Engineer who picks an open protocol over a proprietary plugin format is making a defensible architecture decision, not chasing hype.

## The mechanism / how it works

A standard is just a written agreement on message formats that everyone codes against. MCP's agreement covers three things:

1. **A wire format** — every message is [JSON-RPC 2.0](json-rpc.md), a decades-old, boringly stable RPC convention (`method`, `params`, `id`, `result`/`error`).
2. **A fixed vocabulary of capabilities** — the [primitives](tools.md): tools, resources, prompts, roots, sampling, elicitation. A client and server *negotiate* which they support in an `initialize` exchange.
3. **A versioned spec revision** — dated strings like `2026-07-28`. Client and server announce their version; if they disagree they fall back to a shared one.

Because the spec is published (it lives openly, with a formal schema and an SDK in multiple languages), *anyone* can implement a compliant client or server. Anthropic authored MCP but doesn't own who uses it — OpenAI, Google, IDE vendors, and thousands of community servers all speak it. That's the difference between an **open standard** and a **proprietary plugin API** (like a single vendor's "GPTs" or "extensions"): with the plugin API, your tool only works inside that vendor's product and you're one policy change away from breakage.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 Published spec<span class="sub">JSON-RPC + primitives + version</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 anyone builds a client</span>
    <span class="darr">↔</span>
    <span class="dbox blue">🗄️ anyone builds a server</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ they interoperate</span>
  </div>
  <div class="dcap">A written, versioned agreement means no gatekeeper — implementations from different vendors just work together.</div>
</div>

## Concrete example: capability negotiation

The "openness" is enforced by a handshake. On connect, both sides declare what they speak:

```json
// client → server
{"jsonrpc":"2.0","id":1,"method":"initialize",
 "params":{"protocolVersion":"2026-07-28",
           "capabilities":{"roots":{}, "sampling":{}},
           "clientInfo":{"name":"claude-desktop","version":"1.0"}}}

// server → client
{"jsonrpc":"2.0","id":1,
 "result":{"protocolVersion":"2026-07-28",
           "capabilities":{"tools":{}, "resources":{}},
           "serverInfo":{"name":"golden-visa","version":"0.1"}}}
```

Neither side hard-codes assumptions about the other — they *advertise and agree*. That negotiation is what lets a 2026 client safely talk to an older server: they settle on a common protocol version instead of crashing.

## How a company uses this

A Dubai enterprise standardizing on MCP internally isn't betting on one model vendor. Their CRM MCP server is consumed today by Claude-based assistants; when a business unit pilots a different model for cost reasons, the *same server* works unchanged — the new model's client speaks the same protocol. The open standard is precisely what makes that swap a config change instead of a rewrite. Procurement and security teams also like it: one protocol to audit, one auth pattern, versus a zoo of proprietary connectors.

## Common mistakes

- **"Open standard = Anthropic controls it."** Authoring ≠ owning usage. The spec is public and multi-vendor by design.
- **Ignoring versioning.** "Open" doesn't mean "frozen" — the spec revs (2025-03-26 → 2025-11-25 → 2026-07-28). You must handle version negotiation, not assume one version forever.
- **Confusing it with a proprietary plugin format.** A vendor plugin API locks your tool to that vendor's product; MCP does not.

## Interview tip

Say: *"MCP is an open, versioned standard — JSON-RPC on the wire, a fixed set of primitives, and a dated spec revision that clients and servers negotiate. Being open is the anti-lock-in property: I can build a server once and have it work across model vendors and hosts."* Then mention capability negotiation — knowing the `initialize` handshake exists proves you've read the spec, not a blog post.
