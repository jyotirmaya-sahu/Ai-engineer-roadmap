# Error Handling

**The one-line idea:** Error handling is deciding what your program does when something goes wrong — catch it and recover, or let it stop cleanly — using `try`/`except`/`else`/`finally` and your own exception types.

## Why this matters for an AI Engineer

LLM apps live on top of flaky external services. The OpenAI API rate-limits you, times out, returns malformed JSON, or is briefly down. A file is missing; a vector DB connection drops. Handle these gracefully and your app stays up; ignore them and one hiccup crashes everything or, worse, silently corrupts data. The senior skill is knowing *which* errors to retry (transient), which to surface, and which to never swallow. That judgment is exactly what interviewers probe.

## The full shape: try / except / else / finally

```python
try:
    response = call_llm(prompt)        # code that might fail
except TimeoutError:
    print("timed out")                 # runs only if THIS error happens
except ValueError as e:
    print(f"bad value: {e}")           # a different handler per error type
else:
    print("success!")                  # runs only if NO exception happened
finally:
    print("always runs")               # cleanup — runs no matter what
```

- **`try`** — the risky code.
- **`except`** — catch a *specific* error type and handle it. You can have several.
- **`else`** — runs only if `try` succeeded (keeps success-only code out of the `try`).
- **`finally`** — always runs, error or not — for cleanup (close files/connections).

## Catch specific, not everything

The cardinal rule: catch the **narrowest** exception you can handle, not a blanket `except Exception`.

```python
# BAD — hides bugs; a typo (NameError) gets swallowed as if it were an API issue
try:
    result = call_llm(prompt)
except Exception:
    result = "sorry, try again"

# GOOD — handle what you expect; let real bugs surface loudly
try:
    result = call_llm(prompt)
except (TimeoutError, ConnectionError) as e:
    logger.warning(f"transient network issue: {e}")
    result = fallback_response()
```

Broad `except` masks programming mistakes and makes debugging miserable. Catch the specific errors you know how to deal with.

## Custom exceptions — clear, catchable errors

Define your own exception types so callers can catch *your* app's failures precisely and error messages are meaningful.

```python
class LLMError(Exception):
    """Base error for our LLM layer."""

class RateLimitError(LLMError):
    """The provider rate-limited us — safe to retry."""

class InvalidResponseError(LLMError):
    """Model returned something we can't parse — NOT worth retrying."""

def parse_llm_json(text):
    import json
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise InvalidResponseError(f"model returned non-JSON: {text[:50]}") from e
```

`raise ... from e` keeps the original cause in the traceback (the "chain"), so you see *both* what went wrong and why. A hierarchy (everything under `LLMError`) lets callers catch broadly (`except LLMError`) or narrowly (`except RateLimitError`).

## Retry only *transient* errors — the key LLM pattern

This is the distinction that matters most in AI work. **Transient** errors (rate limits, timeouts, 503s) are temporary — retrying often works. **Permanent** errors (bad API key, malformed prompt, invalid JSON from the model) will fail identically every time — retrying just wastes time and money.

```python
import time

def call_with_retry(prompt, retries=3):
    for attempt in range(retries):
        try:
            return call_llm(prompt)
        except RateLimitError:                 # TRANSIENT -> retry with backoff
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt                # 1s, 2s, 4s — exponential backoff
            logger.warning(f"rate limited, retry in {wait}s")
            time.sleep(wait)
        except InvalidResponseError:           # PERMANENT -> don't retry, fail fast
            raise
```

**Exponential backoff** (waiting longer each try) avoids hammering an already-struggling API. Retrying a permanent error, by contrast, is pure waste — so you separate the two by exception type. (In real code, the `tenacity` library or your SDK's built-in retry does this for you, but you must understand the logic.)

## When to raise vs handle

- **Handle** it if you can recover (retry, fall back, use a default).
- **Raise** it (or re-raise) if you can't — let the layer above decide. Failing loudly beats returning wrong data silently. A support bot that returns "I don't know" on error is fine; one that returns a *hallucinated* number because it swallowed a parse error is dangerous.

## Real world: how a company uses this

> **A Dubai insurance company's** claims assistant wraps every OpenAI call in retry-with-backoff that retries *only* `RateLimitError` and `TimeoutError` — transient issues that clear up — while `InvalidResponseError` (the model returned unparseable JSON) fails fast and routes the claim to a human, never retried. A `finally` block always releases the DB connection so a mid-call failure can't leak connections. They never use a blanket `except`, so a genuine code bug crashes loudly in staging instead of masquerading as an "API error" in production. This transient-vs-permanent split is why their uptime survives OpenAI's occasional rate-limit storms.

## Common mistakes

- **Blanket `except Exception`** (or bare `except:`) that swallows real bugs — catch specific types.
- **Retrying permanent errors** (bad key, invalid JSON) — wastes time/money; they'll never succeed.
- `except: pass` — silently ignoring errors; the #1 source of invisible bugs. At minimum log it.
- Forgetting cleanup on the error path — use `finally` or `with`.
- Returning a fake/default value on error where you should raise, letting corrupt data flow downstream.

## Interview tip

Say: *"I catch specific exceptions, not blanket `Exception`, and I retry only *transient* errors — rate limits and timeouts — with exponential backoff, while permanent errors like unparseable model output fail fast. I use custom exception types so callers can react precisely, and `finally`/`with` for cleanup."* The transient-vs-permanent retry distinction plus exponential backoff is the answer that shows you've actually operated LLM APIs under load.
