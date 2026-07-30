# Rate limiting

**What it is:** Rate limiting caps how many requests a single caller can make in a time window (e.g. 20/min) — and rejects the rest with a `429 Too Many Requests` — so no one user can overload your service or run up your bill.

## Why it matters for an AI Engineer

LLM calls cost real money and hit *upstream* limits (OpenAI/Bedrock throttle you too). Without a rate limit, one buggy client in a retry loop, one abusive user, or one scraper can: (a) burn thousands of dollars in tokens overnight, (b) exhaust your provider quota so *every* user gets errors, or (c) DoS your service. Rate limiting is the seatbelt on an expensive, quota-bound backend — and it's a standard "how do you protect this endpoint?" interview follow-up right after auth.

## The mechanism / how it works

You count requests **per caller key** (user ID from the [JWT](auth-api-key-jwt.md), API key, or IP) within a window. Over the limit → return **429**, ideally with a `Retry-After` header telling the client when to try again. Common algorithms:

- **Fixed window** — "N per 60s," reset on the minute. Simple, but bursty at boundaries (a caller can do N at 0:59 and N at 1:00 = 2N in 2 seconds).
- **Sliding window** — counts the last 60s continuously; smoother, slightly more work.
- **Token bucket** — a bucket refills at a steady rate up to a cap; each request spends a token. **Allows short bursts** while capping the long-run rate — the usual production favorite.

**Where you store the counter is the real production decision.** In-memory counters (a dict, or `slowapi`'s default) are fine for **one process** — but you run [many workers/containers](uvicorn-gunicorn.md), each with its own memory, so "20/min" silently becomes "20/min × N workers." For a real limit across a fleet you need **shared state**, almost always **Redis**, which every instance increments against.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">request (user_id / key)</span>
    <span class="darr">↓</span>
    <span class="dbox blue">🗄️ Redis counter<br/>for this user, this window</span>
    <span class="darr">↓<span class="lbl">under limit</span></span>
    <span class="dbox green">✅ proceed</span>
  </div>
  <div class="flow">
    <span class="dbox blue">over limit</span>
    <span class="darr">→</span>
    <span class="dbox orange">429 + Retry-After</span>
  </div>
  <div class="dcap">Shared Redis state means the limit holds across every worker and container, not per-process.</div>
</div>

## Concrete example

```python
# pip install slowapi
from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# key by user when authenticated, else fall back to IP
def user_key(request: Request):
    return request.headers.get("X-User-Id") or get_remote_address(request)

# storage_uri="redis://..." makes the limit shared across workers/containers
limiter = Limiter(key_func=user_key, storage_uri="redis://localhost:6379")

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/chat")
@limiter.limit("20/minute")          # per caller, backed by Redis
async def chat(request: Request, message: str):
    return {"reply": f"you said: {message}"}
```

The 21st call in a minute from one user gets an automatic **429**. Point `storage_uri` at Redis and the cap holds no matter how many workers or containers run.

## How a company uses this

A Dubai support-bot SaaS enforces tiers: free users 20 msgs/min, paid 200/min, keyed by `user_id` from the JWT and counted in **Redis** so the limit is fleet-wide across their ECS containers. It has paid off twice. Once a customer's integration hit a retry bug and hammered `/chat` thousands of times a minute — the rate limiter absorbed it at 429 instead of forwarding to OpenAI, saving a projected **~$8k** in tokens that night. Separately, they add a **global** limiter beneath the per-user one, sized just under their Bedrock account's requests-per-minute quota, so a traffic spike degrades gracefully (some users get 429) instead of every request failing when the *provider* throttles them. They also return `Retry-After` so well-behaved clients back off automatically rather than retry-storming.

## Common mistakes

- **In-memory limits across multiple workers/containers** — the cap multiplies by process count and stops meaning anything. Use Redis for shared state.
- **Rate-limiting by IP only** — corporate NAT/proxies put many users behind one IP (unfairly throttled), and IPs are cheap to rotate. Prefer user/key identity.
- **No `Retry-After` header** — clients don't know when to retry and hammer you.
- **No *global* cap** — per-user limits still let 10,000 users collectively blow past your provider's quota.
- **Wrong status code** — throttling is `429`, not `403`.

## Interview tip
Say: *"I rate-limit per authenticated user, not just IP, and store counters in Redis so the limit is shared across all workers and containers — in-memory would multiply by process count. I like a token-bucket to allow small bursts, return 429 with Retry-After, and add a global limiter sized just under my LLM provider's quota so a spike degrades gracefully instead of failing everyone. It's the main defense against runaway token cost and abuse."* The "Redis for shared state" and "global cap under the provider quota" points show production experience.

See also: [Auth (API key / JWT)](auth-api-key-jwt.md) (supplies the per-user key), [Uvicorn / Gunicorn](uvicorn-gunicorn.md) (why per-process counters fail).
