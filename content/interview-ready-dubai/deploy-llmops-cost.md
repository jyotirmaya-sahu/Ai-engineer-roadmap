# Deploy / LLMOps / Cost

**What it is:** the drill for the single most-asked Dubai AI Engineer topic — how you take an LLM app from your laptop to a running, monitored, cost-controlled production service.

## Why it matters for an AI Engineer

Deployment appears in **~82% of Dubai AI Engineer JDs** — more than any other skill. Teams don't need someone who can prompt a model in a notebook; they need someone who can serve it reliably, watch it, and stop it from bankrupting the company. LLMs make this uniquely hard: they're **non-deterministic**, **slow** (seconds, not ms), and **priced per token**, so classic web-ops instincts don't fully transfer. Nailing this drill is the difference between "junior who plays with AI" and "engineer who ships it."

## The mechanism: the four pillars of shipping an LLM app

**1. Serving.** Your app is an API in front of the model. You either call a **hosted API** (OpenAI/Anthropic/Bedrock) or **self-host** an open model (vLLM behind a GPU). The key production concern is **concurrency + timeouts**: LLM calls take 1–10s, so you use async I/O so one slow call doesn't block others, and you set hard timeouts + retries with backoff.

**2. Observability.** Because outputs are non-deterministic, you *must* log every request: prompt, response, token counts, latency, cost, and model version. **Tracing** tools (LangSmith, Langfuse, Arize) show the full chain of a request — which retrieval, which prompt, which tool call. Without traces, "the answer was wrong yesterday" is undebuggable.

**3. Cost control.** This is the LLMOps skill Dubai teams care about most. Levers: **caching** (identical/similar prompts served from cache — prompt caching cuts input cost up to 90%), **model routing** (cheap model for easy queries, expensive model only when needed), **max-token caps**, and **truncating context** aggressively. You track **cost-per-request** as a first-class metric.

**4. Evaluation & guardrails in the loop.** You gate deploys on an eval suite (see [RAG & retrieval eval](rag-retrieval-eval.md)), and you run **guardrails** in production — input filtering (prompt-injection, PII) and output checks — before responses reach the user.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">👤 User request</span>
    <span class="darr">↓<span class="lbl">guardrail: input filter</span></span>
    <span class="dbox orange">🧠 App: retrieve / route / cache-check</span>
    <span class="darr">↓<span class="lbl">async call + timeout</span></span>
    <span class="dbox purple">🤖 LLM (hosted or self-hosted)</span>
    <span class="darr">↓<span class="lbl">log tokens, cost, latency</span></span>
    <span class="dbox blue">📊 Trace + metrics store</span>
    <span class="darr">↓<span class="lbl">guardrail: output check</span></span>
    <span class="dbox green">✅ Response</span>
  </div>
  <div class="dcap">Every LLM request is traced, cost-tracked, and guardrailed both directions.</div>
</div>

## Concrete example: cost-tracking + caching wrapper

```python
import hashlib, functools
from anthropic import Anthropic
client = Anthropic()

PRICE = {"in": 3/1_000_000, "out": 15/1_000_000}   # $/token, Sonnet-tier
cache, spend = {}, {"usd": 0.0}

def ask(prompt: str, max_tokens=512):
    key = hashlib.sha256(prompt.encode()).hexdigest()
    if key in cache:                       # exact-match cache = free
        return cache[key]
    r = client.messages.create(model="claude-sonnet-4-5",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}])
    cost = (r.usage.input_tokens * PRICE["in"]
            + r.usage.output_tokens * PRICE["out"])
    spend["usd"] += cost                   # cost-per-request metric
    print(f"tokens={r.usage.input_tokens}/{r.usage.output_tokens} "
          f"cost=${cost:.5f} total=${spend['usd']:.4f}")
    cache[key] = r.content[0].text
    return cache[key]
```

In an interview, walking through *exactly this* — cache check, token accounting, cost log — proves you think about production, not demos.

## How a company uses this (production lens)

A Dubai SaaS running an LLM support assistant at ~50k requests/day self-hosts nothing — they use Bedrock for data-residency reasons (a real UAE compliance driver). Their LLMOps stack: **async FastAPI** service, **Langfuse** tracing on 100% of traffic, **prompt caching** on the system prompt (a 4k-token instruction block cached, cutting input cost ~70%), and a **router** sending ~80% of easy FAQs to a Haiku-tier model and only hard tickets to Sonnet. Result: blended cost ~**$0.004/request** and **p95 latency ~2.8s**. A cost alarm fires if daily spend exceeds $250 — it caught a prompt-injection loop that was re-triggering the agent 30× per request.

## Common mistakes
- **Treating it like a normal web deploy.** No token logging, no cost metric, no traces — then "it got expensive/slow" is unexplainable.
- **No caching or routing.** Sending every query to the biggest model is the #1 cost mistake.
- **Synchronous calls.** Blocking on 5s LLM calls tanks throughput; use async.
- **Skipping output guardrails.** A non-deterministic model *will* eventually emit something harmful or leak context.

## Interview tip
When asked "how would you deploy this?", cover the four pillars in order: *serving (async + timeouts), observability (trace every request), cost control (cache + route + token caps, track cost/request), and eval/guardrails gating the deploy.* Then drop a real number: *"I'd target sub-3s p95 and track blended cost-per-request as a KPI."* Numbers + the four-pillar structure is what wins this round. See [Cost / latency estimation](cost-latency-estimation.md).
