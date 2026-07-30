# Dataclasses

**The one-line idea:** A `@dataclass` is a decorator that writes the boring parts of a class for you — the `__init__`, a readable `__repr__`, and equality — so a class that just holds data takes three lines instead of fifteen.

## Why this matters for an AI Engineer

Half your code is small "record" objects: a `Chunk` with text + score + source, a `Config` with model + temperature, a `SearchResult`. Writing full classes for these is tedious boilerplate. Dataclasses give you clean, typed, comparable records instantly. Knowing when to reach for a `@dataclass` (internal data) vs a Pydantic model (untrusted/LLM data) is a real design decision you'll make constantly.

## The boilerplate it removes

Here's a plain class holding three fields — notice how repetitive it is:

```python
class Chunk:
    def __init__(self, text, score, source):
        self.text = text
        self.score = score
        self.source = source

    def __repr__(self):
        return f"Chunk(text={self.text!r}, score={self.score}, source={self.source!r})"

    def __eq__(self, other):
        return (self.text, self.score, self.source) == (other.text, other.score, other.source)
```

You typed each field *three times*. A dataclass does all of this from the field declarations:

```python
from dataclasses import dataclass

@dataclass
class Chunk:
    text: str
    score: float
    source: str

c = Chunk("Golden Visa lasts 10 years", 0.92, "policy.pdf")
print(c)                         # Chunk(text='Golden Visa...', score=0.92, source='policy.pdf')
print(c.score)                   # 0.92
Chunk("a", 1.0, "x") == Chunk("a", 1.0, "x")   # True  — value equality for free
```

The type hints (`text: str`) aren't just labels here — the dataclass reads them to build `__init__`. Three fields, done.

## Defaults and default factories

```python
from dataclasses import dataclass, field

@dataclass
class Config:
    model: str = "gpt-5"                 # simple default
    temperature: float = 0.7
    stop_words: list[str] = field(default_factory=list)   # mutable default!

c = Config()                             # uses all defaults
c2 = Config(model="gpt-5-mini", temperature=0.2)
```

**Critical rule:** for a mutable default (`list`, `dict`, `set`) you *must* use `field(default_factory=list)`, not `= []`. If you write `= []`, every instance shares the same list — a classic bug. The dataclass actually raises an error to stop you, which is helpful. `default_factory` makes a fresh one per instance.

## `frozen=True` — make it immutable

Add `frozen=True` and the object can't be changed after creation — like a tuple with named fields. Useful for config or anything you want to be safe to pass around, and it makes the object hashable (usable in sets / as dict keys).

```python
@dataclass(frozen=True)
class ModelConfig:
    model: str
    temperature: float

cfg = ModelConfig("gpt-5", 0.2)
# cfg.temperature = 0.9   -> raises FrozenInstanceError
{cfg}                     # works — frozen dataclasses are hashable
```

## Dataclass vs plain class vs Pydantic

| Use | When | Why |
|---|---|---|
| **plain class** | there's real behavior/logic, not just data | you want full control over methods |
| **`@dataclass`** | internal data *you* create and trust | zero-boilerplate typed records, stdlib, fast |
| **Pydantic `BaseModel`** | data from *outside* — API requests, **LLM JSON output** | it *validates and coerces* at runtime |

The key line: **dataclasses don't validate.** `Chunk("a", "not a number", "x")` happily stores the wrong type — hints are cosmetic here. Pydantic would reject it. So use dataclasses for trusted internal data, Pydantic at the untrusted boundary (LLM outputs, user input).

## Real world: how a company uses this

> **A Dubai analytics team** models their RAG pipeline's internal objects as dataclasses — `@dataclass class RetrievedChunk` (text, score, doc_id) and `@dataclass(frozen=True) class PipelineConfig` (embedding_model, top_k, threshold). These are created by their own code, so they don't need validation — dataclasses give clean, comparable, debuggable records for free, and the frozen config can't be accidentally mutated mid-run. At the *edges* — parsing the LLM's JSON answer and the incoming API request — they switch to Pydantic, because that data is untrusted and must be validated. Right tool at each layer.

## Common mistakes

- Using `= []` or `= {}` as a default — always `field(default_factory=list)`.
- Expecting a dataclass to **validate** types — it doesn't; use Pydantic for that.
- Putting a required field after one with a default — Python raises an error (same as function args).
- Reaching for Pydantic everywhere when trusted internal data just needs a dataclass (slightly lighter, stdlib, no dependency).

## Interview tip

Say: *"A `@dataclass` auto-generates `__init__`, `__repr__`, and `__eq__` from typed fields — great for internal records. It does *not* validate, so for LLM outputs or API input I use Pydantic, which coerces and validates at runtime. Mutable defaults need `field(default_factory=...)`."* Drawing the dataclass-vs-Pydantic line (trusted vs untrusted data) is the design-judgment signal interviewers want.
