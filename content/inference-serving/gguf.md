# GGUF

**What it is:** A file format for quantized models designed for **llama.cpp** — it packs an LLM's weights into low-bit form (often 4-bit) plus all metadata into a single file that runs efficiently on **CPU and consumer GPUs**, no data-center hardware needed.

## Why it matters for an AI Engineer

GGUF is how you run capable open models **without a big GPU** — on a laptop, a CPU server, a Mac, or the edge. It's the format behind [Ollama](ollama.md), LM Studio, and llama.cpp, so it's the default for local development, on-prem/privacy deployments, and offline demos. For a job seeker it's the cheapest way to experiment with dozens of models and to demo projects that run entirely on your own machine. Knowing GGUF (and how it differs from GPU-only formats like [AWQ](awq.md)/[GPTQ](gptq.md)) lets you match the right quantization to the right hardware — a real architecture decision.

## The mechanism / how it works

Two ideas: **quantization** and the **container format**.

**Quantization** shrinks the model by storing weights in fewer bits. A full model uses 16-bit floats (FP16). GGUF stores them in 8, 6, 5, 4, 3, or 2 bits, cutting size 2–8×. It does this in **blocks**: a run of weights (e.g. 32) shares a scale factor, so each block is dequantized on the fly during compute. This is why a 7B model drops from ~14 GB (FP16) to ~4 GB (Q4) — small enough for a laptop.

GGUF's quant types use a naming code you must be able to read:

- **Q4_K_M**, **Q5_K_M** — "K-quants," which cleverly use *more* bits for the important weights (attention, some layers) and fewer elsewhere. `_M` = medium size. These are the practical sweet spot.
- **Q4_0 / Q8_0** — older, simpler uniform quants. Q8_0 is near-lossless but bigger.
- **Q2_K / Q3_K** — tiny, but noticeable quality loss.

The **format** part: GGUF is a self-contained binary holding the quantized tensors *plus* metadata (architecture, tokenizer, prompt template, context length). One file, no external config — that's why `ollama pull` or llama.cpp "just works."

The runtime, **llama.cpp**, is written in C/C++ with no Python/CUDA dependency, so it runs anywhere and offloads as many layers as fit onto a GPU (Metal, CUDA, Vulkan) while running the rest on CPU.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🧠 FP16 model<span class="sub">14 GB</span></span>
    <span class="darr">→<span class="lbl">quantize to 4-bit blocks</span></span>
    <span class="dbox orange">📦 model.gguf<span class="sub">~4 GB, weights + tokenizer + template</span></span>
    <span class="darr">→</span>
    <span class="dbox green">💻 runs on CPU / laptop GPU via llama.cpp</span>
  </div>
  <div class="dcap">One quantized, self-contained file — small enough to run without a data-center GPU.</div>
</div>

## Concrete example

```bash
# Run any GGUF straight from the Hugging Face hub with llama.cpp
llama-cli -hf bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M -p "Explain KYC in one line."

# Or via Ollama (uses GGUF under the hood)
ollama run qwen2.5:7b
```

Picking the quant is the real skill: **Q4_K_M** is the standard "fits and stays smart" choice; go **Q5/Q6_K** if you have RAM to spare and want more accuracy; avoid Q2/Q3 unless memory is desperate.

## How a company uses this

GGUF's home turf is **edge and privacy**, not high-QPS serving. A Dubai clinic wanting an offline medical-note assistant ran a Q4_K_M-quantized 8B model on a modest on-prem box with **no GPU** — patient data never left the building, and CPU inference at a few tokens/sec was fine for one clinician typing notes. A field-operations company deployed GGUF models on **ruggedized laptops with no internet** for on-site document lookup. The consistent pattern: GGUF wins when you have **no/weak GPU, need offline or on-prem privacy, and low concurrency**. The moment you need real throughput on GPUs, you switch the *same base model* to AWQ/GPTQ on vLLM — because llama.cpp's CPU-friendly design isn't built for high concurrent batching.

## Common mistakes

- **Using GGUF for high-QPS GPU serving.** It's optimized for CPU/edge/single-user; for GPU throughput use AWQ/GPTQ on vLLM/TGI.
- **Grabbing the smallest quant to save space.** Q2/Q3 degrade noticeably — Q4_K_M is the floor for most real use.
- **Ignoring RAM/VRAM budget.** The whole quantized file must fit in memory (or split CPU/GPU); a Q4 70B still needs ~40 GB.
- **Forgetting the prompt template is embedded.** GGUF carries its chat template — using the wrong wrapper manually gives garbled output.

## Interview tip
Say: *"GGUF is the llama.cpp quantization format — a single self-contained file with low-bit weights plus tokenizer and template, built to run on CPU and consumer GPUs. It's what Ollama and LM Studio use, so it's my go-to for local dev, offline demos, and on-prem privacy where there's no big GPU. I default to Q4_K_M for the size/quality sweet spot. For high-throughput GPU serving I switch to AWQ or GPTQ on vLLM instead — GGUF is an edge/local format, not a batching-server one."* Matching format to hardware is the judgment interviewers reward.
