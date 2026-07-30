# Design a support RAG assistant

**What it is:** the most common AI design prompt — *"build an assistant that answers customer questions from our help docs"* — worked end-to-end through the [framework](clarify-requirements.md): clarify, set SLAs, sketch, find bottlenecks.

## Why it matters for an AI Engineer

RAG support bots are the bread-and-butter AI product, so this is the question you're *most* likely to get in a Dubai loop. Getting it right means showing you can turn "answer from our docs" into a system that's fresh, cited, cheap at scale, and honest when it doesn't know. It also exercises every framework step, so nailing this one proves you can attack any variant.

## Step 1 — Clarify

Ask the four buckets. Suppose the answers are: **public customers, 200k queries/day with Monday spikes; knowledge = 8,000 help-center articles that change weekly; "good" = correct and cited, a wrong answer erodes trust but isn't a legal risk; must feel instant, budget matters, English + Arabic.** Restate it back.

## Step 2 — SLAs

- **Latency:** chat UI → p95 first-token < 1.5s, streamed.
- **Cost:** target $0.008/query → 200k/day = **$1,600/day ≈ $48k/month** if every query hit the frontier model. That's the number that forces caching + routing.
- **Accuracy:** ≥ 90% on a 300-question eval, with a hard "cite the source or say *I don't have that*" rule (no hallucinated policies).

## Step 3 — Sketch

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">👤 User</span>
    <span class="darr">→</span>
    <span class="dbox blue">🚪 Gateway<span class="sub">auth, rate-limit</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">💾 Semantic cache<span class="sub">hit? return</span></span>
    <span class="darr">→<span class="lbl">miss</span></span>
    <span class="dbox orange">🧭 Orchestrator</span>
  </div>
  <div class="flow">
    <span class="dbox orange">🧭 Orchestrator</span>
    <span class="darr">→<span class="lbl">retrieve</span></span>
    <span class="dbox blue">🗄️ Vector DB<span class="sub">top-k chunks</span></span>
    <span class="darr">→<span class="lbl">rerank</span></span>
    <span class="dbox purple">🧠 LLM + context</span>
    <span class="darr">→</span>
    <span class="dbox green">✅ Answer + citation</span>
  </div>
  <div class="dgroup"><span class="dgt">OFFLINE — weekly</span>
    <div class="flow">
      <span class="dbox gray">📄 Articles</span><span class="darr">→</span>
      <span class="dbox">✂️ Chunk</span><span class="darr">→</span>
      <span class="dbox purple">🔢 Embed</span><span class="darr">→</span>
      <span class="dbox blue">🗄️ Upsert index</span>
    </div>
  </div>
  <div class="dcap">Online request path + a separate weekly ingestion pipeline that keeps the index fresh.</div>
</div>

**Online:** user → gateway → semantic cache (return instantly on a hit) → on a miss, orchestrator embeds the query, retrieves top-k chunks from the vector DB, reranks to the best 3–4, builds a prompt that says *"answer only from this context; if it's not here, say you don't know,"* calls the LLM, streams the answer with a citation link.

**Offline:** the 8k articles get parsed, recursively chunked (~500 tokens, 15% overlap), embedded, and upserted weekly so the index stays fresh — the freshness requirement from clarification.

**Bilingual:** use a multilingual embedding model so Arabic questions match English (or Arabic) docs; instruct the LLM to answer in the user's language.

## Step 4 — Find bottlenecks & iterate

- **Cost** (tightest): $48k/month is over budget. Relieve → the **semantic cache** serves ~30% of repeat questions free; **route** the easy 40% to a small model, frontier only for the hard 30%. Blended cost drops under $0.008.
- **Latency:** cache hits <100ms; misses stream first token ~1.2s (retrieval ~150ms + generation start). Meets p95 < 1.5s.
- **Scale / Monday spike:** bursty load → the vector DB and LLM API rate-limits are the risk. Relieve → autoscaling managed vector DB + a queue to smooth bursts; the cache absorbs the repeated spike questions.
- **Accuracy:** the "answer only from context" prompt + a lightweight check that the answer's claim appears in a retrieved chunk enforces the cite-or-refuse rule. Low-confidence retrievals → "I don't have that, here's how to reach support."

## How a company uses this

> **A Dubai telecom** built exactly this for billing and plan questions. In production the killer detail was **freshness + citations**: plans changed mid-week, and an un-cited "your plan includes X" that was wrong triggered regulator-sensitive complaints. They moved ingestion from weekly to **event-driven** (a plan update pushed a re-embed of just that doc within minutes) and made the citation *mandatory* — the UI showed the source article, and answers with no supporting chunk were blocked, not guessed. At their scale (~300k queries/day) the semantic cache carried ~40% of traffic, cutting LLM spend roughly in half and holding p95 under 1.5s through evening peaks. The framework's clarify-step question "how fresh?" is what surfaced the whole freshness redesign.

## Common mistakes
- **No cite-or-refuse rule.** A support bot that confidently invents a policy is worse than no bot. Force grounding.
- **Forgetting the offline pipeline.** Candidates draw retrieval but not how the index gets built or *stays fresh*. Weekly-stale data is a real failure.
- **Ignoring the cost math.** Drawing "→ LLM" without noticing 200k/day × frontier pricing blows the budget. The SLA math *is* the design driver.
- **One model for everything.** Routing easy queries to a small model is the cheapest, highest-leverage optimization; skipping it signals you've never run RAG at scale.

## Interview tip
Drive it as a loop out loud: *"Clarify — public, 200k/day, weekly-changing docs, must cite. SLAs — p95 <1.5s, ~$0.008/query, 90% with cite-or-refuse. Sketch — cache → retrieve → rerank → grounded LLM, plus a separate weekly ingestion pipeline. Bottleneck — cost, so I cache and route; then scale, so I autoscale the vector DB and queue the burst."* Landing all four steps on the most common prompt is a clean senior pass. Compare the trade-offs with the throughput-first [doc pipeline](design-a-doc-processing-pipeline-at-scale.md) and the autonomy-first [agent](design-a-coding-research-agent.md) to show range.
