# Decorators

**The one-line idea:** A decorator is a function that **wraps another function** to add behavior — like timing, retrying, or caching — without touching the original function's code. You attach it with `@name` on the line above.

## Why this matters for an AI Engineer

LLM apps are full of "wrap every API call with X" needs: retry when OpenAI rate-limits you, cache expensive embedding calls, log how long each model call took, check auth on every endpoint. Decorators do this cleanly, once, reused everywhere. FastAPI routes (`@app.post`), caching (`@lru_cache`), and tool registration all *are* decorators. You can't read AI backend code without understanding them.

## First: functions are objects

The whole trick rests on one fact — in Python, functions are values you can pass around, return, and store.

```python
def shout(text):
    return text.upper()

f = shout          # store the function itself (no parentheses)
print(f("hi"))     # HI  — same function, different name

def apply(func, x):
    return func(x)         # a function can take another function
apply(shout, "hey")        # HEY
```

## Building a decorator by hand

A decorator takes a function, wraps it in a new function that adds behavior, and returns the wrapper.

```python
def timer(func):
    def wrapper(*args, **kwargs):        # *args/**kwargs = accept ANY arguments
        import time
        start = time.perf_counter()
        result = func(*args, **kwargs)   # call the real function
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.3f}s")
        return result                    # don't forget to return!
    return wrapper

@timer
def call_llm(prompt):
    import time; time.sleep(0.5)         # pretend this hits an API
    return "answer"

call_llm("hello")        # prints: call_llm took 0.500s
```

`@timer` above `call_llm` is just shorthand for `call_llm = timer(call_llm)`. The name now points at `wrapper`, which times things then calls the original.

`*args, **kwargs` matters: it lets the wrapper forward *any* arguments, so one decorator works on any function.

## `functools.wraps` — the fix everyone forgets

When you wrap a function, its identity (name, docstring) gets replaced by the wrapper's. That breaks debugging and docs. `@functools.wraps` copies the original's metadata over.

```python
from functools import wraps

def timer(func):
    @wraps(func)                 # <- preserves func's name & docstring
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

Always add `@wraps(func)`. Without it, `call_llm.__name__` wrongly returns `"wrapper"`.

## Three decorators you'll actually write

**Retry transient API errors** (rate limits, timeouts — the #1 LLM need):

```python
import time
from functools import wraps

def retry(times=3, delay=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # the loop ALWAYS exits one of two ways: a successful `return`,
            # or `raise` on the final attempt — it never falls through.
            for attempt in range(times):
                try:
                    return func(*args, **kwargs)     # success -> exit
                except Exception as e:
                    if attempt == times - 1:
                        raise                    # last try failed -> give up
                    print(f"retry {attempt+1} after error: {e}")
                    time.sleep(delay * (attempt + 1))   # back off longer each time
        return wrapper
    return decorator

@retry(times=3, delay=2)
def call_openai(prompt):
    ...   # if this throws, it's retried up to 3 times
```

That extra outer layer (`retry` returns `decorator` returns `wrapper`) is how a decorator *takes arguments*.

**Cache expensive calls** — Python gives you this for free:

```python
from functools import lru_cache

@lru_cache(maxsize=1000)          # remembers results for repeated inputs
def embed(text: str):
    ...   # same text -> instant cached result, no API call, no cost
```

## Real world: how a company uses this

> **A Dubai insurance company's** LLM claims-assistant wraps every model call with two decorators: `@retry(times=3)` so an OpenAI rate-limit or network blip auto-recovers instead of failing the user, and a `@timed` decorator that logs latency to their monitoring dashboard. Embedding lookups for common policy questions get `@lru_cache`, cutting repeat embedding costs to zero. All three behaviors live in *one* place each and decorate dozens of functions — change the retry policy once, it applies everywhere. That's the maintainability win decorators buy.

## Common mistakes

- **Forgetting `@wraps`** — breaks the wrapped function's name/docs.
- **Forgetting to `return` the result** inside the wrapper — the function silently returns `None`.
- Not using `*args, **kwargs`, so the decorator only works on functions with a specific signature.
- `@lru_cache` on a function with **unhashable arguments** (a list/dict) crashes — cache keys must be hashable (use tuples/strings).
- Caching something that changes over time (live data) and serving stale results.

## Interview tip

Explain the three-line chain: *"`@timer` means `func = timer(func)`. The decorator returns a wrapper that adds behavior around the original call. I always use `functools.wraps` to keep the name and docstring, and `*args, **kwargs` so it works on any function."* Then name a real use — retry for rate limits, `lru_cache` for embeddings. Concrete AI uses beat textbook examples.
