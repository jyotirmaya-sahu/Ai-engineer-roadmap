# Env & secrets

**What it is:** Environment variables let you inject configuration into a container from outside, and secrets management keeps sensitive values — API keys, DB passwords — out of your image and code entirely.

## Why it matters for an AI Engineer

Your app needs an `OPENAI_API_KEY`, a Bedrock role, a database URL. If you hardcode these or bake them into the image, you've leaked them: image layers are permanent, and anyone who pulls the image (or reads your git history) has your keys. Leaked LLM API keys get abused within hours — bots rack up thousands of dollars in token charges. In a Dubai enterprise, mishandling credentials is also a compliance failure. Doing this right is table stakes for any real deployment.

## How it works

**Environment variables** are key-value pairs the OS hands your process. The same image reads `DATABASE_URL` from the environment, so the identical image runs against a local DB in dev and a production DB in prod — only the injected value changes. That's the whole point of the "config outside the image" rule (from the twelve-factor app methodology).

**Where values come from, worst to best:**

1. **Hardcoded in code / `ENV` in Dockerfile** — never. It's in the image forever.
2. **A `.env` file** — fine for *local dev only*, and it must be in `.gitignore`. Docker reads it via `--env-file` or Compose's `env_file`.
3. **A secrets manager** — the production answer. **AWS Secrets Manager** (or SSM Parameter Store) stores the value encrypted; your container fetches it at startup, authenticated by its [IAM](s3-iam.md) role. The secret never touches the image, git, or logs.

The mental model: the **image is public-safe** (could be leaked and nothing sensitive spills), and **secrets are injected at run time** by the platform.

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">🔐 Secrets Manager<span class="sub">encrypted</span></span>
    <span class="darr">→<span class="lbl">IAM-authed fetch at startup</span></span>
    <span class="dbox orange">env var in container</span>
    <span class="darr">→</span>
    <span class="dbox green">🤖 app reads os.environ</span>
  </div>
  <div class="dcap">Secrets live in the vault, get injected as env vars at run time — never baked into the image.</div>
</div>

## Concrete example

App code stays trivial — it just reads the environment:

```python
import os
api_key = os.environ["OPENAI_API_KEY"]   # fails loudly if missing — good
```

Local dev with a git-ignored `.env`:

```bash
# .env  (add to .gitignore!)
OPENAI_API_KEY=sk-...
DATABASE_URL=postgres://localhost/dev

docker run --env-file .env my-ai-service
```

Production on AWS — fetch from Secrets Manager at startup:

```python
import boto3, json, os
sm = boto3.client("secretsmanager", region_name="me-central-1")
secret = json.loads(sm.get_secret_value(SecretId="prod/ai-service")["SecretString"])
os.environ.update(secret)   # now os.environ["OPENAI_API_KEY"] is set
```

On ECS you can skip even this: the task definition maps a Secrets Manager ARN straight into an env var, and ECS injects it — no boto3 code needed.

## How a company uses this

A Dubai fintech stores every credential in AWS Secrets Manager, encrypted with KMS. Each ECS task runs under an IAM role scoped to read *only* its own secret path (`prod/ai-service/*`). Keys are **rotated automatically every 90 days** — Secrets Manager updates the value and services pick it up on next restart, no code change. Nothing sensitive appears in the Docker image, the git repo, or CloudWatch logs (they scrub for key patterns). When an engineer leaves, no shared password needs changing because no human ever held the raw key — the role did.

## Common mistakes
- **Committing `.env` to git** — the #1 leak. Add it to `.gitignore` *before* the first commit.
- **`ENV API_KEY=...` in the Dockerfile** — permanently visible in `docker history`.
- **`print()`-ing config or logging the whole environment** — secrets end up in log aggregators.
- **One shared key everywhere** — can't rotate or revoke per-service. Scope secrets and use IAM.
- **`.env` in production** — fine locally, but prod should pull from a managed vault.

## Interview tip
Say: *"Config comes from environment variables so one image runs in every environment. Secrets never touch the image or git — locally I use a git-ignored .env, and in production AWS Secrets Manager injects them into the container at startup via the task's IAM role, with automatic rotation."* That answer signals you won't leak the company's keys. Next group: [Bedrock](bedrock.md) and AWS.
