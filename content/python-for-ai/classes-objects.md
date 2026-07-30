# Classes & Objects

**The one-line idea:** A class is a blueprint; an object is a thing built from it. A class bundles **data** (attributes) and **behavior** (methods) together so related state and logic live in one place.

## Why this matters for an AI Engineer

The tools you use every day are classes: `OpenAI()`, `httpx.Client()`, a Pydantic `BaseModel`, a LangChain `Chain`. You'll build your own too — an `LLMClient` that holds config and knows how to call the model, a `Retriever` that holds a vector index and searches it, an `Agent` that holds tools and memory. Classes are how you package a "thing that has state and does work." Understanding them is required to read *and* structure real AI code.

## Class vs object

```python
class Dog:          # blueprint
    pass

rex = Dog()         # object (instance) built from the blueprint
fido = Dog()        # a different, separate object
```

One class, many objects. Each object holds its own data.

## `__init__`, `self`, and attributes

`__init__` is the **constructor** — it runs automatically when you create an object, to set up its starting data. `self` is the object itself; it's how each instance refers to *its own* data.

```python
class LLMClient:
    def __init__(self, model, temperature=0.7):
        self.model = model               # store on THIS instance
        self.temperature = temperature
        self.call_count = 0              # per-instance state

client = LLMClient("gpt-5", temperature=0.2)
print(client.model)          # "gpt-5"  — read an attribute
print(client.temperature)    # 0.2
```

Every method's first parameter is `self`. You don't pass it — Python passes the object automatically. `client.model` and `self.model` refer to the same thing from outside vs inside.

## Methods — behavior that uses the object's data

A method is a function defined inside a class. It acts on the object's attributes via `self`.

```python
class LLMClient:
    def __init__(self, model, temperature=0.7):
        self.model = model
        self.temperature = temperature
        self.call_count = 0

    def complete(self, prompt):          # a method; self = the instance
        self.call_count += 1             # update this object's state
        # (pretend we call the API using self.model / self.temperature)
        return f"[{self.model}] replied to: {prompt}"

    def stats(self):
        return f"{self.call_count} calls made"

client = LLMClient("gpt-5")
print(client.complete("Hello"))    # [gpt-5] replied to: Hello
print(client.complete("Bye"))
print(client.stats())              # 2 calls made
```

The object *remembers* between calls — `call_count` persists on `client`. That's the value of a class over loose functions: bundled, persistent state.

## Instance vs class attributes

An attribute set with `self.` belongs to *one* object. An attribute set directly in the class body is **shared by all** instances.

```python
class LLMClient:
    provider = "OpenAI"              # class attribute — shared by every instance

    def __init__(self, model):
        self.model = model           # instance attribute — per object

a = LLMClient("gpt-5")
b = LLMClient("gpt-5-mini")
print(a.provider, b.provider)        # OpenAI OpenAI  (shared)
print(a.model, b.model)              # gpt-5  gpt-5-mini  (separate)
```

Gotcha: never make a class attribute a mutable list/dict for per-object data — all instances would share and stomp on it. Put mutable per-object state in `__init__`.

## A slightly fuller example

```python
class ChatSession:
    def __init__(self, system_prompt):
        self.messages = [{"role": "system", "content": system_prompt}]

    def add_user(self, text):
        self.messages.append({"role": "user", "content": text})

    def add_assistant(self, text):
        self.messages.append({"role": "assistant", "content": text})

    def history(self):
        return self.messages

chat = ChatSession("You are a helpful Dubai travel guide.")
chat.add_user("Best time to visit?")
chat.add_assistant("November to March.")
print(len(chat.history()))        # 3 messages, held inside the object
```

This is essentially how chat memory is modeled in real apps — an object that owns the message list.

## Real world: how a company uses this

> **A Dubai proptech company** wraps their LLM logic in a `PropertyAgent` class. Each instance holds the config (model, temperature), a `ChatSession` for conversation memory, and a list of tools it can call. Methods like `.ask()` and `.reset()` operate on that state. When a new user connects, they create a fresh `PropertyAgent()` — each object keeps its own conversation isolated from others. Bundling state + behavior in one class keeps 20 users' chats cleanly separated without global variables everywhere.

## Common mistakes

- **Forgetting `self`** as the first parameter of a method, or forgetting `self.` when reading/writing an attribute.
- Putting mutable defaults (`[]`, `{}`) as class attributes for per-instance data — they get shared across all objects.
- Doing real work in `__init__` (like network calls) that should be a separate method — `__init__` is for setup.
- Overusing classes for what a plain function would do. A class earns its place when there's *state to hold*.

## Interview tip

Be able to explain: *"`__init__` initializes each instance's attributes, `self` is the instance so methods can read and mutate its own state, and a class attribute is shared across all instances while `self.x` is per-object."* Then give an AI example — an `LLMClient` or `ChatSession` that holds config and history. Showing you'd reach for a class *when there's state to bundle* (and a function otherwise) signals good judgment, not just syntax knowledge.
