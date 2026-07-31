# Streaming

**What it is:** Instead of waiting for the model to finish and returning the whole answer at once, streaming sends you each token *as it's generated*, so text appears word-by-word — like the typing effect in ChatGPT.

## Why it matters for an AI Engineer

A model generating 800 tokens might take 15–30 seconds end-to-end. If you wait for the full response, the user stares at a spinner and assumes it's broken. With streaming, the first words appear in **under a second** and the rest flow in as they're produced. The total time is the same — but *perceived* latency collapses, and users tolerate long answers happily. Streaming is table-stakes for any chat UI, and it's also what lets you show a running answer, cancel early, or process output incrementally. Interviewers ask "how do you stream a response?" precisely because it separates people who've built real UIs from people who've only called the API in a notebook.

## The mechanism — how it works

You add `stream=True` to the request. The connection stays open and the server pushes a sequence of small **chunks** over [Server-Sent Events](/llm-apis-advanced/sse-streaming). Each chunk contains a *delta* — usually one token's worth of text — plus occasional metadata. Your code loops over the chunks and appends each delta to the growing string (and typically prints/renders it live). A final chunk signals completion; usage/token counts arrive at the end.

Key facts:
- Each chunk is tiny — you accumulate them yourself into the full message.
- **Time-to-first-token (TTFT)** is the metric users feel; total tokens/second is throughput.
- You can **abort** mid-stream (user hit stop) by closing the connection — you stop paying for tokens not yet generated.
- Tool calls and structured output stream too, but arrive as partial JSON fragments you must buffer until complete.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📤 request<span class="sub">stream=True</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model</span>
    <span class="darr">→<span class="lbl">chunks</span></span>
    <span class="dbox orange">"The"</span>
    <span class="dbox orange">" cap"</span>
    <span class="dbox orange">"ital"</span>
    <span class="dbox orange">"…"</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ [DONE]</span>
  </div>
  <div class="dcap">The model pushes token-deltas as it generates; you concatenate them live. First token in ~500ms.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

stream = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "Explain embeddings in two sentences."}],
    stream=True,
    stream_options={"include_usage": True},  # get token counts in the final chunk
)

full = ""
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        piece = chunk.choices[0].delta.content
        print(piece, end="", flush=True)   # render live
        full += piece
    if chunk.usage:                          # arrives on the last chunk
        print(f"\n[tokens: {chunk.usage.total_tokens}]")
```

The Anthropic SDK exposes the same idea via `client.messages.stream(...)` with a `.text_stream` iterator.

## How a company uses this

A Dubai airline's customer-service assistant streams every reply to the web widget. **Production numbers:** without streaming, a 600-token answer took ~12s and support-chat abandonment was high; with streaming, first text hit the screen in ~600ms and users stayed. They also wired the browser's *stop* button to abort the stream — when a user rephrases mid-answer, closing the connection **stops token billing immediately**, saving real money at their volume. On the backend they buffer partial tool-call JSON until it's valid before executing, because acting on a half-streamed function call would crash.

## Common mistakes

- **Not accumulating deltas** — each chunk is a fragment, not the whole message.
- **Parsing partial JSON** from streamed tool calls or JSON mode before it's complete. Buffer, then parse.
- **Ignoring the final usage chunk**, then having no token counts for cost tracking (see [Usage & token counting](usage-token-counting.md)).
- **Blocking the event loop** — in a web server, stream asynchronously so one slow generation doesn't stall other requests.
- **Forgetting error handling mid-stream** — the connection can drop after the first token; wrap the loop and be ready to retry (see [Retries & backoff](/llm-apis-advanced/retries-backoff)).

## Interview tip
Say: *"Streaming doesn't make generation faster — it slashes *perceived* latency by delivering time-to-first-token in about half a second while the rest flows in. I accumulate the deltas, buffer partial tool-call JSON until valid, capture the final usage chunk for cost tracking, and wire abort to stop billing when a user cancels."* Mentioning TTFT and abort-to-save-cost signals real UI experience.

## Practice — assignments

Write a program for each. Do them in order. You need `pip install openai` and `OPENAI_API_KEY` set.

1. Write a program that streams a reply to a long prompt and prints each piece as it arrives, so the text appears word-by-word in the terminal instead of all at once.

2. Extend assignment 1 to also accumulate the streamed pieces into one complete string, and after the stream ends, print that full string again on its own.

3. Write a program that measures and prints the time-to-first-token — how many seconds pass between sending the request and receiving the first non-empty piece.

4. Write a program that streams a reply, and also captures and prints the total token count from the final chunk (you'll need to request usage in the stream).

5. Write a program that streams a long reply but stops reading after the first 50 characters have arrived — closing the stream early — and prints only what it received. (Simulates a user hitting "stop".)

6. Write a program that compares the two modes: request the same prompt once without streaming and once with streaming, and print how long until you had the first visible output in each case.

7. (Stretch) Write a program that streams a reply and wraps the loop in error handling, so that if the connection drops mid-stream it prints what it received so far instead of crashing.

*Do 1–4 before moving to the next tile.*
