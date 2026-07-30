# Episodic Memory

**What it is:** Memory of *specific past events* — "what happened, when" — like the individual conversations, actions, and outcomes the agent has experienced.

## Why it matters for an AI Engineer

Episodic memory is one of the three flavours of [long-term memory](long-term.md), and it's the one that gives an agent *continuity of experience*. It's why an assistant can say "last Tuesday you asked me to cancel that subscription — did that go through?" or why a coding agent can recall "the last time I touched this file, the tests failed for reason X." Without episodic memory, every interaction is a blank slate; with it, the agent can reference, learn from, and avoid repeating its own past. For an AI Engineer, knowing when a task needs *event recall* (versus just facts) is a real design decision — episodic memory is heavier to store and retrieve, so you use it deliberately.

## The mechanism: how it works

An **episode** is a time-stamped record of a past interaction or event: *what the user asked, what the agent did, what happened, and when*. Unlike [semantic memory](semantic-memory.md) (which stores distilled *facts*), episodic memory stores the *raw experience* with its temporal context intact.

The lifecycle:

1. **Capture** — after an interaction, save an episode: a summary of the exchange, the actions taken, the outcome, and a timestamp (plus metadata like user ID, session ID, tags).
2. **Store** — usually in a [vector store](vector-memory.md) so episodes are retrievable by semantic similarity, often alongside the timestamp so you can also filter/sort by time ("most recent first," "in the last week").
3. **Recall** — when the current situation resembles a past one, retrieve the relevant episodes and inject them. This powers both *reference* ("as we discussed yesterday…") and *learning* ("last time this approach failed, so try another").

The two things that make memory *episodic* rather than just "stored text": it's **event-shaped** (an occurrence, not a fact) and it's **time-anchored** (recency and ordering matter). That temporal dimension is why episodic recall often combines similarity search with a recency filter.

<div class="diagram">
  <div class="dstack">
    <span class="dbox blue">🕐 Mon 09:12 — user asked to cancel subscription → done</span>
    <span class="dbox blue">🕐 Tue 14:40 — user reported a failed payment → refunded</span>
    <span class="dbox blue">🕐 Wed 11:05 — user asked about that refund → confirmed</span>
  </div>
  <div class="dcap">Episodic memory = time-stamped records of specific events, recalled by similarity + recency.</div>
</div>

## Concrete example

Storing and recalling episodes with timestamps:

```python
import time, chromadb
from openai import OpenAI
client = OpenAI()
ep = chromadb.Client().create_collection("episodes")

def embed(t):
    return client.embeddings.create(
        model="text-embedding-3-small", input=t).data[0].embedding

def log_episode(user, summary):                    # CAPTURE + STORE
    ep.add(ids=[f"{user}-{time.time()}"],
           embeddings=[embed(summary)], documents=[summary],
           metadatas=[{"user": user, "ts": time.time()}])

def recall_episodes(user, query, k=3):             # RECALL by similarity
    r = ep.query(query_embeddings=[embed(query)], n_results=k,
                 where={"user": user})
    pairs = list(zip(r["documents"][0], [m["ts"] for m in r["metadatas"][0]]))
    return sorted(pairs, key=lambda p: p[1], reverse=True)   # most recent first

log_episode("u7", "2026-08-03: user asked to cancel Netflix; cancelled OK.")
log_episode("u7", "2026-08-04: user's card payment failed; issued refund.")

print(recall_episodes("u7", "did my cancellation go through?"))
# -> [('2026-08-03: user asked to cancel Netflix; cancelled OK.', ...)]
```

The timestamp in metadata is what makes it episodic — you retrieve by relevance, then order by recency so "what happened most recently" surfaces first.

## How a company uses this

A telecom in Dubai runs a support agent with episodic memory across channels (app chat, phone, WhatsApp). When a customer messages "is my issue fixed yet?", the agent recalls the **specific prior episode** — "yesterday you reported no 5G in Marina; a network ticket was raised (#4471)" — and answers precisely instead of asking them to re-explain. In production they cap each customer to their **last ~50 episodes** with older ones consolidated into semantic facts, keeping recall fast (~15ms) and storage bounded. The measurable win: repeat-contact handling time dropped because customers stopped having to re-tell their story — the agent already *remembered the event*.

## Common mistakes

- **Confusing episodic with semantic.** "User's card failed on Aug 4" is episodic (an event); "user pays by Visa" is semantic (a fact). Storing everything as flat facts loses the *when*, so the agent can't reason about sequence or recency.
- **Ignoring recency.** Pure similarity search can surface a stale episode over a fresh one. Combine similarity with a time filter or recency sort.
- **Unbounded growth.** Episodes accumulate fast. Consolidate old ones into semantic facts and evict (see [forgetting](memory-eviction-forgetting.md)).
- **Storing raw transcripts as episodes.** Summarise each episode to what happened + outcome; raw logs bloat the store and blur retrieval.

## Interview tip
Say: *"Episodic memory stores specific time-stamped events — what happened and when — versus semantic memory which stores distilled facts. It's what lets an agent say 'last Tuesday you asked me X.' I store episodes in a vector store with timestamps, recall by similarity plus recency, and consolidate old episodes into semantic facts to bound growth."* The episodic-vs-semantic distinction is a classic interview probe — nailing it with an example stands out.

See also: [Semantic memory](semantic-memory.md) (facts vs events), [Vector memory](vector-memory.md) (how episodes are retrieved), [Which memory type when](which-memory-type-when.md).
