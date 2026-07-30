# Containers & Cloud

**The one-line idea:** A container packages your AI app plus everything it needs into one portable box, and the cloud is where you run that box so real users can reach it — without buying servers.

## Why we even need it

You built an LLM app on your laptop. It works. Now someone in Dubai needs to use it at 2am. Two problems:

1. **"It works on my machine" doesn't ship.** Your app depends on a specific Python version, specific library versions, system tools, environment variables. Move it to another computer and one mismatch breaks everything. A **container** freezes all of that into a single image, so it runs identically on your laptop, a colleague's machine, and a server in an AWS Bahrain data center.
2. **A laptop isn't a server.** It sleeps, has one IP, no scaling, no uptime guarantee. The **cloud** gives you machines that stay on, scale up when traffic spikes, and sit behind a real URL. For Dubai roles that means **AWS** specifically — it's the dominant cloud in the UAE (AWS opened its Middle East region in Bahrain in 2019 and a UAE region in 2022), so almost every Dubai JD that mentions cloud means AWS.

This is the single biggest gap in most candidates' resumes. **Deployment appears in ~82% of Dubai AI/ML job descriptions** — more than any other skill. You can have brilliant RAG and agents, but if you can't containerize and deploy them, you're not hireable for these roles.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">💻 Your code<span class="sub">+ deps</span></span>
    <span class="darr">→<span class="lbl">docker build</span></span>
    <span class="dbox purple">📦 Image</span>
    <span class="darr">→<span class="lbl">push</span></span>
    <span class="dbox blue">🗄️ Registry<span class="sub">ECR</span></span>
    <span class="darr">→<span class="lbl">deploy</span></span>
    <span class="dbox green">☁️ AWS<span class="sub">live URL</span></span>
  </div>
  <div class="dcap">Build once into an image, push it to a registry, run it on the cloud — same box everywhere.</div>
</div>

## Why it matters for an AI Engineer

Modern AI work is glue: a FastAPI service wrapping an LLM, a vector DB, background workers. Every one of those runs in a container. The **flagship capstone of this roadmap** — a deployed AI service — literally is "containerize it and put it on AWS." Interviewers probe this because it separates people who *build demos* from people who *ship products*. Knowing Docker + a few AWS services is the difference between "I made a notebook" and "I deployed a service handling real traffic."

## The tiles you'll learn (and when to reach for each)

| Tile | Core idea | Reach for it when |
|---|---|---|
| **[Dockerfile](containers-cloud/dockerfile.md)** | the recipe that builds your image | packaging any app — the starting point |
| **[Images](containers-cloud/images.md)** | the built, layered, shippable artifact | understanding size, caching, registries |
| **[Compose](containers-cloud/compose.md)** | run several containers together locally | app + vector DB + Redis on your laptop |
| **[Multi-stage](containers-cloud/multi-stage.md)** | build fat, ship thin | shrinking a 2GB image to 300MB |
| **[Env & secrets](containers-cloud/env-secrets.md)** | config & API keys without hardcoding | every real deploy (keys must not be baked in) |
| **[Bedrock](containers-cloud/bedrock.md)** | AWS's managed LLM API (Claude, Llama) | calling frontier models the "AWS-native" way |
| **[ECS / App Runner](containers-cloud/ecs-app-runner.md)** | run your container as a service on AWS | deploying a long-running FastAPI backend |
| **[Lambda](containers-cloud/lambda.md)** | run code with no server, pay per call | spiky/event-driven tasks, cheap glue |
| **[S3 · IAM](containers-cloud/s3-iam.md)** | file storage + who-can-do-what permissions | storing docs/models + securing everything |
| **[Azure / AzureML](containers-cloud/azure-azureml.md)** | Microsoft's cloud + ML platform | enterprise/Microsoft-shop employers |
| **[GCP](containers-cloud/gcp.md)** | Google's cloud (Vertex AI, Gemini) | Google-stack teams, Vertex deployments |
| **[MS Fabric](containers-cloud/ms-fabric.md)** | Microsoft's unified data+analytics platform | data-heavy enterprises already on Microsoft |

Focus order for Dubai: **Docker fully → AWS core (Bedrock, ECS/App Runner, Lambda, S3/IAM)**. The other clouds are "recognize and speak to," not "master."

## Real world: how a company uses this

> **A Dubai fintech** ships its customer-support RAG assistant like this: the FastAPI app is defined in a **multi-stage Dockerfile** (~350MB final image), built in CI and pushed to **ECR**. It runs on **ECS Fargate** — 2 tasks normally, auto-scaling to 8 during business hours. The LLM calls go to **Bedrock** (Claude, kept in-region for data-residency rules the UAE regulator cares about). Uploaded documents land in **S3**; an **IAM role** attached to the task grants read access to exactly that one bucket and nothing else. No API keys live in the image — they're injected as environment variables from **AWS Secrets Manager** at startup. That whole stack is what "deploy an AI app" means in a real Dubai job.

## Interview tip
Say: *"I package the service in a multi-stage Docker image, push to ECR, and run it on ECS Fargate behind a load balancer, with Bedrock for the models to keep data in-region, S3 for documents, and least-privilege IAM roles instead of hardcoded keys — secrets come from Secrets Manager as env vars. For spiky glue work I'd use Lambda instead of a long-running task."* That one sentence proves you can actually ship, which is exactly the 82% gap employers screen for.

---

*Below: deep-dive articles on each container & cloud topic.*
