# Load Test + Harden (auth, rate limits)

**What it is:** Deliberately hammering your live service to find where it breaks, then bolting on the defenses — API keys, rate limits, timeouts — that stop it from falling over or being abused once real (or hostile) traffic arrives.

## Why it matters for an AI Engineer

A public LLM endpoint is uniquely dangerous to run naked, because *every single request costs you money* and calls a slow upstream. An open endpoint is an open wallet: one script firing thousands of requests can run up a four-figure OpenAI bill in an hour, or simply exhaust your concurrency so real users get errors. And you can't reason about capacity you've never measured — "can it handle launch?" is unanswerable until you've actually pushed load through it. This step is what separates a demo URL you'd be nervous to share from a service you can confidently put on a resume and hand to a hiring manager to hit.

## The mechanism / how it works

**Load testing** — measure before you guess. A tool sends a controlled, rising number of concurrent requests and reports **throughput** (requests/sec), **latency percentiles** (p50, p95, p99 — the p99 is the unlucky user's experience), and the **error rate**. You ramp users up until latency spikes or errors appear: that's your breaking point and your real capacity number.

Then **hardening** — three layers, cheapest attacks first:

- **Auth (API keys).** No key, no service. Each caller sends a secret key in a header; unknown keys get `401`. This alone stops anonymous internet abuse and gives every request an *identity* — which the next layer needs.
- **Rate limiting.** Cap requests *per key* per window (e.g. 60/minute). Over the cap → `429 Too Many Requests`. This is your bill's circuit breaker: even a valid key can't melt your budget. The classic algorithm is a **token bucket** — each key has a bucket that refills at a fixed rate; each request spends a token; empty bucket → reject.
- **Timeouts & limits.** Cap how long an upstream LLM call may hang (so one stuck request doesn't pin a worker forever), cap request body size, and validate inputs (already handled by Pydantic from the [FastAPI step](wrap-in-fastapi-service.md)).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📨 request + API key</span>
    <span class="darr">→<span class="lbl">no key?</span></span>
    <span class="dbox orange">🔑 auth → 401</span>
    <span class="darr">→<span class="lbl">over cap?</span></span>
    <span class="dbox yellow">🪣 rate limit → 429</span>
    <span class="darr">→<span class="lbl">too slow?</span></span>
    <span class="dbox purple">⏱️ timeout → 504</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ served</span>
  </div>
  <div class="dcap">Each guard rejects a cheaper class of abuse before the expensive LLM call runs.</div>
</div>

## Concrete example

Load test with [k6](https://k6.io) — ramp to 50 concurrent users and watch p95:

```javascript
// loadtest.js  →  k6 run loadtest.js
import http from "k6/http";
import { check } from "k6";
export const options = {
  stages: [
    { duration: "30s", target: 50 },   // ramp up to 50 virtual users
    { duration: "1m",  target: 50 },   // hold
    { duration: "20s", target: 0 },    // ramp down
  ],
  thresholds: { http_req_duration: ["p(95)<3000"] },  // fail if p95 > 3s
};
export default function () {
  const res = http.post("https://your-app.awsapprunner.com/chat",
    JSON.stringify({ question: "What is our refund policy?" }),
    { headers: { "Content-Type": "application/json", "X-API-Key": "test-key" } });
  check(res, { "status 200": (r) => r.status === 200 });
}
```

Harden the FastAPI app — API-key auth + per-key rate limit + timeout:

```python
# pip install slowapi
from fastapi import FastAPI, Depends, Header, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
import asyncio, os

VALID_KEYS = set(os.environ["API_KEYS"].split(","))  # from env, never hardcoded
limiter = Limiter(key_func=lambda req: req.headers.get("X-API-Key", "anon"))
app = FastAPI()
app.state.limiter = limiter

def require_key(x_api_key: str = Header(None)):
    if x_api_key not in VALID_KEYS:
        raise HTTPException(401, "invalid or missing API key")
    return x_api_key

@app.post("/chat")
@limiter.limit("60/minute")                      # per-key, from the key_func above
async def chat(req: ChatRequest, key: str = Depends(require_key)):
    try:                                          # cap a hung upstream call at 30s
        return await asyncio.wait_for(answer(req.question), timeout=30)
    except asyncio.TimeoutError:
        raise HTTPException(504, "upstream LLM timed out")
```

Now: no key → `401`, 61st request in a minute → `429`, a stuck LLM call → `504` instead of a frozen worker. Re-run the k6 test to confirm the limits kick in and p95 stays under budget.

## How a company uses this

The production numbers make the *why* concrete. A team load-tests before launch and learns a single Fargate task handles **~40 req/s at p95 = 2.8s** before latency degrades — so they configure autoscaling to add a task at 30 req/s, well before the cliff. Rate limits are **tiered by plan**: free keys get 20/min, paid 300/min, enforced in shared Redis (not per-process memory) so the limit holds *across* all containers behind the load balancer — a per-process limiter would let a burst through by hitting different containers. The real save is the budget guard: after one customer's misconfigured cron fired **12,000 requests overnight**, a per-key daily token cap turned what would've been a ~$400 surprise into a wall of `429`s and a Slack alert. Timeouts matter because upstream providers occasionally hang — a 30s cap plus a retry-with-backoff keeps one slow OpenAI call from cascading into every worker being stuck and the whole service going dark.

## Common mistakes

- **In-memory rate limiting behind multiple containers.** Each process counts separately, so the real limit is `N × your_cap`. Use shared Redis.
- **Rate-limiting by IP instead of by key.** Everyone behind one corporate NAT or cloud egress shares an IP — you'll throttle legitimate users and miss distributed abuse. Limit per authenticated key.
- **No timeout on the LLM call.** One hung upstream request pins a worker indefinitely; enough of them and the service is fully down.
- **Testing only the happy path.** Load-test *auth failures and rate-limit rejections* too — a flood of `401`s shouldn't be able to knock you over either.
- **Hardcoding keys in code.** Load them from env/Secrets Manager, and be able to rotate them.

## Interview tip

Say: *"I load-test with k6 to find the real breaking point — throughput and p95 — before I trust a capacity number, then set autoscaling below that cliff. I harden with API-key auth so every request has an identity, per-key rate limits in shared Redis so they hold across all containers, and timeouts on the upstream LLM so one hung call can't pin a worker. For an LLM endpoint the rate limit is really a bill circuit-breaker — an open endpoint is an open wallet."* Naming the *shared-Redis* detail and the *cost* motivation shows you've actually run one of these, not just read about it.
