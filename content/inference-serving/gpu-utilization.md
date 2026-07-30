# GPU utilization

**What it is:** How busy your expensive GPU actually is while serving — the single number that tells you whether you're getting your money's worth, and the lens through which every other serving optimization is judged.

## Why it matters for an AI Engineer

A GPU is the most expensive thing in your serving stack — an H100 runs roughly **$2–4/hour** whether it's at 5% or 95% load. If it sits half-idle, you're paying double per answer for no reason, and the fix is usually free (better batching, quantization) rather than buying more hardware. "Why is serving slow/costly?" almost always traces to a utilization problem. Being able to *diagnose* low utilization — and know which lever fixes which cause — is exactly the operational skill that separates someone who can *run* models from someone who only calls APIs. It's the thread that ties this whole node together.

## The mechanism / how it works

First, a trap: **`nvidia-smi` GPU-Util is misleading.** It reports "was a kernel running in the last sample window," not how much of the GPU's compute you used. It can read 100% while the GPU does almost nothing useful. The real signals are:

- **Throughput** — tokens/sec (or requests/sec) across all users. This is the honest number: more tokens/sec per GPU = better utilization.
- **MFU (Model FLOPs Utilization)** — fraction of the GPU's theoretical FLOPs you actually achieve. Inference decode is memory-bound, so MFU is naturally low; you care more about tokens/sec.
- **Memory utilization** — how full VRAM is (weights + [KV cache](kv-cache.md)). Often the *binding* constraint, not compute.

The two enemies of utilization:

1. **Idle / starvation** — the GPU waits because requests arrive one at a time or a static batch stalls on its slowest member. Fix: [continuous batching](continuous-batching.md) to keep a full set of active sequences flowing.
2. **Memory-bound decode** — token generation moves weights and KV cache through memory far more than it does math, so compute units idle waiting on memory bandwidth. Fix: [quantization](awq.md) (smaller weights = less memory traffic + room for bigger batches), [FlashAttention](flash-attention.md) (less memory movement), a bigger batch (amortize the weight reads across more requests).

The mental model: **decode is memory-bandwidth-bound**, so the game is (a) never let the GPU sit idle, and (b) do more useful work per byte moved. Bigger batches help both — you read the weights once and serve many requests with them.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🐌 Low util: idle or memory-bound</span>
    <span class="darr">↓<span class="lbl">diagnose</span></span>
    <div class="flow">
      <span class="dbox orange">idle? → continuous batching</span>
      <span class="dbox orange">mem-full? → quantize</span>
      <span class="dbox orange">small batch? → raise it</span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">🚀 more tokens/sec per $ GPU-hour</span>
  </div>
  <div class="dcap">Utilization is a diagnosis: find whether you're idle or memory-bound, then apply the matching lever.</div>
</div>

## Worked numbers

An H100 at $3/hr serving 300 tokens/sec = 1.08M tokens/hour = **~$2.78 per million output tokens**. Push utilization up with batching + quantization to 900 tokens/sec on the *same* card and it's **~$0.93 per million** — a 3× cost cut with zero new hardware. That arithmetic — cost = GPU-hour-price ÷ tokens-per-hour — is the whole reason utilization is the master metric.

## How a company uses this

A team's self-hosted 13B model was costing far more than projected. `nvidia-smi` showed "80% util" so they assumed the GPU was maxed — but measured **throughput was terrible**. Real diagnosis: requests weren't being batched (a naive server), so the card processed one at a time, memory-bound and mostly idle. Moving to vLLM with continuous batching and AWQ 4-bit lifted throughput from ~90 to ~340 tokens/sec on the same A100 — **~3.7× more work per GPU-hour** — and they served their traffic on 1 GPU instead of 3. Their standing practice afterward: alert on **tokens/sec/GPU and KV-cache memory %**, never trust raw GPU-Util, and load-test to find the batch size that maximizes throughput before tail latency degrades.

## Common mistakes

- **Trusting `nvidia-smi` GPU-Util as "how busy."** It's a coarse on/off signal; measure tokens/sec and memory instead.
- **Buying more GPUs before checking batching.** Low utilization is usually a software fix (batching/quantization), not a hardware shortage.
- **Maximizing batch size blindly.** Past a point KV memory saturates and tail latency spikes — tune batch against your latency SLA.
- **Ignoring memory as the real limit.** Often you're memory-bound, not compute-bound; quantization frees the actual bottleneck.

## Interview tip
Say: *"GPU utilization is the master serving metric because cost is just GPU-hour-price divided by tokens-per-hour. I don't trust nvidia-smi's util number — I measure tokens/sec/GPU and KV-cache memory. Low utilization is almost always one of two things: the GPU is idle because requests aren't batched (fix with continuous batching) or decode is memory-bound (fix with quantization and bigger batches). Getting from ~25% to ~75% utilization typically cuts cost 3× with no new hardware."* Leading with the cost-per-token arithmetic shows you think in dollars, which is the whole point of this node.
