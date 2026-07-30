# Type Hints

**The one-line idea:** Type hints are optional labels that say what type a variable, argument, or return value should be — like `name: str` or `-> list[int]`. Python doesn't enforce them at runtime, but your editor, your tools, and libraries like Pydantic and FastAPI use them heavily.

## Why this matters for an AI Engineer

Modern AI stacks are built *on* type hints. **Pydantic** turns hints into runtime validation for LLM structured outputs. **FastAPI** reads hints to validate requests and generate docs. **Tool/function calling** derives the JSON schema the LLM sees from your type hints. Type your code and half the AI ecosystem starts working for you — plus your editor catches bugs before you run anything. Untyped code in 2026 looks junior.

## Basic annotations

```python
name: str = "Dubai"
count: int = 5
ratio: float = 0.8
active: bool = True

def greet(name: str, times: int) -> str:      # args typed, return typed
    return name * times

# -> None means "returns nothing"
def log(msg: str) -> None:
    print(msg)
```

Nothing is enforced at runtime — `greet(5, "x")` still *runs*. But your editor underlines it in red, and type checkers (`mypy`, `pyright`) flag it. That early warning is the value.

## Container types

Since Python 3.9+ you use the built-in types directly (no more `from typing import List`):

```python
scores: list[float] = [0.9, 0.7]
message: dict[str, str] = {"role": "user", "content": "hi"}
ids: set[int] = {1, 2, 3}
point: tuple[float, float] = (25.2, 55.3)

def top_chunks(chunks: list[dict], k: int) -> list[dict]:
    return chunks[:k]
```

Read `dict[str, str]` as "dict with string keys and string values" — the shape every chat message uses.

## Optional and Union — "might be missing" / "could be either"

- `X | None` means "an `X`, or `None`" (this replaces the old `Optional[X]`).
- `X | Y` means "either type" (replaces the old `Union[X, Y]`).

```python
def find_user(uid: int) -> dict | None:     # returns a dict, or None if not found
    ...

def parse(value: str | int) -> float:       # accepts str OR int
    return float(value)
```

`| None` is the honest signal that a function can return "nothing found" — callers know to check.

## Generics — reusable-but-typed containers

Sometimes a function works on *any* type but should keep it consistent. A `TypeVar` says "whatever type comes in, that same type comes out." In Python 3.12+ the syntax is clean:

```python
def first[T](items: list[T]) -> T:          # 3.12+ generic syntax
    return items[0]

first([1, 2, 3])          # editor knows this returns int
first(["a", "b"])         # editor knows this returns str
```

Without the generic, the return would just be "unknown." With it, the type flows through. You rarely *write* these early on, but you'll *see* them.

## The real payoff: Pydantic for LLM outputs

This is where type hints stop being cosmetic. Pydantic uses your hints to *validate data at runtime* — essential when an LLM returns JSON you can't trust:

```python
from pydantic import BaseModel

class Ticket(BaseModel):
    category: str
    priority: int
    urgent: bool

# Suppose an LLM returned this JSON string, parsed to a dict:
raw = {"category": "billing", "priority": "2", "urgent": "true"}
ticket = Ticket(**raw)     # Pydantic COERCES + VALIDATES
print(ticket.priority)     # 2  (int, not "2")
print(ticket.urgent)       # True (bool, not "true")
# Wrong shape? Pydantic raises a clear ValidationError instead of a silent bug.
```

The class body is *just type hints*. Pydantic reads them and enforces them. This is how you make flaky LLM JSON into safe, typed Python objects — the single most useful pattern in production LLM code.

## Real world: how a company uses this

> **A Dubai HR-tech startup** extracts structured data from CVs with an LLM. They define a Pydantic model (`Candidate` with `name: str`, `years_experience: int`, `skills: list[str]`) and tell the LLM to return that shape. Pydantic validates every response — a CV that yields a garbage `years_experience` raises a catch-able error instead of corrupting the database. Their FastAPI endpoints use the same hints to auto-validate incoming requests and generate Swagger docs for free. One set of type hints powers validation, docs, *and* the LLM's output schema.

## Common mistakes

- Expecting hints to enforce types at runtime — they don't; only Pydantic/validators do. Plain hints are for tooling.
- Using old `List`, `Dict`, `Optional` imports — use `list`, `dict`, `X | None` (3.9/3.10+).
- Over-typing trivial scripts; under-typing shared library code. Type the interfaces others call.
- Forgetting `-> None` on functions that return nothing, then wondering why the return type is unclear.

## Interview tip

Say: *"Type hints are optional and not enforced at runtime, but Pydantic and FastAPI turn them into real validation and schema generation — that's why I always type LLM-facing code. I use `X | None` for optional and let Pydantic validate structured LLM outputs."* Connecting hints to *Pydantic validation of LLM JSON* is the answer that signals real AI-engineering experience.
