# Failure-mode analysis

**What it is:** systematically naming what breaks in your [design](sketch-components.md) — the LLM API goes down, retrieval returns garbage, the model hallucinates, load spikes 10× — and saying *how you'd detect and handle each*, before the interviewer forces it.

## Why it matters for an AI Engineer

Demos assume everything works. Production assumes everything eventually fails. The senior signal is that you **think in failure modes without being asked** — "if the LLM provider has an outage, here's my fallback" — because that's the mindset of someone who's been paged at 2am. AI systems have *extra* failure modes ordinary services don't: they're non-deterministic (same input, different output), they can be confidently wrong (hallucination), and they depend on external model APIs you don't control. An interviewer probing "what if X fails?" is checking whether you'd ship something that falls over on day one. Answering proactively flips you from "can design" to "can operate."

## The mechanism: walk each component, ask "how does this break?"

Go box by box through your diagram and, for each, name the **failure**, the **detection**, and the **handling**. Group them into four buckets.

<div class="diagram">
  <div class="flow">
    <span class="dbox purple">🧠 Model fails<span class="sub">down · slow · rate-limited</span></span>
    <span class="dbox blue">🗄️ Retrieval fails<span class="sub">empty · wrong · stale</span></span>
    <span class="dbox orange">🎯 Quality fails<span class="sub">hallucinate · off-topic</span></span>
    <span class="dbox yellow">📈 Load fails<span class="sub">spike · overload</span></span>
  </div>
  <div class="dcap">Four buckets of failure. For each: how do you detect it, and what happens when it hits?</div>
</div>

**1. Model / API failure.** The LLM provider has an outage, hits a rate limit, or times out. **Detect:** error rate, latency alerts. **Handle:** retry with backoff, **fail over to a second provider or a smaller model**, circuit-breaker so you don't hammer a dead API, and a graceful "try again shortly" instead of a 500. Never let a single vendor be a single point of failure.

**2. Retrieval failure.** The vector DB is down, returns nothing, or returns irrelevant chunks. **Detect:** monitor retrieval scores and empty-result rates. **Handle:** if no good chunk is found, **say "I don't have that information" rather than letting the LLM guess** — this is the single most important RAG failure handler. Cache recent good results as a fallback.

**3. Quality / correctness failure.** The model hallucinates, goes off-topic, or produces unsafe output — and it does this *silently*, returning a confident wrong answer with a 200 OK. **Detect:** this is the hard one — you need **online evaluation**: sample outputs, check grounding (does the answer trace to a source?), track user thumbs-down. **Handle:** grounding checks that block unsupported claims, guardrails on unsafe content, confidence thresholds that route to a human.

**4. Load / capacity failure.** Traffic spikes past your [capacity estimate](capacity-cost-qps-tokens.md). **Detect:** QPS + queue-depth alerts. **Handle:** autoscaling, a **queue** to absorb bursts, rate-limiting/load-shedding to protect the core, and degraded modes (serve cached answers when overloaded).

The unifying discipline: **every failure needs a detection AND a handling.** "It might fail" is a junior observation; "I'd detect it via X and handle it via Y" is the senior answer.

## Worked example: failure table for a support RAG bot

| Failure | Detect | Handle |
|---|---|---|
| LLM API down | error-rate alert | fail over to backup model; "try again" message |
| LLM rate-limited at peak | 429 rate | queue + backoff; shed non-urgent load |
| Vector DB returns junk | low retrieval scores | refuse: "I don't have that info" — don't guess |
| Model hallucinates a policy | grounding check fails | block answer, require a cited source |
| Stale index (docs changed) | freshness lag metric | event-driven re-index; show doc date |
| 10× traffic spike | QPS/queue alarms | autoscale + cache the top questions |

Presenting a small table like this — proactively — is a standout move.

## How a company uses this

> **A Dubai airline's** booking assistant learned failure-mode analysis the expensive way. Their LLM provider had a **90-minute regional outage**, and because every request called that one API synchronously with no fallback, the assistant returned errors to thousands of customers during a peak travel window. The post-incident redesign was a textbook failure-mode pass: a **secondary model provider** with automatic failover, a **circuit breaker** to stop hammering the dead endpoint, **cached answers** for the top-100 questions served straight through the outage, and a **grounding check** added after they separately found the bot inventing baggage rules. None of it was exotic — it was the four-bucket walk applied *before* the next incident instead of after. In the interview, being the candidate who lists these unprompted says you've lived through the outage, not just read about it.

## Common mistakes
- **Assuming the happy path.** A design with no failure handling is a demo, not a system. Interviewers *will* probe — get there first.
- **Single points of failure.** One LLM provider, one vector DB node. Name the SPOF and add a fallback or replica.
- **Letting RAG guess on empty retrieval.** The most common AI-specific failure. No good chunk → refuse, don't hallucinate.
- **Detection without handling (or vice versa).** "We'd monitor it" — then what? And "we'd retry" — how do you know to? Always pair the two.

## Interview tip
Volunteer it: *"Let me walk the failure modes. If the LLM API is down I fail over to a backup provider with a circuit breaker; if retrieval returns nothing I refuse rather than hallucinate; for silent quality failures I run online grounding checks and track thumbs-down; and for load spikes I autoscale behind a queue. Each has a detection and a handler."* Naming AI-specific failures — hallucination, empty retrieval, provider outage — *before being asked* is one of the highest-value moves in the round, because it proves operational experience. It pairs naturally with the [iterate loop](find-bottlenecks-iterate.md) and [capacity math](capacity-cost-qps-tokens.md).
