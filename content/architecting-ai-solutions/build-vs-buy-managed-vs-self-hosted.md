# Build vs buy (managed vs self-hosted)

**What it is:** the decision of whether to *call a managed API* (OpenAI, Anthropic, AWS Bedrock) or *run the model yourself* on your own GPUs — and, more broadly, buy a component or build it.

## Why it matters for an AI Engineer

This is the infrastructure decision that shapes your cost curve, your data-governance story, and how fast you ship. Get it wrong toward "self-host everything" and a two-person team drowns in GPU ops instead of building features. Get it wrong toward "buy everything" and at scale you're paying a 5× markup and can't meet a data-residency rule. In the Gulf specifically, **data residency and regulatory control** often force the question — which is exactly why interviewers there probe it. Knowing the real trade-offs, not the dogma, is a senior signal.

## The mechanism: what you're actually trading

<div class="diagram">
  <div class="flow">
    <span class="dbox green">☁️ Managed API<span class="sub">buy</span></span>
    <span class="darr">↔<span class="lbl">the trade-off axis</span></span>
    <span class="dbox purple">🖥️ Self-hosted<span class="sub">build</span></span>
  </div>
  <div class="dcap">Speed & simplicity on the left; control & unit-cost-at-scale on the right.</div>
</div>

**Managed API (buy)** — you send a request, they run the model. You get:
- **Speed to ship** — no infra, working in minutes.
- **Always-current frontier models** — someone else trains and hosts them.
- **Elastic scale** — they handle spikes; you pay per token.
- But: **per-token cost that grows with usage**, your data leaves your walls (governance/compliance concern), vendor lock-in, and no control over model changes or downtime.

**Self-hosted (build)** — you run an open-weight model (Llama, Qwen, Mistral, Falcon) on your own/cloud GPUs. You get:
- **Data stays in your environment** — critical for banking, healthcare, gov, and UAE data-residency rules.
- **Cheaper *per unit* at high, steady volume** — a rented GPU is fixed-cost; heavy traffic amortizes it below API pricing.
- **Full control** — pin a model version, customize, no surprise deprecations.
- But: **you own the ops** — GPU provisioning, scaling, uptime, upgrades — and idle GPUs burn money whether or not requests come in.

| Factor | Managed API | Self-hosted |
|---|---|---|
| Time to ship | **minutes** | weeks (infra + ops) |
| Cost shape | per-token (grows with use) | fixed GPU (cheap *if* well-utilized) |
| Data governance | leaves your walls | **stays in-house** |
| Model quality | **frontier, always current** | open-weight (catching up) |
| Ops burden | ~none | **you own it** |
| Best for | early stage, spiky traffic, need frontier | high steady volume, strict compliance, cost at scale |

**The crossover:** managed wins early (low volume, need speed, want frontier quality). Self-hosting wins when volume is **high and steady** (GPU stays busy enough to beat per-token pricing) or when **compliance forbids data leaving**. Many mature systems go **hybrid** — self-host a small model for the cheap high-volume 80%, call a managed frontier API for the hard 20%.

## Worked example: the crossover math

A summarization feature, ~5M requests/month, ~1k tokens each.

- **Managed:** 5M × $0.002 ≈ **$10,000/month**, zero ops.
- **Self-hosted:** two A100-class GPUs (~$4,000/month) running an open model can serve this steady load → **~$4,000/month** *if kept well-utilized* — plus an engineer's time to run it.

At 5M steady requests, self-hosting roughly halves compute cost. At 50k requests/month, the same GPUs sit ~idle and self-hosting is *far more* expensive per request than the API — the fixed cost has no volume to amortize against. Volume and utilization decide it.

## How a company uses this

> **A Dubai government-adjacent entity** processing citizen documents *cannot* send that data to a US-hosted API — data-residency rules settle the "managed vs self-hosted" question before cost even enters. They self-host an open-weight model (Falcon/Jais-family for Arabic) on GPUs inside the UAE, accepting the ops burden as the price of compliance. Contrast: a **Dubai startup** building an MVP used a managed API from day one — they had neither the volume to justify GPUs nor the team to run them, and needed frontier quality to validate the product fast. Same city, opposite correct answers, because the deciding factors (compliance + volume) differed. The startup's plan is to *revisit* self-hosting only once volume is high and steady — buy now, build later if the numbers flip.

## Common mistakes
- **Self-hosting to "save money" at low volume.** Idle GPUs are a fixed cost with nothing to amortize. Below the crossover, the API is cheaper *and* less work.
- **Ignoring the ops cost of self-hosting.** The GPU bill is the *visible* cost; the engineer-hours keeping it up are the real one, and a small team often can't spare them.
- **Assuming self-hosted = worse quality forever.** Open-weight models are strong; for many tasks they match managed models. Don't dismiss them.
- **Ignoring data residency until launch.** In regulated Gulf sectors this can *override* every cost argument — check it first, not last.
- **All-or-nothing thinking.** Hybrid (self-host cheap bulk + managed frontier for hard cases) is often the right answer.

## Interview tip
Say: *"I start with a managed API — fastest to ship, frontier quality, no ops — and self-host only when one of two things forces it: high steady volume where owning well-utilized GPUs beats per-token pricing, or a data-residency/compliance rule that forbids data leaving our walls. In the UAE that compliance factor often decides it outright. And I'd consider hybrid: self-host a small model for the bulk, call a managed frontier model for the hard tail."* Naming the *crossover conditions* — not a blanket preference — is the senior answer. Ties into [which model tier per task](which-model-tier-per-task.md).
