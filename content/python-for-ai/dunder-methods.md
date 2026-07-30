# Dunder Methods

**The one-line idea:** Dunder ("double underscore") methods like `__repr__`, `__len__`, and `__eq__` are special hooks Python calls automatically. Define them and your own objects work with built-in syntax — `len(x)`, `x == y`, `print(x)`, even `x()`.

## Why this matters for an AI Engineer

They're everywhere in the tools you use: `with` (context managers) is `__enter__`/`__exit__`; iterating a dataset is `__iter__`/`__next__`; a callable "tool" object is `__call__`; a Pydantic model's nice printout is `__repr__`. When you build a `Chunk`, `Dataset`, or `Tool` class, dunders make it behave like a native Python object — readable in logs, comparable, usable in `len()` and loops. Clean debugging and idiomatic APIs depend on them.

## `__repr__` — a useful printout (define this first, always)

By default, printing an object gives useless `<Chunk object at 0x104f2>`. `__repr__` fixes that — it's what shows in logs, the REPL, and debuggers.

```python
class Chunk:
    def __init__(self, text, score):
        self.text = text
        self.score = score

    def __repr__(self):
        return f"Chunk(text={self.text!r}, score={self.score})"

c = Chunk("Golden Visa info", 0.92)
print(c)        # Chunk(text='Golden Visa info', score=0.92)
[c, c]          # list shows [Chunk(...), Chunk(...)] — debuggable!
```

Rule: make `__repr__` unambiguous — ideally it looks like the code to recreate the object. This single method saves hours of debugging. (`!r` inserts the *repr* of a value, adding quotes around strings.)

## `__eq__` — value equality

By default two objects are "equal" only if they're the *same* object in memory. `__eq__` lets you compare by *content*.

```python
class Chunk:
    def __init__(self, text, score):
        self.text, self.score = text, score

    def __eq__(self, other):
        if not isinstance(other, Chunk):
            return NotImplemented        # let Python handle mismatched types
        return (self.text, self.score) == (other.text, other.score)

Chunk("a", 1.0) == Chunk("a", 1.0)       # True — same content
```

Gotcha: if you define `__eq__` and want the object usable in a `set` or as a dict key, also define `__hash__` (or use a `frozen=True` dataclass, which does both for you).

## `__len__` — make `len()` work

```python
class Dataset:
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        return len(self.rows)

ds = Dataset([1, 2, 3])
len(ds)          # 3
if ds: ...       # also works — empty objects are "falsy" via __len__
```

## `__iter__` — make `for` loops work

Define `__iter__` and your object can be looped over directly. The simplest version just hands back an iterator over your internal data (`iter(...)` gives you one for free):

```python
class Dataset:
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        return len(self.rows)

    def __iter__(self):
        return iter(self.rows)     # delegate to the list's own iterator

ds = Dataset(["a", "b", "c"])
for row in ds:       # works because of __iter__
    print(row)
list(ds)             # ['a', 'b', 'c'] — anything that loops now works
```

Now `Dataset` behaves like a native collection: `len(ds)`, `for row in ds`, `list(ds)`, even `"a" in ds` all work. That's the whole point of dunders — your class plugs into Python's built-in syntax.

## `__call__` — make an object behave like a function

Define `__call__` and you can "call" the instance with `()`. This is how LLM **tools** and pipelines are often modeled — an object that holds config *and* acts like a function.

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor         # holds state

    def __call__(self, x):           # now the instance is callable
        return x * self.factor

double = Multiplier(2)
double(10)       # 20  — called like a function, but it remembers factor=2
```

A `Tool` object with `__call__` can carry its name, description, and API key as state, yet be invoked like a plain function — the best of both worlds.

## `__enter__` / `__exit__` — the `with` statement

These make your object a context manager (setup on enter, cleanup on exit — see the Context Managers article). Any object defining them works in a `with` block, guaranteeing cleanup even on error.

```python
class Timer:
    def __enter__(self):
        import time; self.start = time.perf_counter(); return self
    def __exit__(self, *exc):        # runs even if the block raises
        import time; print(f"{time.perf_counter()-self.start:.3f}s")

with Timer():
    do_work()        # timing prints automatically at the end
```

## Operator overloading (use sparingly)

Dunders let you define what `+`, `<`, etc. mean for your objects (`__add__`, `__lt__`). This is how NumPy makes `array + array` do element-wise math. For your own classes, only overload operators when the meaning is *obvious* — a `Vector.__add__` is clear; a `User + User` is confusing. When in doubt, use a named method.

## Real world: how a company uses this

> **A Dubai ML platform** models each LLM tool as a callable object: a `Tool` class holds its `name`, `description`, and credentials as state, and defines `__call__` so the agent invokes it like `weather_tool(city="Dubai")`. Every domain object (`Chunk`, `SearchResult`, `EvalRow`) defines `__repr__`, so their logs and error traces show `Chunk(text='...', score=0.88)` instead of memory addresses — turning a 3am debugging session from guesswork into reading. Their `Dataset` defines `__len__` and `__iter__` so it drops into `len()` and `for` loops like a native list.

## Common mistakes

- Skipping `__repr__` — then drowning in `<object at 0x...>` while debugging. Define it on every data class.
- Defining `__eq__` but not `__hash__`, then the object breaks in sets/dicts.
- Overloading operators where a named method would be clearer — cleverness that confuses readers.
- Confusing `__repr__` (for developers, unambiguous) with `__str__` (for end users, pretty); if you only write one, write `__repr__`.

## Interview tip

Say: *"Dunder methods hook into Python's syntax — `__repr__` for debuggable output, `__eq__` for value equality, `__len__` for `len()`, `__call__` to make an object callable like a function, and `__enter__`/`__exit__` for `with`. I define `__repr__` on every data class because it makes logs and stack traces readable."* Naming `__call__` for tool objects and `__enter__`/`__exit__` for context managers shows you know the dunders that actually appear in AI code, not just the textbook trio.
