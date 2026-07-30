# Tracing

**What it is:** a trace records a single user request as a *nested tree of steps* — retrieve, build prompt, call model, call tool, call model again — with the exact inputs, outputs, timing, and token cost of each step.

## Why it matters for an AI Engineer

When a normal API is wrong you read the stack trace and find the line. When an LLM app is wrong there's no exception — the request "succeeded" and produced a confident lie. The only way to debug is to see *what actually happened inside*: which chunks were retrieved, what the final prompt looked like, what the model returned at each hop. Tracing is that X-ray. Without it, "the bot gave a wrong answer" is unsolvable; with it, you open the trace and see the bad retrieved chunk in ten seconds. It's the single highest-leverage observability tool, and Langfuse is built around it.

## The mechanism — how it works

A trace is a **tree of spans**. The top-level node is the **trace** (one user request). Inside it are nested **spans** (a retrieval step, a tool call) and **generations** (an actual LLM call, which additionally records the model name, the prompt/messages, the completion, and token counts in/out).

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">🔍 TRACE: "what's my refund window?"</span>
    <span class="darr">↓</span>
    <div class="dstack">
      <span class="dbox blue">span: retrieve (120ms) → 4 chunks</span>
      <span class="dbox purple">generation: gpt-4o-mini (830ms, 1.2k→180 tok, $0.0009)</span>
      <span class="dbox blue">span: tool call get_order (40ms)</span>
      <span class="dbox purple">generation: gpt-4o-mini (610ms, 900→90 tok)</span>
      <span class="dbox green">✅ final answer</span>
    </div>
  </div>
  <div class="dcap">One request = one trace; each internal step is a nested span, each model call a priced generation.</div>
</div>

You create these by **instrumenting your code**. Langfuse gives you three ways: (1) the `@observe()` decorator, which auto-wraps a function into a span; (2) drop-in SDK wrappers for OpenAI/LangChain that turn every model call into a generation automatically; (3) OpenTelemetry, since Langfuse speaks OTel. Spans nest by *call stack* — a function decorated with `@observe()` called inside another becomes its child. The SDK batches spans and ships them asynchronously, so tracing adds negligible latency to the request.

Crucially, each generation carries **usage** (prompt/completion tokens) and Langfuse multiplies by the model's price to attach a **cost** — that's what powers the dashboards downstream.

## Concrete example

```python
# pip install langfuse openai   (Langfuse SDK v3, 2026)
from langfuse import observe, get_client
from langfuse.openai import openai   # drop-in wrapper: model calls auto-traced

langfuse = get_client()

@observe()  # this whole function becomes one span
def retrieve(q: str) -> list[str]:
    return ["Refunds within 14 days of delivery.", "..."]

@observe()  # parent span; retrieve() nests under it
def answer(question: str) -> str:
    chunks = retrieve(question)
    prompt = f"Context:\n{chunks}\n\nQ: {question}\nA:"
    # because we imported the wrapped openai, THIS call is auto-logged
    # as a generation with tokens + cost, nested under answer()
    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content

print(answer("What's my refund window?"))
langfuse.flush()  # ship spans before the script exits
```

Open the trace in Langfuse and you see `answer` → `retrieve` → the `gpt-4o-mini` generation, each with timing and (for the generation) tokens and cost.

## How a company uses this

At production scale a support assistant handles, say, **200,000 conversations/day**. You can't eyeball those. The team lives in Langfuse's trace *filters*: "show traces where latency > 5s" surfaces the slow tail (usually an over-large retrieval); "show traces with a thumbs-down score" jumps straight to the failures. A real debugging session: a spike in wrong answers filtered to traces where the retrieval span returned a specific stale document — the fix was a re-index, found in minutes because the exact retrieved text was in the trace. Tracing overhead is ~1–3ms per request (async batching), and teams sample high-volume, low-value traffic (e.g. keep 100% of thumbs-down, 10% of the rest) to control storage cost.

## Common mistakes
- **Logging only the final answer, not the intermediate steps.** Then you can see it's wrong but not *why*. Trace retrieval and every model hop.
- **Not attaching a `user_id`/`session_id`/`tags`.** Without them you can't group a multi-turn conversation or slice by feature. Set them on the trace.
- **Putting secrets/PII in span inputs** — traces are stored and viewable. Mask sensitive fields before logging.
- **Forgetting `flush()`** in short-lived scripts/serverless — spans are batched, so the process can exit before they're sent.

## Interview tip
Say: *"A trace is a nested tree — spans for retrieval and tools, generations for model calls with tokens and cost. I instrument with the `@observe()` decorator and the auto-tracing OpenAI wrapper, tag traces with user and session IDs, and debug by filtering to slow or thumbs-down traces. It's async so overhead is a couple ms, and I sample high-volume traffic to control cost."* Pair this with [monitoring & logging](/llmops-observability/monitoring-logging) (the aggregate view) and [cost / latency dashboards](/llmops-observability/cost-latency-dashboards) (which read from these traces).
