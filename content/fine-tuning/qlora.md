# QLoRA

**The one-line idea:** QLoRA is LoRA run on top of a base model that's been squeezed down to 4-bit — so you can fine-tune a big model on a single consumer/rented GPU that otherwise couldn't even hold it.

## Why it matters for an AI Engineer

[LoRA](lora.md) already cut the *trainable* parameters to under 1%. But you still had to load the full base model in memory to train — a 70B model in 16-bit needs ~140 GB, more than any single GPU. **QLoRA** fixes the memory ceiling by storing the frozen base in **4-bit**, cutting its footprint ~4×. Suddenly a 70B fine-tune fits on one 48 GB GPU, and a 7–8B fine-tune fits on a free Colab / a 16 GB card. This is *the* technique that put serious fine-tuning in reach of individuals and small teams — including a solo candidate prepping for a Dubai AI role on a rented GPU. If someone says "I fine-tuned Llama on my own," they almost certainly mean QLoRA.

## The mechanism / how it works

QLoRA = **quantized base + LoRA adapters**. Three ideas make it work without hurting quality:

1. **4-bit NormalFloat (NF4) base.** The frozen base weights are stored in a 4-bit format tuned for the bell-curve distribution of neural-net weights (see [Quantization](quantization.md)). This is *only for storage/forward math* — the base is never updated, so its slight precision loss barely matters.
2. **LoRA adapters in full precision.** The small A/B matrices that actually *train* stay in 16-bit, so the *learning* keeps its accuracy. You get 4-bit memory savings on the giant frozen part and full-precision gradients where they count.
3. **Double quantization + paged optimizers.** The quantization constants are themselves quantized (a little extra saving), and optimizer state is "paged" to CPU RAM during memory spikes so training doesn't crash (OOM).

The result: the same LoRA training, but the memory-hungry frozen base takes ~¼ the space, at a small (~10–30%) speed cost and negligible quality loss versus 16-bit LoRA.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🔒 Base weights → 4-bit NF4<span class="sub">frozen, tiny memory</span></span>
    <span class="darr">＋</span>
    <span class="dbox orange">LoRA A·B → 16-bit<span class="sub">trains, full precision</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ 70B fine-tune on one GPU</span>
  </div>
  <div class="dcap">Store the frozen giant in 4-bit; keep the tiny trainable adapters full-precision.</div>
</div>

**Memory intuition:** an 8B model in 16-bit ≈ 16 GB just for weights; in 4-bit ≈ 4–5 GB. Add adapters + activations and an 8B QLoRA run fits comfortably in ~10–12 GB.

## Concrete example

```python
# pip install transformers peft bitsandbytes
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model
import torch

bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",          # NormalFloat4
    bnb_4bit_use_double_quant=True,     # double quantization
    bnb_4bit_compute_dtype=torch.bfloat16,
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B", quantization_config=bnb, device_map="auto",
)
model = get_peft_model(model, LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj","v_proj"], task_type="CAUSAL_LM",
))
# Now train exactly like LoRA — but the 8B base sits in ~5 GB, not ~16 GB.
```

## How a company uses this

A Dubai healthtech startup with no in-house GPU cluster fine-tuned a 13B model to summarize Arabic/English clinical notes into a strict template. Using **QLoRA on one rented 24 GB A10G** (~$0.75/hr), a 1,500-example run finished in ~40 minutes for under $1. In 16-bit LoRA that model wouldn't have fit on the card at all — they'd have needed a bigger, pricier instance or multi-GPU setup. QLoRA turned a "we can't afford this" into a coffee-break job, and because it ran on their own rented infra the patient data never left their controlled environment.

## Common mistakes
- **Expecting a speedup.** QLoRA saves *memory*, not time — it's usually a bit *slower* than 16-bit LoRA due to on-the-fly dequantization. You trade speed for fitting on the GPU.
- **Serving the merged model in 4-bit and blaming quality drops on the tune.** Evaluate at the precision you'll serve.
- **Skipping `bf16` compute dtype**, which can hurt training stability.

## Interview tip
Say: *"QLoRA loads the frozen base in 4-bit NF4 and trains 16-bit LoRA adapters on top, so a model that wouldn't fit in 16-bit now fine-tunes on a single GPU with negligible quality loss. It saves memory, not time. It's how I'd fine-tune a 13B–70B model without a cluster."* See also [Quantization](quantization.md) for the 4-bit mechanics and [LoRA](lora.md) for the adapter math.
