# Find bottlenecks & iterate

**What it is:** the back half of the design round — you stress-test your own [sketch](sketch-components.md) against the [SLAs](define-slas-latency-cost-accuracy.md), find the box that breaks first, fix it, and repeat until the design holds under load, cost, and failure.

## Why it matters for an AI Engineer

This is where seniority is *won or lost*. Anyone can draw a diagram that works for one user. The senior signal is: **you attack your own design before the interviewer does.** "This works at 10 QPS, but at our 500 QPS the vector DB becomes the bottleneck, so here's what I'd change." That single move — proactively finding the weak link and iterating — is the difference between "can draw a system" and "can run a system." The interviewer will keep adding pressure ("now 10× the traffic," "now the model API is down"); the iterate loop is your muscle for absorbing each hit without panicking.

## The mechanism: find the tightest constraint, relieve it, re-check

A bottleneck is **the one component that hits its limit first as you push load, cost, or a failure.** You don't optimize everything — you find the single tightest constraint, relieve it, and see what becomes the *new* bottleneck.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">📐 Design</span>
    <span class="darr">→</span>
    <span class="dbox orange">🔺 Apply pressure<span class="sub">10× load / cost / failure</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🔍 Find tightest box</span>
    <span class="darr">→</span>
    <span class="dbox green">🔧 Relieve it</span>
    <span class="darr">→<span class="lbl">new bottleneck?</span></span>
    <span class="dbox blue">↺ Re-check</span>
  </div>
  <div class="dcap">One constraint at a time. Fix the tightest, then see what breaks next.</div>
</div>

Push on three axes:

1. **Latency.** Where does time go? Walk the request path and add up the slow parts: embedding call, vector search, prompt build, **the LLM generation (almost always the biggest chunk)**, guardrail checks. If the total blows the p95 SLA, the LLM is usually the culprit — relieve it with a smaller/faster model for easy queries, streaming, or caching.
2. **Throughput / scale.** At the target QPS, which box saturates? A single-node vector DB caps out; the LLM API has rate limits; the orchestrator is CPU-bound. Relieve with horizontal replicas, a queue to smooth bursts, sharding the index, or higher API tiers.
3. **Cost.** At volume, which call dominates spend? Usually the frontier LLM. Relieve with a **cache** (repeat queries → free), **routing** (cheap model for easy queries), shorter prompts, or batching.

The core techniques you'll reach for, over and over: **cache** (kill repeat cost/latency), **route** (right-size the model per query), **queue** (absorb bursts, decouple slow work), **replicate/shard** (scale a saturated store), **precompute** (move work offline). Name the technique *and* which bottleneck it relieves.

**The discipline: fix one thing, then re-scan.** Relieving the LLM bottleneck with a cache might make the vector DB the new limit. Iterate until the design meets the SLA end-to-end — then stop. Don't gold-plate boxes that were never the constraint.

## Worked example: iterating under pressure

Start: support RAG, works at 10 QPS. Interviewer: *"Now it's 1,000 QPS and your cost tripled — fix it."*

- **Scan cost:** at 1,000 QPS every query hits the frontier model → spend explodes. **Tightest constraint = LLM cost.** Relieve: add a semantic cache (repeat questions serve free) + route easy queries to a small model. Cost drops ~60%.
- **Re-scan:** now 1,000 QPS of embedding + search hits the vector DB. **New bottleneck = vector DB throughput.** Relieve: add read replicas / use a managed DB that autoscales; the cache also absorbs ~35% of searches.
- **Re-scan latency:** cache hits are <100ms; misses still stream first token in ~1.2s. **Meets the p95 < 2s SLA.** Stop.

Three iterations, each fixing the *then-tightest* box. That's the loop.

## How a company uses this

> **A Dubai delivery app's** order-support bot passed its demo, then fell over on launch day. Real traffic was **bursty** — a promo pushed a 20× spike in ten minutes. The bottleneck wasn't the model; it was the **synchronous request path**: every user waited on a live LLM call, the API's rate limit was hit, requests queued in the web tier, and the whole thing timed out. The fix was the iterate loop applied in production: put a **queue** between the gateway and the orchestrator to absorb the burst, serve a "working on it…" stream, and **cache** the top 50 promo-related questions that made up 70% of the spike. Same components, one queue and one cache added at the true bottleneck — p95 held through the next promo. The lesson: the bottleneck is rarely the box you expect, and you only find it by pushing on the design.

## Common mistakes
- **Optimizing the wrong box.** Tuning the embedding model when the LLM call is 90% of latency. Find the *tightest* constraint first; everything else is noise.
- **Fixing everything at once.** You lose track of what mattered. One change, re-scan, repeat.
- **Never re-scanning.** Relieving one bottleneck creates the next. If you don't re-check, you declare victory while the design still fails at scale.
- **Waiting to be attacked.** If the interviewer has to point out your bottleneck, you've already lost the senior signal. Attack your own design first.

## Interview tip
Proactively say: *"Let me stress this. At our target QPS, the LLM cost is the tightest constraint, so I'd cache repeats and route easy queries to a smaller model. That'd make the vector DB the next bottleneck, which I'd relieve with replicas. Then I re-check latency against the p95 SLA — and if it holds, I stop."* Running this loop out loud, unprompted, is the clearest "I've operated real systems" signal you can give — and it's exactly the muscle you'll flex in the [worked examples](design-a-support-rag-assistant.md) and [capacity math](capacity-cost-qps-tokens.md).
