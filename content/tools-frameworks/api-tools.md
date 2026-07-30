# API tools

**What it is:** wrapping an external web API — weather, a CRM, payments, your own backend — as a callable tool so the LLM can fetch *live, private, or real-time* data it could never know on its own.

## Why it matters for an AI Engineer

An LLM's knowledge is frozen at training time and knows nothing private. API tools are how you close both gaps: "what's the current AED/USD rate?", "is this customer a paying subscriber?", "book this slot." Most *useful* agents are mostly API tools — the LLM is the reasoning layer, and the APIs are its senses and hands. For an AI Engineer this is bread-and-butter: you'll spend real time turning REST endpoints into clean, safe tools. The skill isn't calling an API (you know that) — it's wrapping it so an LLM can use it *reliably and safely*.

## The mechanism — turning an endpoint into a tool

An API tool is a normal function that (1) takes the arguments the model provides, (2) makes the HTTP request, and (3) returns a *small, clean* result the model can read. Four production concerns shape it:

1. **Translate, then call.** The model gives you semantic arguments (`city="Dubai"`); your wrapper turns them into the real request (auth headers, query params) and calls the API. The model should never see your API key — that's the security boundary.
2. **Shrink the response.** APIs return big JSON. Feeding all of it wastes tokens and confuses the model. Return only the 3–5 fields that matter.
3. **Handle failure gracefully.** Networks time out, APIs rate-limit. Catch errors and return a *readable* error object (`{"error": "rate limited, retry in 30s"}`) so the model can react, not crash.
4. **Add timeouts and retries.** An agent that hangs on a slow API hangs the whole run. Bound every call.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🤖 call get_fx{pair:'AED/USD'}</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔧 wrapper<span class="sub">+auth, +timeout</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🌐 REST API</span>
    <span class="darr">→<span class="lbl">big JSON</span></span>
    <span class="dbox orange">✂️ shrink to {rate: 0.272}</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ back to model</span>
  </div>
  <div class="dcap">Your wrapper adds secrets + safety and trims the response — the model only sees clean, small data.</div>
</div>

## Concrete example (runnable, 2026-current)

```python
import os, requests
from openai import OpenAI
client = OpenAI()

def get_fx_rate(pair: str) -> dict:
    """Live FX rate for a pair like 'AED/USD'."""
    base, quote = pair.split("/")
    try:
        r = requests.get(
            "https://api.example-fx.com/v1/rate",
            params={"base": base, "quote": quote},
            headers={"Authorization": f"Bearer {os.environ['FX_API_KEY']}"},  # secret stays server-side
            timeout=5,                                                        # never hang the agent
        )
        r.raise_for_status()
        return {"pair": pair, "rate": r.json()["rate"]}      # shrink: one field, not the whole blob
    except requests.RequestException as e:
        return {"error": f"FX lookup failed: {e}"}           # readable error, model can retry/apologize

tools = [{"type": "function", "function": {
    "name": "get_fx_rate",
    "description": "Get the live exchange rate for a currency pair, e.g. 'AED/USD'.",
    "parameters": {"type": "object",
                   "properties": {"pair": {"type": "string"}},
                   "required": ["pair"]}}}]
# then the standard function-calling loop runs it and feeds the result back
```

Note what the wrapper does that the model can't: injects the API key, bounds the call to 5s, trims the response, and turns exceptions into readable errors.

## How a company uses this — production lens

> **A Dubai travel agency** agent wraps three APIs: flights, hotels, and their own booking backend. At ~5 req/s it hit real limits: the flight API allows **20 calls/minute**, so a chatty agent got `429`ed mid-conversation. Fixes: (1) a **cache** on flight lookups (same route asked repeatedly within minutes returns instantly, cutting cost and dodging rate limits); (2) a **5s timeout + one retry with backoff** so a slow hotel API doesn't freeze the chat; (3) **response trimming** — the flight API returns 40 fields per result, they pass back 4 (price, times, stops, airline), cutting ~2000 tokens per call to ~150, roughly a 10× token saving on that step. Same APIs, dramatically cheaper and more reliable — all in the wrapper.

## Common mistakes

- **Exposing the raw API key or endpoint to the model.** Auth lives in your wrapper. The model only sends semantic args.
- **Dumping the full response back.** Huge JSON burns tokens and buries the answer. Trim to what matters.
- **No timeout.** One slow API and the whole agent hangs. Always bound the call.
- **Crashing on failure.** Return an error object; let the model apologize or retry rather than throwing.
- **Ignoring rate limits.** Cache repeat calls and back off on `429`, or a busy agent gets blocked.

## Interview tip
Say: *"An API tool is a thin, safe wrapper: I keep auth server-side, add a timeout, trim the response to a few fields to save tokens, and return readable errors so the model can recover. In production I cache repeat calls and back off on rate limits."* That shows you think about cost, latency, and failure — not just the happy path. Compare with [retrieval / MCP tools](retrieval-mcp-tools.md), which do the same for *your own data*.
