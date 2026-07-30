# Latency

**What it is:** How *fast* a model responds — split into **time-to-first-token** (how long before the reply starts) and **throughput** (how fast tokens stream after that). It's a first-class selection axis, not an afterthought.

## Why it matters for an AI Engineer

Users abandon slow apps. A voice assistant that pauses three seconds before speaking feels broken; a chat that takes ten seconds to start feels dead. Latency also caps model choice: bigger and reasoning models are slower, so a real-time UX may *forbid* your most capable model regardless of its quality. And latency ties to cost and architecture — streaming, caching, and routing all exist partly to fix it. Interviewers ask "the assistant feels slow, what do you do?" and expect you to break latency into its parts and name concrete levers.

## The mechanism / how it works

Two numbers, and they matter for different UX:

- **Time-to-first-token (TTFT)** — the wait before the *first* word appears. Dominated by how long the model takes to read (prefill) your whole input. Long prompts and huge retrieved context inflate TTFT badly. This is what users perceive as "is it frozen?"
- **Throughput / tokens-per-second (TPS)** — how fast the rest streams out. Determines how long a long answer takes to finish. Bigger models generate fewer tokens/sec.

Total response time ≈ TTFT + (output tokens ÷ TPS). What moves each:

- **Model size** — bigger = slower on both axes ([Model sizes](model-sizes.md)).
- **Reasoning models** — they generate hidden reasoning tokens first, so TTFT-to-*useful*-answer is much longer. Great accuracy, bad for real-time.
- **Input length** — long context inflates TTFT because the model must read it all first ([Context length](context-length.md)).
- **Streaming** — send tokens as generated so the user sees words immediately; TTFT becomes the only wait they feel, even if the full answer takes seconds.
- **Prompt caching** — cache a stable long prefix so the model skips re-reading it, slashing TTFT on repeated calls.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 request</span>
    <span class="darr">→<span class="lbl">prefill = TTFT</span></span>
    <span class="dbox orange">🔵 first token</span>
    <span class="darr">→<span class="lbl">stream @ TPS</span></span>
    <span class="dbox green">✅ full answer</span>
  </div>
  <div class="dcap">TTFT is the "is it frozen?" wait; throughput sets how long the rest takes. Optimize them separately.</div>
</div>

## Concrete example — streaming kills perceived latency

```python
from anthropic import Anthropic
client = Anthropic()
with client.messages.stream(
    model="claude-sonnet-4-5",
    max_tokens=400,
    messages=[{"role": "user", "content": "Explain our refund policy."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)   # words appear as generated
```

Without streaming the user stares at nothing until all 400 tokens finish (~several seconds). With streaming they read from the first word — same total time, but the app *feels* instant because only TTFT is felt.

## How a company uses this

A Dubai telco's voice IVR assistant needs speech to start within ~1 second or callers think the line dropped. Their frontier model had a ~2.5s TTFT on long prompts — unusable. Fixes, stacked: they (1) moved to a smaller fast model for the conversational turns, (2) put the fixed 4k-token system prompt in **prompt caching** so it wasn't re-read each turn, dropping TTFT to ~600ms, and (3) **streamed** tokens into the text-to-speech engine so speech began at the first word. Hard reasoning (rare) still uses the slow model, but off the real-time path. Result: sub-second perceived response on 95% of turns.

## Common mistakes
- **Optimizing total time but ignoring TTFT** — users judge responsiveness by the *first* token; streaming fixes the feel even when total time is unchanged.
- **Putting a reasoning model on a real-time path** — its hidden thinking makes useful-answer latency far worse than the raw number suggests.
- **Stuffing huge context then wondering why it's slow** — long input inflates prefill; trim or cache it.
- **Not caching stable prefixes** — repeated re-reading of a long system prompt is avoidable TTFT.

## Interview tip
Say: *"I split latency into time-to-first-token and throughput. Users feel TTFT, so I stream tokens, cache stable prefixes, and trim input context to shrink prefill. Model choice is constrained by latency — reasoning and frontier models are too slow for real-time, so I keep them off the interactive path and use a smaller fast model there. Total time is TTFT plus output-tokens over throughput, and I optimize each lever separately."*
