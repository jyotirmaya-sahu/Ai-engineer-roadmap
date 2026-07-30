# Sampling

**What it is:** the primitive that lets a **server ask the client's LLM to run a completion** — so a server can "think" without owning an API key, and the client keeps control of model choice, cost, and consent.

## Why it matters for an AI Engineer

Sampling is the elegant piece most people miss: it inverts the usual flow. Normally the model calls tools; with sampling, a *tool* calls the model. Understanding it proves you grasp MCP's control model — that the host stays in charge of the LLM even when a server needs intelligence. It's also what makes servers portable: they don't ship their own model credentials.

## The mechanism / how it works

Suppose a server needs to do something that requires reasoning — summarize a fetched document, classify a message, draft a reply. It has two bad options: bundle its own OpenAI key (now the server owns cost, secrets, and model choice), or don't do it at all. **Sampling** is the third way: the server sends a `sampling/createMessage` request *up* to the client, containing messages and hints; the client runs *its* LLM and returns the completion.

The lifecycle:

1. Server → client: `sampling/createMessage` with messages + `modelPreferences` (hints like "cheap/fast" or "smart").
2. The client **stays in control**: it can show the request to the user for approval, pick which model to use, apply its own rate limits/budget, and even edit the prompt.
3. Client → server: the completion text.

This is why the direction matters: sampling is **server→client**, the reverse of tool calls. The server *requests* intelligence; the client *grants* it on its own terms. Cost and model choice never leave the host (see [host/client/server](host-client-server.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ server needs to reason</span>
    <span class="darr">→<span class="lbl">sampling/createMessage</span></span>
    <span class="dbox gray">👤 client approves + picks model</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 client's LLM runs it</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ completion back to server</span>
  </div>
  <div class="dcap">Sampling inverts the flow: a server borrows the client's model — client keeps control of cost, choice, and consent.</div>
</div>

## Concrete example

A server that summarizes a fetched page by borrowing the client's model:

```python
from fastmcp import FastMCP
mcp = FastMCP("research")

@mcp.tool()
async def summarize_url(url: str, ctx) -> str:
    "Fetch a page and summarize it using the CLIENT's model."
    text = fetch(url)[:8000]
    result = await ctx.sample(                      # server → client
        messages=f"Summarize in 3 bullets:\n\n{text}",
        model_preferences="fast",                   # hint, client decides
    )
    return result.text
```

The `research` server has **no LLM credentials of its own** — it borrows the host's model via `ctx.sample`. The host decides which model runs and whether to charge/approve it.

## How a company uses this

A Dubai enterprise builds internal MCP servers that need light reasoning (categorize a ticket, extract fields from a document) but *forbids* servers from holding model API keys — a security policy so credentials live in exactly one place: the host. Sampling makes that policy workable. Servers request intelligence; the central host applies a per-team token budget, logs every completion for audit, and routes cheap requests to a small model and hard ones to a large one — governance the servers never see. The production win is **cost centralization**: one place enforces the token budget, so a runaway server can't quietly rack up a bill on its own key. (Note: not every host supports sampling yet, so servers must degrade gracefully when the capability is absent.)

## Common mistakes

- **Bundling an API key in the server instead of using sampling.** That defeats central cost control and scatters secrets.
- **Assuming sampling always succeeds.** It's an *optional* client capability; check it's supported and handle its absence.
- **Forgetting the user is in the loop.** The client may require approval — a sampling call can be denied or edited.
- **Confusing it with tool calls.** Tools = model calls server. Sampling = server calls model. Opposite directions.

## Interview tip

Say: *"Sampling lets a server ask the client's LLM for a completion — it inverts the normal flow so a tool can 'think' without owning a model key. The client stays in control: it picks the model, applies budget and rate limits, and can require user approval. That's how an enterprise keeps all LLM cost and credentials centralized in the host even though servers need intelligence."* Framing it as *control and cost staying with the host* is the senior-level read.
