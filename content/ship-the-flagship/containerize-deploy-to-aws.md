# Containerize + Deploy to AWS

**What it is:** Packing your app *and its exact environment* into a single portable box (a container), then running that box on Amazon's cloud so it has a public URL and stays up without your laptop.

## Why it matters for an AI Engineer

"It works on my machine" is the phrase that gets features stuck forever. Your app depends on a specific Python version, specific library versions, specific system libraries — and the moment it runs on a different computer, one of those differs and it breaks. A **container** freezes all of that into one image that runs *identically* on your laptop, a teammate's Mac, and an AWS server. Then you need somewhere reliable to run it — cloud infra that restarts it if it crashes, gives it a stable URL, and scales it up under load. Nearly every AI Engineer job posting in Dubai lists "Docker" and one of "AWS/GCP/Azure." This step is where you earn those two lines on your resume for real.

## The mechanism / how it works

**Containers (Docker).** A `Dockerfile` is a recipe: start from a base OS image, copy your code in, install your dependencies, and declare the command that runs the app. `docker build` executes the recipe once and produces an **image** — a frozen, layered snapshot. `docker run` starts a live **container** from that image. Because the image bakes in Python and every library at pinned versions, there's nothing left to differ between environments.

**Registry (ECR).** The built image lives in Amazon's **Elastic Container Registry** — think "GitHub, but for container images." Your compute pulls the image from ECR to run it.

**Where it runs.** For a single flagship service you have three realistic AWS options, in rising order of control:

- **App Runner** — you hand it an image, it gives you an HTTPS URL, autoscaling, and TLS. Least ops. Best for a flagship.
- **ECS Fargate** — you define a "task" (this image, this CPU/memory), AWS runs the containers serverlessly; you add a load balancer for the URL. More control, industry-standard.
- **EKS (Kubernetes)** — full orchestration. Overkill for one service; know the name for interviews.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">📝 Dockerfile</span>
    <span class="darr">↓<span class="lbl">docker build</span></span>
    <span class="dbox orange">📦 image (frozen app+deps)</span>
    <span class="darr">↓<span class="lbl">push</span></span>
    <span class="dbox blue">🗄️ ECR registry</span>
    <span class="darr">↓<span class="lbl">pull + run</span></span>
    <span class="dbox purple">☁️ App Runner / Fargate</span>
    <span class="darr">↓</span>
    <span class="dbox green">🌐 public HTTPS URL</span>
  </div>
  <div class="dcap">Build once, store in a registry, run on managed AWS compute with a real URL.</div>
</div>

## Concrete example

A production-grade `Dockerfile` for the FastAPI app from the [previous step](wrap-in-fastapi-service.md):

```dockerfile
FROM python:3.12-slim

WORKDIR /app
# Install deps first so this layer caches when only code changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Gunicorn manages Uvicorn workers; -w 4 = 4 workers
EXPOSE 8000
CMD ["gunicorn", "app:app", "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "4", "-b", "0.0.0.0:8000"]
```

Build, push to ECR, deploy — the whole path:

```bash
# 1. Build the image
docker build -t flagship .

# 2. Log in + push to ECR (ACCOUNT + REGION are yours)
aws ecr get-login-password --region me-central-1 \
  | docker login --username AWS --password-stdin \
    ACCOUNT.dkr.ecr.me-central-1.amazonaws.com
docker tag flagship ACCOUNT.dkr.ecr.me-central-1.amazonaws.com/flagship:latest
docker push ACCOUNT.dkr.ecr.me-central-1.amazonaws.com/flagship:latest

# 3. Point App Runner at the image (once) → it returns an HTTPS URL
aws apprunner create-service --service-name flagship \
  --source-configuration '{"ImageRepository":{
     "ImageIdentifier":"ACCOUNT.dkr.ecr.me-central-1.amazonaws.com/flagship:latest",
     "ImageConfiguration":{"Port":"8000"},"ImageRepositoryType":"ECR"}}'
```

Note `me-central-1` — that's **AWS's UAE (Dubai) region**, which matters for a Dubai-targeted flagship: lower latency to local users and data residency inside the country. Set `OPENAI_API_KEY` as an App Runner environment variable (or better, pull it from AWS Secrets Manager) — **never bake secrets into the image**, since anyone who pulls it can read them.

## How a company uses this

At scale the same pieces gain sharp edges. Teams pin `python:3.12-slim` (not `latest`) so a rebuild six months later produces the *same* image — reproducibility is the whole point. **Image size is money and speed:** a naive image with build tools and CUDA can balloon to 3–5 GB, making cold starts and deploys slow; a slim base plus multi-stage builds cuts that to ~300–500 MB. The `/health` endpoint from the last step is wired into the load balancer's health check — a container that fails it gets killed and replaced automatically, which is how the service "heals" at 3am with nobody watching. **Autoscaling** is configured on a metric like concurrent requests: a support bot might idle at 2 containers and burst to 20 during business hours, then scale back to save cost overnight. Deploys are **rolling** — new containers come up and pass health checks *before* old ones drain, so there's zero downtime.

## Common mistakes

- **Baking secrets (API keys) into the image.** Anyone with the image reads them. Use env vars or Secrets Manager.
- **Using the `latest` tag for the base image.** Your builds stop being reproducible; a surprise upgrade breaks prod.
- **Copying code before installing deps.** Every code change busts the dependency layer cache and reinstalls everything — slow builds. Copy `requirements.txt` and install *first*.
- **No health check.** AWS can't tell a hung container from a healthy one, so it never restarts the dead ones.
- **Reaching for EKS/Kubernetes for one service.** Huge ops burden for zero benefit. App Runner or Fargate is right for a flagship.

## Interview tip

Say: *"I containerize with a slim pinned base for reproducibility, install dependencies in their own cached layer, and keep secrets out of the image via env vars or Secrets Manager. For a single service I deploy to App Runner or ECS Fargate — not Kubernetes, which is overkill — with the container's health endpoint driving the load balancer's checks so dead containers self-heal via rolling deploys."* Mentioning **me-central-1** for a Dubai app quietly signals you think about latency and data residency.
