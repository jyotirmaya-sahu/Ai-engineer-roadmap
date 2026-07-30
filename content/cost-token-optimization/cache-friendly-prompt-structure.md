# Cache-friendly prompt structure

**What it is:** Ordering your prompt so all the stable, repeated content sits at the front and everything that changes per request sits at the back — the layout that lets [prompt caching](prompt-kv-caching.md) actually hit.

## Why it matters for an AI Engineer

Prompt caching only works on a **byte-identical prefix**. The moment a single character early in the prompt differs, the cache misses and you pay full price for the whole thing. Most teams turn caching on, structure their prompt carelessly (user's question at the top, a timestamp in the system message), get a near-zero hit rate, and conclude "caching doesn't help us." It does — they just built the prompt in an order the cache can't use. Getting this right is the difference between a 5% and a 90% cache hit rate on the exact same content. It's free savings that only appears if the layout is correct.

## The mechanism / how it works

Caching matches from the **start of the prompt forward**, up to the first byte that differs. So the design rule is simple: **order content from most-stable to most-variable.**

A cache-friendly prompt is layered:

1. **System prompt** — role, rules, tone. Changes rarely (a deploy, not a request).
2. **Tool / function definitions** — same across all calls of a feature.
3. **Few-shot examples** — fixed demonstrations.
4. **Static context** — a policy doc, product catalog, or knowledge base pasted verbatim.
5. **← cache boundary goes here →**
6. **Retrieved chunks** — vary per query (semi-dynamic).
7. **Conversation history** — grows per turn.
8. **The user's current question** — always different. Must be **last**.

Everything above the boundary is one reusable prefix. Put a dynamic value — a `now()` timestamp, a request ID, a randomized instruction — anywhere in layers 1–4 and you've poisoned the prefix for every call. Common poisoners to hunt down: injected timestamps, per-user names in the system prompt, non-deterministic JSON key ordering, and trailing whitespace differences.

<div class="diagram">
  <div class="dstack">
    <span class="dbox blue">1. system prompt<span class="sub">stable</span></span>
    <span class="dbox blue">2. tools</span>
    <span class="dbox blue">3. few-shot</span>
    <span class="dbox blue">4. static context</span>
    <span class="dbox green">— cache boundary —</span>
    <span class="dbox orange">5. retrieved chunks<span class="sub">semi-dynamic</span></span>
    <span class="dbox orange">6. history</span>
    <span class="dbox gray">7. user question<span class="sub">always last</span></span>
  </div>
  <div class="dcap">Stable at top, variable at bottom — the shared prefix (blue) is what the cache reuses.</div>
</div>

## Concrete example

Anti-pattern (cache never hits — dynamic content first):

```python
system = f"Current time: {datetime.now()}. You are a support agent...\n{BIG_POLICY}"
# the timestamp changes every call → the whole prefix differs → 0% cache hit
```

Cache-friendly (stable prefix, dynamic pushed down):

```python
system = [
    {"type": "text", "text": STATIC_SYSTEM + BIG_POLICY,   # never changes
     "cache_control": {"type": "ephemeral"}},               # cache this prefix
]
messages = [
    {"role": "user",
     "content": f"{retrieved_chunks}\n\nTime: {now}\nQ: {question}"},  # all dynamic, last
]
```

Impact: a team with the timestamp-first bug ran at a **4% cache hit rate**. Moving the timestamp into the user turn lifted it to **91%**, cutting their input bill on cached segments ~85% — one line moved, no content changed.

## How a company uses this

An e-commerce assistant in the UAE had a big product-catalog block and few-shot examples in its prompt — ideal cache material — but injected the shopper's name and a session timestamp into the system message for "personalization." Hit rate sat near zero. An engineer moved name and timestamp into the final user message and left the catalog + examples as a frozen prefix; hit rate jumped past 90% and input spend dropped sharply overnight. The team then added a lint check in CI that fails the build if `datetime`, `uuid`, or the user object appears above the cache boundary — so nobody re-poisons the prefix by accident. At their volume, protecting that prefix is worth low-five-figures a month, so it's guarded like any other performance regression.

## Common mistakes

- **Dynamic value in the system prompt.** Timestamps, request IDs, user names up top silently kill every cache hit. The #1 cause.
- **Question or history at the top.** Retrieval-augmented prompts sometimes lead with the query; it must go last.
- **Non-deterministic serialization.** JSON with unstable key order, or trailing whitespace that varies, makes "identical" content byte-different.
- **Not monitoring hit rate.** Without watching it, a refactor can silently reorder the prompt and you won't notice cost creeping back up.

## Interview tip
Say: *"Prompt caching matches a byte-identical prefix from the start, so I structure prompts most-stable to most-variable: system prompt, tools, few-shot, and static context up top as one cacheable prefix; retrieved chunks, history, and the user's question at the bottom. The classic bug is a timestamp or username in the system prompt — it drops your hit rate to near zero on content that should be 90%+. I even lint for dynamic values above the cache boundary."* It shows you know why caching fails in practice, not just that it exists.
