# Max tokens

**The one-line idea:** a hard ceiling on how many tokens the model is allowed to *generate* in its reply. When it hits the limit, generation stops — mid-sentence if it has to.

## Why it matters for an AI Engineer

Max tokens is your direct control over **cost, latency, and truncation**. Output tokens are billed (usually several times more expensive than input tokens) and every generated token adds latency, because the model produces them one at a time. A missing or too-high `max_tokens` is how teams get surprise bills and slow responses; a too-low one is how they get answers chopped off mid-thought. It's one of the first things an interviewer expects you to set on any production call.

## The mechanism / how it works

Generation is a loop: the model emits one token, appends it, and predicts the next. `max_tokens` (called `max_completion_tokens` on newer OpenAI models, `max_tokens` on Anthropic) is simply the **maximum number of times that loop runs** before it's force-stopped. Generation ends when *either* the model naturally produces an end-of-turn token, hits a **[stop sequence](stop-sequences.md)**, *or* reaches `max_tokens` — whichever comes first.

Crucially, `max_tokens` caps the **output only**. Your total budget is:

`input tokens (prompt) + output tokens (max_tokens) ≤ model's context window`

So if a model has a 128K context window and your prompt is 120K tokens, you can only ask for ~8K output regardless of what you set. The response tells you which limit fired via a **finish_reason**: `stop` (natural end / stop sequence) vs `length` (hit max_tokens — your output was truncated).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 Prompt<span class="sub">input tokens (billed cheaper)</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 generate loop</span>
    <span class="darr">→<span class="lbl">stops at first of…</span></span>
    <span class="dbox green">EOS · stop seq · max_tokens</span>
  </div>
  <div class="dcap">max_tokens caps only the generated side; input + output must fit the context window.</div>
</div>

## Concrete example — a cost calculation

```python
from openai import OpenAI
client = OpenAI()

r = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "Summarize this report in 3 bullets: ..."}],
    max_tokens=150,               # cap the summary length
)
print(r.choices[0].finish_reason) # "stop" = finished; "length" = got truncated
print(r.usage)                    # exact input/output token counts
```

**Why it matters for the bill.** Imagine a support bot handling 100,000 replies/day. If output prices are, say, \$0.60 per million tokens, then leaving `max_tokens=1000` when 200 would do wastes up to 800 tokens × 100,000 = 80M tokens/day ≈ **\$48/day burned** on padding you often trim anyway — plus the latency of generating tokens you throw away. Setting a tight, task-appropriate cap is free money and free speed.

## How a company uses this

A Dubai bank's customer assistant caps replies at **max_tokens=300** — long enough for a clear answer, short enough to keep p95 latency under ~2 seconds and the monthly bill flat and forecastable. Its document-summarization pipeline uses a higher **max_tokens=800** but logs every response with `finish_reason == "length"` as a truncation alert, so engineers know when a summary was cut off and can raise the cap or shorten the input. Treating `length` finishes as a monitored failure mode is a hallmark of a mature LLM system.

## Common mistakes / misconceptions

- **Forgetting to set it.** Many APIs then default to a large cap or the full remaining window, inviting runaway cost and latency.
- **Setting it huge "just in case."** It doesn't *make* the model talk more — the model stops naturally when done — but a huge cap removes your safety net against a model that loops. Pair a generous cap with a **[stop sequence](stop-sequences.md)**.
- **Ignoring `finish_reason`.** If you don't check it, silent truncation (`length`) ships broken/half answers to users.
- **Thinking it counts the prompt.** It's *output* only; the prompt eats into the context window separately.
- **Using it to enforce "3 sentences."** Token limits are a blunt length cap, not a formatting instruction — ask for the structure in the prompt *and* set a sane cap.

## Interview tip

Say: *"max_tokens caps the generated tokens only — the model stops at end-of-turn, a stop sequence, or this limit, whichever comes first. I set it per task to control cost and latency, since output tokens are billed and generated serially, and I always check finish_reason: 'length' means I truncated and need to alert or retry."* Mentioning `finish_reason` monitoring separates you from people who only read the happy path.
