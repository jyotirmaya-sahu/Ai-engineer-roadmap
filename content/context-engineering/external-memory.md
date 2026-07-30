# External Memory

**The one-line idea:** store facts *outside* the context window — in a database or file — and load only the relevant ones back in when you need them, so the model can "remember" far more than fits in a single prompt.

## Why it matters for an AI Engineer

The context window is the model's *working* memory: small, temporary, and wiped between calls. External memory is its *long-term* memory: durable, effectively unlimited, and searchable. Every product that "remembers you" — a support agent that recalls your last three tickets, a coding assistant that knows your project conventions, a personal assistant that learns your preferences — is doing this. Without external memory, every conversation starts from zero and the model can only know what fits in one window. This is the pattern behind the "memory" feature in modern assistants, and it's a standard interview topic because it's how you turn a stateless model into something that feels persistent.

## The mechanism / how it works

The model itself is stateless — it never changes and stores nothing. *You* build the memory around it. The loop has four moves:

1. **Write.** After (or during) a conversation, extract durable facts — "user prefers Arabic," "account tier: premium," "allergic to X" — and save them to a store (a vector DB, a key-value store, or plain rows in Postgres).
2. **Retrieve.** On a new turn, fetch the memories relevant to the current message. This is either a **semantic search** (embed the query, find similar stored memories — the same machinery as [RAG](rag-dynamic-filters.md)) or a direct lookup by user ID.
3. **Inject.** Paste the retrieved memories into the context, usually just under the system prompt, as a "what we know about this user" block.
4. **Update.** Revise or delete memories as facts change, so the store doesn't rot.

There are two flavors. **Short-term / working memory** is the current conversation, kept in the window (and eventually [summarized](summarization-pruning.md) when it grows). **Long-term memory** is the external store that survives across sessions. Good systems tier them: recent turns live in the window, older knowledge lives outside and is pulled back on demand.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 new message</span>
    <span class="darr">→<span class="lbl">semantic search</span></span>
    <span class="dbox blue">💾 memory store<span class="sub">outside the window</span></span>
    <span class="darr">→<span class="lbl">top-k facts</span></span>
    <span class="dbox orange">📋 injected memory block</span>
    <span class="darr">→</span>
    <span class="dbox purple">🤖 model</span>
  </div>
  <div class="dcap">Load only the relevant stored facts back into the window per turn — the store holds everything, the window holds what's needed now.</div>
</div>

## Concrete example

```python
# A minimal long-term memory over a vector store (pseudocode-real).
from openai import OpenAI
client = OpenAI()

def remember(user_id, text, store):          # WRITE
    vec = client.embeddings.create(model="text-embedding-3-small",
                                   input=text).data[0].embedding
    store.upsert(user_id=user_id, text=text, vector=vec)

def recall(user_id, query, store, k=5):       # RETRIEVE
    qvec = client.embeddings.create(model="text-embedding-3-small",
                                    input=query).data[0].embedding
    return store.search(user_id=user_id, vector=qvec, k=k)  # top-k memories

def build_context(user_id, query, store):     # INJECT
    mems = recall(user_id, query, store)
    memblock = "Known facts about this user:\n" + "\n".join(f"- {m.text}" for m in mems)
    return [{"role": "system", "content": SYSTEM + "\n\n" + memblock},
            {"role": "user", "content": query}]
```

Frameworks like `mem0`, LangGraph's memory store, and LlamaIndex ship this loop pre-built, but it's the same four moves underneath.

## How a company uses this

A Dubai property-tech assistant remembers each buyer's budget, preferred neighborhoods, and viewed listings across weeks of chats. Those facts live in Postgres + pgvector, not the prompt. On a new message it pulls the ~5 most relevant memories (a few ms, ~$0.00002 per embed) and injects ~200 tokens instead of replaying a 50-turn history that would cost thousands of tokens and blow latency. The scaling win is real: with 100K users, storing memory externally and loading k=5 per turn keeps every prompt small and flat-cost regardless of how long a user's history gets. The failure mode they watch for is **stale memory** — "budget: 2M AED" from six months ago — so writes carry timestamps and old facts decay.

## Common mistakes / misconceptions

- **Confusing memory with fine-tuning.** External memory changes *what's in the prompt*, not the model's weights. It's instant, per-user, and reversible; fine-tuning is none of those.
- **Dumping the whole store in.** The point is to retrieve *relevant* memories, not all of them — otherwise you've just recreated the context-overflow problem.
- **Never updating or expiring.** Facts change. Without updates/decay you inject confidently wrong information.
- **Storing raw transcripts as "memory."** Extract atomic facts. A 50-turn transcript is data, not memory; you still have to summarize it.

## Interview tip

Say: *"The model is stateless, so I build memory around it: durable facts go to an external store, and each turn I semantically retrieve just the relevant ones and inject a small memory block — working memory in the window, long-term memory outside it. I timestamp and expire facts to avoid stale-memory bugs."* Drawing the working-vs-long-term split and naming the write/retrieve/inject/update loop shows you understand it as a system, not a checkbox feature.
