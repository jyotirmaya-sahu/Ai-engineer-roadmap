# Cost / latency dashboards

**What it is:** aggregated views that turn thousands of individual [traces](/llmops-observability/tracing) into the two numbers a business actually asks about — *how much is this costing?* and *how fast is it?* — sliced by model, feature, and user.

## Why it matters for an AI Engineer

LLM cost is sneaky. It's fractions of a cent per call, so it feels free — until you multiply by a few million calls and it's a five-figure monthly bill nobody budgeted. And latency is the difference between an assistant that feels magic and one users abandon. A dashboard makes both *visible and attributable*: you can point at the exact feature burning 60% of spend, or the exact step adding 4 seconds. In interviews, "I cut inference cost 40% by finding that a single logging feature was calling GPT-4 on every keystroke" is a story you can only tell if you had the dashboard. Owning the cost/latency numbers is a core part of the AI Engineer job.

## The mechanism — how it works

Every generation in a trace already carries **token counts and cost** (tokens × the model's per-token price) and **duration**. A dashboard is just those values **aggregated** over a time window and **grouped** by a dimension:

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">🔍 traces<span class="sub">tokens, cost, ms each</span></span>
    <span class="darr">→<span class="lbl">group by</span></span>
    <span class="dbox blue">🗄️ model / feature / user / day</span>
    <span class="darr">→</span>
    <span class="dbox green">📊 $ per day · p95 latency · tokens/req</span>
  </div>
  <div class="dcap">Dashboards = per-trace cost & timing rolled up along a dimension you care about.</div>
</div>

The dimensions that pay off:
- **By model** — spot that an expensive model is doing a job a cheap one could.
- **By feature/prompt** (via a trace tag) — find the feature eating the budget.
- **By user/tenant** — catch an abusive or runaway account; enable per-customer billing.
- **Over time** — see cost creep before it's a crisis.

Key metrics to put on the board: **total cost/day**, **cost per request**, **tokens in vs out** (output tokens often cost 3–4× input, so a chatty prompt is expensive), **p50/p95/p99 latency**, and **latency broken down by step** (retrieval vs model vs tool) so you know *where* the time goes. Langfuse ships these dashboards out of the box because it already has the priced traces; you add custom charts grouped by your tags.

## Concrete example — worked numbers

A RAG assistant, gpt-4o-mini (≈ $0.15 / 1M input tokens, $0.60 / 1M output in 2026):

- Avg request: **1,400 input tokens** (prompt + 4 retrieved chunks) + **200 output tokens**.
- Cost/request = 1,400 × $0.15/1M + 200 × $0.60/1M = $0.00021 + $0.00012 = **$0.00033**.
- At **200,000 requests/day** → **$66/day ≈ $2,000/month**.

Now the dashboard shows one feature stuffs **8 chunks (2,800 input tokens)** for no accuracy gain. Drop it to 4 → input cost halves on that path. If that feature is 40% of traffic, you save ~**$400/month** from one chart. That's the entire value of a cost dashboard: it makes the invisible waste visible.

## How a company uses this

A Dubai SaaS with a multi-tenant AI feature bills customers partly on AI usage, so **cost-per-tenant** isn't a nice-to-have — it's the invoice. Their Langfuse dashboard groups cost by `tenant_id` tag. It caught one enterprise account whose integration retried in a loop, generating **12× normal token volume**; a per-tenant cost alert fired and they rate-limited it before it cost thousands. On latency, the step-breakdown chart showed reranking added a steady 900ms; they moved to a faster reranker and cut p95 from 3.1s to 2.0s. Rule of thumb they live by: **watch output-token growth** — it's the most expensive number and the easiest to let creep.

## Common mistakes
- **Watching total cost only, not cost *per request*.** Total can look flat while per-request cost quietly doubles and traffic dips — a hidden regression.
- **Averaging latency.** A 900ms average with a 12s p99 is a bad product. Chart percentiles.
- **No feature/tenant tags on traces** — then you can see spend went up but not *who or what* caused it. Tag at the source.
- **Ignoring the input/output split.** Output tokens dominate cost; a dashboard that lumps them hides where to optimize.

## Interview tip
Say: *"Cost and latency dashboards roll up per-trace token cost and timing, grouped by model, feature, and tenant. I watch cost-per-request (not just total), the input/output token split since output is 3–4× pricier, and p95/p99 latency broken down by step so I know whether retrieval or the model is the bottleneck. That's how I find things like a feature over-retrieving and cut cost without touching quality."* This tile is the payoff of [tracing](/llmops-observability/tracing) — no traces, no dashboards.
