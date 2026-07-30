# Flash attention

**What it is:** A rewritten attention algorithm that computes the exact same result as standard attention but **without ever writing the giant intermediate attention matrix to GPU memory** — making attention both faster and dramatically more memory-efficient.

## Why it matters for an AI Engineer

Attention is the core operation of a transformer and, on long sequences, its biggest bottleneck. FlashAttention (now FlashAttention-2/3) is why modern models can handle **long contexts** at all without exploding memory, and it's baked into every serious serving engine — [vLLM](vllm.md), [TGI](tgi.md), and Hugging Face Transformers. You rarely call it directly, but understanding it explains why "just enable FlashAttention" is standard advice, why long-context inference got affordable, and why the win is about *memory movement*, not raw math. It's a strong signal in interviews when you can explain that GPU speed is often bound by memory bandwidth, not compute.

## The mechanism / how it works

Here's the key insight most people miss: on a GPU, attention is **memory-bound, not compute-bound**. The arithmetic (matrix multiplies, softmax) is fast; the slow part is shuttling data between two kinds of GPU memory — big-but-slow **HBM** (the tens of GB of "GPU RAM") and tiny-but-blazing-fast **SRAM** (on-chip cache, a few MB).

Standard attention computes the full `N×N` attention score matrix (for N tokens), writes it to HBM, reads it back to apply softmax, writes again, reads again to multiply by values. For a 4,000-token sequence that matrix is 16 million entries **per head per layer** — enormous reads and writes that dominate the time, and the matrix's size grows **quadratically** with sequence length (the memory that kills long context).

**FlashAttention** never materializes that full matrix. It uses **tiling**: it loads small blocks of queries, keys, and values into fast SRAM, computes their partial attention there, and combines results using an **online (streaming) softmax** that keeps a running max and sum so it can produce the exact softmax without ever seeing all scores at once. Because the big matrix never touches slow HBM, memory traffic drops massively and memory usage goes from **O(N²) to O(N)**. Same numbers out — far less memory moved.

<div class="diagram">
  <div class="flow v">
    <span class="dgt">STANDARD</span>
    <div class="flow">
      <span class="dbox orange">tiny Q,K,V</span>
      <span class="darr">→</span>
      <span class="dbox blue">🗄️ full N×N matrix in slow HBM</span>
      <span class="darr">→</span>
      <span class="dbox green">output</span>
    </div>
    <span class="dgt">FLASH — tiled, stays on-chip</span>
    <div class="flow">
      <span class="dbox orange">block of Q,K,V</span>
      <span class="darr">→</span>
      <span class="dbox purple">⚡ compute in fast SRAM<span class="sub">online softmax</span></span>
      <span class="darr">→</span>
      <span class="dbox green">output<span class="sub">no big matrix</span></span>
    </div>
  </div>
  <div class="dcap">By tiling and streaming softmax, FlashAttention avoids the huge N×N matrix — less memory moved, exact result.</div>
</div>

## Concrete example

You almost never hand-code it — you flip a flag:

```python
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    attn_implementation="flash_attention_2",   # <- enable FlashAttention-2
    torch_dtype="bfloat16", device_map="cuda",
)
```

In vLLM/TGI it's on by default. The payoff is concrete: on long sequences it delivers roughly **2–4× faster attention** and cuts attention memory from quadratic to linear, which is often the difference between fitting a 32k-token context on your GPU or OOMing.

## How a company uses this

A team building a long-document analysis tool needed 32k-token contexts (whole contracts). With standard attention, the N² score matrix blew past GPU memory and they were capped at ~4k tokens. Enabling FlashAttention-2 dropped attention memory to linear, letting them serve the full 32k context on the **same A100**, and attention ran ~3× faster so long-doc latency stayed acceptable. The lesson they took: the win wasn't a math speedup, it was **not moving a giant matrix through HBM**. Production caveat — FlashAttention needs a **compatible GPU** (Ampere/Hopper, e.g. A100/H100) and specific dtypes (bf16/fp16); on older cards it silently falls back to slower attention, so they pinned their instance types.

## Common mistakes

- **Thinking it changes the output.** It's *exact* attention, not an approximation — quality is identical, only memory/speed differ.
- **Believing it's a compute optimization.** The win is reduced memory traffic (HBM↔SRAM); attention is memory-bound.
- **Assuming it works everywhere.** It requires recent GPUs and fp16/bf16; check hardware or you get a slow fallback.
- **Expecting big gains on tiny sequences.** The benefit scales with sequence length — short prompts see little.

## Interview tip
Say: *"FlashAttention computes exact attention but avoids ever writing the N×N score matrix to slow GPU memory. It tiles Q/K/V into on-chip SRAM and uses a streaming softmax, so memory goes from quadratic to linear and attention runs 2–4× faster on long sequences. The key idea is that GPU attention is memory-bandwidth-bound, not compute-bound — so the win is moving less data, not doing less math. It's what makes long-context inference affordable, and it's on by default in vLLM/TGI."* Naming the memory-bound insight is what separates a real answer from a buzzword.
