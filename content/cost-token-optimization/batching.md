# Batching

**What it is:** Grouping many LLM requests together and processing them as one job — trading immediate latency for a big price discount (on APIs) or much higher throughput (when self-hosting).

## Why it matters for an AI Engineer

A huge share of real AI work isn't interactive: nightly summarization of every new document, classifying a million support tickets, generating embeddings for a whole knowledge base, running an eval suite over 50k test cases. None of that needs a sub-second reply — it needs to be *cheap* and *done by morning*. Batching is how you serve those workloads for roughly half the price (managed APIs) or several times the throughput on the same GPUs (self-hosted). Knowing which workloads are batchable — and separating them from the latency-critical path — is a core cost skill; teams that run everything through the real-time endpoint overpay massively on their offline work.

## The mechanism / how it works

There are two distinct meanings, both worth knowing:

**1. Batch API (managed, offline discount).** OpenAI, Anthropic, and others offer a **Batch API**: you upload a file of thousands of requests, they process it within a window (typically up to 24h), and you pay about **50% less** per token than the real-time endpoint. They can offer the discount because they schedule your work into spare capacity. Perfect for anything with no tight SLA. You submit, poll for completion, download results.

**2. Continuous batching (serving throughput).** When *self-hosting* with vLLM/TGI, the engine packs many users' requests through the GPU together — while one request waits on generation, others use the compute. This "continuous batching" can lift GPU throughput several-fold, which lowers cost-per-request because you serve more traffic on the same hardware. Here batching is automatic and works even for near-real-time traffic; you just size concurrency to keep the GPU busy without blowing latency.

The trade-off is always **latency for cost/throughput**. Batch API: minutes-to-hours delay for ~50% off. Continuous batching: a few ms of queuing for far more throughput. The engineering job is routing each workload to the right lane.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 10,000 offline requests</span>
    <span class="darr">→<span class="lbl">batch file</span></span>
    <span class="dbox purple">🧠 Batch API<span class="sub">≤24h window</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ results @ ~50% price</span>
  </div>
  <div class="dcap">No-SLA work goes to the batch lane for a big discount; interactive work stays real-time.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

# 1. write a JSONL of requests, one per line
# {"custom_id":"t1","method":"POST","url":"/v1/chat/completions",
#  "body":{"model":"gpt-5-mini","messages":[...]}}
f = client.files.create(file=open("batch.jsonl","rb"), purpose="batch")
job = client.batches.create(input_file_id=f.id,
        endpoint="/v1/chat/completions", completion_window="24h")
# 2. poll job.status until "completed", then download job.output_file_id
```

Worked numbers: classifying **2,000,000 tickets/month**, ~500 tokens in / 20 out, on a mid model ($2/$8 per MTok):

- **Real-time endpoint:** input $2,000 + output $320 = **$2,320/month.**
- **Batch API (~50% off):** **~$1,160/month.**
- **~$1,160/month saved** for accepting overnight turnaround on work that has no reason to be instant.

## How a company uses this

A media company in the region re-summarizes and tags every article published that day. It's inherently a nightly job, so they route it through the **Batch API** and pay roughly half — the summaries are ready before the morning news cycle and nobody waits on them. Their *live* article-chat feature stays on the real-time endpoint. A separate self-hosted team serving an internal code assistant relies on **vLLM continuous batching**: by tuning max concurrent sequences they pushed GPU utilization from ~35% to ~80%, tripling requests-served-per-GPU and cutting their effective cost-per-request without adding hardware. The shared principle: **classify each workload by its latency need**, then send no-SLA work to the cheap batch lane and keep interactive work on the fast lane — and keep self-hosted GPUs busy enough that batching does its job.

## Common mistakes

- **Running offline work on the real-time endpoint.** Paying full price and interactive-tier attention for a job that could wait overnight is the classic overspend.
- **Batching latency-critical requests.** A user waiting on a chat reply cannot sit in a 24h queue; know which lane each request belongs to.
- **Forgetting to poll / handle partials.** Batch jobs are async and can partially fail; you must poll status and reconcile which `custom_id`s succeeded.
- **Under-loading self-hosted GPUs.** Continuous batching only helps if concurrency is high enough to fill the GPU; a near-idle server gets none of the throughput win.

## Interview tip
Say: *"I split workloads by latency need. Anything offline — nightly summarization, bulk classification, embedding a corpus, eval runs — goes through the Batch API for about 50% off, since it tolerates an overnight window. Interactive traffic stays real-time. And when I self-host, continuous batching in vLLM packs requests through the GPU together to multiply throughput, which is really cost-per-request optimization. The skill is routing each job to the right lane instead of paying real-time prices for work that could wait."* It shows you see cost as a scheduling problem, not just a model choice.
