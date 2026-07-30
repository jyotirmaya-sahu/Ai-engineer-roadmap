# Env vars & .env

**What it is:** An environment variable is a setting stored outside your code that your program can read at runtime — like an API key or a database URL. A `.env` file is a simple text file that holds those settings for local development.

## Why it matters for an AI Engineer

Your AI app needs secrets and config: an OpenAI API key, a database password, a model name, a debug flag. You must **never** write these directly into your code. If you do, they end up on GitHub for the world to steal, and you cannot change them without editing code. Environment variables solve both problems: secrets stay out of your source, and the same code runs in dev, staging, and production just by changing the values around it. Every real AI service is configured this way. Get this right and you avoid the single most common — and most expensive — junior mistake.

## What is an environment variable

It is a named value that lives in your operating system's environment, not in your files. Your program reads it when it runs.

```bash
# set one for the current terminal session
export OPENAI_API_KEY="sk-abc123"

# check it
echo $OPENAI_API_KEY
```

Set this way it vanishes when you close the terminal. That is fine for a quick test, but tedious for real projects — which is why we use a `.env` file.

## Reading env vars in Python

Python reads environment variables through `os.environ`:

```python
import os

# raises KeyError if missing — good for required secrets
api_key = os.environ["OPENAI_API_KEY"]

# returns None (or a default) if missing — good for optional config
model = os.environ.get("MODEL_NAME", "gpt-4o-mini")
debug = os.environ.get("DEBUG", "false") == "true"
```

Use `os.environ["X"]` when the value is required — you *want* a loud crash if the key is missing, not a silent failure later. Use `.get()` with a default for optional settings.

## The .env file + python-dotenv

Typing `export` for ten variables every session is painful. Instead, put them in a `.env` file at your project root:

```
# .env
OPENAI_API_KEY=sk-abc123
DATABASE_URL=postgresql://localhost/appdb
MODEL_NAME=gpt-4o-mini
DEBUG=true
```

Then load it automatically with the `python-dotenv` library:

```bash
pip install python-dotenv
```

```python
import os
from dotenv import load_dotenv

load_dotenv()                 # reads .env into os.environ

api_key = os.environ["OPENAI_API_KEY"]
model = os.environ.get("MODEL_NAME", "gpt-4o-mini")
```

`load_dotenv()` reads the file and loads each line into `os.environ`. Now your code reads from `os.environ` exactly the same way whether the values came from a `.env` file locally or from real environment variables in production. Same code, different environments — that is the whole point.

## NEVER commit .env

This is the rule that matters most. Your `.env` holds secrets. It must never go into Git.

```
# .gitignore
.env
```

Instead, commit a **template** with the keys but no real values, so teammates know what to fill in:

```
# .env.example  (SAFE to commit — no real secrets)
OPENAI_API_KEY=
DATABASE_URL=
MODEL_NAME=gpt-4o-mini
DEBUG=false
```

A new engineer copies it and fills in their own values:

```bash
cp .env.example .env    # then edit .env with real keys
```

## A real company example

A Dubai AI startup runs the exact same chatbot code in three places. Locally, each engineer has a `.env` with a test API key and a local database. In staging and production, the platform (a cloud host) injects the real keys as environment variables — no `.env` file on the server at all. Because the code only ever reads `os.environ`, nothing changes between environments except the values. The repo ships a `.env.example` so new hires are running in minutes, and `.env` is gitignored so no real key has ever touched GitHub.

## Common mistakes and gotchas

- **Committing `.env`.** The classic leak. Add it to `.gitignore` on day one, before your first commit.
- **Hardcoding keys "just for now."** They get committed and forgotten. Never do it, not even temporarily.
- **Forgetting `load_dotenv()`.** Then `os.environ["KEY"]` is empty and you get a confusing crash. Call it before you read.
- **Type confusion.** Env vars are always strings. `"false"` is a non-empty string and is truthy. Compare explicitly: `os.environ.get("DEBUG") == "true"`.
- **No `.env.example`.** Teammates cannot tell which variables the app needs. Always ship a template.

## Interview / practical tip

When asked how you handle configuration and secrets, say: "config and secrets live in environment variables, loaded from a gitignored `.env` locally via python-dotenv and injected by the platform in production; I commit a `.env.example` template so the code never contains a real key." That one sentence signals you will not leak the company's API keys — a genuine, costly worry that hiring managers screen for.
