# Speculative decoding

**What it is:** A latency trick where a small, fast "draft" model guesses several next tokens, and the big, accurate model **verifies them all in one pass** — accepting the good guesses and rejecting the rest, so you generate multiple tokens per big-model step without changing the output.

## Why it matters for an AI Engineer

Token generation is inherently sequential — one token at a time — and that per-token latency is often the wall between "feels instant" and "feels sluggish." Speculative decoding attacks it directly, delivering **1.5–3× faster generation** with **zero quality loss** (the output is provably identical to the big model's). For latency-sensitive products — a coding assistant, a live chat — that's a huge UX win. Being able to explain how you get *free* speed without degrading quality is a memorable interview point, because it sounds too good to be true until you understand the verification step.

## The mechanism / how it works

Normal decoding: the big model runs one forward pass → one token. Slow, because each pass is expensive and you need one per token.

The key realization: a big model's forward pass can **score many token positions in parallel just as cheaply as one** (it's memory-bandwidth-bound during decode — see [KV cache](kv-cache.md) — so verifying 5 tokens costs almost the same as generating 1). Speculative decoding exploits this:

1. **Draft:** a small model (e.g. a 1B) cheaply generates the next *k* tokens (say 4) — a guess of what the big model would say.
2. **Verify:** feed all 4 drafted tokens into the big model in **one** forward pass. The big model outputs its own probability for each position, in parallel.
3. **Accept/reject:** walk the draft left to right. As long as the big model agrees (its sampled token matches the draft), accept — you got those tokens "for free." At the first disagreement, reject the rest and take the big model's own token there.

Because the acceptance rule follows the big model's exact distribution, the final output is **statistically identical** to running the big model alone — it's an exact speedup, not an approximation. If the draft is good (agrees often), you get 3–4 tokens per big-model pass. If it's bad, you fall back to ~1 token/pass (no worse than normal, minus a little overhead).

Variants: **self-speculative** (the model drafts with some of its own layers), **Medusa/EAGLE** (extra lightweight heads predict multiple tokens), and **n-gram/prompt lookup** (draft by copying repeated phrases from the prompt — great for summarization/code).

<div class="diagram">
  <div class="flow v">
    <span class="dbox orange">🐇 draft model guesses: "the cat sat on"</span>
    <span class="darr">↓<span class="lbl">verify all 4 in ONE big pass</span></span>
    <span class="dbox purple">🐢 big model checks in parallel</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ "the cat sat" accepted · ✗ "on" → big model's own token</span>
  </div>
  <div class="dcap">Cheap guesses, one expensive verification — accepted tokens are free, output is identical to the big model alone.</div>
</div>

## Concrete example

In vLLM it's a config flag — pair a big model with a small drafter:

```bash
vllm serve meta-llama/Llama-3.1-70B-Instruct \
  --speculative-model meta-llama/Llama-3.2-1B-Instruct \
  --num-speculative-tokens 4
```

The 1B drafts 4 tokens; the 70B verifies. On agreeable text (code, structured output) you'll often see **2–3× lower latency** at the same quality. Prompt-lookup needs no second model at all — it drafts by matching repeated spans in the input, ideal when outputs echo the prompt.

## How a company uses this

A team shipping an in-IDE coding assistant needed sub-second completions from a 70B model, but per-token latency made it feel laggy. They enabled speculative decoding with a 1B drafter. Because code is highly predictable, the acceptance rate was high (~70–80% of drafts accepted), giving a **~2.4× speedup** with byte-identical output — users just saw faster completions. The trade-off they measured: the draft model consumes **extra GPU memory and some compute**, so on a fully memory-saturated server it can *reduce* total throughput even as it improves per-request latency. Their rule: enable it for **latency-critical, low-concurrency** paths; leave it off for **throughput-maximizing batch** workloads where [continuous batching](continuous-batching.md) already keeps the GPU full.

## Common mistakes

- **Thinking it changes output quality.** The verification step makes it mathematically exact — same distribution as the big model alone.
- **Using a too-big or too-weak drafter.** Too big and drafting isn't cheap; too weak and few tokens get accepted. A ~10–20× smaller, same-family model is the sweet spot.
- **Enabling it on a throughput-bound server.** It trades some throughput for latency; on a saturated batch workload it can hurt.
- **Ignoring acceptance rate.** If drafts rarely match (very creative/high-temperature text), the speedup shrinks — measure it.

## Interview tip
Say: *"Speculative decoding runs a small draft model to guess several tokens, then the big model verifies all of them in one parallel forward pass, accepting matches and correcting at the first miss. Because verification follows the big model's exact distribution, the output is identical — it's a free 1.5–3× latency win when the draft agrees often, like on code. The catch is it costs extra memory/compute, so I use it on latency-critical, lower-concurrency paths, not on throughput-saturated batch serving."* The 'exact output' point plus the throughput caveat is the full story.
