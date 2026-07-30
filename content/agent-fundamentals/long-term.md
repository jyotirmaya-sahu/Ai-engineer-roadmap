# Long-term Memory

**What it is:** Memory that *persists across sessions* — facts, past interactions, and learned skills the agent stores outside the context window and recalls in future conversations.

## Why it matters for an AI Engineer

[Short-term memory](short-term.md) is wiped the moment a session ends. That's fine for a one-off question, but useless for anything that should feel continuous: a personal assistant that remembers your name and preferences, a support agent that recalls your open ticket from yesterday, a coding agent that remembers your project's conventions. Long-term memory is what makes an agent *personalised and stateful over time* instead of an amnesiac that reintroduces itself every session. In 2026, "memory" is a headline feature of every serious assistant product — and building it correctly (what to store, how to recall it, what to forget) is a core AI-Engineer skill.

## The mechanism: how it works

Long-term memory lives in **external storage** — a database, a vector store, a key-value store — and is loaded back into [short-term memory](short-term.md) only when relevant. The lifecycle has three moving parts:

1. **Write** — during or after a session, decide what's worth keeping and save it. You almost never save the whole transcript; you extract durable facts ("user prefers metric units," "works at a Dubai bank," "the API key rotates monthly").
2. **Store** — put it somewhere queryable. Structured facts go in a database or key-value store; free-form memories go in a [vector store](vector-memory.md) so you can retrieve by similarity.
3. **Read / recall** — at the start of (or during) a new session, fetch the relevant memories and inject them into the context. You can't dump *all* memory into every prompt — it wouldn't fit and would cost a fortune — so recall is selective: fetch what matters for *this* query.

Crucially, long-term memory isn't one thing. It splits by *type* of information: [episodic](episodic.md) (specific past events), [semantic](semantic-memory.md) (facts and preferences), and [procedural](procedural-memory.md) (learned how-to skills) — mirroring how human memory is organised. The retrieval mechanism (usually [vector similarity](vector-memory.md)) is what turns a big store into just the few relevant memories you inject.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">💬 Session ends</span>
    <span class="darr">→<span class="lbl">extract facts</span></span>
    <span class="dbox blue">🗄️ Persistent store<span class="sub">DB / vector store</span></span>
    <span class="darr">→<span class="lbl">recall relevant</span></span>
    <span class="dbox purple">🧠 New session context</span>
  </div>
  <div class="dcap">Write durable facts out at the end, store them, and recall only the relevant ones into the next session.</div>
</div>

## Concrete example

A tiny long-term memory over a vector store — write at end of session, recall at start of next:

```python
from openai import OpenAI
import chromadb
client = OpenAI()
mem = chromadb.Client().create_collection("user_memory")

def embed(text):
    return client.embeddings.create(
        model="text-embedding-3-small", input=text).data[0].embedding

def remember(user_id, fact):                      # WRITE + STORE
    mem.add(ids=[f"{user_id}-{hash(fact)}"],
            embeddings=[embed(fact)],
            documents=[fact], metadatas=[{"user": user_id}])

def recall(user_id, query, k=3):                  # READ (selective)
    res = mem.query(query_embeddings=[embed(query)], n_results=k,
                    where={"user": user_id})
    return res["documents"][0]

# End of session 1:
remember("u42", "User prefers flights in the morning and window seats.")
remember("u42", "User is based in Dubai (DXB).")

# Start of session 2, new query:
context = recall("u42", "book me a flight to London")
# -> ['User is based in Dubai (DXB).', 'User prefers flights in the morning ...']
# inject `context` into the system prompt so the agent already knows this
```

Note the recall is *selective* — a "book a flight" query pulls the flight-preference and location memories, not every fact ever stored.

## How a company uses this

A wealth-management app in the DIFC gives each client a persistent assistant. Long-term memory stores each client's risk profile, past questions, and stated goals in a per-user vector namespace. When a client returns after two weeks and asks "should I rebalance?", the agent **recalls** their profile and prior decisions and answers in context — no re-onboarding. At scale (50k clients, millions of memories) they keep recall to the **top-5 memories per query (~20ms lookup)** rather than loading everything, and run a nightly **consolidation job** that de-duplicates and summarises each user's memories to stop the store growing without bound. Personalisation measurably lifted engagement; the engineering cost was almost entirely in *what to write and what to recall*, not the storage itself.

## Common mistakes

- **Storing whole transcripts.** They bloat the store and pollute recall with noise. Extract durable facts instead.
- **Recalling everything into context.** It won't fit and costs a fortune — recall selectively (top-k by relevance).
- **Never forgetting.** Stale memories ("user lives in London" after they moved to Dubai) produce wrong answers. Pair long-term memory with [eviction/forgetting](memory-eviction-forgetting.md).
- **Ignoring privacy.** Persisted user data is a compliance surface — especially in regulated Dubai finance/health sectors. Scope it per-user and honour deletion requests.

## Interview tip
Say: *"Long-term memory persists across sessions in external storage — I extract durable facts at the end of a session, store them (structured facts in a DB, free-form in a vector store), and recall only the relevant ones into the next session's context. It splits into episodic, semantic, and procedural. The hard parts are what to write and what to recall — not the storage — plus forgetting stale data and handling privacy."* Mentioning consolidation and privacy signals production maturity.

See also: [Semantic memory](semantic-memory.md), [Episodic](episodic.md), [Procedural memory](procedural-memory.md), [Vector memory](vector-memory.md) (the recall mechanism), [Memory eviction / forgetting](memory-eviction-forgetting.md).
