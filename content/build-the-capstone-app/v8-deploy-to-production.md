# v8 · Deploy to Production

**What you'll build:** take HelpDesk off `localhost` and put it on the **public internet**, so a real person on their phone can use it. Frontend on Vercel, FastAPI backend on a container host, managed Supabase Postgres + Redis, secrets in environment config, and the basics that keep it alive.

## Why this version

"Works on my machine" earns nothing. Deployed and reachable is the whole point — it's what makes this a portfolio project you can *link*, and it forces the last cluster of real-engineer skills: environment config, secrets management, CORS in production, and keeping a service healthy. This is the version that turns a repo into a product.

## The production topology

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📱 user<span class="sub">browser</span></span>
    <span class="darr">→</span>
    <span class="dbox green">▲ Vercel<span class="sub">Next.js UI</span></span>
    <span class="darr">→<span class="lbl">HTTPS</span></span>
    <span class="dbox purple">🐳 API host<span class="sub">FastAPI in a container</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">Supabase<span class="sub">Postgres + Auth</span></span>
    <span class="darr">+</span>
    <span class="dbox orange">Redis Cloud</span>
    <span class="darr">+</span>
    <span class="dbox purple">OpenAI</span>
  </div>
  <div class="dcap">Each piece hosted by a managed service. You wire them together with URLs and secrets — no servers to babysit.</div>
</div>

The choices (all have free tiers):
- **Frontend → Vercel.** Next.js's native home; `git push` deploys.
- **Backend → a container host** (Render, Railway, Fly.io, or Google Cloud Run). You containerise the FastAPI app and they run it.
- **Postgres + Auth → Supabase** (already hosted — you've used it since v6).
- **Redis → Redis Cloud / Upstash** (managed, free tier).

## Step 1 — containerise the backend

A `Dockerfile` so any host can run your API identically:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# host provides $PORT; bind to it
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

Test locally: `docker build -t helpdesk . && docker run -p 8000:8000 --env-file .env helpdesk`. If it runs in Docker, it runs on the host.

## Step 2 — secrets as environment variables

**Nothing secret is in the repo.** Every key — `OPENAI_API_KEY`, `SUPABASE_SERVICE_KEY`, `REDIS_URL` — is set in each host's dashboard as an env var, and your code reads them with `os.environ[...]`. Commit only `.env.example` listing the *names*.

## Step 3 — production CORS and URLs

Two config flips for the real world:
- **Backend CORS** must allow your real frontend origin, not `localhost:3000`:
  ```python
  allow_origins=[os.environ["FRONTEND_URL"]]   # e.g. https://helpdesk.vercel.app
  ```
- **Frontend** must call the deployed API, not localhost. Put the API base URL in a Next.js env var (`NEXT_PUBLIC_API_URL`) and use it in every fetch.

## Step 4 — deploy and connect

1. Push the frontend repo to Vercel → set `NEXT_PUBLIC_API_URL` + Supabase public keys → deploy → get `https://helpdesk.vercel.app`.
2. Push the backend to your container host → set all secrets + `FRONTEND_URL` → deploy → get `https://helpdesk-api.onrender.com`.
3. Point the frontend's `NEXT_PUBLIC_API_URL` at the backend URL, redeploy. They're now talking over HTTPS.

## Step 5 — the keep-it-alive basics

Production minimum (don't over-build, but don't skip these):
- **A `/health` endpoint** returning `{"ok": true}` so the host knows the app is alive.
- **Structured logging** of errors and per-request token cost (you already track cost — now log it).
- **A sane request timeout** on OpenAI calls so a hung upstream doesn't pile up requests.
- **Rate limiting** per user (a simple Redis counter) so one user can't run up your whole OpenAI bill.

```python
@app.get("/health")
def health():
    return {"ok": True}
```

## Make it real — required for this version

- **A public URL that works on your phone** — open it on mobile data (not your wifi), log in, chat. That's the proof.
- **No secrets in git** — scan your history; rotate anything ever committed.
- **Cold-path works end to end** — signup → login → chat → refresh → history persists → logout.
- **README with the live link + architecture diagram + a GIF.** This is the top of your portfolio.
- **Commit and `git tag v8`.** README: "v8 — deployed: Vercel + containerised FastAPI + Supabase + Redis."

## Common mistakes

- **Committing secrets** — the #1 way keys leak. Env vars only; `.env` in `.gitignore`.
- **Forgetting production CORS** — the classic "works locally, blocked in prod" bug. Allow the real origin.
- **Hardcoding `localhost` URLs** in the frontend — use an env var for the API base.
- **No rate limit** — one abusive user (or a loop bug) can run up a huge OpenAI bill overnight.
- **No health check** — the host can't tell if your app crashed, so it never restarts it.

## Interview tip

*"v8 deployed it: containerised FastAPI on a managed host, Next.js on Vercel, Supabase for Postgres+Auth, managed Redis — all wired with environment secrets, production CORS, a health check, structured cost logging, and per-user rate limiting. It's live on a public URL."* Being able to say "it's deployed, here's the link" — and describe the topology and the guardrails — is what separates a finished engineer from a tutorial-completer.

## You did it — and it's still the spine

HelpDesk is now a **real, multi-user, deployed product**: eight tagged versions, from one API call to a live app with auth, per-user durable history, caching, concurrency handling, and production ops. Put the live link at the top of your CV.

And it *still* keeps growing — the [RAG phase](../rag-architecture.md) makes it answer from real documents, and the agents phase lets it take actions. You'll be adding those capabilities to an app that's already in production, exactly like a real job.
