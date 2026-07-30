# Context Managers

**The one-line idea:** A context manager (the `with` statement) guarantees **setup and cleanup** happen as a pair — open a resource, use it, and *always* close it, even if your code crashes in the middle.

## Why this matters for an AI Engineer

You constantly open things that must be closed: files, database connections, HTTP clients (`httpx`), vector-DB sessions, GPU/model handles. Leak them and your app runs out of connections and dies in production. `with` makes leaks impossible. It's also how you cleanly time blocks, open DB transactions, and manage an `httpx` client's connection pool. Small syntax, huge reliability payoff.

## The problem it solves

Without `with`, you must remember to clean up — and remember to do it *even when an error is thrown*:

```python
# Fragile: if processing crashes, the file is never closed -> leak
f = open("data.txt")
data = f.read()
process(data)          # if this raises, f.close() below never runs
f.close()

# Correct but noisy
f = open("data.txt")
try:
    data = f.read()
    process(data)
finally:
    f.close()          # runs no matter what
```

`with` collapses that whole `try/finally` into one line:

```python
with open("data.txt") as f:
    data = f.read()
    process(data)
# file is closed automatically here — even if process() raised
```

The moment the `with` block ends (normally *or* by exception), cleanup fires.

## How it works: `__enter__` and `__exit__`

Any object with these two dunder methods is a context manager:

- `__enter__()` — runs on entry; its return value is what `as x` gives you.
- `__exit__(exc_type, exc_val, tb)` — runs on exit; receives exception info (or `None`s if clean). It's where cleanup lives.

```python
class DBConnection:
    def __enter__(self):
        print("opening connection")
        self.conn = connect_to_db()
        return self.conn                 # this is what `as conn` binds

    def __exit__(self, exc_type, exc_val, tb):
        print("closing connection")
        self.conn.close()                # ALWAYS runs
        # return False (default) -> let any exception propagate

with DBConnection() as conn:
    conn.query("SELECT 1")
# prints: opening... then closing... guaranteed
```

If the block raised, `__exit__` still runs (you can log/rollback there), then the exception continues unless you `return True` to swallow it.

## The easy way: `contextlib.contextmanager`

Writing a class is overkill for simple cases. The `@contextmanager` decorator turns a generator into a context manager: code before `yield` is setup, code after is cleanup.

```python
from contextlib import contextmanager
import time

@contextmanager
def timer(label):
    start = time.perf_counter()
    try:
        yield                        # <- the `with` block runs here
    finally:
        print(f"{label}: {time.perf_counter() - start:.3f}s")

with timer("llm call"):
    call_the_model()                 # whatever happens, timing prints
```

The `try/finally` around `yield` ensures cleanup runs even on error. This is the pattern you'll use most.

## Multiple resources at once

```python
with open("in.txt") as src, open("out.txt", "w") as dst:
    dst.write(src.read())            # both closed at the end
```

## Real world: how a company uses this

> **A Dubai e-commerce team** runs an LLM pipeline that reads product data from Postgres, calls an embedding API over `httpx`, and writes vectors to Pinecone. Each stage uses `with`: the `httpx.Client` is opened in a `with` block so its connection pool is released cleanly; the DB transaction uses a context manager that **commits on success and rolls back if the LLM step throws** — so a mid-batch failure never leaves half-written data. Under load, this is the difference between "runs for months" and "exhausts the connection pool at 3am." The cleanup guarantee is the whole point.

## Common mistakes

- Manually calling `.close()` and forgetting the `try/finally` — just use `with`.
- Doing cleanup *after* `yield` without wrapping in `try/finally` in a `@contextmanager` — an exception skips your cleanup.
- Assuming `with` catches exceptions. It doesn't — it runs cleanup then *re-raises*. Use `try/except` for handling.
- Opening a client/connection once at import time and never closing it, instead of scoping it with `with`.

## Interview tip

Say: *"`with` guarantees `__exit__` runs for cleanup even if the block raises — it's `try/finally` made clean. For simple cases I use `@contextlib.contextmanager` with a `try/finally` around a single `yield`."* Then give the AI example: scoping an `httpx` client or a DB transaction that rolls back on an LLM failure. That shows you've deployed real services, not just opened files.
