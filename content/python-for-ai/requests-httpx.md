# requests / httpx

**The one-line idea:** These libraries make **HTTP calls** from Python — how your code talks to any web API, including LLM providers. `requests` is the classic synchronous one; `httpx` is the modern one that also does `async`, which you need to call many LLMs concurrently.

## Why this matters for an AI Engineer

Every LLM API — OpenAI, Anthropic, a local model server, your vector DB, a weather tool the agent calls — is reached over HTTP. Official SDKs wrap these calls, but constantly you'll hit an endpoint that has *no* SDK, or need to see exactly what's on the wire, or call your own FastAPI service. And because LLM calls are I/O-bound, `httpx`'s async client is how you fire 100 calls at once instead of one-by-one. HTTP fluency is core plumbing for the job.

## HTTP in 30 seconds

You send a **request** to a URL and get a **response**. The main pieces:

- **Method:** `GET` (fetch data) or `POST` (send data). LLM calls are `POST` (you send the prompt).
- **Headers:** metadata — most importantly your API key (`Authorization`).
- **Body:** the data you send, usually JSON.
- **Status code:** `200` = ok, `429` = rate limited, `401` = bad key, `500` = server error.

## `requests` — the synchronous classic

```python
import requests

# GET — fetch something
r = requests.get("https://api.example.com/status")
print(r.status_code)     # 200
print(r.json())          # parse the JSON body into a Python dict

# POST — send JSON (the shape of an LLM API call)
r = requests.post(
    "https://api.openai.com/v1/chat/completions",
    headers={"Authorization": "Bearer sk-...", "Content-Type": "application/json"},
    json={                                   # `json=` auto-encodes + sets header
        "model": "gpt-5",
        "messages": [{"role": "user", "content": "Hello"}],
    },
    timeout=30,                              # ALWAYS set a timeout
)
r.raise_for_status()                         # raise on 4xx/5xx instead of failing silently
data = r.json()
print(data["choices"][0]["message"]["content"])
```

Two habits that matter: **`timeout=`** so a hung server can't freeze your app forever, and **`raise_for_status()`** so a `429` or `500` becomes a catchable exception instead of silently returning an error page you'd try to parse as a result.

## `httpx` — same API, plus async

`httpx` mirrors `requests` almost exactly for synchronous use, so switching is easy:

```python
import httpx

r = httpx.get("https://api.example.com/status", timeout=30)
print(r.json())
```

The reason to prefer it: it also has an **async** client. Since LLM calls are I/O-bound (mostly waiting on the network), async lets you run many concurrently — the batch finishes in the time of the *slowest* call, not the sum.

```python
import asyncio, httpx

async def call(client, prompt):
    r = await client.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": "Bearer sk-..."},
        json={"model": "gpt-5", "messages": [{"role": "user", "content": prompt}]},
        timeout=30,
    )
    return r.json()["choices"][0]["message"]["content"]

async def main():
    prompts = ["a", "b", "c", "d", "e"]
    # AsyncClient reuses one connection pool for all calls — faster + tidy
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(call(client, p) for p in prompts))
    return results

asyncio.run(main())      # 5 calls fired concurrently, not serially
```

`async with httpx.AsyncClient()` opens a client whose connection pool is reused across calls (much faster than a fresh connection each time) and closed cleanly at the end. `asyncio.gather` runs them all at once. This is the standard pattern for batching LLM requests.

## Reuse a client (don't open one per call)

Creating a new connection for every request is slow. Reuse a `Client`/`AsyncClient` — it pools connections:

```python
with httpx.Client(timeout=30) as client:      # one client, many calls
    for url in urls:
        client.get(url)
```

## Handling failures

Network calls fail; wrap them and retry the *transient* ones (see the Error Handling article):

```python
try:
    r = httpx.post(url, json=payload, timeout=30)
    r.raise_for_status()
except httpx.TimeoutException:
    ...   # transient -> retry with backoff
except httpx.HTTPStatusError as e:
    if e.response.status_code == 429:
        ...   # rate limited -> back off and retry
    else:
        raise # 401 bad key etc. -> don't retry, surface it
```

## Real world: how a company uses this

> **A Dubai travel startup** builds an agent that, per user query, calls three tools — a flights API, a hotels API, and an LLM to summarize — each an HTTP endpoint with no shared SDK. They use `httpx.AsyncClient` to fire all three concurrently with `asyncio.gather`, so a request that would take 6 seconds serially returns in ~2 (the slowest single call). Every call has a `timeout` and `raise_for_status`, and `429`s trigger backoff-retry while `401`s fail loudly. One reused async client pools connections across thousands of daily requests, keeping latency low. That async-HTTP pattern is the backbone of their multi-tool agent.

## Common mistakes

- **No `timeout`** — a hung server freezes your app indefinitely. Always set one.
- Not calling `raise_for_status()` — you parse an error page as if it were a valid result.
- Using `requests` (synchronous) *inside* async code — it blocks the whole event loop; use `httpx` async there.
- Creating a new client per request instead of reusing one — wastes time re-establishing connections.
- Hardcoding API keys in the code — read them from environment variables instead.

## Interview tip

Say: *"I use `httpx` over `requests` because it has an async client, and since LLM calls are I/O-bound I batch them with `httpx.AsyncClient` + `asyncio.gather` so the batch takes as long as the slowest call. I always set a `timeout`, call `raise_for_status`, reuse one pooled client, and retry only transient errors like 429s."* The async-batching-because-I/O-bound point plus the timeout/raise_for_status hygiene is what shows you've built real, resilient LLM integrations.
