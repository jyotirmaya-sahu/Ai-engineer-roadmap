# Quantization

**The one-line idea:** quantization stores a model's weights using fewer bits per number (16-bit → 8-bit → 4-bit), shrinking memory ~2–4× so bigger models fit on smaller GPUs, with a small, usually acceptable, hit to precision.

## Why it matters for an AI Engineer

Memory is the binding constraint in almost every real LLM deployment — you can't train or serve a model that doesn't fit on your GPU. Quantization is the lever that makes big models fit: it's what lets [QLoRA](qlora.md) fine-tune a 70B model on one GPU, and what lets you *serve* an 8B model on a 12 GB card. Every AI engineer needs to reason about the size-vs-quality trade-off, pick a precision, and know that "the model got dumber" after deployment often traces to over-aggressive quantization. It's a bread-and-butter production skill.

## The mechanism / how it works

A weight is just a number. Trained models store weights as 32-bit or 16-bit floats — lots of decimal precision. Quantization maps those onto a smaller set of values represented in fewer bits:

- **FP16 / BF16 (16-bit)** — the standard training/serving precision. ~2 bytes/param → an 8B model ≈ 16 GB.
- **INT8 / 8-bit** — ~1 byte/param → ~8 GB. Usually near-lossless in quality.
- **4-bit (NF4, GPTQ, AWQ)** — ~0.5 byte/param → ~4–5 GB. Noticeable but often acceptable quality loss.

**How the mapping works:** take a block of weights, find its min/max range, and slice that range into a small number of buckets (256 buckets for 8-bit, 16 for 4-bit). Each weight is stored as the *index* of its nearest bucket plus a per-block **scale factor** to convert back. At compute time the value is de-quantized on the fly. Doing it per-*block* (not globally) keeps precision where weights vary a lot.

**Why quality survives:** neural nets are robust to small weight noise, and **NF4** (NormalFloat-4) places its 16 buckets to match the bell-curve distribution of real weights, so it spends precision where the weights actually live. Two families:
- **Weight-only PTQ** (GPTQ, AWQ, NF4) — quantize *after* training. Fast, no data (or a tiny calibration set). The common case.
- **Quantization-aware training (QAT)** — simulate quantization *during* training so the model adapts. Better quality, more work.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">FP16<span class="sub">16 GB · full quality</span></span>
    <span class="darr">→<span class="lbl">8-bit</span></span>
    <span class="dbox blue">INT8<span class="sub">8 GB · ~lossless</span></span>
    <span class="darr">→<span class="lbl">4-bit</span></span>
    <span class="dbox orange">NF4<span class="sub">~4.5 GB · small loss</span></span>
  </div>
  <div class="dcap">Fewer bits per weight → less memory, gradually more precision loss. 8-bit is nearly free; 4-bit is the aggressive sweet spot.</div>
</div>

## Concrete example — worked numbers

An 8B-parameter model:
- **FP16:** 8e9 × 2 bytes = **16 GB** — needs a 24 GB GPU with room for activations.
- **INT8:** 8e9 × 1 byte = **8 GB** — fits a 12 GB card comfortably.
- **NF4:** 8e9 × 0.5 byte ≈ **4 GB** — fits a free Colab T4 (16 GB) with room for a fine-tune.

That single choice can be the difference between "needs a $2/hr GPU" and "runs on a free tier."

## How a company uses this

A Dubai startup serving an internal 8B assistant to ~200 employees couldn't justify an A100. They served the model **AWQ-quantized to 4-bit on a single 16 GB GPU**, holding throughput for their modest QPS while cutting the instance cost by ~60%. They ran an eval suite before and after quantizing and saw accuracy drop from 91% to 89% — acceptable for the use case. The discipline that mattered: **measuring** the quality delta rather than assuming 4-bit was free, then choosing 4-bit because the 2-point drop was worth the cost savings.

## Common mistakes
- **Assuming quantization is free.** 8-bit usually is; 4-bit can meaningfully hurt reasoning-heavy tasks. Always eval before/after.
- **Confusing training and serving precision.** You can QLoRA-train in 4-bit but *serve* the merged model in 8-bit for better quality — decide each separately.
- **Over-quantizing tiny models.** Small models have less redundancy and degrade harder at 4-bit than large ones.

## Interview tip
Say: *"Quantization stores weights in fewer bits — 8-bit is nearly lossless and halves memory, 4-bit with NF4 or AWQ quarters it with a small quality hit I always measure. It's what makes big models fit one GPU, and it's the backbone of QLoRA. I pick precision per stage — often 4-bit to train, higher to serve — and never ship a quantized model without an eval delta."* Related: [QLoRA](qlora.md) uses this to fine-tune on one GPU.
