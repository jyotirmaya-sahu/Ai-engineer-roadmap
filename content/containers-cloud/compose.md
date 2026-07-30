# Compose

**What it is:** Docker Compose is a single YAML file that defines and runs several containers together — your app plus its database, cache, and vector store — with one command.

## Why it matters for an AI Engineer

Real AI apps are never one container. A RAG service needs the API, a **vector database** (Qdrant, Weaviate), often **Redis** for caching, maybe **Postgres** for metadata. Running each by hand with the right ports, networks, and env vars is error-prone. Compose declares the whole stack once so you (and every teammate) get an identical local environment with `docker compose up`. It's how you develop and test a multi-service AI system on your laptop before it ever touches the cloud.

## How it works

You write a `compose.yaml` listing **services** (each is a container). Compose then:

- **Builds or pulls** each service's image.
- Puts them all on a **shared private network** where they reach each other **by service name** as the hostname. Your API connects to the vector DB at `http://qdrant:6333` — no IP juggling. This is the feature people underuse.
- Maps **ports** to your host (`8000:8000` → localhost:8000 hits the container's 8000).
- Injects **environment variables** and mounts **volumes** (folders that survive container restarts — critical so your vector index isn't wiped every time).
- Manages **startup order** with `depends_on`.

One command brings the whole stack up; one tears it down. Compose is for **local dev and small single-host deployments** — for real multi-machine cloud scaling you graduate to [ECS / App Runner](ecs-app-runner.md).

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🤖 api<span class="sub">:8000</span></span>
    <span class="darr">→<span class="lbl">http://qdrant:6333</span></span>
    <span class="dbox blue">🗄️ qdrant<span class="sub">vector DB</span></span>
    <span class="dbox blue">⚡ redis<span class="sub">cache</span></span>
  </div>
  <div class="dcap">One private network — services find each other by name, no IPs. One `up` starts all three.</div>
</div>

## Concrete example

A RAG stack: FastAPI app + Qdrant vector DB + Redis cache.

```yaml
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - QDRANT_URL=http://qdrant:6333   # reach qdrant by service name
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env                             # OPENAI_API_KEY etc.
    depends_on:
      - qdrant
      - redis

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage      # index survives restarts

  redis:
    image: redis:7-alpine

volumes:
  qdrant_data:
```

```bash
docker compose up --build     # start everything
docker compose logs -f api    # tail the API logs
docker compose down           # stop (add -v to wipe volumes too)
```

Inside `api`, the code connects with `QdrantClient(url=os.environ["QDRANT_URL"])`. The **volume** is what stops you re-embedding your whole corpus after every restart.

## How a company uses this

A Dubai startup uses one `compose.yaml` as the team's dev environment: a new engineer clones the repo, runs `docker compose up`, and in two minutes has the API, vector DB, and cache running identically to everyone else — no "install Postgres locally" onboarding docs. The same file (with a different override) runs their **staging** environment on a single EC2 box, which is cheaper than full ECS while traffic is low. Compose also underpins their integration tests in CI: spin up the real stack, run tests against it, tear it down — catching wiring bugs (wrong service name, missing env var) before they reach production.

## Common mistakes
- **Forgetting volumes** — your vector index or database vanishes on every `down`/restart.
- **Using `localhost` between services** — inside the network you must use the *service name*, not `localhost`.
- **Assuming Compose scales to production** — it's single-host; use ECS/Kubernetes for real scale.
- **Hardcoding secrets in the YAML** — use `env_file` and keep `.env` out of git. See [Env & secrets](env-secrets.md).

## Interview tip
Say: *"For local dev I use Compose to run the API, vector DB, and cache on one private network where they reach each other by service name, with volumes so data persists. It gives every engineer an identical environment and powers integration tests — but for production scale I move to ECS, since Compose is single-host."* Knowing the boundary of Compose is what separates hobbyist from engineer. Next: [Multi-stage](multi-stage.md) builds.
