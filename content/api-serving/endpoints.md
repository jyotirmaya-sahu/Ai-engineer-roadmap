# Endpoints

**What it is:** An endpoint is a single URL + HTTP method (like `POST /chat`) wired to one Python function that runs when someone calls it.

## Why it matters for an AI Engineer

An endpoint is the *front door* to your model. Everything a caller can do with your AI system, they do by hitting an endpoint. If you can't define clean endpoints, you can't ship anything. In interviews, "expose this model as an API" means "write me an endpoint." Getting the shape right — the right method, path, and what goes in vs. comes back — is the base skill the rest of this node builds on.

## The mechanism / how it works

An HTTP request has four parts you care about:

- **Method** — the verb. `GET` reads (no body, safe to repeat), `POST` creates/acts (has a body, may have side effects). For an LLM call you use `POST` because you're sending data (the prompt) and triggering work.
- **Path** — the URL after the domain, e.g. `/v1/chat`. Group related things: `/users`, `/users/{id}`.
- **Request body / params** — the data the caller sends. In the body (JSON), in the path (`/users/42`), or in the query string (`?limit=10`).
- **Response** — what you send back, almost always JSON plus a **status code** (200 OK, 422 validation error, 401 unauthorized, 500 server error).

In FastAPI you declare an endpoint with a **decorator** on a function. `@app.post("/chat")` says "when a POST hits `/chat`, run this function." FastAPI reads the function's type hints to know what to parse and returns whatever you `return` as JSON automatically.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">POST /chat<span class="sub">method + path</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">@app.post("/chat")<span class="sub">decorator matches it</span></span>
    <span class="darr">↓</span>
    <span class="dbox orange">your function runs</span>
    <span class="darr">↓</span>
    <span class="dbox green">return dict → JSON + 200</span>
  </div>
  <div class="dcap">A decorator binds a method+path to one function; its return value becomes the JSON response.</div>
</div>

**Path vs query params:** a value *inside* the path (`/users/{user_id}`) becomes a function argument by matching name. A value not in the path becomes a query param (`?limit=10` → `limit: int = 10`).

## Concrete example

```python
# pip install "fastapi[standard]"
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")            # GET, no body — a liveness check
def health():
    return {"status": "ok"}

@app.get("/models/{model_id}") # path param
def get_model(model_id: str, verbose: bool = False):  # verbose is a query param
    return {"model": model_id, "verbose": verbose}

@app.post("/chat")             # POST, takes a body
def chat(payload: dict):       # (next tile replaces dict with a Pydantic schema)
    reply = f"You said: {payload['message']}"
    return {"reply": reply}
```

Run it: `fastapi dev main.py`. Then `GET /health` → `{"status":"ok"}`, and `GET /models/gpt-4?verbose=true` → `{"model":"gpt-4","verbose":true}`. FastAPI auto-generates interactive docs at `/docs` — every endpoint listed, testable in the browser. That free Swagger UI is a big reason FastAPI won.

## How a company uses this

A production LLM API rarely has one endpoint. A Dubai SaaS's assistant service typically exposes: `POST /v1/chat` (the main call), `GET /v1/health` (load balancers ping this every few seconds to know the instance is alive — return fast, don't call the model), `GET /v1/models` (list what's available), and `POST /v1/feedback` (thumbs up/down for the eval flywheel). **Versioning the path** (`/v1/`) matters at scale: when you change the response shape, you ship `/v2/` and let old clients keep using `/v1/` instead of breaking every mobile app in the field. The health endpoint is not decoration — in an ECS/Kubernetes deploy, a failing health check is how the platform decides to kill and restart a hung instance, so it must respond in milliseconds without touching the model.

## Common mistakes

- **Using GET for actions with side effects.** GETs get cached and retried by browsers/proxies — never trigger a paid LLM call or a write from a GET.
- **Health check that calls the model.** It'll be slow and will report "unhealthy" whenever the model is merely busy, causing needless restarts.
- **No path versioning.** You'll regret it the first time you must change a response shape.
- **Returning raw strings when clients expect JSON** — return a dict/model so the shape is stable.

## Interview tip
Say: *"I design endpoints REST-style: POST for actions with a body like /v1/chat, GET for reads, path versioning so I can evolve the API without breaking clients, and a lightweight /health that never touches the model so orchestrators can check liveness cheaply."* Then mention FastAPI's auto-generated `/docs` — interviewers love that you get testable API docs for free.

See also: [Pydantic schemas](pydantic-schemas.md) (validate the body), [Async](async.md) (handle slow calls).
