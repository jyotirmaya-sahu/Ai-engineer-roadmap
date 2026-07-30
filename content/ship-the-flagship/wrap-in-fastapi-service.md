# Wrap in FastAPI Service

**What it is:** Taking the Python function that runs your AI project and putting it behind a web address, so anything — a browser, a mobile app, another server — can send it a request over HTTP and get an answer back.

## Why it matters for an AI Engineer

A notebook cell is callable by exactly one person: you, sitting at that machine. A *service* is callable by the whole world over the network. Every LLM product — a chatbot, a doc-summarizer, an agent — is ultimately an HTTP endpoint someone POSTs to. FastAPI is the near-universal default for this in AI companies because it's async (so one server can hold thousands of slow, waiting LLM calls at once), it validates inputs automatically, it supports streaming responses (the "typing" effect users expect), and it generates interactive API docs for free. When a job says "serve the model," this is the layer they mean.

## The mechanism / how it works

FastAPI is built on three ideas:

1. **A route = a URL + a function.** You decorate a Python function with `@app.post("/chat")`, and now anyone who sends an HTTP POST to `/chat` triggers that function. The function's return value becomes the HTTP response (auto-converted to JSON).

2. **Pydantic models = typed, validated request/response.** You declare the *shape* of the incoming data as a class. FastAPI checks every request against it: wrong type or missing field → automatic `422` error before your code even runs. No manual `if "question" not in body` checks.

3. **`async def` = concurrency for slow calls.** An LLM call takes 1–5 seconds, but almost all of that is *waiting on the network*, not using CPU. With `async`, while one request waits on OpenAI, the server handles others. A single worker can juggle hundreds of in-flight LLM calls — critical, because LLM latency is high and traffic is bursty.

**Streaming** is the fourth piece that matters specifically for LLMs. Instead of making the user stare at a spinner for 4 seconds, you stream tokens as the model generates them, using a `StreamingResponse`. This is why ChatGPT feels fast even though the full answer isn't ready — it's showing you the first tokens immediately.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📨 POST /chat<span class="sub">{"question": "..."}</span></span>
    <span class="darr">→<span class="lbl">validate</span></span>
    <span class="dbox orange">🔎 Pydantic model</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 your LLM logic</span>
    <span class="darr">→<span class="lbl">stream</span></span>
    <span class="dbox green">✅ tokens back</span>
  </div>
  <div class="dcap">Request comes in, gets validated, hits your model code, streams out.</div>
</div>

## Concrete example

```python
# app.py  — pip install "fastapi[standard]" openai
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

app = FastAPI()
client = AsyncOpenAI()  # reads OPENAI_API_KEY from env

class ChatRequest(BaseModel):
    question: str
    top_k: int = 5          # validated: must be an int, defaults to 5

class ChatResponse(BaseModel):
    answer: str

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # ...your retrieval / RAG logic here using req.question...
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": req.question}],
    )
    return ChatResponse(answer=resp.choices[0].message.content)

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    async def gen():
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": req.question}],
            stream=True,
        )
        async for chunk in stream:
            if tok := chunk.choices[0].delta.content:
                yield tok
    return StreamingResponse(gen(), media_type="text/plain")

@app.get("/health")               # for load balancers / deploys
def health():
    return {"status": "ok"}
```

Run it: `fastapi dev app.py`, then open `http://localhost:8000/docs` — FastAPI generates a live, clickable test UI for your API automatically. That `/health` endpoint isn't optional decoration: the next step (deploy to AWS) uses it so the load balancer knows your container is alive.

## How a company uses this

At production scale the shape is the same, the numbers get real. A customer-support RAG API at a mid-size SaaS might run behind **Gunicorn managing 4 Uvicorn workers per container**, each handling ~50 concurrent async requests, targeting a **p95 latency budget of ~2.5s** end-to-end (retrieval + LLM). The Pydantic layer quietly earns its keep: it rejects malformed requests (a mobile client sends `top_k` as a string) at the edge with a clean `422` instead of letting a `TypeError` crash a worker mid-request. Streaming is a business decision, not a nicety — showing first tokens in ~300ms keeps users from abandoning, even when the full answer takes 3s. Teams put a `/health` and often a `/ready` endpoint on every service so orchestrators can restart dead containers automatically.

## Common mistakes

- **Using `def` instead of `async def` for LLM routes.** A blocking `def` route with a slow LLM call ties up a whole worker thread — throughput collapses under load. Use `async` and the async client.
- **Doing heavy CPU work inside an async route** (e.g. a large local embedding computation). That blocks the event loop and freezes *every* concurrent request. Offload it with `run_in_threadpool` or a separate worker.
- **Returning raw dicts everywhere and skipping Pydantic.** You lose validation and auto-docs, and bad input crashes deep in your code instead of bouncing at the door.
- **Forgetting a health endpoint** — then the AWS deploy step has no way to tell if your container actually started.

## Interview tip

Say: *"I serve models with FastAPI because it's async — one worker can hold hundreds of in-flight LLM calls that are mostly waiting on the network. I use Pydantic models so bad requests get a clean 422 at the edge instead of crashing a worker, and I stream token-by-token so time-to-first-token is ~300ms even when the full response takes seconds."* Then mention the `/health` endpoint — it shows you're already thinking about the [deploy step](containerize-deploy-to-aws.md).
