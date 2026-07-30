# Design a doc-processing pipeline at scale

**What it is:** the *throughput-first* design prompt — *"we have 10 million documents (invoices, contracts, forms) to extract structured data from"* — worked through the [framework](clarify-requirements.md), where the SLA that dominates is cost-per-doc and docs/hour, **not** latency.

## Why it matters for an AI Engineer

Not every AI system is a chat box. A huge slice of real enterprise AI work is **batch processing at volume**: read a document, pull out fields, validate, store. This prompt tests whether you know that latency is irrelevant here and **throughput and cost-per-document are everything** — a design mindset that trips up candidates who only think in "chat p95." Getting it right shows you can build the unglamorous pipelines that actually make money.

## Step 1 — Clarify

Buckets → **10M documents, mixed types (scanned PDFs, native PDFs, images); goal = extract a fixed set of fields (invoice number, amount, vendor, dates) into a database; "good" = ≥ 98% field accuracy because errors flow into accounting; no latency requirement — it's a nightly/backfill batch; must finish the 10M backfill in ~a week, then ~50k new docs/day ongoing; data is sensitive (financial) → stays in-region.** Restate.

## Step 2 — SLAs

- **Latency:** none per-doc. The SLA is **throughput** — 10M docs / 7 days ≈ **60k docs/hour** for the backfill.
- **Cost:** the one that dominates. If each doc costs $0.02 in LLM calls, 10M docs = **$200k** for the backfill. That number forces routing cheap docs away from the LLM.
- **Accuracy:** ≥ 98% per field, so a **validation + human-review-on-low-confidence** loop is mandatory, not optional.

## Step 3 — Sketch

This is an **asynchronous, queue-driven batch pipeline**, not a request/response service.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 10M docs<span class="sub">object store</span></span>
    <span class="darr">→</span>
    <span class="dbox blue">📋 Work queue<span class="sub">one msg / doc</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">👷 Worker pool<span class="sub">autoscaled, parallel</span></span>
  </div>
  <div class="flow v">
    <span class="dbox orange">👷 Worker</span>
    <span class="darr">↓</span>
    <span class="dbox purple">🔍 OCR / parse</span>
    <span class="darr">↓<span class="lbl">route</span></span>
    <span class="dbox blue">📐 Template? → regex</span>
    <span class="darr">↓<span class="lbl">messy</span></span>
    <span class="dbox purple">🧠 LLM extract → JSON</span>
    <span class="darr">↓</span>
    <span class="dbox orange">✔️ Validate</span>
    <span class="darr">↓<span class="lbl">low conf</span></span>
    <span class="dbox yellow">🙋 Human review</span>
    <span class="darr">↓<span class="lbl">ok</span></span>
    <span class="dbox green">🗄️ Structured DB</span>
  </div>
  <div class="dcap">Queue + autoscaled workers. Each doc is routed cheap-first; only messy docs hit the LLM; low-confidence goes to a human.</div>
</div>

Flow: documents land in object storage → a message per document goes on a **work queue** → an **autoscaled pool of workers** pulls jobs in parallel. Each worker: OCR/parse the doc → **route** (if it matches a known template, use cheap regex/rules; only messy or unknown layouts hit the LLM with a "return this JSON schema" prompt) → **validate** the extracted fields (amounts are numbers, dates parse, invoice number matches a pattern) → if confidence is low or validation fails, send to a **human-review queue**; otherwise write to the structured DB. Failed docs go to a **dead-letter queue** for retry.

The queue is the heart: it decouples ingestion from processing, lets you scale workers independently, survives crashes (unacked messages redeliver), and smooths the 50k/day ongoing load.

## Step 4 — Find bottlenecks & iterate

- **Cost** (tightest): $200k backfill is brutal. Relieve → **route**: ~70% of invoices match known vendor templates and never touch the LLM (near-free); only the 30% messy ones use a model, and a **small/cheap** model at that, reserving the frontier model for genuinely hard layouts. Backfill cost drops ~60%.
- **Throughput:** need 60k docs/hr. Relieve → **horizontal scaling** — the queue lets you run hundreds of workers in parallel; throughput = workers × docs/worker/hr. LLM-API rate limits become the cap, so use **batch API** endpoints (cheaper, higher throughput) for the non-urgent backfill.
- **Accuracy:** the validation + human-review loop catches the misses; route only low-confidence docs to humans so review volume stays manageable (~2% of docs, not all 10M).
- **Failure:** dead-letter queue + idempotent workers (re-processing a doc is safe) so a crash mid-run doesn't corrupt or double-write.

## How a company uses this

> **A Dubai trade-finance firm** processed millions of shipping and customs documents this way. The economics were the entire design: naively LLM-ing every page would have cost **six figures per backfill and blown the per-doc budget**, so they built the router — a cheap layout classifier sent ~75% of standard forms to deterministic template extraction, and only non-standard docs reached the model, using the provider's **batch endpoint at ~50% of real-time price** since nothing was latency-sensitive. Human reviewers handled the ~1.5% flagged low-confidence, feeding corrections back to improve the templates (a data flywheel). Result: cost-per-doc fell roughly 5×, the week-long backfill target held, and accuracy cleared 98% because the human loop caught the tail. Latency was never mentioned once — throughput and cost were the whole game.

## Common mistakes
- **Designing it like a chat service.** Synchronous request/response collapses at 10M docs. It must be queue-driven and async.
- **Sending every doc to the LLM.** The most expensive possible choice. Route template-matchable docs to cheap deterministic extraction first.
- **Ignoring the human-review loop.** 98% accuracy is impossible from the model alone at this volume — validation + human-on-low-confidence is how you hit it.
- **Forgetting failure handling.** At 10M docs, thousands *will* fail. No dead-letter queue / retry / idempotency = a corrupted, half-finished run.

## Interview tip
Lead with the reframe: *"This is throughput-first, not latency-first — the SLAs that matter are docs-per-hour and cost-per-doc, so I'll design a queue-driven async pipeline and route cheap-first. Let me do the cost math: 10M × $0.02 is $200k, which is why routing 70% to template extraction and using the batch API is the core decision, not an optimization."* Showing you know *which* SLA dominates — and doing the [capacity/cost math](capacity-cost-qps-tokens.md) out loud — is the senior signal here. Contrast it with the latency-first [support RAG](design-a-support-rag-assistant.md) design to show you adapt the framework to the problem.
