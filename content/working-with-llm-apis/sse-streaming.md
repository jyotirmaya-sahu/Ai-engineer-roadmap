# SSE streaming

**What it is:** **Server-Sent Events (SSE)** is the actual wire protocol underneath [streaming](streaming.md) — a simple, one-way, text-over-HTTP format where the server keeps the connection open and pushes a series of `data:` lines. It's *how* those token chunks physically arrive.

## Why it matters for an AI Engineer

Most of the time the SDK hides this and you just loop over chunks. But the moment you build a **custom client**, proxy an LLM through your own backend to a browser, debug a stream that's "stuck," or integrate a provider without an SDK, you need to understand the raw protocol. Knowing SSE is what lets you forward streamed tokens from your server to a web frontend, spot why a stream never ends, or parse events by hand. Interviewers asking "what's actually happening when you stream?" want to hear *SSE*, not "the SDK does magic."

## The mechanism — how it works

When you request streaming, the server responds with `Content-Type: text/event-stream` and *doesn't close the connection*. It then sends a sequence of **events**, each as plain text lines:

```
data: {"choices":[{"delta":{"content":"The"}}]}

data: {"choices":[{"delta":{"content":" cap"}}]}

data: [DONE]
```

Rules of the format:
- Each event is one or more lines; a line starting with `data:` carries the payload (here, a JSON chunk).
- Events are separated by a **blank line** (`\n\n`). That blank line is the delimiter your parser splits on.
- The stream ends when the server closes the connection; OpenAI also sends a sentinel `data: [DONE]`.
- SSE is **one-directional** (server → client) and **text-only** — simpler than WebSockets, which are bidirectional and used for realtime [audio](audio.md).
- Anthropic's SSE includes richer named events (`event: content_block_delta`, etc.) alongside the `data:` payload.

You parse it by reading the response as a byte stream, splitting on blank lines, stripping the `data: ` prefix, and JSON-decoding each payload (except `[DONE]`).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">GET/POST · Accept: text/event-stream</span>
    <span class="darr">↓<span class="lbl">connection stays open</span></span>
    <span class="dbox orange">data: {delta "The"}\n\n</span>
    <span class="dbox orange">data: {delta " cap"}\n\n</span>
    <span class="dbox orange">data: {delta "ital"}\n\n</span>
    <span class="dbox green">data: [DONE]  → connection closes</span>
  </div>
  <div class="dcap">SSE: a long-lived HTTP response streaming blank-line-separated <code>data:</code> events until [DONE].</div>
</div>

## Concrete example

Parsing the raw SSE stream by hand (no SDK), to show what's really on the wire:

```python
import json, httpx

url = "https://api.openai.com/v1/chat/completions"
headers = {"Authorization": "Bearer $OPENAI_API_KEY", "Content-Type": "application/json"}
body = {"model": "gpt-4.1", "stream": True,
        "messages": [{"role": "user", "content": "Say hello in 3 words."}]}

with httpx.stream("POST", url, headers=headers, json=body) as r:
    for line in r.iter_lines():          # each SSE line
        if not line or not line.startswith("data: "):
            continue
        payload = line[len("data: "):]   # strip the prefix
        if payload == "[DONE]":
            break
        chunk = json.loads(payload)
        delta = chunk["choices"][0]["delta"].get("content", "")
        print(delta, end="", flush=True)
```

This is exactly what the SDK's streaming loop does internally.

## How a company uses this

A Dubai SaaS proxies all LLM traffic through its **own backend** (to inject auth, log usage, and enforce quotas) before reaching the browser. **Production reality:** they receive the provider's SSE stream server-side and *re-emit their own SSE stream* to the frontend, forwarding each delta as it arrives so the user still sees instant typing. Understanding the protocol let them solve two real bugs: a proxy that **buffered** the whole response (killing the streaming effect) until they disabled response buffering, and streams that **hung forever** because a load balancer's idle timeout closed long-lived connections — fixed by tuning timeouts and sending periodic keep-alive comments (`: ping\n\n`).

## Common mistakes

- **Response buffering in a proxy/gateway** — nginx or a CDN buffering the body destroys streaming; disable buffering for `text/event-stream`.
- **Idle-timeout kills** — load balancers close long connections; raise timeouts or send keep-alive pings.
- **Forgetting the blank-line delimiter** — chunks can arrive split across reads; buffer until you see `\n\n`.
- **Not handling `[DONE]`** — treating the sentinel as JSON throws.
- **Confusing SSE with WebSockets** — SSE is one-way and simpler; realtime voice needs the bidirectional WebSocket.

## Interview tip
Say: *"Streaming rides on Server-Sent Events: a long-lived HTTP response with `text/event-stream`, pushing blank-line-separated `data:` chunks until a `[DONE]` sentinel. It's one-directional and text-only, unlike WebSockets. The classic production pitfalls are proxy buffering that silently disables streaming, and load-balancer idle timeouts that kill the connection — both fixed at the infra layer, not in the model call."* Naming the buffering and timeout gotchas proves hands-on debugging.
