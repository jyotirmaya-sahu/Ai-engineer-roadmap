# Autoregressive Decoding

**What it is:** The way LLMs generate — one token at a time, feeding each token they just produced back in as input to produce the next one.

## Why it matters for an AI Engineer

This single fact explains most of your latency and cost model. Output tokens are generated **serially** — the model can't write token 50 until it has written token 49 — so a 500-token answer takes ~500 sequential forward passes. That's why **longer outputs are slower and why streaming exists**, why **output tokens often cost more than input tokens**, and why techniques like the KV cache and speculative decoding exist. If you can't explain autoregression, you can't explain why "make the answer shorter" is the most reliable latency fix.

## The mechanism

"Autoregressive" means each output depends on the previous outputs. The loop:

1. Feed the prompt through the model → get logits for the next token.
2. Sample one token from those logits.
3. **Append** that token to the sequence.
4. Feed the new, longer sequence back in → get logits for the *next* token.
5. Repeat until an end-of-sequence token or the max length is hit.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">Prompt: 'The cat sat'</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Model</span>
    <span class="darr">→</span>
    <span class="dbox yellow">' on'</span>
  </div>
  <div class="flow">
    <span class="dbox gray">'The cat sat on'</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Model</span>
    <span class="darr">→</span>
    <span class="dbox yellow">' the'</span>
  </div>
  <div class="flow">
    <span class="dbox gray">'The cat sat on the'</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Model</span>
    <span class="darr">→</span>
    <span class="dbox yellow">' mat'</span>
  </div>
  <div class="flow">
    <span class="dbox gray">'The cat sat on the mat'</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 Model</span>
    <span class="darr">→</span>
    <span class="dbox green">🛑 EOS</span>
  </div>
  <div class="dcap">Each generated token is appended and fed back in — one serial pass per token until EOS.</div>
</div>

There are two phases in practice:
- **Prefill:** the whole prompt is processed in one parallel pass (fast — GPUs love this). This is why you pay less per input token.
- **Decode:** tokens come out one at a time, each needing its own pass (slow, serial). This is the bottleneck.

**The KV cache** makes decode bearable: instead of re-processing the entire growing sequence every step, the model caches the Key/Value vectors of all previous tokens and only computes the new token. Without it, step *n* would redo the work of all *n* previous tokens — quadratic waste.

## Concrete example

Ask for a 300-word essay vs. a 30-word summary from the same prompt. The summary comes back ~10x faster not because the prompt changed, but because decode is serial: fewer output tokens = fewer sequential passes. This is why "limit `max_tokens`" and "ask for concise output" are real, measurable latency levers.

```python
# Streaming shows autoregression directly — tokens arrive one by one
for chunk in client.chat.completions.create(model="gpt-4o", messages=[...], stream=True):
    print(chunk.choices[0].delta.content, end="", flush=True)
```

## How this shows up in production

- **Streaming UX:** You stream tokens as they're generated because they *are* produced one at a time — there's nothing to stream faster.
- **Speculative decoding:** A small "draft" model guesses several tokens ahead; the big model verifies them in one pass. Accepted guesses skip serial steps — a common latency optimization in serving stacks like vLLM.
- **Time-to-first-token vs. tokens-per-second:** Prefill sets time-to-first-token; decode sets throughput. Long prompts hurt the first, long outputs hurt the second.

## Common misconceptions

- **"The model plans the whole answer, then writes it."** No — it commits to one token at a time, with no lookahead. Its "plan" is implicit in the running context. This is why it can paint itself into a corner mid-sentence.
- **"Output and input tokens cost the same to compute."** Input is prefilled in parallel; output is serial and dominates latency. Pricing usually reflects this (output priced higher).
- **"The KV cache changes the answer."** It's a pure speed optimization — same math, just not recomputed. It costs memory, not correctness.

## Interview tip

Say: *"Generation is autoregressive — prefill processes the prompt in parallel, then decode emits tokens one at a time, each conditioned on all previous tokens, with a KV cache avoiding recomputation."* Then connect it: *"That's why output length drives latency and why streaming and speculative decoding exist."* Linking the mechanism to a real optimization is what separates a strong answer.
