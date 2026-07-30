# Secrets Management

**What it is:** Secrets management is how you store, use, and protect sensitive values — API keys, passwords, tokens — so they power your app without ever leaking.

## Why it matters for an AI Engineer

Your AI app is full of secrets. An OpenAI or Anthropic API key. A database password. A cloud access token. These are money and access: a leaked OpenAI key can be abused to run up thousands of dollars in charges overnight, and a leaked database credential can expose customer data. Handling secrets correctly is a core professional responsibility. Get it wrong once in public and the damage is instant and real. Employers in Dubai — especially in finance and health — take this seriously, so proving you understand it sets you apart.

## Rule one: never hardcode secrets

Do not write a secret directly in your code.

```python
# NEVER do this
client = OpenAI(api_key="<never-put-a-real-key-here>")
```

Why it is dangerous:
- It gets committed to Git and pushed to GitHub, where bots scrape it within minutes.
- Everyone with repo access sees it.
- To change the key, you must edit and redeploy code.
- It ends up in logs, screenshots, and shared files.

Instead, read it from the environment:

```python
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
```

The code says *what* it needs, never *what the value is*.

## .env vs secret managers

There are two levels, for two situations.

| | `.env` file | Secret manager |
|---|---|---|
| Where | On your laptop | A dedicated cloud service |
| Good for | Local development | Staging & production |
| Access control | None — just a file | Per-user, per-role, audited |
| Rotation | Manual edit | Central, sometimes automatic |
| Examples | plain `.env` | AWS Secrets Manager, Google Secret Manager, HashiCorp Vault, Doppler |

**`.env`** is fine for local dev: keep it gitignored, never share it. **Secret managers** are for real deployments. They store secrets encrypted, control exactly who and what can read each one, log every access, and let you rotate a key in one place. Your app asks the manager for the secret at startup (or the platform injects it as an environment variable), so no secret sits in a file on the server.

The good news: your code does not change between them. It always reads `os.environ["OPENAI_API_KEY"]`. Locally that comes from `.env`; in production it comes from the secret manager. Same code, safer source.

## Rotating keys

**Rotating** means replacing a secret with a new one and disabling the old. Do it when:
- A key may have leaked (committed by mistake, shared in chat, left in a log).
- An employee with access leaves.
- On a regular schedule, as good hygiene.

The flow: create a new key in the provider's dashboard, update it in your secret manager (or `.env`), deploy, then delete the old key. Because your app reads the value from one place, rotation is a config change, not a code change. This is exactly why hardcoding is so bad — a hardcoded key cannot be rotated without editing and redeploying code everywhere it appears.

## Server-only vs client-exposed secrets

This one catches people badly. A secret is only secret if it stays on a server you control.

- **Backend/server code** is private. Secrets here are safe.
- **Frontend/browser code** ships to the user's machine. Anyone can open dev tools and read every value in it. A secret in frontend JavaScript is **not secret** — it is published.

So: never put your OpenAI key in a React app or any browser-side code. Instead, keep the key on your backend, and have the browser call *your* server, which then calls OpenAI with the key. The user never sees it.

```
Browser  →  your backend (holds the key)  →  OpenAI API
```

If your build tool exposes a variable to the browser (for example a `NEXT_PUBLIC_` or `VITE_` prefix), treat it as fully public. Only truly public values (like a public URL) belong there.

## A real company example

A Dubai fintech runs an LLM feature that reads customer transactions. The OpenAI key and database password never appear in any file — they live in AWS Secrets Manager. Production servers fetch them at boot; every access is logged. When a contractor's laptop is lost, the security team rotates the affected keys in the manager and redeploys — no code touched, old keys dead in minutes. The web frontend holds zero secrets: it calls the company's own backend, which holds the key and talks to OpenAI. Because the whole system reads secrets from one controlled place, a lost laptop is a five-minute rotation, not a breach.

## Common mistakes and gotchas

- **Hardcoding a key "temporarily."** It gets committed and forgotten. Never, not once.
- **Committing `.env`.** Gitignore it before your first commit. If a key ever lands in Git, rotate it immediately — deleting the file does not erase it from history.
- **Putting a secret in frontend code.** It ships to every user. Keep secrets server-side and proxy the call.
- **Never rotating.** Old, possibly-leaked keys stay valid for years. Rotate on schedule and after any exposure.
- **Sharing keys in Slack or chat.** Chat gets searched, logged, and screenshotted. Use the secret manager's sharing, or share a template with blanks.

## Interview / practical tip

Have a crisp answer ready: "Secrets never touch the code — `.env` (gitignored) for local dev, a secret manager like AWS Secrets Manager in production, both read via `os.environ` so the code is identical. Frontend gets no secrets; the browser calls my backend, which holds the key. If a key leaks, I rotate it centrally." Naming rotation and the server-only rule shows senior-level judgment — this is one of the fastest ways for a junior candidate to sound like someone who has shipped real, secure software.
