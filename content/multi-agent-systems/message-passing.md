# Message Passing

**What it is:** agents communicating by sending explicit messages to each other — "here's my result, over to you" — like a group chat where each turn is addressed to someone.

## Why it matters for an AI Engineer

Message passing is one of the two fundamental ways agents share information (the other is [shared state](shared-state-memory.md)). It's the model behind conversational frameworks like AutoGen, and it maps cleanly onto how humans coordinate — you read the last message, respond, and the conversation moves. For an AI Engineer, knowing *when* message passing beats shared state (and when it doesn't) is a real design decision: messages give you a natural audit trail but grow the context every turn, which is a cost and correctness trap on long runs.

## The mechanism / how it works

Each agent's input is a **list of messages** (the conversation so far); its output is a new message appended to that list. The next agent to act reads the running transcript and adds its own message. Coordination is implicit in the transcript: whoever speaks next sees everything said before.

The **critical property**: the message history *accumulates*. Turn 1 has one message; turn 20 has twenty. Every agent re-reads the whole growing transcript on its turn, and you pay for those tokens every time. This is the flip side of message passing's simplicity — on long multi-agent conversations the context balloons, cost rises quadratically-ish, and agents start getting distracted by stale early messages.

<div class="diagram">
  <div class="dstack">
    <span class="dbox gray">👤 user: "research + summarize UAE fintech"</span>
    <span class="dbox blue">🔎 researcher: "found 3 facts: …"</span>
    <span class="dbox purple">✍️ writer: "draft summary: …"</span>
    <span class="dbox orange">🕵️ critic: "claim 2 unsupported, revise"</span>
    <span class="dbox blue">✍️ writer: "revised: …"</span>
  </div>
  <div class="dcap">A shared transcript grows each turn; every agent reads the whole thing — simple, auditable, but token-hungry.</div>
</div>

To keep it affordable on long runs you *trim or summarize* old messages (see [tool-result trimming](../agent-cost-context-control/tool-result-trimming.md) and compaction) — you don't let the transcript grow unbounded.

## A concrete example

AutoGen (v0.4+, 2026) is built entirely on message passing between agents:

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

model = OpenAIChatCompletionClient(model="gpt-4o")
researcher = AssistantAgent("researcher", model, system_message="Find facts.")
writer     = AssistantAgent("writer", model, system_message="Write the summary.")

team = RoundRobinGroupChat(
    [researcher, writer],
    termination_condition=MaxMessageTermination(6),  # cap messages or it never ends
)
# each agent reads the shared message list and appends its reply
result = await team.run(task="Research and summarize UAE fintech news.")
```

`MaxMessageTermination(6)` is the essential guardrail: message-passing conversations have no natural end, so you cap the number of messages.

## How a company uses this

A Dubai software consultancy uses an AutoGen group chat for code review: a "coder" agent and a "reviewer" agent converse until the reviewer approves. Message passing suits it because the *back-and-forth is the product* — you want to see the reviewer's objection and the coder's fix as a readable thread, which doubles as an audit log for the client. But they cap it at 8 messages and summarize the transcript if it runs long: an uncapped review chat once spiraled to 30 messages arguing over a semicolon, costing more than the feature was worth. The cap plus summarization made it shippable.

## Common mistakes / misconceptions

- **Unbounded transcripts.** The history grows every turn and you pay for all of it — cap message count and summarize old turns.
- **No termination condition.** Message-passing conversations don't naturally stop; without a cap they run forever (see [infinite-loops.md](infinite-loops.md)).
- **Using it when shared state is simpler.** If agents just need to read/write a common object (a plan, a document), [shared state](shared-state-memory.md) is cheaper than replaying a whole transcript.
- **Losing addressing.** In a busy chat, agents can respond to the wrong prior message; structured turns or explicit routing prevent this.

## Interview tip
Say: *"Message passing is agents communicating via a shared, growing transcript — natural and auditable, which is why AutoGen uses it, but the context accumulates every turn so I cap message count and summarize old turns. When agents just need to read and write a common object rather than converse, I use shared state instead, which is cheaper."* Naming the cost trade-off versus shared state is the senior move.
