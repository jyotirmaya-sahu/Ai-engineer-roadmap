# Logging

**The one-line idea:** Logging is `print()` grown up — a proper way to record what your program is doing, with severity levels, timestamps, and control over where messages go, so you can debug production without changing code.

## Why this matters for an AI Engineer

LLM apps fail in ways you can't reproduce locally: a weird user prompt, an API timeout, a malformed model response at 2am. You can't `print()` your way through that — you need durable logs you can search later. Which prompt was sent? How long did the call take? What did the model return before it crashed? Good logging is the foundation of **observability**, and it feeds tools like LangSmith/Langfuse that trace LLM calls. Every production AI service logs; none rely on `print`.

## Why not just `print()`?

`print()` seems fine until it isn't:

- **No severity.** You can't tell an info message from a crash; you can't filter.
- **No easy off switch.** To quiet it, you delete lines (then need them back next week).
- **Nowhere to go.** It only hits the console; you can't route it to a file or log service.
- **No context.** No timestamp, no module name, no request ID.

Logging solves all four. Same effort to write, vastly more useful in production.

## Levels — the core concept

Every log message has a **severity level**. You set a threshold; anything below it is hidden. This lets you run *quiet* in production (warnings and up) but *verbose* while debugging — with **no code change**, just a config line.

| Level | Use it for |
|---|---|
| `DEBUG` | detailed dev info (the full prompt, token counts) |
| `INFO` | normal events ("LLM call started", "request handled") |
| `WARNING` | something odd but survivable ("retrying after rate limit") |
| `ERROR` | a real failure ("LLM call failed after 3 retries") |
| `CRITICAL` | the app can't continue |

## Basic setup

```python
import logging

logging.basicConfig(
    level=logging.INFO,     # show INFO and above; hides DEBUG
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)   # one logger per module, named automatically

logger.debug("full prompt: ...")       # hidden (below INFO)
logger.info("calling LLM")             # shown
logger.warning("rate limited, retrying")
logger.error("LLM call failed")
# 2026-07-30 10:22:01 [INFO] myapp: calling LLM
```

Change `level=logging.DEBUG` and suddenly the debug lines appear — flip verbosity for an incident without editing your logic. Use `getLogger(__name__)` so each module's logs are labeled with where they came from.

## Logging exceptions properly

Inside an `except`, use `logger.exception()` — it logs your message *plus the full traceback*, so you can actually diagnose the failure:

```python
try:
    response = call_llm(prompt)
except Exception:
    logger.exception("LLM call failed")   # includes the stack trace automatically
    raise
```

Never do a bare `except: pass` that swallows errors silently — that's how bugs hide for weeks.

## Structured logging — the production upgrade

Plain text logs are readable but hard to *search and analyze* at scale. **Structured logging** emits each log as JSON with named fields, so a log platform (Datadog, CloudWatch, Grafana) can filter and aggregate — "show all LLM calls over 5 seconds," "count errors by model."

```python
import logging, json

# simplest structured approach: log a JSON string with consistent fields
def log_llm_call(logger, model, tokens, latency_ms, status):
    logger.info(json.dumps({
        "event": "llm_call",
        "model": model,
        "tokens": tokens,
        "latency_ms": latency_ms,
        "status": status,
    }))

log_llm_call(logger, "gpt-5", 1200, 830, "ok")
# {"event": "llm_call", "model": "gpt-5", "tokens": 1200, "latency_ms": 830, "status": "ok"}
```

Now every call is a queryable record. (Libraries like `structlog` make this ergonomic, but the idea — consistent JSON fields — is what matters.) This is the raw material of LLM observability: track latency, token cost, and error rates per model over time.

## Real world: how a company uses this

> **A Dubai bank's** LLM support assistant logs a structured JSON record for every model call: prompt length, token count, latency, cost, and outcome — never the customer's raw data (compliance). These flow to their monitoring platform, where a dashboard shows p95 latency and error rate per model in real time, and an alert fires if failures spike. When a user reports a bad answer, engineers search logs by request ID and see the exact prompt sent and response received — reconstructing the incident without reproducing it. During a rate-limit storm, they flipped the log level to `DEBUG` via config (no redeploy) to capture full detail, then flipped it back. That's observability logging buys you.

## Common mistakes

- Using `print()` in production code — no levels, no routing, no timestamps.
- **Logging sensitive data** (passwords, PII, full customer prompts) — a compliance and security violation; log IDs and metadata, not secrets.
- Bare `except: pass` that hides errors — always at least `logger.exception(...)`.
- Configuring logging inside a library module instead of the app entry point — spams config; libraries should just `getLogger(__name__)` and let the app configure handlers.
- Everything at one level (all `INFO` or all `DEBUG`) — defeats filtering. Match level to severity.

## Interview tip

Say: *"I use the `logging` module with per-module loggers via `getLogger(__name__)`, set levels so production runs quiet but I can flip to DEBUG without a redeploy, and emit structured JSON logs — model, tokens, latency, status — so they're queryable in our observability platform. I never log PII, and I use `logger.exception` to capture tracebacks."* Tying logging to *observability and cost/latency tracking* (not just "instead of print") is the production-minded answer.
