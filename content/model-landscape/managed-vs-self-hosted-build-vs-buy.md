# Managed vs Self-hosted — Build vs Buy

**The one-line idea:** managed inference buys speed and operational simplicity; self-hosting buys control and can lower unit cost at sustained scale. The right choice comes from requirements and measured traffic—not ideology.

## Why it matters for an AI Engineer

Choosing a model is only half the architecture. You must also decide who operates it. A provider API or managed platform handles GPUs, autoscaling, patches, and availability. A self-hosted stack makes your team responsible for all of that, but gives tighter control over weights, placement, latency, data paths, and optimization. This decision affects delivery time, compliance, hiring, reliability, and total cost.

## The decision model

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">Requirements<span class="sub">quality · privacy · latency · QPS</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">Benchmark both<span class="sub">same eval set + traffic shape</span></span>
    <span class="darr">→</span>
    <span class="dbox green">Choose deployment<span class="sub">managed · self-hosted · hybrid</span></span>
  </div>
</div>

Reach for **managed inference** when time-to-market matters, traffic is uncertain or bursty, the provider meets residency requirements, and the team does not have GPU-serving expertise. Reach for **self-hosting** when model weights must stay in your environment, a required open model is unavailable as a managed service, you need custom kernels or fine-tuned weights, or steady utilization makes owned capacity economical. A **hybrid** route is common: managed frontier models for difficult requests and a self-hosted smaller model for high-volume classification, extraction, or routing.

Compare total cost, not token price alone:

```python
managed_month = requests * avg_tokens / 1_000_000 * price_per_million
self_hosted_month = gpu_hours * gpu_hourly + engineering_hours * loaded_hourly

print({
    "managed": round(managed_month, 2),
    "self_hosted": round(self_hosted_month, 2),
})
```

For self-hosting, include idle GPU time, replicas for high availability, observability, storage, networking, security reviews, upgrades, and on-call support. For managed services, include input/output tokens, provisioned throughput, cross-region transfer, retries, and vendor lock-in.

## How a company uses this

A UAE bank might keep customer-identifying extraction on a private, self-hosted model inside its approved network, while using a managed model for redacted document summarization. A routing layer records quality, latency, and cost for both paths and can fail over without exposing restricted data.

## Common mistakes

- Comparing an always-busy self-hosted GPU with a low-volume pay-per-token workload.
- Assuming self-hosted automatically means compliant; the surrounding logs, backups, and operators still matter.
- Choosing from benchmark leaderboards without testing the company’s own Arabic/English data.
- Ignoring migration and exit costs.

## Interview tip

Say: *“I decide from workload and constraints. I benchmark quality and p95 latency on our eval set, model managed and fully loaded self-hosted cost, check residency and operational capability, then choose managed, self-hosted, or hybrid. I revisit the choice as traffic changes.”*

