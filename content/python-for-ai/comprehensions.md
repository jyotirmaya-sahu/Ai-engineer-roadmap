# Comprehensions

**The one-line idea:** A comprehension is a one-line way to build a list, dict, or set from a loop. Instead of writing `for` + `append`, you say *what you want* in a single readable expression.

## Why this matters for an AI Engineer

You transform data constantly: extract every chunk's text, filter documents by score, turn a list of results into `{id: score}`, clean up embeddings. Comprehensions make these one line each — the standard, Pythonic way seniors write it. They're also faster than manual loops. You'll read them in every AI codebase (LangChain, LlamaIndex), so you must be fluent.

## From loop to comprehension

Here's the same task three ways. All build a list of squared numbers.

```python
# The long way
squares = []
for n in range(5):
    squares.append(n * n)

# The comprehension (same result, one line)
squares = [n * n for n in range(5)]      # [0, 1, 4, 9, 16]
```

Read it left-to-right: **`[ expression  for item in iterable ]`**. "Give me `n*n`, for each `n` in the range."

## Adding a condition (filter)

Put an `if` at the end to keep only some items:

```python
# Only even numbers, squared
evens = [n * n for n in range(10) if n % 2 == 0]   # [0, 4, 16, 36, 64]

# Real: keep only retrieved chunks above a score threshold
chunks = [{"text": "a", "score": 0.9, "source": "doc1"},
          {"text": "b", "score": 0.4, "source": "doc2"},
          {"text": "c", "score": 0.85, "source": "doc1"}]
good = [c for c in chunks if c["score"] > 0.8]     # keeps a and c
```

Want an `if/else` that *changes the value* (not filters)? It goes at the **front**:

```python
scores = [0.9, 0.3, 0.7, 0.5]
labels = ["pass" if s > 0.5 else "fail" for s in scores]   # ['pass','fail','pass','fail']
```

Rule of thumb: `if` at the **end** = filter (drop items). `if/else` at the **front** = transform (keep all, change value).

## Dict and set comprehensions

Same idea, different brackets.

```python
# DICT comprehension — build key: value pairs
scores = {"doc1": 0.9, "doc2": 0.3, "doc3": 0.7}
passed = {name: s for name, s in scores.items() if s > 0.5}
# {'doc1': 0.9, 'doc3': 0.7}

# SET comprehension — build a set (auto-dedupes)
unique_sources = {chunk["source"] for chunk in chunks}
```

## Nested comprehensions (flattening)

A common need: turn a list of lists into one flat list. This happens when you chunk many documents and want all chunks together.

```python
docs = [["a", "b"], ["c", "d"], ["e"]]

# Flatten: read the fors in the SAME order you'd write nested loops
flat = [chunk for doc in docs for chunk in doc]
# ['a', 'b', 'c', 'd', 'e']
```

The trick: `for doc in docs` is the outer loop, `for chunk in doc` is the inner — same order as regular nested `for`s. Keep nesting shallow; two levels is the readable limit.

## Generator expressions — the lazy cousin

Swap `[ ]` for `( )` and you get a **generator expression**. It doesn't build the whole list in memory — it produces items one at a time, on demand. This matters for big or infinite data.

```python
# List: builds ALL 10 million numbers in RAM at once
total = sum([n * n for n in range(10_000_000)])   # memory-heavy

# Generator: computes one at a time, ~zero extra memory
total = sum(n * n for n in range(10_000_000))     # lean and fast
```

When you're just going to consume the values once (like feeding `sum()`, `any()`, or a loop), use a generator expression — no reason to hold the full list.

## Real world: how a company uses this

> **A Dubai fintech** runs an LLM to classify support tickets. After calling the model on a batch, they process results in one clean line each: keep only confident predictions — `[r for r in results if r["confidence"] > 0.9]`; build a `{ticket_id: category}` lookup with a dict comprehension; collect the distinct categories seen today with a set comprehension. When streaming a 2 GB export of tickets, they use a **generator expression** so the file never loads fully into memory. Four comprehensions replace ~20 lines of loops — and every reviewer reads them instantly.

## Common mistakes

- **Cramming too much in.** If a comprehension needs a comment to understand, use a normal loop.
- Confusing filter-`if` (end) with transform-`if/else` (front).
- Writing `{ }` and expecting a dict when you meant a set — `{x for x in y}` is a set; `{k: v for ...}` is a dict.
- Using a list comprehension when you only iterate once over huge data — wastes memory; use a generator.

## Interview tip

Be ready to convert a `for`/`append` loop into a comprehension live, and to explain *"a generator expression is lazy — it yields one item at a time, so it's memory-efficient for large or streamed data, whereas a list comprehension materializes everything at once."* That memory distinction is the senior-level answer.
