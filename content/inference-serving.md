# Inference & Serving

**The one-line idea:** Inference & Serving is everything between "I have model weights" and "a user gets a fast, cheap answer" — the frameworks, batching tricks, quantization, and routing that make an LLM actually usable in production.

## Why we even need it

Training gets the headlines, but **99% of an LLM's compute happens at inference** — every single request a user sends. And a raw model, loaded naively with `model.generate()`, is catastrophically wasteful: it processes one request at a time, holds the whole model in expensive GPU memory, and leaves the GPU idle most of the time. A single H100 GPU costs roughly **$2–4/hour**; run it at 15% utilization and you're paying 6× more per answer than you should.

Two hard realities force everything in this node:

1. **GPUs are scarce and expensive.** You must squeeze maximum throughput (tokens/second across all users) out of each card. That means batching many requests together, reusing computation, and shrinking the model so more fits in memory.
2. **Users want it *now*.** Latency is a product feature — a chatbot that takes 8 seconds to start replying feels broken. So you also optimize for time-to-first-token and streaming, sometimes trading throughput for speed.

Serving is the discipline of winning both at once: fast *and* cheap, at scale.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🙋 Many user requests</span>
    <span class="darr">→</span>
    <span class="dbox purple">⚙️ Serving engine<span class="sub">batch + KV cache</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">🎯 Quantized weights<span class="sub">on GPU</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Streamed tokens</span>
  </div>
  <div class="dcap">The serving stack turns scattered requests into high-throughput, low-latency generation.</div>
</div>

## Why it matters for an AI Engineer

Even if you mostly call OpenAI/Anthropic APIs, this node is where you defend architecture decisions. The moment cost, privacy, or latency pushes you to **self-host an open model** (Llama, Qwen, Mistral) — very common for Dubai enterprises with data-residency rules — you own the serving stack. And the routing/caching layer applies *even to hosted APIs*: a semantic cache or a cheap-model router can cut a bill in half without touching a GPU. Interviewers probe here to separate people who *use* LLMs from people who can *run* them affordably.

## The pieces you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| **[vLLM](inference-serving/vllm.md)** | throughput-king serving engine (PagedAttention) | self-hosting for high QPS on GPUs |
| **[TGI](inference-serving/tgi.md)** | Hugging Face's production server | you're in the HF ecosystem / want easy deploys |
| **[Ollama](inference-serving/ollama.md)** | one-command local model running | dev, prototyping, laptop/edge inference |
| **[LiteLLM gateway](inference-serving/litellm-gateway.md)** | one API in front of 100+ providers | unifying, budgeting, and routing all LLM calls |
| **[Continuous batching](inference-serving/continuous-batching.md)** | swap requests in/out mid-flight | maximizing GPU throughput under mixed load |
| **[KV cache](inference-serving/kv-cache.md)** | reuse past-token attention math | making token-by-token generation fast |
| **[Flash attention](inference-serving/flash-attention.md)** | memory-efficient attention kernel | longer contexts, faster attention |
| **[Speculative decoding](inference-serving/speculative-decoding.md)** | small model drafts, big model checks | cutting latency without losing quality |
| **[GPU utilization](inference-serving/gpu-utilization.md)** | keep the expensive card busy | diagnosing why serving is slow/costly |
| **[GGUF](inference-serving/gguf.md)** | CPU/edge quant format (llama.cpp) | running locally without a big GPU |
| **[AWQ](inference-serving/awq.md)** | activation-aware 4-bit quant | fast GPU inference with minimal quality loss |
| **[GPTQ](inference-serving/gptq.md)** | classic post-training GPU quant | 4-bit on GPU, wide tooling support |
| **[bitsandbytes](inference-serving/bitsandbytes.md)** | on-the-fly 8/4-bit in Transformers | quick load-in-low-bits, QLoRA training |
| **[Prompt / semantic cache](inference-serving/prompt-semantic-cache.md)** | reuse answers to repeated queries | high repeat traffic (FAQ, support) |
| **[Model routing](inference-serving/model-routing.md)** | send easy queries to cheap models | cutting cost while keeping quality |
| **[Fallbacks & load balancing](inference-serving/fallbacks-load-balancing.md)** | survive outages, spread load | production reliability across providers/GPUs |

Read it as three layers: **frameworks** (what runs the model), **optimization + quantization** (how to make each GPU do more), and **cost & routing** (how to spend less per answer, even on hosted APIs).

## Real world: how a company uses this

> **A Dubai bank** couldn't send customer data to a US API, so it self-hosted **Qwen-72B on 2× H100 with vLLM**, quantized to AWQ 4-bit so it fit and ran fast. Continuous batching pushed the GPUs from ~20% to ~70% utilization, tripling throughput. In front of the whole thing sat a **LiteLLM gateway** with a semantic cache and a router: repeated "what's my balance limit?" style questions hit the cache (near-zero cost), simple ones went to a small local model, and only genuinely hard queries used the 72B. Result: on-prem compliance, sub-second cached responses, and a per-answer cost a fraction of naive serving. Same weights — the *serving stack* is what made it viable.

## Interview tip
Say: *"Serving is where LLM economics are won. My defaults: vLLM for self-hosted GPU throughput, quantize to 4-bit (AWQ/GPTQ) so it fits and runs fast, rely on continuous batching + KV cache + FlashAttention for utilization, and put a gateway in front for caching, routing, and fallbacks. The single biggest lever is GPU utilization — an idle GPU is money on fire — and caching/routing cut cost even on hosted APIs."* That shows you can run models, not just call them.

---

*Below: deep-dive articles on each serving, optimization, quantization, and routing technique.*
