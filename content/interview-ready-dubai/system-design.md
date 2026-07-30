# System Design

**What it is:** the 45-minute whiteboard round where you're handed a vague prompt ("design a customer-support AI for a bank") and must architect a full LLM application out loud — boxes, data flow, trade-offs, and numbers.

## Why it matters for an AI Engineer

Almost every Dubai AI Engineer loop has a design round, and it's where mid/senior candidates are separated from juniors. It tests something a coding test can't: can you hold a whole system in your head, make defensible choices under ambiguity, and communicate them to a hiring manager who may not be technical? Because Dubai teams often run lean, they specifically want someone who designs for **cost and operability**, not just correctness. A strong design answer is the highest-leverage 45 minutes in your interview.

## The mechanism: a repeatable framework

Don't free-associate. Run the same skeleton every time — interviewers reward structure.

**1. Clarify + scope (2–3 min).** Never start drawing immediately. Ask: *Who are the users and how many? What's the volume (QPS)? Latency budget? Accuracy bar? Any compliance/data-residency needs?* In Dubai, **data residency** is a real constraint — asking about it signals local awareness.

**2. Define the happy path.** State the core flow in one sentence, then draw it: request → (retrieval / tools) → LLM → guardrails → response.

**3. Pick the LLM pattern.** Is this **RAG** (needs private knowledge), an **agent** (needs to take actions), **fine-tuning** (narrow, high-volume, stable task), or **plain prompting**? Justify the choice — most "AI Engineer" problems are RAG or a simple agent.

**4. Detail each component.** Data ingestion + chunking → embedding + vector store → retrieval (hybrid + rerank) → prompt assembly → model call → output guardrails. Name a concrete tool for each ("pgvector", "a cross-encoder reranker").

**5. Add the production concerns.** Observability (tracing), evaluation (gold set + CI), caching, model routing, scaling, and failure handling. This is where you separate yourself.

**6. State trade-offs + numbers.** For each big choice, name the alternative and why you didn't pick it, and attach a latency/cost estimate.

<div class="diagram">
  <div class="flow v">
    <span class="dbox gray">1️⃣ Clarify: users, QPS, latency, compliance</span>
    <span class="darr">↓</span>
    <span class="dbox orange">2️⃣ Happy path + pick pattern (RAG/agent/FT)</span>
    <span class="darr">↓</span>
    <span class="dbox purple">3️⃣ Detail components (ingest→retrieve→LLM→guard)</span>
    <span class="darr">↓</span>
    <span class="dbox blue">4️⃣ Production: trace, eval, cache, route, scale</span>
    <span class="darr">↓</span>
    <span class="dbox green">5️⃣ Trade-offs + numbers</span>
  </div>
  <div class="dcap">Same skeleton every time — structure is what interviewers grade.</div>
</div>

## Concrete example: "Design a policy-Q&A assistant for a Dubai bank"

A tight 60-second version you'd expand on the board:

> *"~2,000 internal staff, ~5 QPS peak, 3s latency target, must keep data in-region (Bedrock in me-central). It's a **RAG** problem — private policy docs, answers must cite sources. Ingest PDFs → recursive chunk on section boundaries (~500 tokens, 15% overlap) → embed → **pgvector** (already in their Postgres, no new infra). Retrieve **hybrid** (BM25 + vector) top-30 → cross-encoder rerank to top-5 → assemble prompt with citations → Claude on Bedrock → output guardrail checks every claim is grounded. Production: **Langfuse** traces, a 150-question gold set in CI gating recall@5 ≥ 0.85, system-prompt caching to cut cost, cost-per-request tracked. Trade-off: I chose pgvector over a dedicated vector DB because their scale (~300k chunks) doesn't justify new infra — I'd revisit above ~5M chunks."*

That answer hits every framework step, names tools, respects Dubai compliance, and closes with a numbered trade-off.

## How a company uses this (production lens)

The design you sketch *is* how these systems get built. A Dubai bank's real assistant at ~300k chunks runs exactly this shape: pgvector for storage, hybrid + rerank for recall, p95 ~2.7s, blended cost ~$0.005/query, recall@5 gated in CI. The one thing that broke in production and that a great design answer anticipates: **stale documents** — a policy changed, the vector store wasn't re-indexed, and the assistant confidently cited the old rule. Mentioning "I'd add a re-indexing pipeline + document freshness metadata" in your design is a senior-level detail most candidates miss.

## Common mistakes
- **Drawing before clarifying.** Jumping to architecture without asking scope/latency/compliance reads as junior.
- **No numbers.** "It'll be fast and cheap" is not a design. Estimate QPS, latency, cost.
- **Ignoring operability.** Forgetting eval, tracing, and failure modes signals demo-only experience.
- **One-way choices.** Every big decision needs its alternative named. Silence on trade-offs loses the round.

## Interview tip
Memorize the six-step skeleton and *say the step names out loud* ("first let me clarify scope…"). It keeps you calm and shows structure. Always end each component with a trade-off and a number. For Dubai specifically, proactively raise **data residency** and **cost discipline** — it signals you understand the local market. Pairs with [Trade-off defense](trade-off-defense.md) and [Cost / latency estimation](cost-latency-estimation.md).
