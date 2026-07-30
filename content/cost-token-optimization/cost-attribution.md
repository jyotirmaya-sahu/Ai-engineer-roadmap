# Cost attribution

**What it is:** Slicing your total token bill by *who* and *what* caused it — which feature, which customer, which user, which step of an agent — so you optimize the line that actually costs money.

## Why it matters for an AI Engineer

A single number ("$41k this month") tells you there's a problem but not where. Attribution turns it into "the summarizer feature is 48% of spend, the disputes agent is 30%, and one enterprise tenant is 22% of the total because their integration retries on every timeout." Now you know exactly where a day of work pays off. In multi-tenant SaaS it's also a business requirement: you can't price or rate-limit a customer whose cost you can't measure, and you can't tell finance your gross margin. Attribution is how token accounting becomes decisions.

## The mechanism / how it works

Attribution is [token accounting](token-accounting-per-request.md) plus **tags**. On every logged call you attach dimensions you'll want to group by later:

- `feature` / `endpoint` — which product surface (summarize, chat, classify).
- `tenant_id` / `user_id` — which customer, for multi-tenant billing and abuse detection.
- `model` — because a frontier call costs 10× a cheap one.
- `trace_id` / `step` — inside an agent, which node in the chain; loops hide here.
- `environment` — prod vs eval vs internal testing (test spend is real spend).

You emit `{tags..., input_tokens, output_tokens, cost}` per call to a store you can aggregate — a warehouse table, Langfuse, or a metrics backend. Then a `GROUP BY` gives you the breakdown. The key discipline is **propagating the tags through the whole call graph**: a user's request may fan out into a retrieval rerank call, three tool calls, and a final synthesis — all of those must carry the same `trace_id` and `tenant_id`, or the agent's cost looks like it comes from nowhere.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">💰 $41k total</span>
    <span class="darr">↓<span class="lbl">group by tag</span></span>
    <div class="flow">
      <span class="dbox orange">summarize 48%</span>
      <span class="dbox orange">disputes 30%</span>
      <span class="dbox orange">chat 15%</span>
      <span class="dbox orange">other 7%</span>
    </div>
    <span class="darr">↓<span class="lbl">group by tenant</span></span>
    <span class="dbox yellow">⚠️ 1 tenant = 22% (retry loop)</span>
  </div>
  <div class="dcap">Same total, sliced two ways — each slice points at a different fix.</div>
</div>

## Concrete example

```python
def log_usage(usage, model, tags):
    pin, pout = PRICE[model]
    cost = usage.prompt_tokens/1e6*pin + usage.completion_tokens/1e6*pout
    metrics.emit({
        **tags,                     # feature, tenant_id, trace_id, step
        "model": model,
        "in": usage.prompt_tokens,
        "out": usage.completion_tokens,
        "cost": cost,
    })

# later, in the warehouse:
# SELECT tenant_id, SUM(cost) c FROM llm_usage
# WHERE day = CURRENT_DATE GROUP BY 1 ORDER BY c DESC LIMIT 10;
```

The top-10 query is the one you run when a bill spikes. Nine times out of ten one row explains most of the jump — a runaway agent loop, a new feature nobody load-tested, or a customer hammering the API.

## How a company uses this

A regional B2B AI platform bills customers partly on AI usage. Every LLM call is tagged with `tenant_id` and `trace_id`; a nightly job rolls cost up per tenant and feeds both the invoice and an anomaly alert. That system caught a customer whose bad integration retried failed calls in a tight loop — **$3,100 in one weekend** from a single account — and let support throttle just that tenant instead of everyone. On the agent side, per-`step` attribution revealed the "reflection" node in their research agent was called 4× per task and drove 40% of that agent's cost with marginal quality gain; they capped it to one pass. Attribution is what made both problems findable in minutes instead of a week of guessing. At scale the tags are non-negotiable: without `trace_id` propagation, an agent's cost is an untraceable blob.

## Common mistakes

- **Tagging the entry call but not the fan-out.** Sub-calls (rerank, tools, sub-agents) lose their tags and the parent feature looks artificially cheap.
- **No tenant/user dimension.** You see total cost but can't find the one account causing an abuse spike or price a heavy customer.
- **Forgetting eval and internal spend.** Automated eval runs and dev testing can be a large, invisible chunk — tag `environment` so it's not mistaken for prod.
- **Attribution only in dashboards, never in alerts.** Set thresholds (per-tenant/day, per-request tokens) so anomalies page you, don't just sit in a chart.

## Interview tip
Say: *"I tag every LLM call with feature, tenant, model, and a trace id, propagate those tags through the whole agent call graph, and roll cost up by each dimension. When a bill spikes I run a top-N-by-cost query and one row usually explains it — a loop, a new feature, or one abusive tenant. Attribution is what turns 'AI is expensive' into 'this specific thing is expensive, and here's the fix.'"* It shows you can operate cost, not just observe it.
