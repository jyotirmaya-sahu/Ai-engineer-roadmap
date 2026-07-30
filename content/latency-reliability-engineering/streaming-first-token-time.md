# Streaming & first-token time

**The one-line idea:** Instead of waiting for the whole answer and then showing it, stream tokens to the screen *as the model produces them* — so the user sees words within a few hundred milliseconds even though the full response takes several seconds.

## Why it matters for an AI Engineer

An LLM generates one token at a time. A 500-token answer might take 4 seconds end-to-end — a 4-second blank spinner feels broken. But if the *first* word appears in 400 ms and the rest flows in like someone typing, the same 4 seconds feels fast and alive. This is the single highest-leverage perceived-latency win in LLM apps, and it costs almost nothing to implement. Every serious chat product (ChatGPT, Claude, Copilot) streams. If your demo doesn't, it feels a generation behind — and interviewers notice.

## The mechanism — how it works

Two numbers define streaming performance:

- **TTFT (time-to-first-token):** how long until the *first* token arrives. This is what the user perceives as "how fast it responds." Driven by network round-trip + prompt processing (prefill), so a long prompt raises TTFT.
- **TPOT / inter-token latency:** the gap between subsequent tokens once flowing (typically 10–50 ms/token). Total time ≈ TTFT + (output tokens × TPOT).

Technically, the model API keeps the HTTP connection open and sends **server-sent events (SSE)** — small chunks, each carrying a token or two — instead of one big response at the end. Your backend reads that stream and forwards each chunk to the browser (also over SSE or WebSocket), which appends it to the screen.

The magic: **TTFT is roughly constant regardless of answer length.** A 50-token and a 500-token answer both show their first word at ~the same moment. So streaming decouples *perceived* latency (TTFT) from *actual* latency (total). Your latency budget can even "cheat" — a 5 s total answer with 400 ms TTFT feels faster than a 2 s non-streamed answer with a 2 s spinner.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 asks a question</span>
    <span class="darr">↓<span class="lbl">~400ms TTFT</span></span>
    <span class="dbox green">"The" "termination" "notice"…<span class="sub">tokens stream in</span></span>
    <span class="darr">↓<span class="lbl">~20ms/token</span></span>
    <span class="dbox green">…"is 30 days." ✅ full answer</span>
  </div>
  <div class="dcap">User sees the first word in ~400ms; the rest flows in like typing — 4s feels instant.</div>
</div>

## Concrete example

Streaming from the OpenAI API and printing tokens as they arrive:

```python
from openai import OpenAI
import time

client = OpenAI()
t0 = time.perf_counter()
first = None

stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain a bank overdraft in 3 sentences."}],
    stream=True,
)
for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        if first is None:
            first = (time.perf_counter() - t0) * 1000
            print(f"[TTFT: {first:.0f}ms]")
        print(delta, end="", flush=True)   # append to screen live
```

In a FastAPI backend you forward this to the browser as SSE:

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat")
def chat(q: str):
    def gen():
        stream = client.chat.completions.create(
            model="gpt-4o", stream=True,
            messages=[{"role": "user", "content": q}])
        for chunk in stream:
            if (d := chunk.choices[0].delta.content):
                yield f"data: {d}\n\n"      # SSE frame per token
    return StreamingResponse(gen(), media_type="text/event-stream")
```

## How a company uses this

A **Dubai e-commerce** company's shopping assistant answers "which of these two phones has a better camera?" — answers run 300–600 tokens (~4–6 s total). Before streaming, users bounced during the spinner; conversion on the assistant was poor. After streaming, **TTFT dropped to ~500 ms** and users started reading immediately; engagement with the assistant roughly doubled with *zero* change to the model or prompt. At their scale (peak ~80 concurrent chats), streaming also let them use a *bigger, slower, more accurate* model without hurting perceived speed — the extra 1.5 s of total time was invisible behind the stream. They watch TTFT p95 (target < 800 ms) as a first-class SLA, separate from total latency.

## Common mistakes / misconceptions

- **Confusing TTFT with total latency.** Streaming barely changes total time; it transforms *perceived* time. Budget and monitor them separately.
- **Buffering the stream on the server.** If your backend collects all chunks before flushing, you've silently un-streamed it. Yield each chunk immediately; disable proxy/response buffering.
- **Streaming structured JSON to the user.** Half-written JSON on screen is ugly and unparseable. Stream prose to humans; buffer tool-call/JSON output and validate before use.
- **Ignoring long prompts.** A huge prompt raises TTFT (prefill cost). Trim context to keep first-token snappy.

## Interview tip
Say: *"I stream every user-facing generation. The metric that matters is TTFT — time-to-first-token — which is roughly constant regardless of answer length, so streaming decouples perceived latency from total latency. I monitor TTFT p95 as its own SLA, keep prompts lean to protect prefill time, and only stream prose to users while buffering JSON/tool output."* Naming TTFT as distinct from total latency is the tell of someone who's shipped chat.

See also: **[Latency budgeting](latency-budgeting.md)** (where TTFT fits the budget) and **[Async serving](async-serving.md)** (how the server holds many streams open at once).
