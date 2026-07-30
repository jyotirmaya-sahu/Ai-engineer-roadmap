# Timeouts

**The one-line idea:** Put a hard clock on every network/LLM call — "if you're not done in N seconds, give up and move on" — so one slow provider can never freeze your whole service.

## Why it matters for an AI Engineer

The most common way an AI app "goes down" isn't a crash — it's a **hang**. An LLM call that normally takes 1 second occasionally takes 60, or never returns at all. Without a timeout, your request thread sits there waiting. Under load, every thread ends up stuck on the same slow provider, your server stops accepting new requests, and the whole app appears dead even though nothing "errored." A timeout converts an infinite hang into a fast, catchable failure you can retry or fall back from. It is the single most important reliability primitive — everything else (retries, breakers, fallbacks) depends on the call *failing quickly* first.

## The mechanism — how it works

A timeout is a deadline attached to an operation. If the operation doesn't complete within the deadline, the client cancels it and raises a `TimeoutError` instead of waiting forever. Key things to get right:

- **Set it deliberately, not by default.** Most HTTP clients default to *no timeout* or a very long one. You must set an explicit value derived from your latency budget — e.g. if generation's budget is 2 s, a 4 s timeout catches true hangs while tolerating normal jitter.
- **Timeout each *hop*, not just the whole request.** Connect timeout (getting a socket), read timeout (waiting for bytes), and an overall total. A dead provider often *connects* fine but never sends data — the read timeout catches that.
- **Streaming needs care.** With streaming you don't want a total timeout (the stream is legitimately long); you want a **per-chunk / idle timeout** — "if no new token for X seconds, abort" — because a stalled stream is the failure mode.
- **A timeout must trigger cleanup.** Cancel the underlying request so you don't leak a connection while you move on.

Right-sizing matters: **too short** and you kill healthy-but-slow requests (false failures, wasted retries); **too long** and hangs still pile up. Base it on your measured p99 plus margin.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📞 call provider</span>
    <span class="darr">→<span class="lbl">start 4s clock</span></span>
    <span class="dbox purple">⏳ waiting…</span>
    <span class="darr">→<span class="lbl">4s hit</span></span>
    <span class="dbox orange">⏱️ TimeoutError<span class="sub">cancel + free thread</span></span>
    <span class="darr">→</span>
    <span class="dbox green">↩️ retry / fallback</span>
  </div>
  <div class="dcap">A hang becomes a fast, catchable error — freeing the thread instead of freezing the service.</div>
</div>

## Concrete example

Explicit timeouts on an OpenAI call, plus a per-chunk idle timeout for streaming:

```python
from openai import OpenAI
import httpx

# per-request timeout: 2s connect, 4s read, 10s total
client = OpenAI(timeout=httpx.Timeout(10.0, connect=2.0, read=4.0))

try:
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Summarize this policy."}],
        timeout=4.0,          # per-call override
    )
except httpx.TimeoutException:
    resp = None               # → hand off to retry / fallback, never hang
```

```python
import asyncio
# streaming: abort if no new token for 5s (idle timeout, not total)
async def stream_with_idle_timeout(stream, idle=5.0):
    it = stream.__aiter__()
    while True:
        try:
            chunk = await asyncio.wait_for(it.__anext__(), timeout=idle)
        except StopAsyncIteration:
            break
        except asyncio.TimeoutError:
            raise TimeoutError("stream stalled")   # dead stream → fail fast
        yield chunk
```

## How a company uses this

A **Dubai telco**'s support chatbot had a 2am incident: Azure OpenAI in one region started accepting connections but never responding. Because their client had **no read timeout**, request threads piled up waiting; within minutes the whole chatbot fleet was saturated and unresponsive to *every* user — a full outage caused by *slowness*, not an error. The fix was one line: a 4 s read timeout. Now the same provider stall produces fast `TimeoutError`s that flip to a fallback model (see [fallback chains](fallback-chains.md)), and the incident became invisible to users. At ~50 QPS, a timeout that frees threads in 4 s vs hanging for 60 s is the difference between a blip and a 15-minute outage.

## Common mistakes / misconceptions

- **Relying on the client default.** Many SDKs default to no timeout or 10 minutes. Always set an explicit value.
- **One giant total timeout only.** You also need connect and read timeouts — a common failure is "connected, then silent."
- **A total timeout on a stream.** Long streams are normal; use a per-chunk idle timeout instead.
- **Timeout without cancellation.** If you move on but don't cancel the request, you leak the connection — eventually exhausting the pool.
- **Too aggressive.** Setting it below your p99 turns normal slow requests into failures and triggers needless retries. Base it on measured p99 + margin.

## Interview tip
Say: *"Every external call gets an explicit timeout — connect, read, and total — sized from measured p99 plus margin, because the default is usually 'wait forever' and a hang is how AI apps actually go down. For streams I use a per-chunk idle timeout, not a total, and a timeout always cancels the underlying request so I don't leak connections. Timeouts are what make retries and fallbacks even possible."* Framing timeouts as the *precondition* for all other resilience patterns is the sophisticated answer.

See also: **[Retries & backoff](retries-backoff.md)** (what to do after a timeout) and **[Circuit breakers](circuit-breakers.md)** (when timeouts keep repeating).
