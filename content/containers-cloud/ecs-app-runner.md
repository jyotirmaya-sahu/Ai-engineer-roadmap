# ECS / App Runner

**What it is:** Two AWS ways to run your container as an always-on web service — **App Runner** is the easy button (hand it an image, get a URL), **ECS Fargate** is the flexible workhorse (full control, no servers to manage).

## Why it matters for an AI Engineer

Your FastAPI-wrapped LLM service needs to *stay running* behind a real URL, scale with traffic, and restart itself if it crashes. That's exactly what these give you. This is the concrete "deploy to AWS" step in the roadmap capstone, and it's the single most-requested deployment skill in Dubai JDs. Knowing when to pick the simple option vs. the powerful one is what an interviewer wants to hear.

## How it works

Both run **containers**, not code — you build an image, push it to [ECR](images.md), and point the service at it.

**App Runner** is fully managed. You give it an ECR image (or a GitHub repo) and it handles the load balancer, HTTPS URL, auto-scaling, and health checks automatically. It even **scales to near-zero** when idle. Minimal config — ideal when you just want your service live.

**ECS (Elastic Container Service) with Fargate** is more granular. The pieces:

- **Task definition** — the blueprint: which image, how much CPU/memory, which env vars and secrets, which [IAM](s3-iam.md) role.
- **Task** — one running copy of that blueprint (one container instance).
- **Service** — keeps N tasks running, replaces crashed ones, and **auto-scales** based on CPU or request count.
- **Fargate** — the serverless engine that runs tasks without you managing EC2 VMs.
- An **Application Load Balancer** spreads traffic across tasks and gives one stable URL.

Rule of thumb: **App Runner** for a single simple service you want live fast; **ECS Fargate** when you need fine-grained control, VPC networking, multiple linked services, or specific scaling rules.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🌐 users</span>
    <span class="darr">→</span>
    <span class="dbox blue">⚖️ Load Balancer</span>
    <span class="darr">→</span>
    <span class="dgroup"><span class="dgt">ECS Service (auto-scales)</span>
      <span class="dbox green">task 1</span>
      <span class="dbox green">task 2</span>
      <span class="dbox green">task 3…</span>
    </span>
  </div>
  <div class="dcap">A service keeps N identical tasks alive behind one load balancer, adding tasks as traffic rises.</div>
</div>

## Concrete example

The fast path — App Runner from an ECR image:

```bash
aws apprunner create-service \
  --service-name ai-service \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "123456789.dkr.ecr.me-central-1.amazonaws.com/my-ai-service:v1",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {"Port": "8000"}
    }
  }' \
  --instance-configuration '{"Cpu": "1 vCPU", "Memory": "2 GB"}'
```

App Runner returns an HTTPS URL, provisions a load balancer, and auto-scales — no other setup. For ECS you'd instead register a task definition (image, CPU/memory, IAM role, secret ARNs), create a service with `--desired-count 2`, and attach an ALB target group — more YAML, more control (VPC, private subnets, custom scaling policies).

## How a company uses this

A Dubai fintech runs its support RAG API on **ECS Fargate**: normally 2 tasks (1 vCPU / 2GB each), auto-scaling to 8 during 9am–6pm Gulf business hours based on request count, then back down overnight — so they pay for capacity only when it's used. The service auto-replaces any task that fails a health check, giving high availability with zero manual ops. A smaller internal HR-policy chatbot, with light and spiky traffic, runs on **App Runner** instead — it scales to near-zero off-hours, costing almost nothing when idle. Same company, two tools, chosen by traffic shape and control needs.

## Common mistakes
- **Wrong container port** — the service's health check hits a port your app doesn't listen on; the task loops crashing. Match `Port` to your `EXPOSE`/uvicorn port.
- **No health-check endpoint** — add a `/health` route or the platform can't tell if you're alive.
- **Reaching for full ECS + Kubernetes for one service** — over-engineering; App Runner ships it in minutes.
- **Under-provisioning memory** — LLM clients and PDF parsing spike RAM; a too-small task gets OOM-killed.

## Interview tip
Say: *"For a single service I'd start with App Runner — hand it the ECR image and it gives me an HTTPS URL with auto-scaling. When I need VPC networking, multiple services, or custom scaling, I move to ECS Fargate: a task definition for the blueprint, a service to keep N tasks alive behind an ALB, auto-scaling on request count, with an IAM role instead of keys."* Naming the task/service/Fargate split proves hands-on AWS experience. Next: [Lambda](lambda.md).
