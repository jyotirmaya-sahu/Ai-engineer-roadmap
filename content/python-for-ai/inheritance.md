# Inheritance

**The one-line idea:** Inheritance lets one class **reuse and extend** another. A `child` class gets everything the `parent` has, then adds or changes what it needs — so shared code lives in one place.

## Why this matters for an AI Engineer

The AI libraries you use are built on inheritance: every Pydantic model inherits from `BaseModel`, every custom exception from `Exception`, LangChain's components from base classes. You'll define a base `LLMProvider` and subclass it for OpenAI, Anthropic, and a local model — sharing the common logic, overriding only the API call. And you'll use **Abstract Base Classes** to enforce that every provider implements the required methods. Knowing inheritance (and when to *avoid* it via composition) is core design skill.

## The basics: subclassing and `super()`

```python
class LLMProvider:
    def __init__(self, model):
        self.model = model

    def complete(self, prompt):
        raise NotImplementedError        # each subclass must define this

    def log(self, msg):                  # shared behavior, inherited by all
        print(f"[{self.model}] {msg}")

class OpenAIProvider(LLMProvider):       # inherits from LLMProvider
    def __init__(self, model, api_key):
        super().__init__(model)          # run the parent's __init__ first
        self.api_key = api_key           # then add child-specific setup

    def complete(self, prompt):          # override the parent's version
        self.log("calling OpenAI")       # reuse inherited method
        return f"OpenAI({self.model}): answer"

p = OpenAIProvider("gpt-5", "sk-...")
print(p.complete("hi"))
p.log("done")                            # inherited method, no need to rewrite
```

**`super()`** calls the parent's version of a method — essential in `__init__` so the parent's setup (here, storing `self.model`) still happens. Forget `super().__init__()` and `self.model` never gets set.

**Overriding** = a child defines a method the parent already has; the child's wins. That's how each provider customizes `complete()` while sharing `log()`.

## MRO — which method runs?

**Method Resolution Order** is the order Python searches classes to find a method: the object's own class first, then its parents, upward. For simple single inheritance it's obvious (child, then parent). It only gets interesting with multiple inheritance, where Python follows a consistent left-to-right, depth-aware order you can inspect:

```python
print(OpenAIProvider.__mro__)
# (OpenAIProvider, LLMProvider, object)
```

Python checks `OpenAIProvider` first, then `LLMProvider`, then the universal base `object`. `super()` follows this same chain. You rarely need to memorize MRO rules — just know it exists and defines *which* inherited method wins.

## Abstract Base Classes — enforce a contract

Sometimes you want to *guarantee* every subclass implements certain methods. An ABC marks methods as `@abstractmethod`; Python then refuses to instantiate a subclass that hasn't implemented them.

```python
from abc import ABC, abstractmethod

class LLMProvider(ABC):                   # ABC = can't be instantiated directly
    @abstractmethod
    def complete(self, prompt: str) -> str:
        ...

class OpenAIProvider(LLMProvider):
    def complete(self, prompt: str) -> str:
        return "answer"

# LLMProvider()        -> TypeError: can't instantiate abstract class
# A subclass missing complete() -> also TypeError
p = OpenAIProvider()   # fine — it implemented complete()
```

This is how you say "every provider *must* have `complete()`." It turns a forgotten method into an immediate, clear error instead of a crash deep in production.

## Composition vs inheritance — the key design choice

Inheritance says **"is-a"**: an `OpenAIProvider` *is a* `LLMProvider`. Composition says **"has-a"**: an `Agent` *has a* provider, *has a* memory, *has* tools.

```python
# Composition: build from parts instead of inheriting
class Agent:
    def __init__(self, provider, memory, tools):
        self.provider = provider     # HAS-A provider
        self.memory = memory         # HAS-A memory
        self.tools = tools           # HAS tools

    def run(self, prompt):
        return self.provider.complete(prompt)
```

**Prefer composition** unless there's a genuine "is-a" relationship. Deep inheritance trees get rigid and confusing; composition stays flexible — swap the provider without touching the `Agent` class. The senior instinct: reach for composition first, inheritance only for true specialization or to satisfy an ABC contract.

## Real world: how a company uses this

> **A Dubai bank** wants to avoid vendor lock-in, so they define an abstract `LLMProvider(ABC)` with an `@abstractmethod complete()`. Concrete `OpenAIProvider`, `AzureProvider`, and `JaisProvider` (a local Arabic model) each inherit and implement it, sharing the base's logging and retry logic via inheritance. Their `Assistant` class then uses **composition** — it *has a* provider — so switching from OpenAI to the on-prem Jais model for data-residency compliance is a one-line change. The ABC guarantees every provider is swappable; composition keeps the assistant decoupled from any one of them.

## Common mistakes

- Forgetting `super().__init__()` in a child's `__init__` — parent setup never runs.
- Building deep inheritance chains where **composition** would be clearer and more flexible.
- Overriding a method but changing its signature, breaking code that expects the parent's interface.
- Not using an ABC when you *need* to enforce that subclasses implement a method, then getting cryptic errors later.

## Interview tip

Say: *"`super()` runs the parent's method — I always call `super().__init__()` in a child. I use an ABC with `@abstractmethod` to enforce a contract across implementations. But I prefer composition ('has-a') over inheritance ('is-a') unless there's a true specialization, because deep hierarchies get rigid."* The composition-over-inheritance line plus a concrete ABC use (swappable LLM providers) is exactly the design maturity interviewers probe for.
