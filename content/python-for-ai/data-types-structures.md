# Data Types & Structures

**The one-line idea:** Python gives you a few built-in containers — `list`, `tuple`, `dict`, `set`, `str` — and picking the right one is 80% of writing clean, fast Python. Each is good at *one* thing.

## Why this matters for an AI Engineer

Every LLM app is just data moving through containers. An API returns a `dict` (JSON). You collect chat messages in a `list`. You store unique document IDs in a `set` so you don't embed the same file twice. You slice a prompt `str`. Get the container wrong and your code is slow, buggy, or unreadable. This is the most-used knowledge in the whole job — more than any framework.

## The five containers at a glance

| Type | Looks like | Ordered? | Changeable (mutable)? | Duplicates? | Use it for |
|---|---|---|---|---|---|
| `list` | `[1, 2, 3]` | yes | **yes** | yes | a sequence you'll add to / change |
| `tuple` | `(1, 2, 3)` | yes | **no** | yes | a fixed record that shouldn't change |
| `dict` | `{"a": 1}` | yes (insertion) | **yes** | keys unique | lookup by name (key → value) |
| `set` | `{1, 2, 3}` | no | **yes** | **no** | uniqueness + fast "is it in here?" |
| `str` | `"hello"` | yes | **no** | yes | text |

## Mutability — the concept that trips everyone

**Mutable** = can be changed in place. **Immutable** = once made, it's frozen; any "change" makes a *new* object.

- Mutable: `list`, `dict`, `set`
- Immutable: `tuple`, `str`, `int`, `float`, `bool`

Why care? Two variables can point at the *same* mutable object:

```python
a = [1, 2, 3]
b = a          # b points at the SAME list, not a copy
b.append(4)
print(a)       # [1, 2, 3, 4]  <- a changed too! surprise bug

# Fix: make a real copy
c = a.copy()   # or list(a)
c.append(9)
print(a)       # unchanged
```

Immutable things can't do this to you — that's why `tuple` and `str` are safer to pass around.

## Common operations you'll actually use

```python
# LIST — an ordered, growable sequence
msgs = ["hi"]
msgs.append("how are you?")     # add to end
msgs[0] = "hello"               # change by index
last = msgs[-1]                 # negative index = from the end
first_two = msgs[0:2]           # slicing

# DICT — lookup by key (this is JSON in Python)
resp = {"model": "gpt-5", "tokens": 42}
resp["tokens"]                  # 42
resp.get("cost", 0)             # 0 if key missing (never crashes)
for key, value in resp.items(): # loop keys + values together
    print(key, value)

# SET — uniqueness + fast membership
seen = {"doc1", "doc2"}
"doc1" in seen                  # True, and it's O(1) fast
seen.add("doc3")
new_docs = {"doc2", "doc9"} - seen   # set difference -> {"doc9"}

# TUPLE — a fixed record
point = (25.2, 55.3)            # Dubai lat/long, won't change
lat, lng = point                # unpacking

# STR — text, immutable
name = "  Dubai  "
name.strip().lower()            # "dubai" (returns a NEW string)
"a,b,c".split(",")              # ['a', 'b', 'c']
",".join(["a", "b"])            # "a,b"
f"Model: {resp['model']}"       # f-string formatting
```

## Why `set` and `dict` are fast (the one CS fact to know)

Checking `x in a_list` scans every item — slow on big lists (**O(n)**). Checking `x in a_set` or `x in a_dict` uses a **hash table**, so it's near-instant no matter the size (**O(1)**). If you find yourself doing repeated `in` checks, switch the list to a set.

Catch: only *immutable* things can go in a set or be dict keys. `{[1,2]}` crashes — a list can't be hashed. Use a tuple instead: `{(1,2)}` works.

## Real world: how a company uses this

> **A Dubai logistics firm** builds a RAG chatbot over delivery-policy PDFs. When ingesting files, they track processed document IDs in a **`set`** — so re-running the pipeline skips already-embedded files instantly instead of re-paying for embeddings. The chat history is a **`list`** of message **`dict`s** (`{"role": "user", "content": "..."}`) — the exact shape every LLM API expects. Each config (region, model, temperature) is a **`dict`** loaded from JSON. That's four container choices, each obvious once you know the rules.

## Common mistakes

- **Mutable default arguments:** `def f(items=[]):` — that list is shared across *all* calls. Use `def f(items=None): items = items or []`.
- Using a `list` for membership checks on large data — should be a `set`.
- Forgetting `str`/`tuple` are immutable and expecting `.append()` to work.
- `dict[key]` crashes on a missing key; use `.get(key, default)` when unsure.

## Interview tip

If asked "list vs tuple?" say: *"Tuple is immutable, so it's for fixed records and can be a dict key or set member; list is mutable, for sequences that change."* If asked to speed up repeated lookups, the answer is almost always *"use a set/dict — O(1) hash lookup instead of O(n) scan."* Those two lines signal you understand *why*, not just syntax.
