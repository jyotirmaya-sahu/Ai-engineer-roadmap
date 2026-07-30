# LiteLLM gateway

**What it is:** A single proxy that puts **one OpenAI-style API in front of 100+ LLM providers** (OpenAI, Anthropic, Bedrock, Azure, Gemini, self-hosted [vLLM](vllm.md), etc.) — so your app talks to one endpoint while LiteLLM handles auth, routing, budgets, caching, and fallbacks behind it.

## Why it matters for an AI Engineer

Real systems don't call one model — they call GPT for hard tasks, a cheap model for easy ones, Bedrock for the data-residency-compliant workload, and a self-hosted model for private data. Without a gateway, that's four SDKs, four auth schemes, four billing dashboards, and no unified control. **LiteLLM is the control plane**: every LLM call flows through it, so you get one place to enforce spend limits, log cost per team, cache, retry, and swap providers without touching app code. It's rapidly becoming standard infrastructure, and being able to describe *why* you'd put a gateway in the path is a strong systems-thinking signal in interviews.

## The mechanism / how it works

LiteLLM has two forms. The **Python SDK** (`litellm.completion(...)`) normalizes every provider to the OpenAI request/response shape in-process. The **proxy server** (the "gateway") runs that as a standalone service your whole org points at — the more powerful production form.

You define models and their real backends in a `config.yaml`, grouping several under one public name (a "model group") so LiteLLM can [route](model-routing.md), [load-balance](fallbacks-load-balancing.md), and fall back among them. On top of the routing it layers:

- **Virtual keys & budgets** — issue per-team/per-user API keys with hard monthly spend caps and rate limits. Kill a key, kill the spend.
- **Cost tracking** — logs tokens and dollars per request, tagged by key/team/model, into a database or Langfuse.
- **[Caching](prompt-semantic-cache.md)** — exact-match or semantic response caching (Redis) to skip repeat calls.
- **[Fallbacks & retries](fallbacks-load-balancing.md)** — if OpenAI 429s or errors, automatically retry on Azure or Anthropic.
- **Guardrails hooks** — run PII redaction or content checks pre/post call.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🧩 Your app<span class="sub">one OpenAI call</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🚪 LiteLLM gateway<span class="sub">keys · budget · cache · route</span></span>
    <span class="darr">→</span>
    <div class="flow v">
      <span class="dbox blue">OpenAI</span>
      <span class="dbox blue">Anthropic</span>
      <span class="dbox blue">Bedrock</span>
      <span class="dbox blue">self-hosted vLLM</span>
    </div>
  </div>
  <div class="dcap">One endpoint in; many providers out — with budgets, caching, and fallbacks in the middle.</div>
</div>

## Concrete example

`config.yaml` — one public name backed by two providers, with a fallback:

```yaml
model_list:
  - model_name: smart          # what your app asks for
    litellm_params: {model: openai/gpt-4o, api_key: os.environ/OPENAI_KEY}
  - model_name: smart          # same public name = a fallback pool
    litellm_params: {model: anthropic/claude-3-5-sonnet, api_key: os.environ/ANTHROPIC_KEY}
litellm_settings:
  cache: true
router_settings:
  fallbacks: [{"smart": ["smart"]}]
```

```python
# App code never names a real provider — it targets the gateway
from openai import OpenAI
client = OpenAI(base_url="http://litellm:4000", api_key="sk-team-marketing")  # virtual key
r = client.chat.completions.create(
    model="smart",
    messages=[{"role": "user", "content": "Summarize this contract."}],
)
```

Switching from GPT to Claude, adding a budget cap, or turning on caching is now a **config change, not a code deploy**.

## How a company uses this

A Dubai SaaS company with five product teams ran everything through a central LiteLLM proxy. Each team got a **virtual key with a monthly budget** (e.g. $2k), so finance saw exact per-team spend and a runaway feature hit its cap instead of the company card. During an OpenAI outage, the fallback config transparently rerouted traffic to Azure OpenAI — **users never noticed**. Semantic caching on their support endpoint cut ~35% of calls (repeated FAQ-style questions). The one number that sold it internally: a single dashboard showing **$/team/day**, which turned "AI costs are scary" into a line-item they could manage. The main production caution is that the gateway is now a **single point of failure and a latency hop** — so they ran it in HA (multiple replicas + Redis) and kept its overhead to a few milliseconds.

## Common mistakes

- **Baking provider SDKs into app code anyway.** The whole point is the app never knows the real provider — route through the gateway or you lose swap-ability.
- **No budgets on keys.** Without per-key caps, one bug or abusive tenant drains the shared account.
- **Running one gateway replica in prod.** It's in the hot path of every call — make it HA or it's a single point of failure.
- **Confusing SDK and proxy.** The org-wide control (keys, budgets, central logging) comes from the *proxy server*, not just the Python SDK.

## Interview tip
Say: *"I put a LiteLLM gateway in front of all LLM traffic so the app makes one OpenAI-style call and the gateway owns routing, per-team virtual keys with budgets, cost logging, semantic caching, and provider fallbacks. That means swapping GPT for Claude, capping a team's spend, or surviving an OpenAI outage is a config change, not a code deploy — and I get one dashboard of cost per team. I run it HA because it's in the hot path of every request."* That's textbook control-plane thinking.
