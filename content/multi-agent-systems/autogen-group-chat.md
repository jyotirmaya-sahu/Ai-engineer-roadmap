# AutoGen (group chat)

**What it is:** Microsoft's multi-agent framework built around *conversation* — agents collaborate by talking in a shared group chat, taking turns to respond until the task is done.

## Why it matters for an AI Engineer

AutoGen popularized the [message-passing](message-passing.md) style of multi-agent collaboration, where the *dialogue itself* drives the work. It's especially strong for flexible, open-ended tasks — research, brainstorming, iterative problem-solving — where you don't want to pre-wire the exact steps. For an AI Engineer, AutoGen is the framework to name when the task is *conversational* by nature, and knowing its group-chat model (and its speaker-selection knob) shows you can match a framework to a problem shape rather than forcing one tool everywhere.

## The mechanism / how it works

AutoGen (v0.4+, the redesigned 2025–26 architecture) models everything as agents exchanging messages. The core multi-agent primitive is a **team** where agents share a conversation:

- Each agent is an `AssistantAgent` with a model and a `system_message` describing its role.
- A **team** (e.g. `RoundRobinGroupChat` or `SelectorGroupChat`) manages *whose turn it is*. This **speaker-selection** logic is the heart of group chat:
  - **RoundRobin** — agents speak in a fixed rotation. Simple, predictable.
  - **Selector** — an LLM (or a custom function) picks who should speak next based on the conversation so far — a dynamic [router](routing.md) over speakers.
- A **termination condition** ends the chat: max messages, a stop keyword ("TERMINATE"), or a custom check. This is *mandatory* — conversations don't naturally end.

Agents read the shared transcript and append replies, so context accumulates every turn (see the cost note in [message-passing.md](message-passing.md)). AutoGen also supports human-in-the-loop by dropping a `UserProxyAgent` into the chat.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🗣️ Selector<span class="sub">who speaks next?</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">👤 Coder</span>
    <span class="darr">↔</span>
    <span class="dbox blue">🕵️ Reviewer</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ TERMINATE</span>
  </div>
  <div class="dcap">AutoGen: agents converse in a group chat; a selector picks the next speaker; a termination condition stops it.</div>
</div>

## A concrete example

A selector group chat (AutoGen 0.4+, 2026):

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import SelectorGroupChat
from autogen_agentchat.conditions import TextMentionTermination, MaxMessageTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

model = OpenAIChatCompletionClient(model="gpt-4o")

coder = AssistantAgent("coder", model,
    system_message="Write Python to solve the task. Say TERMINATE when the reviewer approves.")
reviewer = AssistantAgent("reviewer", model,
    system_message="Review the coder's code. Demand fixes until it's correct.")

team = SelectorGroupChat(
    [coder, reviewer], model_client=model,     # LLM picks who speaks next
    termination_condition=TextMentionTermination("TERMINATE") | MaxMessageTermination(10),
)
result = await team.run(task="Write a function to validate a UAE IBAN.")
```

The two termination conditions OR'd together are the safety net: stop on "TERMINATE" *or* at 10 messages, so a stuck chat can't run forever.

## How a company uses this

A Dubai software house uses an AutoGen group chat as an automated pair-programming loop: a coder agent and a reviewer agent converse until the reviewer approves, with a human `UserProxyAgent` able to jump in on tricky calls. The conversational model fits because code review *is* a back-and-forth, and the readable transcript serves as a review record for clients. They rely on the selector to let the reviewer interrupt when it spots a bug rather than waiting its turn — but they cap the chat at 10 messages, because early unbounded runs occasionally spiraled into 25-message arguments that cost more than the feature. Termination discipline made it production-viable.

## Common mistakes / misconceptions

- **No termination condition.** Group chats don't self-end; without a cap they loop forever ([infinite-loops.md](infinite-loops.md)).
- **Ignoring context growth.** Every turn re-reads the whole transcript — costs climb on long chats. Summarize or cap.
- **Using v0.2 patterns.** AutoGen was substantially rearchitected in v0.4; old `GroupChatManager` tutorials won't match current APIs. Check the version.
- **Forcing structured pipelines into a chat.** If the steps are fixed, a [pipeline](sequential-pipeline.md) or LangGraph is more predictable than a free conversation.

## Interview tip
Say: *"AutoGen models multi-agent work as a group chat — agents converse and a speaker-selector (round-robin or LLM-driven) decides who talks next, with a mandatory termination condition. It shines on open-ended, conversational tasks like iterative coding or research. I'm careful about context growth and always set a message cap, and I use the current v0.4 API, which is a big rewrite from v0.2."* Naming the rearchitecture and termination discipline signals you're current.
