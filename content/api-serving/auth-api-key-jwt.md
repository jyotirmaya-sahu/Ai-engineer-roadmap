# Auth (API key / JWT)

**What it is:** Authentication is how your API proves *who is calling* before it does any work — the two workhorse methods being a static **API key** (a secret string) and a **JWT** (a signed token that carries who-you-are inside it).

## Why it matters for an AI Engineer

An open LLM endpoint is a disaster: anyone who finds the URL can spend your OpenAI budget, extract your data, or DoS you. Every non-public endpoint needs auth — which is almost all of them. Beyond safety, auth is *who* for cost attribution and rate limits: you can't cap "20 requests/user/min" if you don't know which user is calling. This is a baseline production skill; a take-home that serves a model without auth reads as junior.

## The mechanism / how it works

**Authentication** = *who are you* (a key/token). **Authorization** = *are you allowed to do this* (roles/scopes). Auth first, then authz.

**API key** — a long random secret string the caller sends in a header (`X-API-Key: sk_live_…` or `Authorization: Bearer sk_…`). Your API checks it against a store (DB/hash) and maps it to an account. Simple, great for **server-to-server** and machine callers. Downsides: it never expires on its own (rotate it), carries no user info by itself, and must be stored hashed (like a password), never in plaintext.

**JWT (JSON Web Token)** — a self-contained token with three dot-separated parts: a header, a **payload** of claims (`user_id`, `role`, `exp` expiry), and a **signature**. The server signs the payload with a secret; on each request it verifies the signature. If it's valid, the token is trusted *without a DB lookup* — the identity travels inside the token. This is the standard for **user-facing** apps: the user logs in once, gets a short-lived JWT, and sends it on every call. Crucial: a JWT is **signed, not encrypted** — anyone can read the payload (base64), so never put secrets in it; the signature only guarantees it wasn't *tampered with*. Short expiry (`exp`) limits damage if one leaks.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">request + Authorization header</span>
    <span class="darr">↓</span>
    <span class="dbox purple">dependency: verify<br/>key hash / JWT signature</span>
    <span class="darr">↓<span class="lbl">valid</span></span>
    <span class="dbox green">✅ handler runs, knows user</span>
  </div>
  <div class="dcap">Bad or missing credential → 401 before any model work. Valid → identity flows into the handler.</div>
</div>

## Concrete example

```python
# pip install "fastapi[standard]" pyjwt
from fastapi import FastAPI, Depends, HTTPException, Header
import jwt   # PyJWT

app = FastAPI()
SECRET = "change-me-load-from-env"   # real: from env/secret manager

# --- API key: simple, for machine callers ---
VALID_KEYS = {"hash_of_key_here"}    # store HASHES, not raw keys
def require_api_key(x_api_key: str = Header(...)):
    import hashlib
    if hashlib.sha256(x_api_key.encode()).hexdigest() not in VALID_KEYS:
        raise HTTPException(401, "invalid API key")

# --- JWT: for logged-in users ---
def current_user(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])  # verifies sig + exp
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid or expired token")
    return payload["user_id"]

@app.post("/chat")
def chat(message: str, user_id: str = Depends(current_user)):
    return {"reply": f"hi {user_id}", "you_said": message}
```

FastAPI's **`Depends`** is the clean pattern: attach the check as a dependency and the endpoint body only runs if auth passed — no boilerplate `if` in every handler.

## How a company uses this

A Dubai fintech uses **both**. End users hit the chat via the web app: they log in through the identity provider, receive a **15-minute JWT**, and every `/chat` call carries it — the API verifies the signature (no DB hit, so it's fast at high QPS) and reads `user_id` for logging, cost tracking, and rate limits. Partner *backends* that call the API server-to-server use **long-lived API keys** stored in a secret manager, hashed at rest, and rotated quarterly. Two production essentials: the signing secret lives in **AWS Secrets Manager**, never in code or Git; and JWTs are kept **short-lived with refresh tokens**, because a self-contained token can't be un-issued — if it were long-lived and leaked, an attacker would have access until natural expiry. When a key does leak, they revoke it in the store and every request with it 401s immediately.

## Common mistakes

- **No auth at all** on an LLM endpoint — open budget and data.
- **Secrets in code/Git** — the signing key or API keys must come from env/secret manager.
- **Storing API keys in plaintext** — hash them like passwords.
- **Long-lived JWTs** — they can't be revoked; keep `exp` short and use refresh tokens.
- **Putting secrets in the JWT payload** — it's readable by anyone; signed ≠ encrypted.
- **Confusing CORS with auth** — [CORS](cors.md) restricts browser origins, not identity.

## Interview tip
Say: *"I authenticate with a FastAPI dependency so unauthenticated calls 401 before any model work. API keys — hashed at rest, from a secret manager, rotated — for server-to-server; short-lived JWTs for logged-in users, verified by signature so there's no DB lookup per request. I keep JWTs short because they can't be revoked, never put secrets in the payload since it's only signed not encrypted, and I use the identity for per-user rate limits and cost attribution."* Distinguishing key vs JWT use-cases and the "signed ≠ encrypted" point signals real security literacy.

See also: [Rate limiting](rate-limiting.md) (needs identity), [CORS](cors.md) (not a substitute for auth).
