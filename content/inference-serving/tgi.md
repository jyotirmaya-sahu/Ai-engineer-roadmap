# TGI

**What it is:** **Text Generation Inference** — Hugging Face's production-grade LLM serving server, a batteries-included alternative to [vLLM](vllm.md) that's tightly integrated with the HF model hub and ecosystem.

## Why it matters for an AI Engineer

TGI is the serving engine you'll meet the moment a team is already living in the Hugging Face world — models pulled from the hub, tokenizers from `transformers`, deploys on HF's own **Inference Endpoints** or on AWS/GCP via HF's containers. It gives you the same production capabilities as vLLM (continuous batching, quantization, streaming, tensor parallelism) wrapped in a well-documented Docker image with a clean REST/gRPC API. Knowing when to reach for TGI versus vLLM — and being able to say *why* — is a common architecture-interview beat, because both are correct answers in different shops.

## The mechanism / how it works

TGI is a Rust web server (fast, low-overhead request handling) sitting in front of a Python inference process that runs the model. That split matters: the Rust layer handles thousands of concurrent HTTP connections, request queuing, and streaming without the GIL bottlenecking things, while Python does the GPU math.

Its core throughput trick is the same family as vLLM's: **continuous batching** (HF calls it "dynamic batching") so finished requests are immediately replaced by waiting ones, keeping the GPU full. It ships with:

- **PagedAttention** and **FlashAttention** for memory-efficient KV handling (see [KV cache](kv-cache.md), [Flash attention](flash-attention.md)).
- **Quantization** — [GPTQ](gptq.md), [AWQ](awq.md), [bitsandbytes](bitsandbytes.md), EETQ, FP8 — loadable straight from a quantized hub repo.
- **Tensor parallelism** to shard a large model across multiple GPUs (`--num-shard 2`).
- **Token streaming** over Server-Sent Events, plus a `/generate` and OpenAI-compatible `/v1/chat/completions` endpoint.
- **Guided/structured output** (JSON schema, regex) to force valid formats — handy for tool-calling and extraction.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🌐 HTTP requests</span>
    <span class="darr">→</span>
    <span class="dbox orange">🦀 Rust router<span class="sub">queue + batch</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🐍 model shard(s)<span class="sub">GPU, paged KV</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ streamed tokens</span>
  </div>
  <div class="dcap">A fast Rust front-end batches and streams; Python runs the model across one or more GPUs.</div>
</div>

## Concrete example

TGI ships as a Docker container — the standard way to run it:

```bash
docker run --gpus all -p 8080:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id Qwen/Qwen2.5-7B-Instruct \
  --quantize awq --num-shard 1 --max-total-tokens 8192
```

```python
# OpenAI-compatible endpoint — same client you'd use for OpenAI
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8080/v1", api_key="none")
r = client.chat.completions.create(
    model="tgi",
    messages=[{"role": "user", "content": "Explain AML screening in one line."}],
    stream=True,
)
for chunk in r:
    print(chunk.choices[0].delta.content or "", end="")
```

## How a company uses this

A regional media company already stored all its fine-tuned models on the Hugging Face hub, so TGI was the path of least resistance: **push model → one Docker command → live endpoint** on HF Inference Endpoints with autoscaling. They served a fine-tuned 13B summarizer at **~120 requests/sec** across 3 A10G GPUs, using continuous batching and GPTQ 4-bit to fit each replica on a single card. The operational win was less about peak throughput (vLLM might edge it) and more about **fit**: their MLOps was HF-native, so TGI meant no new tooling, versioned model rollouts through the hub, and structured-JSON output for their extraction pipeline out of the box. The production gotcha they hit: TGI reserves KV memory from `--max-total-tokens`, and setting it too high on the A10G's 24GB caused OOM on startup — they tuned it down to match real prompt lengths.

## Common mistakes

- **Assuming TGI ≫ vLLM or vice-versa.** They're close on throughput; pick by ecosystem fit and features (TGI for HF-native shops and structured output, vLLM for raw throughput tuning).
- **Over-setting `--max-total-tokens` / `--max-input-length`.** Like vLLM's max-model-len, too high wastes KV memory and can OOM; too low truncates prompts.
- **Not sharding a model that won't fit.** A 70B won't load on one GPU — set `--num-shard` to split it (tensor parallelism) or quantize harder.
- **Forgetting it's Docker-first.** People fight to `pip install` TGI; the supported path is the official container image.

## Interview tip
Say: *"TGI is Hugging Face's production server — a fast Rust front-end doing continuous batching and streaming over a Python model process, with PagedAttention, quantization, tensor-parallel sharding, and guided JSON output built in. I reach for it when the team is HF-native — models on the hub, deploying to Inference Endpoints — because it's the zero-friction path, and for vLLM when I want maximum tunable GPU throughput. Both are right; the choice is ecosystem fit."* Framing it as a *fit* decision, not a winner, is what interviewers want to hear.
