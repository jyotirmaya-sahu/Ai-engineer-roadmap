# AWQ

**What it is:** **Activation-aware Weight Quantization** — a method for compressing an LLM to 4-bit that protects the small fraction of weights that matter most, giving near-full-precision quality at a quarter of the memory, optimized for fast **GPU** inference.

## Why it matters for an AI Engineer

When you self-host on GPUs, quantization is usually mandatory — it's how a 70B model fits on hardware you can afford and how you free memory for a bigger [KV cache](kv-cache.md) and more concurrent requests. AWQ is one of the two dominant GPU quant formats (with [GPTQ](gptq.md)) and is a first-class citizen in [vLLM](vllm.md) and [TGI](tgi.md). Its selling point is **minimal accuracy loss for 4-bit**, which matters when quality is non-negotiable. Being able to say *why* AWQ keeps quality high — not just "it's 4-bit" — is exactly the depth interviewers look for.

## The mechanism / how it works

Naive 4-bit quantization rounds every weight to one of 16 levels. That's fine for most weights, but a **small fraction of "salient" weights carry outsized importance** — round those crudely and quality collapses.

AWQ's insight is in its name: **which weights matter is revealed by the activations, not the weights themselves.** It runs a small calibration dataset through the model and watches which weight channels see large activation magnitudes — those channels dominate the output. Instead of keeping those in high precision (which breaks hardware efficiency), AWQ **scales** them: it multiplies the salient weight channels up by a per-channel factor before quantizing (so their values use the quantization range well and round accurately) and divides the corresponding activations down to compensate — a mathematically equivalent transform. The important weights survive quantization sharply; everything goes to a clean, uniform 4-bit that GPUs run fast.

Two consequences that matter in practice:

- **Quality:** typically within ~1% of FP16 on benchmarks — the best-preserving of the common 4-bit methods.
- **Speed:** because all weights end up in uniform 4-bit (no mixed precision), the GPU kernels are simple and fast — AWQ is often the **fastest** 4-bit format for inference, and needs only a light calibration pass (quicker to produce than GPTQ).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📊 calibration data → find salient channels (via activations)</span>
    <span class="darr">↓</span>
    <span class="dbox orange">⚖️ scale salient weights up, activations down<span class="sub">equivalent transform</span></span>
    <span class="darr">↓</span>
    <span class="dbox purple">🔢 quantize all to uniform 4-bit</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ 4× smaller, ~1% quality loss, fast GPU kernels</span>
  </div>
  <div class="dcap">AWQ uses activations to spot the weights that matter, protects them by scaling, then quantizes everything to fast uniform 4-bit.</div>
</div>

## Concrete example

Most of the time you just **download a pre-quantized AWQ model** and serve it:

```bash
vllm serve Qwen/Qwen2.5-72B-Instruct-AWQ --quantization awq --max-model-len 8192
```

That 72B model is ~140 GB in FP16 but ~**40 GB in AWQ 4-bit** — the difference between needing 4 GPUs and fitting on 2 (or even 1 H100). To make your own, `autoawq` calibrates on a few hundred sample texts and writes the quantized weights; it takes minutes, not the hours GPTQ can need.

## How a company uses this

A fintech self-hosting a 72B model for compliance-sensitive Q&A couldn't afford the 4× A100 that FP16 demanded. AWQ 4-bit shrank it to fit **2× A100**, and the freed memory let them run a larger KV cache and higher concurrency — so the quantization *paid twice* (cheaper hardware **and** more throughput per card). On their internal eval the AWQ model scored within ~0.8% of FP16 — invisible to users. They chose AWQ over GPTQ specifically for the **accuracy margin** on a regulated workload and its faster inference kernels. Production note: they validated on their *own* eval set, not just public benchmarks, because quantization can hit a specific domain harder than average — the discipline is "quantize, then re-run your evals before trusting it."

## Common mistakes

- **Assuming all 4-bit is equal.** Naive round-to-nearest 4-bit tanks quality; AWQ's activation-aware scaling is why it doesn't.
- **Skipping re-evaluation.** Public benchmark parity doesn't guarantee *your* task is unaffected — re-run your evals after quantizing.
- **Using a bad calibration set.** Calibrate on data resembling real inputs; a mismatched set picks the wrong salient channels.
- **Using AWQ for CPU/edge.** It's a GPU format — for laptops/CPU use GGUF instead.

## Interview tip
Say: *"AWQ is activation-aware 4-bit quantization for GPUs. The insight is that a few weight channels matter far more, and you find them by looking at activation magnitudes, not the weights — then you scale those channels up before quantizing and scale the activations down to compensate, so the important weights round accurately. You get ~4× smaller with roughly 1% quality loss and fast uniform-4-bit kernels. I pick AWQ over GPTQ when accuracy is critical, and I always re-run my own evals after quantizing."* The activation-driven salience explanation is the part that shows real understanding.
