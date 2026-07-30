# Continuous batching

**What it is:** The scheduling trick that lets a serving engine swap requests in and out of a GPU batch *mid-generation* — so a finished request is instantly replaced by a waiting one, instead of everyone waiting for the slowest request to complete.

## Why it matters for an AI Engineer

This is the single biggest throughput win in modern LLM serving — it's *the* reason [vLLM](vllm.md) and [TGI](tgi.md) crush a naive server, often by **5–20×** on the same GPU. Since GPU hours are the dominant cost of self-hosting, batching efficiency translates directly into how many GPUs you need and therefore your bill. You won't implement it yourself (the engines do), but understanding it lets you reason about why utilization is low, why one giant request tanks throughput, and how to size a cluster. It's a favorite "explain how vLLM is fast" interview probe.

## The mechanism / how it works

GPUs are massively parallel — they're only efficient when doing many things at once. So you **batch** multiple requests and generate their next tokens together in one forward pass. The naive version is **static batching**: collect N requests, run them together until *all* finish, then start the next batch.

The problem: LLM responses vary wildly in length. If one request generates 20 tokens and another generates 800, static batching keeps the whole batch's GPU slots occupied until that 800-token laggard is done. The short requests finished long ago but their slots sit idle — the batch runs at the speed of its slowest member.

**Continuous batching** (a.k.a. in-flight / dynamic batching) works at the **per-token** level. After *every* generation step, the scheduler checks: did any sequence just emit its stop token? If so, evict it and pull a queued request into that freed slot on the next step. The batch is constantly reshuffled so the GPU is always working on a full set of *active* sequences.

Two phases interleave: **prefill** (process a new request's whole prompt at once — compute-heavy) and **decode** (generate one token per active sequence — memory-bandwidth-heavy). Continuous batching mixes new prefills with ongoing decodes to keep both the compute units and memory bandwidth busy. It works hand-in-glove with the [KV cache](kv-cache.md) (each active sequence keeps its own cache) and PagedAttention (so freed slots' memory is reclaimed cleanly).

<div class="diagram">
  <div class="flow v">
    <span class="dgt">STATIC — wait for slowest</span>
    <div class="flow">
      <span class="dbox orange">R1 ▓▓</span>
      <span class="dbox orange">R2 ▓▓▓▓▓▓▓▓</span>
      <span class="dbox gray">R3 idle…waiting</span>
    </div>
    <span class="darr">↓</span>
    <span class="dgt">CONTINUOUS — refill freed slots</span>
    <div class="flow">
      <span class="dbox green">R1 done→R3 in</span>
      <span class="dbox orange">R2 ▓▓▓▓</span>
      <span class="dbox green">R4 in</span>
    </div>
  </div>
  <div class="dcap">Freed slots are refilled every token — the GPU never idles waiting for the slowest request.</div>
</div>

## Worked numbers

Say 4 slots, and requests generate 50, 50, 50, and 600 tokens.

- **Static:** the batch runs for **600** token-steps (bounded by the laggard). Three slots go idle after step 50 — GPU utilization ≈ (50+50+50+600)/(4×600) = **31%**.
- **Continuous:** after step 50, three slots free up and pull in queued requests. Across the same wall-clock window you complete roughly **3× more** short requests. Effective utilization climbs toward **70–90%**.

Same hardware, same model — the scheduler alone roughly triples throughput.

## How a company uses this

A support-bot backend saw wildly mixed response lengths — one-word confirmations next to long troubleshooting walkthroughs. On a static-batching server the long answers dragged utilization to ~25% and they were about to buy more GPUs. Switching to vLLM's continuous batching lifted GPU utilization to ~75% and **tripled requests/sec on the same two A100s**, so they *cancelled* the extra hardware. The production subtlety: a few very long-context prefills can still momentarily stall decodes (prefill is compute-heavy), so they enabled **chunked prefill** to interleave big prompts with ongoing decodes and keep tail latency flat. Monitoring "running vs waiting" queue depth became their early-warning signal for needing more capacity.

## Common mistakes

- **Confusing it with static batching.** "We batch requests" isn't enough — static batching still stalls on the slowest one; the win is per-token refilling.
- **Assuming bigger batch = always better.** Beyond a point you exhaust KV memory and start queuing; throughput plateaus and tail latency rises.
- **Ignoring prefill vs decode.** A flood of long prompts is prefill-bound and can starve decodes — use chunked prefill.
- **Benchmarking single requests.** Continuous batching's entire benefit only shows under concurrency.

## Interview tip
Say: *"Continuous batching is why vLLM/TGI are fast. Static batching runs a batch until every request finishes, so the slowest response wastes all the other slots. Continuous batching evicts finished sequences and slots in queued ones after *every* token, keeping the GPU full of active work — often 5–20× the throughput on the same card. It pairs with the KV cache and PagedAttention, and I watch prefill-vs-decode balance so long prompts don't stall decodes."* Explaining the slowest-request stall is the crisp version interviewers look for.
