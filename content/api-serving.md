# API & Serving

**The one-line idea:** A trained model or an LLM pipeline is useless until something can *call* it over the network — API & Serving is wrapping your Python code in a real HTTP service that other apps, front-ends, and teammates can hit, safely and at scale.

## Why we even need it

Your model lives inside a Python function. A React front-end, a mobile app, or another microservice can't `import` that function — they speak HTTP. So you need a thin layer that:

1. **Accepts requests over the network** — turns `POST /chat {"message": "hi"}` into a call to your function and sends the answer back as JSON.
2. **Validates the input** — rejects garbage before it reaches your expensive model, so a missing field doesn't crash the process.
3. **Survives the real world** — many users at once, browsers with security rules, callers who must prove who they are, and abusers you must throttle.

**FastAPI** is the tool the whole AI industry standardized on for this. It's a Python web framework that is fast, async-native, and validates data automatically using Python type hints. Every LLM-serving project you'll see — OpenAI-compatible gateways, vLLM's server, LangServe — is FastAPI underneath.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🌐 Client<span class="sub">browser / app</span></span>
    <span class="darr">→<span class="lbl">HTTP POST</span></span>
    <span class="dbox purple">⚡ FastAPI<span class="sub">validate + route</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🧠 your model / LLM</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ JSON response</span>
  </div>
  <div class="dcap">API & Serving is the layer that turns your Python model into something the network can call.</div>
</div>

## Why it matters for an AI Engineer

"Deployment" appears in **82% of Dubai AI/ML job descriptions** — more than any other single skill. And deployment starts here: before you can containerize or push to AWS, you must have a *service*. In interviews, "how would you serve this model?" is a near-guaranteed question, and the expected answer is a FastAPI endpoint with input validation, async I/O, streaming, auth, and rate limits. A notebook proves you can train; a running API proves you can ship. This node is the difference between "I did a course" and "I built a service people use."

## The tiles you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| [Endpoints](api-serving/endpoints.md) | define URL routes that run your code | always — the foundation of any API |
| [Pydantic schemas](api-serving/pydantic-schemas.md) | validate request/response with type hints | the moment you accept any input |
| [Async](api-serving/async.md) | handle many slow calls concurrently | your handler waits on an LLM / DB / HTTP call |
| [Streaming responses](api-serving/streaming-responses.md) | send tokens as they generate | any chat/LLM UI (the ChatGPT typing effect) |
| [Uvicorn / Gunicorn](api-serving/uvicorn-gunicorn.md) | the server that actually runs FastAPI | going from `--reload` dev to real production |
| [CORS](api-serving/cors.md) | let browser front-ends call your API | a web app on another domain hits your API |
| [Auth (API key / JWT)](api-serving/auth-api-key-jwt.md) | prove who the caller is | any non-public endpoint (i.e. almost all) |
| [Rate limiting](api-serving/rate-limiting.md) | cap requests per caller | protecting cost, abuse, and downstream limits |

The first four are FastAPI *fundamentals* — how you write the app. The last four are *serving* concerns — how you run it safely for real traffic.

## Real world: how a company uses this

> **A Dubai fintech** ships a customer-support LLM assistant. The chat widget on their website (`app.bank.ae`) calls an API at `api.bank.ae/v1/chat`. That endpoint is a FastAPI service: **Pydantic** validates the incoming message and session ID, an **async** handler streams the LLM's answer token-by-token (so the user sees text appear instantly instead of waiting 8 seconds), a **CORS** policy allows only their own domain, a **JWT** proves the user is logged in, and a **rate limit** of 20 messages/min per user stops one bad actor from running up a $10k OpenAI bill overnight. **Uvicorn workers behind Gunicorn** run 4 processes to use all CPU cores. Every piece in this node is load-bearing in that one flow.

## Interview tip
Say: *"I serve models with FastAPI — endpoints with Pydantic request/response models for automatic validation and docs, async handlers because the bottleneck is waiting on the model not CPU, and streaming responses for chat UX. In production I run it under Uvicorn workers managed by Gunicorn, lock down CORS to known origins, authenticate with an API key or JWT, and rate-limit per caller to protect cost and downstream quotas."* That sentence covers all eight tiles and signals you've actually deployed something.

---

*Below: deep-dive articles on each part of building and serving a FastAPI service.*
