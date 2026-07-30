# GPTQ

**What it is:** A classic post-training quantization method that compresses an LLM to 3–4 bits **one layer at a time**, using second-order math to correct the error each rounding introduces — the widely-supported workhorse of GPU quantization.

## Why it matters for an AI Engineer

GPTQ was the method that made 4-bit LLMs practical, and it's still one of the two default GPU formats (alongside [AWQ](awq.md)) supported everywhere — [vLLM](vllm.md), [TGI](tgi.md), Transformers, ExLlama. Like AWQ, it lets a big model fit on affordable hardware and frees GPU memory for a larger [KV cache](kv-cache.md) and more concurrency. Knowing GPTQ, and being able to contrast its *error-correcting* approach with AWQ's *activation-aware scaling*, is exactly the kind of trade-off discussion that comes up when an interviewer asks "how would you quantize this and why."

## The mechanism / how it works

Naive quantization rounds every weight independently to the nearest 4-bit level and accepts whatever error results. GPTQ is smarter: it treats quantization as **error compensation**.

It goes layer by layer, and within a layer, weight by weight (in groups). When it rounds one weight down to 4-bit, that introduces a small error in the layer's output. GPTQ then **adjusts the remaining, not-yet-quantized weights to cancel that error** — so the layer's overall output on the calibration data stays as close as possible to the original. It figures out *how* to adjust them using the **Hessian** (second-order curvature info) computed from a small calibration dataset, which tells it how sensitive the output is to each weight. Essentially: "I had to round this weight badly — let me nudge the others to make up for it."

Key properties:

- **Group size** (commonly 128): weights are quantized in groups sharing a scale. Smaller groups = better accuracy, slightly bigger file. `g128` is the standard.
- **Accuracy:** very good at 4-bit — comparable to AWQ, sometimes a hair behind, and the error-correction shines at aggressive settings.
- **Cost to produce:** the Hessian computation makes *creating* a GPTQ model slower than AWQ (minutes to hours for big models) — but you usually download a pre-made one, so this rarely matters at serving time.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📊 calibration data → per-layer Hessian (weight sensitivity)</span>
    <span class="darr">↓</span>
    <span class="dbox orange">🔢 round one weight → measure output error</span>
    <span class="darr">↓<span class="lbl">compensate</span></span>
    <span class="dbox purple">🩹 nudge remaining weights to cancel the error</span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ 4-bit layer, output ≈ original</span>
  </div>
  <div class="dcap">GPTQ quantizes weights in order and corrects each rounding error using the rest of the layer.</div>
</div>

## Concrete example

Serve a pre-quantized GPTQ model just like any other:

```bash
vllm serve TheBloke/Llama-2-13B-chat-GPTQ --quantization gptq --max-model-len 4096
```

To make your own with `gptqmodel`/`auto-gptq`, you pass a small calibration set and pick group size:

```python
from gptqmodel import GPTQModel, QuantizeConfig
cfg = QuantizeConfig(bits=4, group_size=128)          # the standard 4-bit, g128
model = GPTQModel.load("Qwen/Qwen2.5-7B-Instruct", cfg)
model.quantize(calibration_dataset)                    # Hessian-based error correction
model.save("Qwen2.5-7B-Instruct-GPTQ")
```

A 13B drops from ~26 GB (FP16) to ~7–8 GB at 4-bit — fitting comfortably on a single 24 GB card.

## How a company uses this

A team standardized on GPTQ because their whole model zoo already had community GPTQ builds on the Hugging Face hub, so adopting it was zero extra work — **download and serve**. They ran a fine-tuned 13B at GPTQ 4-bit g128 on a single A10G per replica, tripling how many replicas fit on their cluster versus FP16. On eval, the GPTQ model landed within ~1% of full precision. When they later benchmarked AWQ head-to-head, AWQ was marginally faster in vLLM's kernels and a touch better on their hardest eval slice, so **new** deployments moved to AWQ — but the fleet of existing GPTQ models stayed, because both were within noise and re-quantizing wasn't worth it. Their production discipline mirrored the AWQ case: **re-run domain evals after quantizing**, since a 1% average drop can hide a bigger hit on one critical task.

## Common mistakes

- **Using too-large a group size for max compression.** Bigger groups shrink the file but cost accuracy — `g128` is the safe default.
- **Calibrating on unrepresentative data.** The Hessian and error correction depend on calibration inputs resembling real traffic.
- **Skipping post-quant evaluation.** Average parity ≠ per-task parity; always re-test your specific workload.
- **Expecting it on CPU/edge.** GPTQ is a GPU format — use GGUF for CPU/laptop inference.

## Interview tip
Say: *"GPTQ is post-training 4-bit quantization that compensates for rounding error: it quantizes weights in order and uses second-order Hessian info to nudge the remaining weights so the layer's output barely changes. It's accuracy-competitive with AWQ and supported everywhere, so it's a safe default — the difference is GPTQ corrects error after rounding while AWQ protects salient weights via activation-aware scaling. Both land within ~1% of FP16; I pick by which pre-quantized builds exist and by re-running my own evals."* Contrasting the two mechanisms is what a strong answer does.
