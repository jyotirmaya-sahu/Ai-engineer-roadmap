# Meta Llama

**What it is:** Meta's family of **open-weight** models — the most widely used downloadable LLMs — which you can run on your own hardware, fine-tune freely, and deploy offline.

## Why it matters for an AI Engineer

Llama is the default answer to "we need an open model." When a Dubai bank or government client says "no customer data may leave our datacenter," Llama is usually the model you self-host. It's the backbone of the open ecosystem: countless fine-tunes, tooling, and quantized versions target it first. Knowing Llama means knowing how to build the *data-sovereign* half of the landscape — the option a purely closed-model engineer can't offer. That capability is a genuine differentiator in Gulf enterprise interviews.

## The mechanism / how it works

Meta releases the **weight files** (on Hugging Face), so the model runs entirely on your infrastructure — see [Closed vs open](closed-vs-open.md). The family spans sizes so you right-size:

- **Small (~1–8B)** — runs on a single GPU; great for classification, RAG answers, on-prem chat.
- **Mid (~70B)** — strong general reasoning; the self-host sweet spot on a multi-GPU box.
- **Large (100B+ / MoE variants)** — approaches frontier quality for teams with serious hardware.

Because you own the weights, you unlock things closed models can't offer:

- **True fine-tuning** — adapt the model to your domain/data (often cheaply via LoRA, which trains a small adapter instead of the whole model).
- **Offline / air-gapped deployment** — nothing leaves your network.
- **Quantization** — shrink weights to 8- or 4-bit so a 70B model fits on far less VRAM, making self-hosting affordable.

You serve it with a runtime like **vLLM** or **Ollama** (for local dev). The catch is the **license**: Llama's community license is permissive for almost everyone but adds conditions for very large companies (an MAU threshold) and some usage restrictions — always read it before shipping ([Licensing](licensing.md)). "Open-weight" is not unconditional.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">⬇️ Download weights<span class="sub">Hugging Face</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🖥️ Serve on your GPUs<span class="sub">vLLM / Ollama</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🔧 Fine-tune (LoRA)<span class="sub">optional</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🔒 Offline app<span class="sub">no data leaves</span></span>
  </div>
  <div class="dcap">Own the weights → run offline, fine-tune, and quantize — the data-sovereign path.</div>
</div>

## Concrete example — serve Llama locally

```python
# pip install vllm ; downloads + serves the weights on your GPU
from vllm import LLM, SamplingParams

llm = LLM(model="meta-llama/Llama-3.1-8B-Instruct")  # ~16GB VRAM at 16-bit
out = llm.generate(
    ["Classify this support ticket as billing, technical, or other: 'My card was charged twice.'"],
    SamplingParams(max_tokens=20, temperature=0),
)
print(out[0].outputs[0].text)   # "billing"
```

No API key, no network call — the model runs on your machine, so a customer's ticket never leaves it.

## How a company uses this

A Dubai retail bank runs **Llama 3.1 70B** (4-bit quantized) on two on-prem A100 GPUs behind vLLM for its internal knowledge assistant. Data residency law forbids sending account data to a foreign API, so a self-hosted open model is the *only* compliant option. They fine-tuned a small LoRA adapter on the bank's product manuals so answers use correct internal terminology. Production shape: the box serves ~30 requests/sec at a fixed hardware cost regardless of volume — which beats per-token API pricing once daily volume is high and steady. For rare hard reasoning they still call a closed model, but only on non-sensitive queries.

## Common mistakes
- **Thinking self-hosting is free** — you take on GPUs, scaling, patching, and uptime; at low volume a closed API is cheaper all-in.
- **Skipping the license check** — Llama's terms bind large companies and restrict some uses.
- **Ignoring quantization** — running 70B at full precision needs ~140GB VRAM; 4-bit makes it fit a two-GPU box with minor quality loss.
- **Expecting frontier-level reasoning from an 8B** — right-size ([Model sizes](model-sizes.md)); use small Llamas for narrow tasks, not open-ended reasoning.

## Interview tip
Say: *"Llama is my default open-weight choice for data-sovereign deployments — I download the weights, serve them with vLLM on-prem, quantize to fit the hardware, and LoRA-fine-tune on domain data. In the UAE that's often the only legally compliant option when data can't leave the datacenter. I always check the license, since it adds conditions for very large companies, and I right-size — small Llamas for narrow tasks, 70B for general reasoning."*
