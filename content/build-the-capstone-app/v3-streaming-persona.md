# v3 · Streaming + Persona

**What you'll build:** two upgrades to HelpDesk. First, replies **stream** — they type out live instead of appearing after a pause. Second, you give the bot a real **persona** through the system prompt, so it sounds like a specific support agent, not a generic model.

## Why this version

After v2, the app *works* but *feels* slow — you wait, then a wall of text appears. Streaming fixes the **perceived** wait (first words in ~half a second) without changing total time. And the system prompt is where you control tone, rules, and personality — the cheapest, highest-leverage knob in any LLM app. This version makes **streaming** and **system-message steering** real.

## Change 1 — the persona (easy, do it first)

Just enrich the system message. It's already there from v2; make it specific:

```python
history = [{"role": "system", "content": (
    "You are HelpDesk, the support assistant for NoonBazaar, a Dubai online store. "
    "Be warm, concise, and professional. Answer in at most 3 sentences. "
    "If you don't know, say so and offer to raise a ticket. Never invent order details."
)}]
```

Restart, ask something — the tone changes immediately. That one string is your product's voice. **Experiment:** make it rude, then formal, then bilingual ("reply in English and Arabic") and watch behaviour shift. This is why the *System / user / assistant* tile matters.

## Change 2 — streaming

The reply must arrive as **token deltas** and reach the browser live. Two edits: stream on the server, read the stream on the client.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">⚙️ server<span class="sub">stream=True</span></span>
    <span class="darr">→<span class="lbl">yield deltas</span></span>
    <span class="dbox orange">StreamingResponse</span>
    <span class="darr">→<span class="lbl">read chunks</span></span>
    <span class="dbox green">🌐 page types live</span>
  </div>
  <div class="dcap">Server yields each token delta; the browser appends them as they land.</div>
</div>

### Backend

```python
from fastapi.responses import StreamingResponse

@app.post("/ask")
async def ask(q: Question):
    history.append({"role": "user", "content": q.text})

    def token_stream():
        collected = ""
        stream = client.chat.completions.create(
            model="gpt-5.4-mini", messages=history, stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                collected += delta
                yield delta                       # push to browser immediately
        history.append({"role": "assistant", "content": collected})  # remember AFTER stream ends

    return StreamingResponse(token_stream(), media_type="text/plain")
```

Note the memory append now happens **after** the stream finishes, using the accumulated text — you can't append a reply you haven't fully received yet.

### Frontend (regenerate for streaming)

The contract changed — the response is now a **stream of text**, not JSON. Hand your AI tool the new contract:

```
POST http://localhost:8000/ask
Request:  { "text": string }
Response: a streamed text/plain body (read incrementally, append as it arrives)
```

Prompt: *"Change the page to read the response body as a stream and append each chunk to the answer live, instead of awaiting res.json()."* The seam you own — reading a `ReadableStream` in React:

```tsx
// app/page.tsx (the ask function)
async function ask() {
  setAnswer("");
  const res = await fetch("http://localhost:8000/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const reader = res.body!.getReader();       // read the stream
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    setAnswer((prev) => prev + decoder.decode(value));  // append each delta live
  }
}
```

That `getReader()` loop is the one piece you must understand — it's how a browser consumes a `StreamingResponse`. Everything else the tool can generate.

## Make it real — required for this version

- **Replies visibly type out**, first words in well under a second.
- **A persona that's clearly "on"** — someone reading the output can tell it's NoonBazaar's agent.
- **Memory still works** across turns (don't break v2 — the append moved, it didn't disappear).
- **Commit and `git tag v3`.** README: "v3 — streaming replies + support persona." A GIF of the typing effect is gold here.

## Try it, then notice the next gap

It feels like a real product now. But every streamed reply resent your entire growing history — and you have **no visibility into what that costs** or how close you are to the context limit. That's exactly **v4**.

## Common mistakes

- **Appending the reply before the stream ends** — you'd store an empty/partial message. Accumulate, then append.
- **Buffering the full reply server-side** before returning — defeats streaming. `yield` each delta.
- **A vague system prompt** ("be helpful") — weak personas come from weak prompts. Be specific about tone, length, and rules.

## Interview tip

*"v3 added streaming — the server yields token deltas through a `StreamingResponse` and the frontend reads the body as a stream, so replies type out live and time-to-first-token drops to about half a second. I also moved the memory-append to after the stream completes. The persona is all in a specific system prompt controlling tone, length, and guardrails."* Naming *where the append moved* shows you actually built it.

*Next: v4 — show tokens and cost per reply, and trim old history before it overflows.*
