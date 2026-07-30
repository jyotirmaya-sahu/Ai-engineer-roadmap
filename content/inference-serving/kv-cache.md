# KV cache

**What it is:** The running memory of a generation — the attention **Key and Value** vectors for every token processed so far, saved on the GPU so the model doesn't recompute the entire prompt on every single new token.

## Why it matters for an AI Engineer

The KV cache is what makes token-by-token generation affordable instead of quadratically slow — and it's simultaneously the **main consumer of GPU memory** during serving. Almost every serving decision (how many requests fit per GPU, how long a context you can afford, why long prompts are expensive, what [PagedAttention](vllm.md) optimizes) comes back to the KV cache. Understanding it explains *why* input tokens are cheaper than they look, why long conversations get slow and pricey, and why [continuous batching](continuous-batching.md) and quantization matter. Interviewers use "explain the KV cache" as a quick depth check.

## The mechanism / how it works

A transformer generates one token at a time. To produce the next token, attention needs the Key and Value vectors of **every previous token**. Naively, you'd re-run the whole sequence through the model each step — generating token 500 would reprocess 499 tokens, token 501 reprocesses 500, and so on. That's O(n²) wasted work.

The insight: **the K and V vectors for past tokens never change.** Token 200's keys and values are identical whether you're generating token 201 or token 900. So you compute them **once** and cache them. Each new step only computes K/V for the *one* new token, appends it to the cache, and attends over the whole stored set. Generation drops from re-processing everything to O(n) — linear.

This creates the two-phase pattern you see everywhere:

- **Prefill:** process the entire prompt in one parallel pass, filling the cache with K/V for all prompt tokens. Compute-heavy, one-time.
- **Decode:** for each output token, compute K/V for just that token, append, attend, emit. Cheap per step but done many times.

The cost is **memory**. Cache size = `2 (K and V) × layers × heads × head_dim × sequence_length × batch × bytes`. It grows linearly with context length *and* with the number of concurrent requests. This is exactly why serving a long-context, high-concurrency workload runs out of GPU memory — and why PagedAttention (paging the cache) and **KV-cache quantization** (storing it in FP8/INT8) exist.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Prompt: 500 tokens</span>
    <span class="darr">↓<span class="lbl">prefill once</span></span>
    <span class="dbox blue">🗄️ KV cache = K,V for all 500 tokens</span>
    <span class="darr">↓<span class="lbl">decode: new token only</span></span>
    <div class="flow">
      <span class="dbox purple">tok 501<span class="sub">+append K,V</span></span>
      <span class="darr">→</span>
      <span class="dbox purple">tok 502</span>
      <span class="darr">→</span>
      <span class="dbox green">…streamed</span>
    </div>
  </div>
  <div class="dcap">Compute each token's K/V once, cache it, and every later step reuses it — O(n²) becomes O(n).</div>
</div>

## Worked numbers

For a 7B model (32 layers, 32 heads, head_dim 128) in FP16:

Per token = 2 × 32 × 32 × 128 × 2 bytes ≈ **0.5 MB/token**.

- A 4,000-token context ≈ **2 GB** of KV cache — for *one* request.
- Serve 16 such requests concurrently → **32 GB** just for KV, on top of the ~14 GB of weights. That's why an 80 GB A100 fills up fast and why you quantize weights *and* the cache to fit more requests. Halving KV bytes (FP8 cache) nearly doubles how many requests fit.

## How a company uses this

A team running long customer-support conversations noticed cost and latency climbing as chats grew — because the KV cache grows with every turn, and long histories meant huge caches limiting concurrency. Two fixes: they enabled **prefix caching** (the shared system prompt's KV is computed once and reused across all requests, saving prefill on ~1,500 tokens every call), and **KV-cache quantization to FP8**, which roughly doubled the number of concurrent sessions per GPU with negligible quality loss. They also **summarized old turns** to cap context length, keeping the cache bounded. Net: ~2× session capacity per GPU and flatter latency on long chats. The production metric to watch is **KV-cache memory utilization** — when it saturates, the engine starts preempting/queuing and tail latency spikes.

## Common mistakes

- **Thinking the cache is free.** It's the dominant memory user in serving and it grows with context × concurrency — it's usually what OOMs you.
- **Ignoring prefix caching.** Recomputing a shared 2,000-token system prompt for every request wastes prefill compute you could cache once.
- **Not capping conversation length.** Unbounded chat history means unbounded KV growth — summarize or window it.
- **Overlooking KV quantization.** Storing the cache in FP8/INT8 can nearly double concurrency for near-zero quality loss.

## Interview tip
Say: *"The KV cache stores the Key/Value vectors of past tokens so generation doesn't reprocess the whole sequence each step — turning O(n²) into O(n). It splits inference into a one-time prefill and cheap per-token decode. The catch is memory: cache size grows with context length times concurrency, so it's usually what limits requests-per-GPU. I manage it with prefix caching, KV quantization to FP8, and capping conversation length."* Naming the prefill/decode split plus the memory trade-off is the complete answer.
