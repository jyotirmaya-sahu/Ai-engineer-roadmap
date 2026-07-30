# Prompts

**What it is:** the MCP primitive for **reusable prompt templates** — pre-written, parameterized instructions a server offers that a user can invoke, like a `/summarize-pr` slash command.

## Why it matters for an AI Engineer

Prompts are how you ship *expertise* alongside a tool. A server author knows the best way to phrase "review this contract for risk" — prompts let them bottle that phrasing so every user gets it right without prompt-engineering skill. For an AI Engineer, this is packaging your prompt-craft as a reusable asset, and it's the primitive people most often forget exists.

## The mechanism / how it works

A prompt is a named template the server exposes, with optional typed arguments. The lifecycle:

1. **`prompts/list`** — the client asks what prompts exist. Each has a `name`, `description`, and an `arguments` list.
2. **`prompts/get`** — the client requests a prompt by name, passing argument values. The server returns a fully-formed list of chat **messages** (system/user turns) ready to send to the model.

The defining property: **prompts are user-controlled**. Unlike [tools](tools.md) (model picks) and [resources](resources.md) (app picks), a prompt is invoked when the *user* deliberately chooses it — typically surfaced in the host as a slash command or menu item. The user says "run `/summarize-pr` on #482," the client fetches the assembled messages, and the model executes them.

A powerful detail: a prompt's returned messages can *embed resources*. A `/review-contract` prompt can pull the contract [resource](resources.md) into the message it builds — so one user action assembles instructions *and* context together.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 user picks /summarize-pr</span>
    <span class="darr">→<span class="lbl">prompts/get</span></span>
    <span class="dbox blue">🗄️ server builds messages<span class="sub">+ embeds resources</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model runs the assembled prompt</span>
  </div>
  <div class="dcap">Prompts are user-invoked templates — the server author bottles the right phrasing so every user gets it.</div>
</div>

## Concrete example

```python
from fastmcp import FastMCP
mcp = FastMCP("dev-tools")

@mcp.prompt()
def summarize_pr(pr_number: int, focus: str = "risk") -> str:
    """Slash command: summarize a pull request."""
    return (f"Summarize pull request #{pr_number}. "
            f"Lead with the {focus}. Give a 3-bullet TL;DR, "
            f"then list any breaking changes. Be concise.")
```

The user triggers `/summarize_pr` with `pr_number=482`; the server returns a ready message. The user never sees or writes the underlying prompt — they just get expert-level phrasing every time. The `focus` argument makes the template flexible without exposing prompt internals.

## How a company uses this

A Dubai law firm's contract-review MCP server ships a small library of prompts: `/flag-termination-risk`, `/summarize-obligations`, `/compare-to-standard`. Junior associates who aren't prompt engineers get partner-quality analysis by picking a command — the firm's best phrasing is encoded once, centrally, and updated in one place when the model or the review methodology changes. This is the production value: prompt quality stops being per-user tribal knowledge and becomes a versioned, maintained asset. When they upgraded models, they re-tuned the prompt templates centrally and every associate improved overnight — no retraining, no docs to circulate.

## Common mistakes

- **Confusing prompts with tools.** A prompt doesn't *do* anything — it returns messages for the model to run. It has no side effects itself.
- **Forgetting they're user-controlled.** Prompts surface as explicit user actions (slash commands), not something the model auto-invokes.
- **Hard-coding values that should be arguments.** A template with no parameters is just a static string; parameterize what varies.
- **Overlooking resource embedding.** Building a prompt that references a document without pulling the resource in means the model lacks the context.

## Interview tip

Say: *"Prompts are user-invoked, reusable templates — the third control mode alongside model-controlled tools and app-controlled resources. They let a server author bottle expert prompt phrasing as a slash command, so non-experts get it right, and the messages can embed resources to bundle instructions with context."* Naming the three control directions — user (prompts), model (tools), app (resources) — in one sentence is the cleanest way to prove you understand MCP's primitive design.
