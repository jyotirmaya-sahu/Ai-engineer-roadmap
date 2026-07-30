# Sketch components

**What it is:** drawing the boxes and arrows — the actual system diagram — that shows how a request flows from the user through your AI components to an answer, sized to the [requirements](clarify-requirements.md) and [SLAs](define-slas-latency-cost-accuracy.md) you already pinned down.

## Why it matters for an AI Engineer

This is where the interviewer *sees* whether you can build. But the trap is drawing too much too soon. A senior sketches a **clean happy-path first** — the minimum boxes that answer one request end-to-end — then layers on caching, queues, and fallbacks only when the SLAs demand them. A junior either freezes on the blank board or vomits every AWS service they know onto it. The skill is a **legible, right-sized diagram** with the data flow arrows correct, that you can then attack in the [bottleneck](find-bottlenecks-iterate.md) step. Interviewers grade whether your boxes actually connect and whether each one *earns its place*.

## The mechanism: the standard AI-app skeleton

Almost every AI system decomposes into the same layers. Learn this skeleton and you can draw any prompt in ninety seconds, then customize.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 Client</span>
    <span class="darr">→</span>
    <span class="dbox blue">🚪 API gateway<span class="sub">auth, rate-limit</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">🧭 Orchestrator<span class="sub">the app logic</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 LLM / model<span class="sub">served or API</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Response</span>
  </div>
  <div class="flow v">
    <span class="dbox orange">🧭 Orchestrator</span>
    <span class="darr">↓<span class="lbl">pulls context</span></span>
    <span class="dbox blue">🗄️ Retrieval / data<span class="sub">vector DB, SQL, cache, tools</span></span>
  </div>
  <div class="dcap">The universal skeleton: client → gateway → orchestrator → (data + model) → response. Add boxes only as SLAs force them.</div>
</div>

Draw it in this order:

1. **The request path (happy path first).** Client → gateway → orchestrator → model → response. Just the spine. Don't add anything else yet.
2. **The data/knowledge layer.** Hang it off the orchestrator: vector DB for RAG, SQL for structured lookups, external tools/APIs for actions, a cache in front. What you attach here came straight from clarification (what data, how fresh).
3. **The offline/ingestion path.** If there's a knowledge base, draw the *separate* pipeline that fills it: source docs → parse → chunk → embed → index. This runs on a schedule, not per-request — keep it visually separate so you don't confuse the two. (See [data pipeline design](data-pipeline-design.md).)
4. **Cross-cutting boxes — only if the SLA demands.** A **cache** (if cost/latency SLA is tight), a **queue** (if load is bursty or work is async), **guardrails** (if stakes are high), **observability** (always mention, lightly). Each one you add, say *why* — "I'm adding a semantic cache here because the cost SLA needs the 35% repeat queries to be near-free."

The rule: **every box justifies itself against a requirement or an SLA.** If you can't say why a box exists, delete it.

## Worked example: sketching a support assistant

SLAs: p95 < 2s, $0.01/query, 90% accuracy, knowledge from 5k help-center articles.

- **Request path:** Client → API gateway (auth + rate-limit) → orchestrator.
- **Orchestrator logic:** embed the question → query vector DB (top-5 chunks) → build prompt with retrieved context → call model → return with citations.
- **Data layer:** managed vector DB (the 5k articles, chunked); a **semantic cache** in front (cost SLA demands it); the LLM via API.
- **Offline path (drawn separately):** help-center articles → parse → chunk → embed → upsert to vector DB, re-run nightly for freshness.
- **Cross-cutting:** cache before the model, a lightweight guardrail to enforce "cite or say I don't know," and logging on every call.

That's ~8 boxes, each traceable to an SLA. Clean enough to attack next.

## How a company uses this

> **A Dubai healthcare provider's** patient-FAQ assistant looked identical to any RAG sketch at first — until the "why does this box exist?" discipline changed it. Data-residency (a UAE requirement) meant the LLM box couldn't be a US API, so it became a **self-hosted open model in-region**. The high-stakes accuracy bar turned the single guardrail box into a real **verification step** that checked every answer against the retrieved source before sending. And because clinicians reviewed edge cases, an extra **human-in-the-loop queue** box appeared for low-confidence answers. Same skeleton as a shopping bot; three boxes swapped because three requirements demanded it. The diagram is only as good as the reasons behind each box.

## Common mistakes
- **Over-drawing on the first pass.** Twenty boxes nobody can follow. Draw the happy path, *then* layer.
- **Wrong arrow direction / dangling boxes.** A component with no clear input or output signals you don't understand the flow. Trace one request end-to-end and make sure it connects.
- **Mixing the online and offline paths.** The per-request flow and the ingestion pipeline are two different diagrams. Blurring them confuses everyone.
- **Boxes with no justification.** A Kafka here, a Redis there "because scale." Every box must map to a stated requirement or SLA.

## Interview tip
Narrate as you draw: *"I'll start with the happy path — client, gateway, orchestrator, model, response — then hang the data layer off the orchestrator, and I'll draw the ingestion pipeline separately since it runs on a schedule. I'm adding a cache here specifically because of the cost SLA."* This shows you build incrementally and that every box is *earned*. It also sets up the next step perfectly: a clean, justified sketch is exactly what you need to [hunt bottlenecks and iterate](find-bottlenecks-iterate.md) on.
