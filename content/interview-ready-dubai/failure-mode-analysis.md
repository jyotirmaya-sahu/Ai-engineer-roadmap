# Failure-Mode Analysis

**What it is:** the drill of naming, unprompted, how your system *breaks* — the ways an LLM app fails in production and how you'd detect and mitigate each — because interviewers use "what could go wrong?" to separate people who've operated systems from people who've only built demos.

## Why it matters for an AI Engineer

Anyone can describe the happy path. The senior signal is thinking about the **sad paths**: what happens when the model hallucinates, the retrieval misses, the API times out, or a user tries to jailbreak you. Dubai teams especially — often small, with real users and compliance exposure — need engineers who anticipate failure, not just ship features. When you volunteer failure modes *before being asked*, you instantly read as someone who's been on call. It's the cheapest way to look experienced.

## The mechanism: the failure taxonomy for LLM apps

LLM apps fail in categories classic software doesn't. Learn the map so you can rattle them off:

**1. Model-level failures**
- **Hallucination** — confident, wrong, ungrounded claims. *Detect:* faithfulness eval / grounding checks. *Mitigate:* RAG with citations, "say I don't know" instructions, output verification.
- **Non-determinism** — same input, different output. *Mitigate:* lower temperature for factual tasks, structured output schemas, eval on distributions not single runs.
- **Prompt injection / jailbreak** — user input hijacks instructions ("ignore your rules…"). *Detect:* input guardrails. *Mitigate:* separate system vs user content, input filtering, least-privilege tools.

**2. Retrieval-level failures (RAG)**
- **Recall miss** — right chunk never retrieved → model guesses. *Detect:* recall@k. *Mitigate:* hybrid search, reranking, better chunking.
- **Stale/corrupt index** — docs changed, index didn't. *Detect:* freshness metadata, re-index pipeline. *Mitigate:* scheduled re-indexing.

**3. System-level failures**
- **Latency spikes / timeouts** — provider slow. *Mitigate:* timeouts, retries with backoff, fallback model.
- **Cost blowup** — an agent loops, or traffic spikes. *Detect:* cost-per-request alarms. *Mitigate:* step/cost caps.
- **Rate limits / provider outage.** *Mitigate:* multi-provider fallback, queue + retry.

**4. Data / safety failures**
- **PII leakage, toxic output, off-topic responses.** *Detect+Mitigate:* output guardrails, content filters.

The universal structure to *say out loud*: **failure → how I detect it → how I mitigate it.** Three beats per mode.

<div class="diagram">
  <div class="flow">
    <span class="dbox orange">⚠️ Failure mode</span>
    <span class="darr">→</span>
    <span class="dbox blue">🔍 Detect<span class="sub">metric / alarm / eval</span></span>
    <span class="darr">→</span>
    <span class="dbox green">🛡️ Mitigate<span class="sub">guardrail / fallback / fix</span></span>
  </div>
  <div class="dcap">Every failure answer has three beats — never name a failure without detect + mitigate.</div>
</div>

## Concrete example: a defensive wrapper

```python
import time
from anthropic import Anthropic, APITimeoutError, RateLimitError
client = Anthropic()

def robust_ask(prompt, max_tokens=400):
    for attempt in range(3):                     # retry w/ backoff
        try:
            r = client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=max_tokens,           # cost/latency cap
                timeout=8.0,                     # latency guardrail
                messages=[{"role": "user", "content": prompt}])
            text = r.content[0].text
            if "IGNORE PREVIOUS" in prompt.upper():   # naive injection check
                return "Request blocked."
            return text
        except (APITimeoutError, RateLimitError):
            time.sleep(2 ** attempt)             # 1s, 2s, 4s
    return "Service busy — try again."           # graceful degradation
```

Walking through this — timeout, retry/backoff, injection check, graceful fallback — shows you code *for* failure, not around it.

## How a company uses this (production lens)

A Dubai insurance firm's claims-assistant post-mortem log reads like this taxonomy. Real incidents in one quarter: (a) an ingestion bug replaced 8% of chunks with blanks → recall@5 dropped, caught by the CI gold set before release; (b) a prompt-injection in a customer email made the agent try to email internal data → blocked by an output guardrail scanning for internal domains; (c) a provider latency spike pushed p95 from 2.5s to 11s → the timeout+fallback-to-cheaper-model kept the service up at degraded quality. Each mitigation existed because someone had *named the failure in advance*. Their SLA: 99.5% availability, and every alarm maps to one taxonomy entry.

## Common mistakes
- **Only describing the happy path.** Never volunteering failures reads as demo-only experience.
- **Naming a failure with no detection.** "It might hallucinate" — okay, *how would you know?* Always pair with a metric/alarm.
- **No mitigation.** Detection without a fix is half an answer.
- **Forgetting cost/latency as failures.** Engineers fixate on hallucination and forget a looping agent is a production incident too.

## Interview tip
Proactively say: *"Let me call out how this breaks."* Then hit 3–4 modes in the **failure → detect → mitigate** rhythm, spanning categories (one model-level, one retrieval, one system, one safety). That structured pessimism is one of the strongest senior signals you can send. Directly reinforces [RAG & retrieval eval](rag-retrieval-eval.md) and [Deploy / LLMOps / cost](deploy-llmops-cost.md).
