# Images

**What it is:** An image is the built, frozen artifact your Dockerfile produces — a stack of read-only layers containing your app, its dependencies, and a minimal OS, ready to run anywhere.

## Why it matters for an AI Engineer

The image is what actually ships. Its **size** decides how fast deploys are and how much you pay to store and pull it; its **layers** decide how fast it rebuilds; its **tag** decides which version runs in production. AI images are especially prone to bloat — a naive one with PyTorch and CUDA can hit 6–8GB, which means slow cold starts, expensive storage, and painful CI. Understanding images is how you keep an AI service lean and deployable.

## How it works

Think of a **Dockerfile** as the recipe and the **image** as the cake. When you `docker build`, each instruction adds one **layer** — a diff of filesystem changes stacked on the one below. Layers are:

- **Read-only and shared.** If two images share a base layer, it's stored once. Pull a second image built on the same base and only the new layers download.
- **Content-addressed.** Each layer has a hash. Change nothing → same hash → reused from cache. Change something → new hash → that layer *and every layer after it* rebuild.

When you `docker run`, Docker stacks the read-only layers and adds one thin **writable layer** on top — that's your live container. Delete the container and the image is untouched.

A **tag** is a human label pointing at an image (`my-service:v1.2`, `my-service:latest`). A **registry** (Docker Hub, or AWS **ECR** for Dubai jobs) is where images live so servers can pull them. The flow is always: **build → tag → push → pull → run.**

<div class="diagram">
  <div class="dstack">
    <span class="dbox green">writable layer<span class="sub">added at run time</span></span>
    <span class="dbox orange">your code</span>
    <span class="dbox blue">pip-installed deps</span>
    <span class="dbox purple">python:3.12-slim base</span>
  </div>
  <div class="dcap">An image is read-only layers; running it adds one thin writable layer on top.</div>
</div>

## Concrete example

```bash
docker build -t my-ai-service:v1 .        # build + tag
docker images                              # see size and tags
# REPOSITORY       TAG   SIZE
# my-ai-service    v1    340MB

docker history my-ai-service:v1            # see which layer costs what
```

Pushing to AWS ECR (the registry Dubai teams use):

```bash
aws ecr get-login-password --region me-central-1 \
  | docker login --username AWS --password-stdin 123456789.dkr.ecr.me-central-1.amazonaws.com

docker tag my-ai-service:v1 123456789.dkr.ecr.me-central-1.amazonaws.com/my-ai-service:v1
docker push 123456789.dkr.ecr.me-central-1.amazonaws.com/my-ai-service:v1
```

Note `me-central-1` — that's the AWS **UAE region**, where a Dubai team keeps images for low latency and data residency. `docker history` is your debugging tool for size: it shows the megabytes each layer added, so you can find the fat one.

## How a company uses this

A Dubai health-tech team tags every image with the **git commit SHA** (`my-service:a1b9f2c`), never relying on `latest` in production — because `latest` is a moving target and you can't tell what's actually running. ECR is set to scan each pushed image for known CVEs and to expire untagged images after 14 days so storage doesn't balloon. Because layers are shared, ten microservices built on the same `python:3.12-slim` base pull that base once per host — cutting deploy bandwidth and cold-start time significantly. When an incident hits, "which image?" is answered instantly by the SHA tag, and rolling back is just deploying the previous SHA.

## Common mistakes
- **Relying on `latest` in prod** — you can't reproduce or roll back cleanly. Tag with SHAs or versions.
- **Fat images** — installing full CUDA/PyTorch when a `-slim` base + CPU wheels would do. Use [Multi-stage](multi-stage.md) builds.
- **Assuming a rebuild changes nothing** — editing an early layer invalidates every layer after it.
- **Confusing image and container** — the image is the frozen template; the container is a running instance of it.

## Interview tip
Say: *"An image is immutable, layered, and content-addressed — that's why caching and shared bases work. In production I tag by git SHA, push to ECR, scan for CVEs, and keep images slim so cold starts and pull costs stay low."* Mentioning SHA tags over `latest` signals real deployment experience. Next: [Compose](compose.md) for running several images together.
