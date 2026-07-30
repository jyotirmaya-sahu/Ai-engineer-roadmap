# Python for AI

**The one-line idea:** every AI tool you'll touch — OpenAI, LangChain, FastAPI, PyTorch — is a Python library. Python is the *glue* language of AI. You don't need to be a computer-scientist; you need to be fluent enough to wire libraries together, handle errors, and ship clean, testable code.

## Why it matters for an AI Engineer

Interviewers rarely ask "reverse a linked list." They hand you a task like *"call this LLM API, retry on failure, parse the JSON, and expose it as an endpoint."* That's 90% Python plumbing and 10% AI. Weak Python is the most common reason strong "prompt people" fail AI Engineer interviews.

## The parts that actually come up daily

### 1. Async / await — because AI is I/O-bound
An LLM call takes 2–20 seconds, but your CPU sits idle waiting. `async` lets you fire many calls at once instead of one-by-one.

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

sem = asyncio.Semaphore(10)   # cap concurrency so you don't trip rate limits

async def summarize(doc: str) -> str:
    async with sem:
        resp = await client.chat.completions.create(
            model="gpt-5.4-mini",   # any current small model; names churn fast
            messages=[{"role": "user", "content": f"Summarize: {doc}"}],
        )
    return resp.choices[0].message.content

async def main(docs: list[str]) -> list[str]:
    # 100 docs summarized concurrently (10 at a time), not sequentially
    return await asyncio.gather(*(summarize(d) for d in docs))
```

Sequential: 100 docs × 3s = **5 minutes**. Concurrent: **~30 seconds** (10 at a time). Same code, one keyword. Without the `Semaphore` you'd fire all 100 at once and instantly hit a rate limit — real batching always caps concurrency.

### 2. Type hints + Pydantic — because AI outputs are messy
LLMs return free text. You force structure with **Pydantic** models (this is also how FastAPI and "structured outputs" work under the hood).

```python
from pydantic import BaseModel

class Ticket(BaseModel):
    category: str
    urgency: int          # 1–5
    needs_human: bool

# Parsing/validation is automatic; bad data raises a clear error
t = Ticket(category="billing", urgency=4, needs_human=False)
```

### 3. Error handling + retries — because APIs fail
Rate limits and timeouts are *normal*, not exceptional. Production code assumes failure.

```python
import time
from openai import RateLimitError, APITimeoutError, InternalServerError

# Only retry TRANSIENT errors (429 / timeout / 5xx). Never retry a 400 or
# auth error — those fail the same way every time; retrying just wastes money.
TRANSIENT = (RateLimitError, APITimeoutError, InternalServerError)

def call_with_retry(fn, tries=3):
    for i in range(tries):
        try:
            return fn()
        except TRANSIENT:
            if i == tries - 1:
                raise
            time.sleep(2 ** i)   # 1s, 2s, 4s backoff
```

## The full toolkit to be fluent in

| Area | What to know | Why |
|---|---|---|
| Core | comprehensions, generators, decorators, context managers | reading/writing real library code |
| OOP | classes, dataclasses, dunder methods | LangChain/Pydantic are OOP-heavy |
| Packaging | venv, pip, pyproject | reproducible environments |
| Quality | pytest, logging, ruff | what "production-grade" means |
| Data | NumPy, Pandas, httpx | embeddings are NumPy arrays; APIs are HTTP |

## Real world: how a company uses this

> **Careem (Dubai) / any startup:** an AI Engineer builds a support-ticket classifier. Python `httpx` calls the LLM, `asyncio` batches 500 nightly tickets, **Pydantic** validates the JSON, `pytest` guards the parsing logic, and `logging` ships traces to their observability stack. Zero "machine learning" — pure Python engineering around a model.

## Interview tip
Be able to explain **why async matters for LLMs** (I/O-bound, not CPU-bound) and **why you validate model output with Pydantic** (LLMs hallucinate structure). These two answers signal "engineer," not "notebook user."
