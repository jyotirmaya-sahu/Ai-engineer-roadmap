# Ollama

**What it is:** A dead-simple tool that lets you download and run open LLMs locally with one command — `ollama run llama3.2` — handling the model download, quantization, and a local API server for you.

## Why it matters for an AI Engineer

Ollama is the fastest way to get a real model running on your own machine, which makes it the default for **development, prototyping, and privacy-sensitive local work**. Before you commit to a heavy [vLLM](vllm.md)/[TGI](tgi.md) GPU deployment, you'll prototype your RAG pipeline or agent against Ollama on your laptop for free — no API keys, no per-token bill, no data leaving the machine. For a job seeker, it's also how you demo projects offline in an interview and how you experiment with a dozen open models cheaply. It is *not* a high-throughput production server — knowing that boundary is part of the skill.

## The mechanism / how it works

Under the hood, Ollama is a friendly wrapper around **llama.cpp**, the C++ inference engine that runs quantized models efficiently on CPU *and* GPU (including Apple Silicon's Metal, and NVIDIA/AMD cards). It uses the **[GGUF](gguf.md)** quantization format, which packs model weights into 4-bit or 5-bit files small enough to run without a data-center GPU.

The flow: you `ollama pull` a model from Ollama's registry (or import any GGUF), and it stores a quantized version locally. `ollama serve` runs a background HTTP server (default port 11434) exposing both a native API and an **OpenAI-compatible** `/v1` endpoint. A **Modelfile** (like a Dockerfile for models) lets you set a system prompt, temperature, or context length and save it as a custom model.

Key behaviors to understand:

- It **loads the model into memory on first request** and keeps it warm (default 5 min), so the first call is slow, later ones fast.
- It runs **one model at a time efficiently**; it can queue concurrent requests but is tuned for single-user/dev, not high QPS.
- It auto-offloads as many layers as fit onto your GPU and runs the rest on CPU — so it works even on modest hardware, just slower.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">⌨️ ollama run qwen2.5</span>
    <span class="darr">↓<span class="lbl">pull GGUF</span></span>
    <span class="dbox blue">📦 quantized model on disk</span>
    <span class="darr">↓</span>
    <span class="dbox purple">💻 llama.cpp<span class="sub">CPU + GPU layers</span></span>
    <span class="darr">↓</span>
    <span class="dbox green">✅ local API :11434</span>
  </div>
  <div class="dcap">One command → quantized local model → an OpenAI-compatible endpoint on your machine.</div>
</div>

## Concrete example

```bash
ollama pull llama3.2          # download a small quantized model
ollama run llama3.2 "In one line, what is RAG?"   # chat from the terminal
```

```python
# Same OpenAI client, pointed at your local Ollama
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
r = client.chat.completions.create(
    model="llama3.2",
    messages=[{"role": "user", "content": "Draft a KYC checklist."}],
)
print(r.choices[0].message.content)
```

Because it's OpenAI-compatible, you build your whole app against Ollama locally, then swap `base_url` to a hosted API or a production vLLM server later — zero code change.

## How a company uses this

Ollama's real production niche is **local/edge and privacy**, not scale. A Dubai law firm prototyping a contract assistant ran Qwen-14B via Ollama entirely on-prem so no client documents ever touched an external API — good enough for a handful of lawyers hitting it interactively, and legally clean. A different pattern: developers across a team each run Ollama locally so their **CI and dev loops don't burn API budget**, reserving the paid/hosted models for production. The moment traffic grows past a few concurrent users, teams graduate the *same app* to vLLM/TGI — because Ollama's single-model, dev-tuned server tops out around a few requests/sec, and its throughput per GPU is well below a batching server. Treating Ollama as your production backend for a public app is the classic mistake.

## Common mistakes

- **Using it as a production server.** It's for dev/edge/single-user; for real QPS you need vLLM or TGI's continuous batching.
- **Ignoring the quantization level.** Default GGUF quants (often Q4) trade a little quality for size — for accuracy-sensitive eval, pull a higher-bit variant.
- **Surprised by the cold-start.** First request loads the model (seconds); keep it warm with `OLLAMA_KEEP_ALIVE` for latency-sensitive demos.
- **Expecting laptop performance to predict server performance.** CPU-offloaded layers are slow; GPU-only serving is a different regime.

## Interview tip
Say: *"Ollama is my local/dev inference tool — a one-command wrapper over llama.cpp using GGUF quantization, with an OpenAI-compatible endpoint, so I prototype RAG and agents on my laptop for free and with data staying local. I build against it, then swap the base URL to vLLM or a hosted API for production, because Ollama is single-user/dev-tuned and won't hold real QPS. It's also the clean answer for on-prem privacy demos."* Naming the dev-vs-prod boundary shows judgment, not just tool familiarity.
