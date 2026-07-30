# vLLM

**What it is:** The most widely used open-source inference engine for serving LLMs at high throughput on GPUs — famous for the **PagedAttention** trick that lets it pack far more concurrent requests onto one card.

## Why it matters for an AI Engineer

When cost, privacy, or latency pushes you off hosted APIs and onto your own GPUs (common for Dubai enterprises with data-residency rules), vLLM is the default answer to "what do we serve it with?" It routinely delivers **5–24× the throughput** of a naive Hugging Face `generate()` loop on the same hardware — meaning you serve the same traffic on a fraction of the GPUs, which is directly a fraction of the bill. Knowing vLLM by name, and *why* it's fast, is the difference between saying "we'll self-host somehow" and defending a real deployment in an interview.

## The mechanism / how it works

Naive serving wastes GPU memory. The [KV cache](kv-cache.md) — the running memory of a generation — is stored as one big contiguous block per request, sized for the *maximum* possible sequence length. Most requests never reach that length, so most of that reserved memory sits empty. With big blocks reserved per request, you can only fit a handful of requests at once, and the GPU starves.

**PagedAttention** fixes this by borrowing from operating-system virtual memory. It splits the KV cache into small fixed-size **pages** (like memory pages) and allocates them on demand as each sequence grows. No giant pre-reservation, almost no wasted memory (~4% vs 60–80% waste before). More free memory → more requests fit → the GPU stays busy.

On top of that, vLLM does **[continuous batching](continuous-batching.md)**: as soon as one request in the batch finishes, a waiting request slots into its place mid-flight, instead of waiting for the whole batch to complete. It also ships with [FlashAttention](flash-attention.md), quantization support ([AWQ](awq.md)/[GPTQ](gptq.md)/FP8), prefix caching (reuse a shared system prompt's KV across requests), tensor parallelism to split a big model across GPUs, and [speculative decoding](speculative-decoding.md).

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">🙋 Requests arrive continuously</span>
    <span class="darr">↓</span>
    <div class="flow">
      <span class="dbox purple">📄 paged KV<span class="sub">tiny blocks</span></span>
      <span class="dbox purple">🔁 continuous batch</span>
      <span class="dbox purple">⚡ FlashAttn + quant</span>
    </div>
    <span class="darr">↓</span>
    <span class="dbox green">✅ high tokens/sec, GPU ~70–90% busy</span>
  </div>
  <div class="dcap">PagedAttention frees KV memory → more concurrent requests → the expensive GPU stays saturated.</div>
</div>

## Concrete example

vLLM exposes an **OpenAI-compatible** server, so your existing code barely changes:

```bash
# Serve an open model on your GPU
pip install vllm
vllm serve Qwen/Qwen2.5-7B-Instruct --quantization awq --max-model-len 8192
```

```python
# Talk to it with the standard OpenAI client — just point base_url at your server
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8000/v1", api_key="none")

resp = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B-Instruct",
    messages=[{"role": "user", "content": "Summarize KYC in one sentence."}],
)
print(resp.choices[0].message.content)
```

That OpenAI-compatibility is a big deal: you can develop against OpenAI, then swap `base_url` to your self-hosted vLLM and everything downstream still works.

## How a company uses this

A fintech serving an internal support assistant ran Qwen-72B on **2× H100** with vLLM, AWQ-quantized. Under load, PagedAttention + continuous batching held the GPUs at ~75% utilization and served ~40 concurrent conversations at **sub-800ms time-to-first-token**, versus a naive server that managed ~5 concurrent requests before queuing. The measured win: **~4× fewer GPUs** for the same SLA, turning a projected 8-GPU cluster into 2. At scale the failure mode to watch is **KV-cache OOM** under a burst of long-context requests — vLLM will preempt/queue rather than crash, but if `--max-model-len` and `--gpu-memory-utilization` are set too aggressively, tail latency spikes. Tuning those two flags against real traffic is the core production job.

## Common mistakes

- **Setting `--max-model-len` to the model's full limit "to be safe."** Huge per-request KV reservations shrink how many requests fit — set it to what you actually need.
- **Ignoring quantization.** Serving FP16 when AWQ 4-bit fits twice the model (or twice the batch) in memory with near-zero quality loss.
- **Benchmarking with one request.** vLLM's win is *throughput under concurrency*; a single-request test hides its whole advantage.
- **Forgetting prefix caching.** A shared 2,000-token system prompt across every request is recomputed each time unless you enable prefix caching.

## Interview tip
Say: *"vLLM is my default self-hosted serving engine. Its edge is PagedAttention — KV cache stored in small pages like OS virtual memory, so almost no memory is wasted and far more requests fit per GPU — plus continuous batching to keep the card saturated. It's OpenAI-compatible, so I can develop against a hosted API and swap the base URL to vLLM with no downstream changes. I tune max-model-len and GPU memory fraction against real traffic to control tail latency."* Naming PagedAttention specifically signals you understand *why* it's fast, not just that it is.
