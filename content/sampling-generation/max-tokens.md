# Max tokens

**The one-line idea:** a hard ceiling on the number of tokens the model is allowed to *generate* — it is not a politeness hint, it is a guillotine; when the counter hits zero, generation stops mid-sentence.

> **Continuing from repetition penalty.** You just learned how the model decides *which* token to pick next — and how to stop it from looping the same word. But those knobs work inside the generation loop. Now we step back and ask: how many times should the loop run *at all*? `max_tokens` is the answer. It and the upcoming **stop sequences** tile are the two ways to end generation before the model naturally reaches its own end-of-turn token: one ends by *count*, the other by *content*.

## Why it matters for an AI Engineer

Three things flow from `max_tokens`:

1. **Cost.** Output tokens are billed. On most APIs they cost several times more per-token than input tokens. Every output token you generate and don't use is cash burned.
2. **Latency.** Models generate tokens *serially* — one at a time, in sequence. More output tokens = more time before the user sees a finished reply. p95 latency is almost entirely driven by output length.
3. **Silent truncation.** If you set it too low, the model's answer gets cut off in the middle — and unless you check the `finish_reason` field on the response, you'll silently ship a broken half-answer to users.

These aren't edge cases. They're the three most common "my LLM app is slow / expensive / broken" root causes, and they all trace to misconfigured output length.

## The context budget — tying back to "Usage & token counting"

Before diving into the parameter itself, recall what you learned in the **Usage & token counting** tile: every model has a **context window** — a maximum total number of tokens it can hold at once. That budget is shared between input and output:

```
input tokens (your prompt) + output tokens (the reply) ≤ context window
```

If a model has a 128 K context window and your prompt is 120 K tokens, you only have 8 K left for the reply — regardless of what you set in `max_tokens`. If you set `max_tokens=20000` on that call, the API will either error or silently cap it at ~8 K. This is why the token-counting tile matters: knowing your prompt's token count tells you how much headroom you actually have for the reply before you even pick up `max_tokens`.

The diagram below shows the full budget split:

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue wide">📥 Input tokens (prompt)<span class="sub">billed at input rate · eats context window</span></span>
    <span class="darr">↓<span class="lbl">remaining window</span></span>
    <span class="dbox purple wide">🧠 max_tokens (your cap)<span class="sub">actual output ≤ min(cap, remaining window)</span></span>
    <span class="darr">↓</span>
    <span class="dbox green wide">✅ Reply text<span class="sub">billed at output rate · adds latency</span></span>
  </div>
  <div class="dcap">Input + output must fit the context window. max_tokens caps the output side of that budget.</div>
</div>

## The mechanism — how the loop stops

Generation is a loop. The model:
1. Looks at everything so far (prompt + tokens generated so far).
2. Outputs a probability over its vocabulary.
3. Samples the next token.
4. Appends it and repeats.

The loop ends when **any one of three things** fires first:

- The model produces a special **end-of-turn token** (EOS) — this is the "natural" ending, `finish_reason == 'stop'`.
- A **stop sequence** string appears in the output — also `finish_reason == 'stop'` (next tile).
- The generated token count reaches `max_tokens` — `finish_reason == 'length'`. **This is truncation.** The model was still talking; you cut it off.

`finish_reason == 'length'` is the signal you must monitor. It means the reply is *incomplete*.

## The 2026 parameter name — `max_completion_tokens`

OpenAI renamed the parameter in their v2 API:

- Old name (still works): `max_tokens`
- New canonical name: **`max_completion_tokens`**

They are the same thing — a cap on generated output tokens. The rename clarifies that it counts *completion* tokens only, not the prompt. If you pass both, `max_completion_tokens` wins. Anthropic still uses `max_tokens`. The concept is identical; only the field name differs.

```python
# OpenAI — new preferred name
client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[...],
    max_completion_tokens=300,   # 2026 canonical name
)

# Anthropic — same concept, same field name as always
anthropic_client.messages.create(
    model="claude-opus-4-5",
    messages=[...],
    max_tokens=300,
)
```

## Concrete example — forcing a 'length' truncation

This example deliberately sets `max_completion_tokens` so low the model cannot finish, then catches the truncation:

```python
from openai import OpenAI

client = OpenAI()

r = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{
        "role": "user",
        "content": (
            "Write a detailed 5-paragraph essay about the history of "
            "artificial intelligence, covering every decade from the 1950s."
        )
    }],
    max_completion_tokens=40,   # deliberately tiny — essay needs hundreds
)

choice = r.choices[0]
print("finish_reason:", choice.finish_reason)
# → "length"   (not "stop" — the model was cut off)

print("reply:", choice.message.content)
# → "Artificial intelligence has a rich history dating back to the 1950s,
#    when pioneers like Alan Turing first asked whether machines could..."
# (ends mid-sentence — truncated at token 40)

print("tokens used:", r.usage.completion_tokens, "of 40 allowed")
```

Run this yourself — you'll see `finish_reason: length` and a reply that stops mid-thought. Now raise `max_completion_tokens` to 600 and you'll see `finish_reason: stop` with a complete essay.

**Cost math on a real service.** Suppose your HelpDesk support bot handles 100,000 replies per day. Output tokens cost \$0.60 per million. If you leave the cap at 1,000 tokens but the average useful reply is 200 tokens:

```
Wasted tokens per reply:  ~800
Wasted tokens per day:    800 × 100,000 = 80,000,000
Daily wasted spend:       80M / 1M × $0.60 = $48
Monthly:                  ~$1,440 — on tokens no user ever reads
```

A tight, task-calibrated cap is genuinely free money and free speed.

## How a company uses this

**HelpDesk v4** (which you built) already used `max_tokens` for cost control — and in v1 you saw `finish_reason` for the first time. Here's the production pattern those versions pointed toward:

A Dubai bank's customer support assistant sets `max_completion_tokens=300`. That's long enough for a clear answer and short enough to keep p95 response latency under 2 seconds and the monthly bill flat and forecastable. Their separate document-summarization pipeline uses `max_completion_tokens=800` — summaries legitimately need more room — but it logs every response where `finish_reason == 'length'` as a truncation alert. When that alert fires, engineers investigate: maybe the input document grew, maybe the prompt template expanded, maybe the cap needs raising. A `length` finish is a signal, not a silent failure.

Treating `finish_reason == 'length'` as a monitored alert, not noise to ignore, is one of the clearest marks of a mature LLM system.

## Common mistakes / misconceptions

- **Not setting it at all.** Most APIs then default to a large cap or the full remaining context window. You've removed your cost and latency guardrail.
- **Setting it huge "just in case."** It doesn't make the model write more — the model stops naturally when done. But a huge cap eliminates your safety net against a looping model. Pair a generous cap with a stop sequence (next tile).
- **Ignoring `finish_reason`.** If you don't check it, silent truncation ships incomplete answers to users. Always check it; log `length` finishes as alerts.
- **Thinking it counts the prompt.** `max_completion_tokens` is *output only*. The prompt eats into the context window separately — see the budget diagram above.
- **Using it as a formatting instruction.** Setting `max_tokens=50` doesn't mean "answer in one sentence." It means "cut the wire at 50 tokens." Ask for the format in the prompt; use `max_tokens` as a safety cap, not a style directive.
- **Confusing it with input limits.** If the API raises a `ContextLengthExceeded` error, the *prompt* is too long — not the `max_tokens` setting. Two different problems, two different fixes.

## Interview tip

Say: *"max_completion_tokens caps only the generated output — the model stops at its natural end-of-turn token, a stop sequence, or this limit, whichever fires first. I set it per task: tight for short-answer flows to control cost and latency, higher for summarization. I always inspect finish_reason — 'stop' means a natural end, 'length' means truncation — and I log 'length' responses as alerts in production because they mean the user got an incomplete answer."* Distinguishing `stop` vs `length` and saying you *monitor* it is the detail that signals you've actually shipped generation code.

---

**Next up — [Stop sequences](stop-sequences.md).** You now have a hard numeric count controlling where generation ends. Stop sequences give you the other half: *content-based* termination — you name a string, and the moment the model produces it, generation halts. Together, max tokens and stop sequences are the two guardrails that keep a generation loop from running away — one by count, one by content.
