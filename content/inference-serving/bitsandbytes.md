# bitsandbytes

**What it is:** A library that quantizes a model to 8-bit or 4-bit **on the fly as you load it** — no calibration step, one line of code — making it the go-to for quick low-memory loading and for **QLoRA fine-tuning**.

## Why it matters for an AI Engineer

Where [AWQ](awq.md) and [GPTQ](gptq.md) are *serving-optimized* formats you download pre-made, **bitsandbytes** is the *convenience* quantizer built into Hugging Face Transformers: pass one flag and any model loads in 4-bit, instantly halving or quartering its memory. Its two real jobs are (1) letting you **run or experiment with a big model that wouldn't otherwise fit** while you develop, and (2) powering **QLoRA** — fine-tuning a huge model on a single consumer GPU by keeping the base weights frozen in 4-bit. For a job seeker who fine-tunes models on limited hardware, this is the tool that makes it possible.

## The mechanism / how it works

bitsandbytes offers two main modes, both applied **at load time** with zero calibration:

- **8-bit (LLM.int8()):** stores weights in INT8 (half the memory of FP16) with near-zero quality loss. Its trick is handling **outlier features** — a few activation dimensions have huge values that would break naive INT8 — by computing *those* in FP16 and the rest in INT8, then combining. So quality holds while most of the model runs in 8-bit.
- **4-bit (NF4):** stores weights in **NormalFloat4**, a 4-bit datatype whose 16 levels are spaced to match the *normal distribution* that neural-net weights actually follow (more levels near zero, where most weights are). This preserves accuracy far better than uniform 4-bit. Add **double quantization** (quantizing the quantization constants too) to squeeze out a bit more memory.

The trade-off versus AWQ/GPTQ: bitsandbytes **dequantizes weights back to FP16 during compute** rather than running specialized low-bit kernels, so it saves *memory* but is **slower per token** at inference. That's the deliberate design — it's for loading and training convenience, not maximum serving throughput.

**QLoRA** is where 4-bit NF4 shines: freeze the base model in 4-bit (tiny memory), attach small trainable LoRA adapters in FP16, and train only those. A 70B model becomes fine-tunable on a single 48 GB GPU.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🧠 FP16 model</span>
    <span class="darr">→<span class="lbl">load_in_4bit=True</span></span>
    <span class="dbox orange">📉 NF4 weights<span class="sub">4× smaller, on the fly</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🎓 + LoRA adapters → QLoRA training</span>
  </div>
  <div class="dcap">One flag quantizes at load time; frozen 4-bit base + LoRA adapters = fine-tune huge models on one GPU.</div>
</div>

## Concrete example

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

cfg = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # NormalFloat4
    bnb_4bit_use_double_quant=True,      # quantize the scales too
    bnb_4bit_compute_dtype="bfloat16",   # compute in bf16
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=cfg, device_map="auto",
)
# 8B model now loads in ~5 GB instead of ~16 GB — no calibration, no separate export.
```

That single config is also the exact base setup for a QLoRA training run.

## How a company uses this

bitsandbytes' production role is mostly **training and experimentation**, not high-QPS serving. A team customizing a 13B model for Arabic customer-support tone had only a single A100 — impossible to full-fine-tune. With **QLoRA** (4-bit NF4 base + LoRA adapters) they fine-tuned it on that one GPU over a weekend, then **merged and re-exported the result to AWQ** for fast production serving on vLLM. That two-step is the common pattern: *bitsandbytes to train cheaply, AWQ/GPTQ to serve fast.* They also used `load_in_4bit` to quickly A/B several base models on limited hardware before committing. The reason they didn't serve directly from bitsandbytes: its dequantize-during-compute path gave noticeably lower throughput than AWQ on the same card — fine for training, wasteful for a production endpoint.

## Common mistakes

- **Serving production traffic from bitsandbytes.** It's memory-saving but slower per token — use AWQ/GPTQ for throughput serving.
- **Using uniform 4-bit instead of NF4.** NF4 matches weight distribution and preserves quality; plain 4-bit doesn't.
- **Forgetting compute dtype.** Set `bnb_4bit_compute_dtype=bfloat16` for stable, fast math.
- **Assuming QLoRA weights are quantized forever.** After training you merge the adapters and export to a serving format (AWQ/GPTQ) for deployment.

## Interview tip
Say: *"bitsandbytes is on-the-fly quantization in Transformers — one flag loads any model in 8-bit (LLM.int8, outliers kept in FP16) or 4-bit NF4, a datatype spaced to match how weights are actually distributed. It saves memory with no calibration, but it dequantizes during compute so it's slower than AWQ/GPTQ at serving. Its killer use is QLoRA: frozen 4-bit base plus LoRA adapters lets me fine-tune a 70B on one GPU — then I merge and export to AWQ for fast production serving."* The 'train with bnb, serve with AWQ' pattern is the mark of someone who's actually done it.
