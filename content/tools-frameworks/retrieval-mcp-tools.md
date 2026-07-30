# Retrieval / MCP tools

**What it is:** two related ideas — a **retrieval tool** lets an agent *search your own documents* on demand, and **MCP** (Model Context Protocol) is the open standard for exposing any tool (retrieval included) so it can be reused across apps and clients without rewriting the wiring.

## Why it matters for an AI Engineer

Two of the most common jobs in real AI products are "ground the answer in our data" (retrieval) and "stop rebuilding the same tool for every app" (MCP). A retrieval *tool* turns [RAG](../rag-architecture.md) into something the *agent decides to use* — it searches only when it needs to, can search multiple times, and refines its query. MCP then lets you build that search tool **once** and plug it into Claude Desktop, your IDE, your production agent, and a teammate's app — all speaking the same protocol. In 2026, "can wrap retrieval as a tool" and "understands MCP" are near-universal AI Engineer job requirements, especially for enterprise Dubai roles where the same knowledge base feeds many products.

## The mechanism — retrieval as a tool, standardized by MCP

**Retrieval as a tool.** Plain RAG always retrieves before answering. A retrieval *tool* instead gives the agent a `search_docs(query)` function. The agent chooses *whether* and *how many times* to call it — search, read results, realize it needs more, search again with a better query. That's "agentic RAG." Underneath, the tool embeds the query, hits a vector DB, and returns the top chunks with their source metadata for citations.

**MCP — the standard plug.** Without MCP, every tool integration is bespoke: N apps × M tools = N×M glue to write. MCP fixes this with a client/server standard:

- An **MCP server** exposes capabilities: *tools* (actions), *resources* (readable data), *prompts*.
- An **MCP client** (Claude Desktop, an IDE, your agent) connects and discovers whatever the server offers.

Build your `search_docs` tool once as an MCP server, and any MCP client can use it — no per-app rewiring. Modern MCP servers can run **stateless** (self-contained requests), so they scale horizontally behind ordinary web infra.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue wide">🗄️ MCP server<span class="sub">search_docs, get_policy…</span></span>
  </div>
  <div class="flow"><span class="darr">↓<span class="lbl">one standard protocol</span></span></div>
  <div class="flow">
    <span class="dbox purple">🖥️ Claude Desktop</span>
    <span class="dbox purple">💻 IDE / Claude Code</span>
    <span class="dbox purple">🤖 Prod agent</span>
  </div>
  <div class="dcap">Build the retrieval tool once as an MCP server; every client reuses it. That's the M×N fix.</div>
</div>

## Concrete example (runnable, 2026-current)

A retrieval tool exposed via FastMCP — build once, reuse everywhere:

```python
from mcp.server.fastmcp import FastMCP
# assume `vector_store` is your existing vector DB (Pinecone/pgvector/etc.)

mcp = FastMCP("company-docs")

@mcp.tool()
def search_docs(query: str, k: int = 4) -> list[dict]:
    """Search internal company documents. Returns top-k chunks with source citations."""
    hits = vector_store.similarity_search(query, k=k)
    return [{"text": h.page_content,
             "source": h.metadata["source"],
             "page": h.metadata.get("page")} for h in hits]

if __name__ == "__main__":
    mcp.run()   # now any MCP client — Claude Desktop, your agent — can call search_docs
```

The agent calls `search_docs` through the standard [function-calling](function-calling.md) loop, gets chunks *with sources*, and cites them. The same server powers the desktop app and production with zero extra wiring.

## How a company uses this — production lens

> **A Dubai bank** maintains one MCP server over its policy/compliance corpus (~2M chunks in a vector DB). It exposes `search_policy` and `get_document`. That single server feeds **three** products: the employee help desk agent, the customer chatbot, and engineers using it live in Claude Code while debugging. Production realities: they run it **stateless behind a load balancer** so it scales to ~200 QPS at peak; retrieval latency is budgeted at **<150ms p95** (vector search + rerank) so the agent stays responsive; and because it's *one* server, a security review and PII audit happen **once**, not three times. When the corpus updates, all three products get the new knowledge instantly. Rebuilding this per-app would have tripled the maintenance and the audit surface.

## Common mistakes

- **Confusing MCP with function calling.** Function calling is the *mechanism*; MCP is a *standard packaging* so tools are reusable across clients. See [MCP (Model Context Protocol)](../mcp-model-context-protocol.md).
- **Returning chunks without sources.** Retrieval tools must return metadata so the agent can cite — un-cited enterprise answers get rejected.
- **Over-permissioning the server.** A docs server should be read-only. Don't expose write/delete "just in case."
- **Forgetting agentic retries.** The power of retrieval-as-a-tool is the agent searching *again* with a better query. Don't cap it at one call if the task is complex.
- **Hardcoding secrets in the server.** Connection strings and keys go in env vars, not the MCP config.

## Interview tip
Say: *"A retrieval tool makes RAG agentic — the agent decides when and how often to search, and gets chunks with citations. I package it as an MCP server so the same tool serves the desktop app, the IDE, and production without rewiring — that's the M×N integration fix. I keep it read-only and stateless so it scales and audits once."* That connects RAG, tools, and MCP in one breath — exactly the systems thinking enterprise roles want.
