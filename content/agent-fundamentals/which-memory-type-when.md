# Which Memory Type When

**What it is:** The decision framework for picking the right memory for the job — short-term vs long-term, and within long-term, semantic vs episodic vs procedural — instead of throwing everything into one bucket.

## Why it matters for an AI Engineer

Beginners build "memory" as one big pile of text and wonder why the agent is slow, expensive, and sometimes recalls the wrong thing. The mature move is to recognise that different information wants different storage and recall — a fact, an event, and a skill are not the same, and neither are "this turn" and "across sessions." Choosing correctly is a design skill interviewers probe directly ("how would you design memory for a personal assistant?"), and it's the difference between an agent that feels coherent and one that feels random. This tile ties the whole memory group together into a decision you can make in seconds.

## The mechanism: how to decide

Two questions, in order:

**1. Does it need to survive the session?**
- *No* → [Short-term memory](short-term.md). The current task's context: conversation, tool results, scratchpad. Volatile, in-window. Everything uses this every turn.
- *Yes* → [Long-term memory](long-term.md). Persist it externally and recall selectively later.

**2. If long-term, what *kind* of information is it?**
- A **fact** true across time ("user is based in Dubai," "refund window is 14 days") → [Semantic memory](semantic-memory.md). Extract, upsert by key, reconcile contradictions.
- A **specific past event** ("on Aug 3 you asked to cancel Netflix") → [Episodic memory](episodic.md). Store time-stamped, recall by similarity + recency.
- A **reusable how-to / skill** ("the steps to process a refund") → [Procedural memory](procedural-memory.md). Store as a playbook, recall by task type.

Then a cross-cutting question: **how do I retrieve it at scale?** For anything beyond a small fixed set of facts, the recall mechanism is [vector memory](vector-memory.md) (embed + nearest-k, filtered per user). A tiny set (10–20 facts) can just be injected wholesale — no vector search needed.

The mnemonic: **semantic = what's true, episodic = what happened, procedural = how to act.** Real agents use *several* types at once.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🧠 A piece of info to remember</span>
    <span class="darr">↓<span class="lbl">survives session?</span></span>
    <div class="flow">
      <span class="dbox orange">No → Short-term<span class="sub">in-context scratchpad</span></span>
      <span class="dbox blue">Yes → Long-term</span>
    </div>
    <span class="darr">↓<span class="lbl">what kind?</span></span>
    <div class="flow">
      <span class="dbox green">Fact → Semantic</span>
      <span class="dbox purple">Event → Episodic</span>
      <span class="dbox yellow">How-to → Procedural</span>
    </div>
  </div>
  <div class="dcap">Decide by persistence first, then by the kind of information. Retrieve at scale with vector memory.</div>
</div>

## Concrete example (worked routing)

Designing memory for a personal travel assistant — route each item:

| Information | Persist? | Type | Why |
|---|---|---|---|
| The flights we're comparing *right now* | No | [Short-term](short-term.md) | only needed for this task |
| "User is based in DXB, prefers window seats" | Yes | [Semantic](semantic-memory.md) | timeless fact, upsert if it changes |
| "On Aug 3 booked EK to London, seat 32A" | Yes | [Episodic](episodic.md) | a specific event, recall on "my last trip" |
| "The steps to rebook a cancelled flight" | Yes | [Procedural](procedural-memory.md) | reusable workflow |
| Recall across 3 years of the above | — | [Vector](vector-memory.md) | scalable similarity retrieval |

When the user says "book me a trip like my last one," the agent pulls the **episodic** record of the last trip, the **semantic** seat preference, and follows the **procedural** booking routine — three memory types cooperating on one request.

## How a company uses this

A hospitality group in Dubai builds a guest concierge agent and maps memory deliberately: **short-term** holds the current chat; **semantic** stores durable guest facts (dietary needs, room preferences, loyalty tier) injected wholesale since it's ~15 facts; **episodic** stores past stays and requests in a vector store for "last time I stayed you upgraded me" recall; **procedural** stores service playbooks (how to handle a late checkout, how to arrange airport transfer) for consistency. The explicit split gave them **cheaper prompts** (they inject only what each request needs, not a giant blob), **correct recall** (a stale event can't masquerade as a current preference), and **auditability** — compliance can inspect exactly what's stored per guest. Treating memory as one bucket had produced a slow, expensive, occasionally-wrong prototype; typing it fixed all three.

## Common mistakes

- **One-bucket memory.** Dumping facts, events, and skills into a single vector store makes recall noisy and reasoning about recency/contradiction impossible.
- **Persisting the whole transcript.** That's neither clean semantic facts nor useful episodes — extract the right shape for each type.
- **Vector-searching a tiny fact set.** If you have 15 facts, just inject them; a vector round-trip is needless latency and cost.
- **Forgetting they combine.** Real requests often need short-term + all three long-term types at once; design for cooperation, not exclusivity.

## Interview tip
Say: *"I decide memory in two steps: does it survive the session — no means short-term context, yes means long-term. Then by kind: facts go to semantic, events to episodic, how-to to procedural. Semantic = what's true, episodic = what happened, procedural = how to act. For scale I recall via vector search with per-user filters; for a tiny fact set I just inject it. A good agent uses several types together."* Delivering that clean decision tree, with the mnemonic, is exactly what "design memory for an assistant" questions want.

See also: every memory tile in this node — [Short-term](short-term.md), [Long-term](long-term.md), [Semantic](semantic-memory.md), [Episodic](episodic.md), [Procedural](procedural-memory.md), [Vector](vector-memory.md), [Eviction/forgetting](memory-eviction-forgetting.md).
