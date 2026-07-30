# CORS

**What it is:** CORS (Cross-Origin Resource Sharing) is a browser security rule that blocks a web page on one domain from calling an API on a *different* domain — unless the API explicitly says "I allow that origin."

## Why it matters for an AI Engineer

The moment your React/Next.js front-end (say `app.company.ae`) tries to call your FastAPI service (`api.company.ae`), the browser blocks it and the console fills with a scary red *"blocked by CORS policy"* error. Nothing is broken on the server — the browser is enforcing a rule and you simply haven't opted in. Almost every AI engineer hits this the first time they wire a web UI to their model API. Knowing what CORS is (and, just as important, what it is *not*) saves hours and prevents a dangerous over-fix.

## The mechanism / how it works

An **origin** is the triple `scheme + host + port` — `https://app.company.ae` and `https://api.company.ae` are *different* origins (different host), and so is `http://localhost:3000` vs `:8000` (different port). When JavaScript in a browser calls an origin different from the page's own, that's a **cross-origin request**, and the browser guards it.

The flow: for anything beyond a simple request, the browser first sends a **preflight** — an automatic `OPTIONS` request asking the API *"do you allow origin X, method POST, header Authorization?"* The API answers with `Access-Control-Allow-*` headers. If the origin is on the allow-list, the browser proceeds; if not, it **blocks the real request from ever being sent** and reports a CORS error.

Two things people must internalize:

1. **CORS is enforced by the browser, not the server.** `curl`, Postman, mobile apps, and server-to-server calls **ignore CORS entirely** — it never applies to them.
2. **CORS is not authentication.** It controls *which web pages* can call you, not *who* the caller is. That's [Auth's](auth-api-key-jwt.md) job. CORS is a browser convenience/safety layer, not a security wall — a malicious server can call you regardless.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">page: app.company.ae<br/>calls api.company.ae</span>
    <span class="darr">↓<span class="lbl">preflight OPTIONS</span></span>
    <span class="dbox purple">FastAPI CORS middleware<br/>origin on allow-list?</span>
    <span class="darr">↓<span class="lbl">yes</span></span>
    <span class="dbox green">✅ real POST allowed</span>
  </div>
  <div class="dcap">The browser asks first; the API's allow-list decides. Non-browser callers skip all of this.</div>
</div>

## Concrete example

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[                       # explicit list — NOT "*"
        "https://app.company.ae",
        "http://localhost:3000",          # your local front-end in dev
    ],
    allow_credentials=True,               # allow cookies / auth headers
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

That's the whole fix. Add the middleware, list your front-end origins, and the red errors vanish — *for browsers*. Your `curl` tests were always working.

## How a company uses this

A Dubai SaaS locks `allow_origins` to exactly `https://app.company.ae` and their staging domain — nothing else. Why so strict? With `allow_credentials=True`, a permissive list would let *any* website their users visit fire authenticated requests to the API using the user's logged-in session (a CSRF-style abuse). So the allow-list is a real, if narrow, safety control. A common self-inflicted outage: a developer sets `allow_origins=["*"]` to "make CORS go away," ships it, and later discovers the wildcard is **incompatible with `allow_credentials=True`** — the browser rejects the combination, breaking the authenticated app in production while it worked in insecure local tests. The right pattern is an explicit, environment-specific list (dev origins in dev, prod origins in prod), usually driven from an env var.

## Common mistakes

- **`allow_origins=["*"]` in production** — over-permissive, and outright *breaks* when combined with `allow_credentials=True`.
- **Thinking CORS secures your API** — it doesn't; non-browser clients ignore it. Use [Auth](auth-api-key-jwt.md) for security.
- **Blaming the server for a CORS error** — the request never reached your logic; it's a missing allow-list entry.
- **Forgetting `localhost:3000` in dev**, or the port/scheme mismatch (`http` vs `https`) that makes an origin "different."
- **Not allowing the `Authorization` header**, so preflight passes but the authenticated call is stripped.

## Interview tip
Say: *"CORS is a browser policy, not server security — it decides which web origins may call my API, enforced only in browsers, so curl and server-to-server ignore it. I add FastAPI's `CORSMiddleware` with an explicit allow-list of my front-end origins per environment, never `*` in prod — especially with credentials, where the wildcard is invalid. Real authentication is a separate concern handled by API keys or JWTs."* The "CORS ≠ auth" distinction is the mark of someone who understands it.

See also: [Auth (API key / JWT)](auth-api-key-jwt.md) (actual security), [Endpoints](endpoints.md).
