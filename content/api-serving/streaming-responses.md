# Streaming responses

**What it is:** Streaming sends the model's answer to the client **token-by-token as it's generated**, instead of waiting for the whole thing and sending it in one lump — this is the "typing" effect you see in ChatGPT.

## Why it matters for an AI Engineer

An LLM might take 8 seconds to produce a full answer. Without streaming the user stares at a spinner for 8 seconds, then everything appears at once — it *feels* broken. With streaming, the first word shows in ~300ms and text flows in continuously; **time-to-first-token (TTFT)** replaces total latency as the number that matters. Every serious chat product streams. Building a streaming endpoint is a rite-of-passage AI-engineer skill and a common take-home task, because it forces you to understand generators, async, and HTTP response bodies together.

## The mechanism / how it works

Normally FastAPI buffers your entire return value, then sends it. Streaming breaks that: you return a **generator** that `yield`s pieces, and FastAPI flushes each piece to the client immediately over a single, kept-open HTTP connection.

Two transport choices:

- **`StreamingResponse`** — raw chunks. Simplest; you just yield strings.
- **Server-Sent Events (SSE)** — a standard text protocol where each message is `data: ...\n\n`. Browsers speak it natively via `EventSource`, and the OpenAI API itself uses SSE. This is the production default for chat.

The LLM SDKs give you an async generator when you pass `stream=True`. You loop over it with `async for`, pulling each delta (a token or few), and yield it onward. Because you're awaiting the model *and* yielding, this is inherently async — streaming is where the [Async](async.md) tile pays off in UX.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🧠 LLM<span class="sub">stream=True</span></span>
    <span class="darr">→<span class="lbl">token</span></span>
    <span class="dbox purple">async for delta:<br/>yield</span>
    <span class="darr">→<span class="lbl">SSE chunk</span></span>
    <span class="dbox green">🌐 client renders live</span>
  </div>
  <div class="dcap">Each token flows straight through to the browser — first word in ~300ms, not after 8s.</div>
</div>

## Concrete example

```python
# pip install "fastapi[standard]" openai
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
import json

app = FastAPI()
client = AsyncOpenAI()

@app.post("/chat/stream")
async def chat_stream(message: str):
    async def event_generator():
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": message}],
            stream=True,                       # ← ask for a token stream
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                # SSE format: "data: <json>\n\n"
                yield f"data: {json.dumps({'token': delta})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",        # SSE content type
    )
```

A browser consumes it with `new EventSource("/chat/stream")` (or `fetch` + a stream reader), appending each token as it arrives. Send `curl -N` to see tokens print live in the terminal — the `-N` disables curl's buffering.

## How a company uses this

A Dubai bank's support assistant streams every answer. Product measured it directly: switching from buffered to streaming dropped **perceived** latency from ~7s to a ~400ms TTFT, and chat abandonment fell noticeably because users saw progress immediately. Three production details matter at scale. **(1) Buffering middlemen:** Nginx and many cloud load balancers buffer responses by default and swallow the streaming effect — they had to set `proxy_buffering off` (and `X-Accel-Buffering: no`) or tokens arrived in one clump anyway. **(2) Client disconnects:** when a user closes the tab mid-answer, the server should detect the dropped connection and *stop* the LLM call — otherwise you keep paying for tokens no one will read. **(3) Errors mid-stream:** once you've sent a 200 and started streaming, you can't change the status code, so failures are signaled as a special SSE `error` event the front-end handles.

## Common mistakes

- **A proxy/load balancer buffering the stream** — the #1 "streaming works locally but not in prod" bug. Disable buffering at every hop.
- **Not sending SSE format** (`data: ...\n\n`) when the client uses `EventSource` — it won't parse.
- **Forgetting a done sentinel** (`[DONE]`) so the client knows when to stop.
- **Ignoring disconnects** — you burn tokens streaming to a closed tab.
- **Trying to set an error status code after streaming started** — too late; use an in-stream error event.

## Interview tip
Say: *"For chat I stream with `StreamingResponse` over SSE — I set `stream=True` on the LLM, `async for` the deltas, and yield each as `data: …\n\n`. The metric that matters becomes time-to-first-token, not total latency. The gotcha I always check is proxy buffering — Nginx/load balancers buffer by default and kill the effect — plus stopping the generation when the client disconnects so I don't pay for unread tokens."* Naming TTFT and the buffering gotcha shows you've shipped a real chat UI.

See also: [Async](async.md) (the engine behind streaming), [Endpoints](endpoints.md).
