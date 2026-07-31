# v4 · Token & Cost Tracking

**What you'll build:** make HelpDesk's cost **visible and controlled**. Show tokens + estimated dollar cost after each reply, track a running total for the session, and **trim old history** before it overflows the context window. This is the version where the app stops being a toy and starts respecting money and limits.

## Why this version

By v3, every reply resends the whole growing conversation — so cost quietly climbs with each turn, and eventually the history exceeds the model's context window and the API errors out. Real apps *must* manage this. This version makes **token counting** and **truncation** real, and builds the cost-visibility habit that separates engineers from tinkerers.

## Change 1 — count tokens and show cost

Use `tiktoken` to count offline, and read the real `usage` from the stream's final chunk. Add cost display per reply.

```python
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")   # gpt-5.x encoding not in tiktoken yet; gpt-4o's is close for counting

IN_PRICE, OUT_PRICE = 0.15, 0.60              # illustrative $ per 1M tokens
session_cost = 0.0

@app.post("/ask")
async def ask(q: Question):
    history.append({"role": "user", "content": q.text})

    def token_stream():
        global session_cost
        collected = ""
        stream = client.chat.completions.create(
            model="gpt-5.4-mini", messages=history, stream=True,
            stream_options={"include_usage": True},   # ask for a final usage chunk
        )
        usage = None
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                piece = chunk.choices[0].delta.content
                collected += piece
                yield piece
            if chunk.usage:                            # arrives on the last chunk
                usage = chunk.usage
        history.append({"role": "assistant", "content": collected})

        cost = (usage.prompt_tokens/1e6)*IN_PRICE + (usage.completion_tokens/1e6)*OUT_PRICE
        session_cost += cost
        # send a small footer line the frontend can show
        yield f"\n\n---\n💰 {usage.total_tokens} tokens · ${cost:.5f} · session ${session_cost:.4f}"

    return StreamingResponse(token_stream(), media_type="text/plain")
```

Now every reply ends with a cost line, and you watch the session total climb — *seeing* why long chats get expensive.

## Change 2 — trim history before it overflows

Keep the system message plus the most recent turns, so total tokens stay under a budget. Do this right before the call.

```python
MAX_HISTORY_TOKENS = 3000

def trim_history(msgs):
    system = msgs[0]
    rest = msgs[1:]
    # drop oldest turns until the rest fits the budget
    while rest and sum(len(enc.encode(m["content"])) for m in rest) > MAX_HISTORY_TOKENS:
        rest.pop(0)                     # remove the oldest non-system message
    return [system] + rest
```

Call `history[:] = trim_history(history)` before `create(...)`. The bot now "forgets" the oldest turns instead of crashing — a deliberate, controlled forgetting.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">full history<span class="sub">grows every turn</span></span>
    <span class="darr">→<span class="lbl">over budget?</span></span>
    <span class="dbox orange">drop oldest turns</span>
    <span class="darr">→</span>
    <span class="dbox green">fits context window<span class="sub">+ known cost</span></span>
  </div>
  <div class="dcap">Count before sending; trim to a token budget so you never overflow — and always know the cost.</div>
</div>

## Make it real — required for this version

- **A visible cost line** after every reply, plus a running session total.
- **Truncation that works** — have a very long conversation and confirm it keeps going (dropping old turns) instead of hitting a context-length error.
- **A short note in your README** on the pricing assumptions (they're illustrative).
- **Commit and `git tag v4`.** README: "v4 — token & cost tracking + history truncation."

## Try it, then notice the next gap

HelpDesk is now a solid chat product. But one thing is still messy: when it *can't* answer (e.g. "where's my order #4471?"), it just says so in prose — nothing downstream can act on that. What if, in those cases, it returned a **structured ticket** another system could ingest? That's **v5**.

## Common mistakes

- **Counting only the user message** — the whole history + system prompt is the input; count all of it.
- **Trimming the system message away** — always keep `msgs[0]`; it holds the persona and rules.
- **Trusting tiktoken as exact for a different model family** — it's a close estimate; the `usage` object is the source of truth for billing.
- **Hiding cost** — the entire point is making it visible. A cost line you can see changes how you build.

## Interview tip

*"v4 made cost a first-class concern — I count tokens with tiktoken, read the real usage from the streaming final chunk, show per-reply and session cost, and trim the history to a token budget (keeping the system message + most recent turns) so it never overflows the context window. That truncation-versus-overflow tradeoff is exactly the problem RAG later solves more cleverly."* Connecting truncation to RAG shows roadmap awareness.

*Next: v5 — when HelpDesk can't help, emit a structured JSON ticket instead of prose.*
