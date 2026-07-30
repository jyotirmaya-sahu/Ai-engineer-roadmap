# transformers

**What it is:** Hugging Face's `transformers` — the standard open-source Python library for **downloading and running open-weight models yourself**, on your own hardware, instead of calling a paid hosted API.

## Why it matters for an AI Engineer

Not every job should run on OpenAI or Anthropic. Sometimes data can't leave your servers (privacy, regulation — a real concern for Dubai finance and healthcare), sometimes you want *no per-token cost* at high volume, sometimes you need a small specialized model, and sometimes you're fine-tuning your own. `transformers` is how you do all of that. It gives you a uniform API over tens of thousands of models — LLMs, embedding models, classifiers, vision, audio — from the [Hugging Face Hub](inference-api-hub.md). Knowing it signals you can build *without* a hosted API, which is a meaningful chunk of enterprise AI work and a common interview differentiator.

## The mechanism — how it works

Two core objects, always paired:

1. **A tokenizer** — turns text into token IDs the model understands and back (see [tokenizers](tokenizers.md)). Loaded with `AutoTokenizer.from_pretrained("model-id")`.
2. **A model** — the neural network with its trained weights. Loaded with an `Auto…` class matching the task, e.g. `AutoModelForCausalLM` for text generation.

The `from_pretrained("org/model")` call downloads the weights from the Hub (cached locally after the first time) and loads them onto CPU or GPU. To generate text you: tokenize the prompt → call `model.generate(...)` → decode the output token IDs back to text.

Practical realities:
- **Hardware matters.** A 7B-parameter model needs ~14GB in full precision; you use **quantization** (4-bit/8-bit) and `device_map="auto"` to fit smaller GPUs. Big models need a real GPU.
- **Chat models use a chat template.** `tokenizer.apply_chat_template(messages, ...)` formats your [messages array](messages-roles.md) into the exact special-token layout that model was trained on — skip it and quality tanks.
- For quick tasks you don't wire this by hand — you use [pipelines](pipelines.md), a one-liner wrapper over the same objects.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💬 prompt</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔢 tokenizer<span class="sub">text → IDs</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 model.generate<span class="sub">local GPU/CPU</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🔢 output IDs</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ decoded text</span>
  </div>
  <div class="dcap">tokenizer + model, both loaded from the Hub, run inference locally — no per-token API bill.</div>
</div>

## Concrete example

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_id = "Qwen/Qwen2.5-7B-Instruct"                 # an open instruct model on the Hub
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id, torch_dtype=torch.bfloat16, device_map="auto",  # spread across available GPUs
)

messages = [{"role": "user", "content": "Name three neighborhoods in Dubai."}]
# Apply the model's chat template — critical for instruct models:
inputs = tok.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to(model.device)

out = model.generate(inputs, max_new_tokens=60, do_sample=False)
text = tok.decode(out[0][inputs.shape[-1]:], skip_special_tokens=True)
print(text)   # "Downtown Dubai, Dubai Marina, and Deira."
```

## How a company uses this

A Dubai hospital group can't send patient notes to a US-hosted API for compliance reasons, so they run an open model **on their own on-premise GPU server** with `transformers` to de-identify and summarize records. **Production reality:** they quantize a mid-size model to 4-bit so it fits their existing GPU, and for higher throughput they front the model with a dedicated serving engine (like vLLM, which loads the same Hugging Face weights) instead of raw `model.generate`, because `generate` in a loop is fine for prototyping but too slow for concurrent traffic. The library's value here is total control: the data never leaves the building, and there's no per-token cost no matter the volume.

## Common mistakes

- **Skipping the chat template** on instruct models — feeding raw text without the trained special tokens wrecks quality.
- **Underestimating hardware** — loading a big model in full precision OOMs the GPU; quantize and use `device_map="auto"`.
- **Using `model.generate` in a loop for production serving** — it's single-request slow; use vLLM/TGI for throughput.
- **Forgetting the first load downloads gigabytes** — pre-cache weights; don't re-download per run.
- **Assuming local = free** — GPUs cost money to run; local wins on *high volume* or *privacy*, not always on price.

## Interview tip
Say: *"`transformers` is how I run open-weight models myself when data can't leave our servers or per-token cost is prohibitive at volume. The pattern is tokenizer plus an Auto model from the Hub, always applying the model's chat template for instruct models, with quantization to fit the GPU. For real serving throughput I put the same weights behind vLLM rather than calling generate in a loop."* Mentioning the chat template and vLLM shows you've gone past the tutorial.
