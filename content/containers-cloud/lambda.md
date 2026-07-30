# Lambda

**What it is:** AWS Lambda runs your code on demand with zero servers — you upload a function, AWS runs it when triggered, and you pay only for the milliseconds it executes.

## Why it matters for an AI Engineer

Not every AI task should be an always-on service. Processing a document when it lands in S3, running a nightly re-embedding job, handling a webhook, powering a lightweight API endpoint that's called occasionally — these are **spiky and event-driven**. Running a 24/7 [ECS](ecs-app-runner.md) task for them wastes money. Lambda is the cheap, auto-scaling glue that fills the gaps between your main services, and it's a standard piece of an AWS AI architecture.

## How it works

You give Lambda a **handler function**. AWS invokes it in response to a **trigger** and tears the environment down after. Key mechanics:

- **Event-driven.** Triggers include an [S3](s3-iam.md) upload, an API Gateway HTTP request, an SQS message, or a scheduled cron (EventBridge). The trigger's data arrives as the `event` argument.
- **Auto-scaling to zero and to thousands.** No traffic → no cost, no running instances. A burst of 500 uploads → AWS runs 500 copies in parallel automatically. You never manage capacity.
- **Pay per use.** Billed per millisecond × memory. Idle time is free.
- **Limits that shape design.** Max **15-minute** run time, up to **10GB** memory, and a **cold start** — the first call after idle spins up the environment (a few hundred ms; more if the package is large). So Lambda suits *short, bursty* work, not long-running jobs or latency-critical LLM streaming.
- **Two package types:** a zip of code, or a **container image** (up to 10GB) — the container option is how you ship heavier AI dependencies, reusing your Docker skills.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🗄️ S3 upload</span>
    <span class="darr">→<span class="lbl">event trigger</span></span>
    <span class="dbox purple">λ function<span class="sub">runs, then vanishes</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ result written back</span>
  </div>
  <div class="dcap">An event fires the function; it runs for seconds and disappears — you pay only for those seconds.</div>
</div>

## Concrete example

A Lambda that parses each PDF the moment it's uploaded to S3, triggered automatically:

```python
import boto3, os
s3 = boto3.client("s3")

def handler(event, context):
    # S3 put-event delivers bucket + key in the event payload
    rec = event["Records"][0]["s3"]
    bucket = rec["bucket"]["name"]
    key = rec["object"]["key"]

    obj = s3.get_object(Bucket=bucket, Key=key)
    text = extract_text(obj["Body"].read())        # your parsing logic

    # e.g. write chunks/embeddings somewhere, or drop text back to S3
    s3.put_object(Bucket=bucket, Key=f"parsed/{key}.txt", Body=text.encode())
    return {"status": "ok", "chars": len(text)}
```

Wire it up: create the function (container image for heavy deps), attach an [IAM](s3-iam.md) role granting `s3:GetObject`/`s3:PutObject`, and add an **S3 → Lambda** trigger on the `uploads/` prefix. Upload 200 files at once and 200 invocations run in parallel — no scaling config, and $0 when the bucket is quiet.

## How a company uses this

A Dubai real-estate platform ingests property brochures unpredictably — dozens one hour, none the next. Each upload to S3 fires a Lambda that extracts text, chunks it, calls [Bedrock](bedrock.md) for embeddings, and writes vectors to the store. Because it's event-driven, a 300-file bulk import auto-scales to hundreds of parallel runs and finishes in minutes, then costs **nothing** overnight when no one uploads — versus an ECS task that would idle-bill 24/7. They deliberately keep the LLM *chat* API on ECS (needs low, steady latency and streaming) and use Lambda only for the bursty ingestion glue: the right tool for each traffic shape.

## Common mistakes
- **Using Lambda for long jobs** — the 15-minute cap kills it; use ECS/Fargate or Batch instead.
- **Ignoring cold starts** — a large AI package makes the first call slow; keep it lean or use provisioned concurrency for latency-sensitive paths.
- **Using it for steady high-QPS, low-latency serving** — an always-on service is cheaper and faster there.
- **Over-scoped IAM** — grant only the exact S3/Bedrock actions the function needs.

## Interview tip
Say: *"Lambda is my choice for spiky, event-driven glue — parse-on-S3-upload, scheduled re-embedding, webhooks — because it scales to zero and I pay per millisecond. But I keep the latency-sensitive LLM chat API on ECS, since Lambda has cold starts and a 15-minute cap. Matching the compute to the traffic shape is the point."* Showing you know Lambda's *limits* is more impressive than just knowing it exists. Next: [S3 · IAM](s3-iam.md).
