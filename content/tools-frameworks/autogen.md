# AutoGen

**What it is:** Microsoft's multi-agent framework where agents solve problems by *talking to each other* — a conversation between specialized agents (and optionally a human) that continues until the task is done.

## Why it matters for an AI Engineer

AutoGen's distinctive idea is the **group chat**: instead of a fixed pipeline, several agents *converse*, each contributing when it's their turn, and the back-and-forth converges on an answer. This shines for problems that benefit from iteration — especially **code tasks**, where one agent writes code, another runs it, sees the error, and they iterate until it works. It's a major framework (backed by Microsoft, common in enterprise and research settings), so it appears in job specs, and knowing it lets you speak to the "conversational multi-agent" pattern that [CrewAI](crewai.md)'s pipeline model doesn't cover. Being able to compare AutoGen (conversation), CrewAI (roles/pipeline), and [LangGraph](langgraph-nodes-edges-state.md) (explicit graph) is a strong interview signal.

## The mechanism — conversable agents and group chat

The core abstraction is a **conversable agent**: an agent that can send and receive messages. A few standard kinds:

- **AssistantAgent** — an LLM-backed agent that reasons and writes replies (and code).
- **UserProxyAgent** — stands in for the human; critically, it can be configured to **execute code** the assistant writes and report back the result, or to pause for real human input.

You connect them and they *converse*. In the classic two-agent loop: the assistant writes code, the user-proxy runs it in a sandbox, the output (or error) goes back, and the assistant fixes and retries — a self-correcting loop driven purely by dialogue.

For more than two, a **GroupChat** + a **GroupChatManager** coordinates whose turn it is: the manager picks the next speaker (by round-robin, or by an LLM deciding who's most relevant), collects the reply, and continues until a termination condition (a keyword like `TERMINATE`, a max-round cap, or task completion).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🗣️ Task: "plot Dubai rent trend"</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🤖 Assistant: writes Python</span>
    <span class="darr">↓<span class="lbl">sends code</span></span>
    <span class="dbox orange">🧑‍💻 UserProxy: runs it in sandbox</span>
    <span class="darr">↑<span class="lbl">error → assistant fixes & retries</span></span>
    <span class="dbox green">✅ chart produced, chat terminates</span>
  </div>
  <div class="dcap">Agents solve by conversation: write → run → see result → fix. The dialogue IS the control-flow.</div>
</div>

## Concrete example (runnable, 2026-current)

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

model = OpenAIChatCompletionClient(model="gpt-5.4-mini")

writer = AssistantAgent("writer", model_client=model,
    system_message="Write clear Python. When the code works, reply DONE.")
reviewer = AssistantAgent("reviewer", model_client=model,
    system_message="Review the code for bugs. If good, reply DONE; else explain fixes.")

# they converse, alternating, until someone says DONE (or max rounds)
team = RoundRobinGroupChat([writer, reviewer],
        termination_condition=TextMentionTermination("DONE"))

import asyncio
async def main():
    result = await team.run(task="Write a function to compute compound interest.")
    print(result.messages[-1].content)
asyncio.run(main())
```

The two agents *talk*: the writer proposes, the reviewer critiques, they iterate until "DONE." That generator-critic conversation is AutoGen's signature pattern.

## How a company uses this — production lens

> **A Dubai data-consultancy** uses an AutoGen pair for ad-hoc analytics: an assistant that writes pandas code and a user-proxy that **executes it in a sandbox** and returns results or errors. Analysts describe a question in plain English and the two agents iterate to a correct chart — often self-correcting through 2–3 error rounds without a human. The production controls that mattered: a **max-round cap (they use 10)** because a genuinely-stuck pair will otherwise chat forever and burn tokens — one runaway session hit ~$5 before they added the cap; **code executed only in an isolated sandbox** (no network, client data can't leak); and a **cost note** — conversational agents are *chatty*, so a task that a single well-prompted call could do in 1 request sometimes took 8 message rounds. Their rule: use the conversation pattern only when *iteration genuinely helps* (code, debugging, debate); for one-shot tasks, don't. For strict control-flow and audit they'd use [LangGraph](langgraph-nodes-edges-state.md) instead.

## Common mistakes

- **No termination condition or round cap.** Two agents can chat indefinitely. Always set a stop keyword *and* a max-round limit.
- **Letting the user-proxy run code unsandboxed.** It executes model-written code — isolate it exactly like [code execution](code-execution.md).
- **Using conversation for non-iterative tasks.** If iteration doesn't help, the chatter just multiplies cost. Use it for code/debate/critique.
- **Vague system messages.** Agents need clear roles and a clear "how do we know we're done" signal, or the chat meanders.
- **Ignoring token cost.** Multi-round dialogue is expensive; monitor rounds and spend.

## Interview tip
Say: *"AutoGen solves tasks through agent *conversation* — its killer pattern is a writer agent and a code-executing proxy that iterate through errors until the code works. I reach for it when iteration genuinely helps, like coding or debate, and I always set a termination keyword plus a max-round cap and sandbox the code execution. Versus CrewAI's role-pipeline and LangGraph's explicit graph, AutoGen is the conversational option."* Being able to slot all three frameworks by their core abstraction — conversation vs roles vs graph — is exactly the comparison interviewers fish for.
