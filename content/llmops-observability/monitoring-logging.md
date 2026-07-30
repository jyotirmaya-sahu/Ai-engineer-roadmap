# Monitoring & logging

**What it is:** logging is recording *what happened* in a structured, queryable way; monitoring is watching live *aggregate* signals and firing alerts when something goes wrong.

## Why it matters for an AI Engineer

[Tracing](/llmops-observability/tracing) shows you one request in depth. Monitoring & logging is the other half: the *bird's-eye* view over all requests. It answers "is the whole system healthy right now?" and "when did error rate spike?" — and it's what pages you at 3am *before* the customer tweets. An AI Engineer who ships without monitoring finds out about outages from users. With it, an alert fires the moment the LLM provider starts throwing 429s, and you failover before anyone notices. This is table-stakes production hygiene, and it's exactly what "deployment" in a Dubai JD really means.

## The mechanism — how it works

Two distinct layers, often confused:

**Structured logging** = emit events as JSON key-value records, not free-text prose. `logger.info("call done", model="gpt-4o-mini", latency_ms=830, tokens=1380, status="ok", user_id="u_42")` is searchable; `print("call done in 830ms")` is not. Structured logs go to a store (Langfuse, or CloudWatch/Datadog/Loki) where you can query "all events where `status='error'` in the last hour."

**Monitoring** sits on top and tracks **metrics** — numbers aggregated over time. The classic LLM-app metrics map to the "four golden signals":

<div class="diagram">
  <div class="flow">
    <span class="dbox blue">📥 traffic<span class="sub">requests/sec</span></span>
    <span class="dbox orange">⏱️ latency<span class="sub">p50 / p95 / p99</span></span>
    <span class="dbox purple">❌ errors<span class="sub">rate of 4xx/5xx/timeouts</span></span>
    <span class="dbox yellow">🔥 saturation<span class="sub">rate limits, queue depth</span></span>
  </div>
  <div class="dcap">The four golden signals — plus LLM-specific ones: tokens/req, cost/req, hallucination/thumbs-down rate.</div>
</div>

Monitor **percentiles, not averages**. Average latency of 900ms can hide a p99 of 12 seconds — and it's the p99 users rage-quit on. LLM apps add domain metrics: tokens per request, cost per request, and quality signals (see [online evaluation](/llmops-observability/online-evaluation)). An **alert** is a rule on a metric: "if error rate > 5% for 3 minutes, page on-call."

## Concrete example

```python
import structlog, time
log = structlog.get_logger()

def call_llm(user_id, prompt):
    t0 = time.perf_counter()
    try:
        resp = client.chat.completions.create(model="gpt-4o-mini",
                    messages=[{"role":"user","content":prompt}])
        dt = (time.perf_counter() - t0) * 1000
        log.info("llm_call", user_id=user_id, status="ok",
                 latency_ms=round(dt), tokens=resp.usage.total_tokens,
                 model="gpt-4o-mini")   # structured → queryable
        return resp
    except Exception as e:
        log.error("llm_call", user_id=user_id, status="error",
                  error=type(e).__name__)   # this line drives the error-rate metric
        raise
```

Ship those JSON logs to your platform; build a dashboard counting `status="error"` over `total`, and an alert when the ratio crosses 5%. In Langfuse, the equivalent metrics are derived from traces automatically — you set alerts on latency/error/cost thresholds without writing the logging by hand.

## How a company uses this

A Dubai e-commerce AI team running a product-recommendation assistant watches a Grafana/Langfuse board with p95 latency, error rate, rate-limit (429) count, and cost/hour. Real incident: the LLM vendor had a regional slowdown; **p99 latency jumped from 2s to 14s** while the average barely moved — the percentile alert caught it, on-call flipped traffic to a fallback model in the other region, users saw a blip instead of an outage. They also alert on a *quality* metric (thumbs-down rate) because a silent prompt regression won't move latency at all. Log volume is real: at high QPS you sample INFO logs (keep 100% of errors) so storage stays affordable.

## Common mistakes
- **Unstructured `print` logging.** You can't query it, you can't alert on it. Always structured key-value.
- **Alerting on averages.** Averages hide the painful tail. Alert on p95/p99.
- **Only technical metrics.** Error rate can be 0% while the answers are wrong. You *also* need quality metrics from [online evaluation](/llmops-observability/online-evaluation).
- **Logging full prompts/responses with PII** to a general log store. Mask or keep sensitive content only in access-controlled traces.
- **Alert fatigue** — 50 noisy alerts means the real one gets ignored. Alert on symptoms users feel, not every twitch.

## Interview tip
Say: *"I use structured JSON logging so every event is queryable, and monitor the four golden signals plus LLM-specific ones — tokens/req, cost/req, and a quality metric like thumbs-down rate. I alert on p95/p99 latency, not averages, because the tail is what users feel, and I sample high-volume logs while keeping 100% of errors."* Contrast it cleanly with [tracing](/llmops-observability/tracing): tracing debugs *one* request, monitoring watches *all* of them.
