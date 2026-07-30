# Memory Eviction / Forgetting

**What it is:** Deciding *what to drop* as an agent's memory grows — pruning stale, redundant, or low-value memories so the store stays fast, cheap, and accurate instead of growing forever.

## Why it matters for an AI Engineer

Every long-running agent accumulates memory, and memory that only ever grows becomes a liability: search slows down, costs climb, and — worst of all — **stale memories produce wrong answers** ("user lives in London" long after they moved to Dubai). Forgetting isn't a bug to avoid; it's a feature you must design. Humans forget on purpose so that what remains is relevant, and agents need the same. For an AI Engineer, eviction is where memory systems either stay production-grade or slowly rot. Interviewers ask "what happens when your memory store has 10 million entries?" — and "I forget" is the right answer, if you can say *how*.

## The mechanism: how it works

Forgetting has two jobs: **bound the size** (cost/latency) and **keep the store true** (correctness). The main strategies, often combined:

- **Recency (TTL / time decay)** — drop or down-weight old memories. A hard time-to-live deletes anything older than N days; softer **time decay** keeps them but lowers their retrieval score so fresh memories win.
- **Relevance / usage** — keep memories that get recalled often; evict ones never retrieved. This is essentially an **LRU** (least-recently-used) policy applied to memory.
- **Capacity cap** — set a max per user (e.g. 500 memories); when full, evict by the lowest recency×relevance score.
- **Consolidation** — instead of deleting, *compress*: merge many related [episodic](episodic.md) memories into one [semantic](semantic-memory.md) fact ("asked about refunds 5 times" → "user cares about refund policy"), or de-duplicate near-identical vectors. This preserves the signal while shrinking the store — the highest-value technique.
- **Contradiction resolution** — when a new fact conflicts with an old one, *overwrite* the old (see [semantic memory](semantic-memory.md) reconciliation). This is forgetting in service of correctness.

The guiding principle: a memory's worth is roughly **recency × importance × usage**. Evict the bottom of that ranking. And short-term memory has its own form of forgetting — compaction (see [short-term memory](short-term.md)) — which is eviction inside the context window.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ Growing store</span>
    <span class="darr">→<span class="lbl">score = recency × usage × importance</span></span>
    <div class="dstack">
      <span class="dbox green">✅ Keep (fresh, used, important)</span>
      <span class="dbox orange">🔀 Consolidate (redundant → 1 fact)</span>
      <span class="dbox gray">🗑️ Evict (stale, never recalled)</span>
    </div>
  </div>
  <div class="dcap">Rank memories by recency × usage × importance; keep the top, consolidate the redundant, drop the rest.</div>
</div>

## Concrete example

A simple capacity-bounded store with a recency×usage eviction score and contradiction overwrite:

```python
import time

class MemoryStore:
    def __init__(self, cap=500):
        self.cap = cap
        self.items = {}   # key -> {"text", "ts", "hits", "importance"}

    def add(self, key, text, importance=1.0):
        self.items[key] = {"text": text, "ts": time.time(),
                           "hits": 0, "importance": importance}  # overwrite = forget old
        if len(self.items) > self.cap:
            self._evict()

    def recall(self, key):
        m = self.items.get(key)
        if m: m["hits"] += 1               # usage signal
        return m and m["text"]

    def _score(self, m):
        age_days = (time.time() - m["ts"]) / 86400
        recency = 0.98 ** age_days          # time decay
        return recency * (1 + m["hits"]) * m["importance"]

    def _evict(self):                       # drop the lowest-value memory
        worst = min(self.items, key=lambda k: self._score(self.items[k]))
        del self.items[worst]

s = MemoryStore(cap=2)
s.add("loc", "User lives in London")
s.add("loc", "User lives in Dubai")        # contradiction -> old one forgotten
s.add("bank", "Banks with ENBD")
s.add("food", "Vegetarian")                # over cap -> evicts least valuable
```

The `add` on the same key overwrites (forgetting the stale London fact), and exceeding `cap` triggers eviction of the lowest recency×usage×importance memory.

## How a company uses this

A ride-hailing app in Dubai runs per-rider memory agents. Left unbounded, active riders accumulated **thousands of memories each**, pushing recall latency past 100ms and monthly vector-store cost up sharply. They added a three-part policy: a **90-day TTL** on raw episodic memories, **nightly consolidation** that rolls old trips into semantic patterns ("prefers airport rides on weekday mornings"), and **contradiction overwrite** on preferences. Result: memory per rider stayed bounded at a few hundred entries, recall dropped back to **~15ms**, cost fell, and — the correctness win — the agent stopped acting on outdated preferences (like a since-changed home address). Forgetting was what made the memory system *safe* to run, not just cheap.

## Common mistakes

- **Never forgetting.** The default failure. Unbounded stores get slow, pricey, and wrong. Design eviction from day one.
- **Deleting when you should consolidate.** Hard-deleting loses signal; merging episodes into a fact keeps it. Prefer consolidation for valuable-but-redundant memory.
- **Pure recency.** TTL alone can drop a rarely-recalled but *important* memory (an allergy). Weight by importance too.
- **Forgetting to resolve contradictions.** Keeping both old and new versions of a fact is worse than forgetting either — the agent picks randomly.

## Interview tip
Say: *"Forgetting is a feature. I bound memory by a score of recency × usage × importance — evict the bottom, consolidate redundant episodes into semantic facts rather than hard-deleting, enforce a per-user cap and TTL, and overwrite contradicted facts so the store stays current. In-context, the equivalent is compaction. Unbounded memory is slow, expensive, and — worst — wrong."* Ending on "wrong, not just expensive" shows you grasp that eviction is about correctness, which is the deeper point.

See also: [Short-term](short-term.md) (compaction = in-context forgetting), [Semantic memory](semantic-memory.md) (contradiction resolution), [Vector memory](vector-memory.md) (de-duplication), [Which memory type when](which-memory-type-when.md).
