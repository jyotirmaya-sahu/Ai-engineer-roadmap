# Elicitation

**What it is:** the primitive that lets a **server pause mid-tool-call to ask the user for input** — "which repo?" or "confirm this refund?" — then resume once the user answers.

## Why it matters for an AI Engineer

Real workflows aren't one-shot. A tool often needs a detail the model didn't provide, or a human confirmation before doing something irreversible. Elicitation is how a server requests that *structured* input mid-flight instead of failing or guessing. It's the primitive behind safe, interactive agents — and it pairs directly with the stateless transport story, which is why it's worth understanding well.

## The mechanism / how it works

Midway through executing a [tool](tools.md), a server realizes it needs more from the user. Instead of erroring out, it sends an **`elicitation/create`** request to the client, containing a message ("Which repository?") and a **JSON Schema** describing the expected answer (e.g. an enum of repo names). The client renders a form or prompt, the user answers, and the client returns the structured value. The server then continues.

The lifecycle:

1. Server → client: `elicitation/create` with a prompt + a response schema.
2. The client shows the user a form (constrained by the schema), and the user can **accept**, **decline**, or **cancel**.
3. Client → server: the structured response (or a decline/cancel signal the server must handle).

Two things make this powerful. First, the response is **schema-validated**, so the server gets clean typed data, not free text. Second — and this is the modern connection — under the [stateless transport (2026-07-28)](stateless-servers-modern-default.md), the server doesn't hold a connection open waiting. It returns an `InputRequiredResult`, and the client simply **re-issues the request** with the answer included. This is the Multi-Round-Trip Request (MRTR) pattern: pause and resume become two ordinary stateless calls, so elicitation works even behind a plain load balancer where each call may hit a different instance.

<div class="diagram">
  <div class="flow v">
    <div class="flow">
      <span class="dbox blue">🗄️ tool needs a detail</span>
      <span class="darr">→<span class="lbl">elicitation/create + schema</span></span>
      <span class="dbox gray">👤 client shows a form</span>
    </div>
    <span class="darr">↓ accept / decline / cancel</span>
    <div class="flow">
      <span class="dbox orange">📝 structured answer</span>
      <span class="darr">→<span class="lbl">re-issued request (MRTR)</span></span>
      <span class="dbox green">✅ tool resumes</span>
    </div>
  </div>
  <div class="dcap">The server pauses for typed user input; stateless servers resume via a re-issued request, not a held-open connection.</div>
</div>

## Concrete example

```python
from fastmcp import FastMCP
mcp = FastMCP("github")

@mcp.tool()
async def create_issue(title: str, ctx) -> str:
    "Create an issue, asking the user which repo if it's ambiguous."
    repos = list_user_repos()
    if len(repos) > 1:
        answer = await ctx.elicit(                          # server → client
            message="Which repository should I use?",
            schema={"type": "object",
                    "properties": {"repo": {"enum": repos}},
                    "required": ["repo"]})
        if answer.action != "accept":
            return "cancelled — no repo chosen"
        repo = answer.data["repo"]
    else:
        repo = repos[0]
    return f"created issue in {repo}: {title}"
```

The `enum` schema means the user picks from a valid list — the server never has to parse ambiguous free text, and it explicitly handles a non-accept response.

## How a company uses this

A Dubai bank's payments MCP server uses elicitation as a **human-in-the-loop confirmation gate**: before a `transfer_funds` tool executes, it elicits an explicit "Confirm AED 50,000 to IBAN …?" with a yes/no schema. No confirmation, no transfer — enforced server-side, logged for audit. Because their servers are stateless and load-balanced, the confirmation round-trip is a re-issued request (MRTR), so the pause survives even though the second call may land on a different server instance. This is the pattern that makes high-stakes agent actions shippable in a regulated environment: the model proposes, but a schema-validated human answer is required to proceed.

## Common mistakes

- **Not handling decline/cancel.** The user can refuse; a tool that assumes acceptance will misbehave.
- **Free-text instead of a schema.** The whole point is *structured* input — use enums and required fields.
- **Assuming a held-open connection.** On stateless servers, resume is a re-issued request; don't rely on server-side session state between the ask and the answer.
- **Over-eliciting.** Asking the user for things the model already provided is annoying — only elicit genuinely missing or high-risk inputs.

## Interview tip

Say: *"Elicitation lets a server pause a tool call to ask the user for structured, schema-validated input — 'which repo?' or a confirmation gate before a risky action. On the stateless transport it resumes via a re-issued request (Multi-Round-Trip), not a held-open connection, so it still works behind a load balancer."* Tying elicitation to the [stateless/MRTR](stateless-servers-modern-default.md) mechanism is the detail that shows you track the current spec, not last year's.
