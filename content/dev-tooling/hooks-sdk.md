# Claude Code: Hooks & SDK

**What it is:** Hooks are commands that run automatically at set points in a Claude Code session. The SDK (Agent SDK) is a library for building your own AI agents in code, powered by the same engine as Claude Code.

## Why it matters for an AI Engineer

Two levels of power here. **Hooks** let you enforce rules and automate chores without asking every time — run tests after every edit, block commits that contain secrets, auto-format code. **The SDK** lets you build agents programmatically: instead of you typing to Claude, your *program* drives Claude to do work — reviewing PRs, triaging tickets, processing documents. Both are exactly the kind of AI automation Dubai employers want built. The SDK especially is your path from "I use an AI tool" to "I build AI agents."

## Hooks — automation on autopilot

A hook is a shell command Claude Code runs automatically at a specific moment (an "event"). Common events:

| Event | Fires when | Typical use |
|---|---|---|
| `PreToolUse` | Before Claude runs a tool | Block dangerous or unwanted actions |
| `PostToolUse` | After Claude edits a file | Auto-format, run tests |
| `UserPromptSubmit` | When you send a message | Inject extra context |

You configure hooks in `.claude/settings.json` in your project:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          { "type": "command", "command": "black . && pytest -q" }
        ]
      }
    ]
  }
}
```

Now every time Claude edits a file, your code is auto-formatted with `black` and the tests run — no reminders needed. A `PreToolUse` hook can inspect what Claude is about to do and block it (exit code 2 stops the action), which is great for guardrails like "never let it push to main."

Hooks make behavior **deterministic**: it happens every time, guaranteed, because it is code, not a polite request to the model.

## The Agent SDK — build your own agents

The SDK gives you Claude Code's engine as a library. Your program becomes the driver. It is available for Python and TypeScript.

```bash
pip install claude-agent-sdk
```

A minimal agent that answers a question about your codebase:

```python
import asyncio
from claude_agent_sdk import query

async def main():
    async for message in query(
        prompt="Summarize what src/retriever.py does in 3 bullet points"
    ):
        print(message)

asyncio.run(main())
```

The agent reads the file itself and reports back. Because it is code, you can wrap it in anything: a loop over 500 documents, a web server, a scheduled job.

A more real shape — an agent that reviews a code diff:

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def review(diff: str):
    options = ClaudeAgentOptions(
        system_prompt="You are a strict code reviewer. Flag bugs and security issues only."
    )
    async for msg in query(prompt=f"Review this diff:\n{diff}", options=options):
        print(msg)

asyncio.run(review(open("change.diff").read()))
```

You have just turned Claude into a programmatic reviewer you can run on every PR.

## A real company example

A Dubai SaaS team uses hooks and the SDK together. A `PreToolUse` hook blocks any Claude action that would write an API key into a file — a hard security guardrail. Separately, they built an SDK agent that runs in CI on every pull request: it reads the diff, checks it against their coding standards, and posts a summary comment. Hundreds of PRs get a consistent first-pass review automatically, and human reviewers only step in where the agent flags something. That agent is a product an AI Engineer built — exactly the kind of work these roles ask for.

## Common mistakes and gotchas

- **Slow hooks.** A `PostToolUse` hook that runs a huge test suite makes every edit crawl. Keep hooks fast; run heavy checks less often.
- **Hooks that fail silently.** If your hook command errors, understand whether it blocks Claude or not. Test hooks in isolation first.
- **Confusing the two.** Hooks automate *inside* an interactive session. The SDK builds *standalone* agents in your own program. Different jobs.
- **Hardcoding secrets in SDK scripts.** Read your API key from an environment variable, never from the code.
- **Unbounded agent loops.** An SDK agent in a loop can rack up cost fast. Cap iterations and add limits.

## Interview / practical tip

Draw the line clearly: "hooks make Claude Code sessions deterministic and safe — auto-format, run tests, block risky actions; the SDK lets me build standalone AI agents in code, like an automated PR reviewer." Then mention one agent you built with the SDK. Being able to say "I built an agent that does X" moves you from tool-user to agent-builder — the exact leap AI Engineer roles are hiring for.
