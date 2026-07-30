# Data pipeline design

**What it is:** the offline half of almost every AI system — how raw data gets *in*, gets turned into something the model can use (chunks, embeddings, structured records), stays **fresh**, and stays **correct** — designed separately from the live request path.

## Why it matters for an AI Engineer

Candidates obsess over the online path (query → retrieve → LLM → answer) and forget that **the index feeding it doesn't build itself.** A RAG bot is only as good as its pipeline: if the pipeline doesn't run, your data goes stale; if it double-writes, you get duplicate chunks; if it silently fails, retrieval quietly rots. Interviewers ask about the pipeline to see whether you understand that an AI system has *two* subsystems — the fast online one and the slow offline one — and that most "the answers got worse" bugs live in the pipeline, not the model. Knowing this is a clear seniority tell.

## The mechanism: the ingestion pipeline, stage by stage

A knowledge pipeline is a chain of stages, each transforming the data. It runs on a schedule or on an event — **never per user request.**

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📥 Source<span class="sub">docs, DB, API</span></span>
    <span class="darr">→<span class="lbl">extract</span></span>
    <span class="dbox">📄 Parse<span class="sub">PDF→text, OCR</span></span>
    <span class="darr">→</span>
    <span class="dbox orange">✂️ Chunk<span class="sub">+ metadata</span></span>
    <span class="darr">→</span>
    <span class="dbox purple">🔢 Embed</span>
    <span class="darr">→</span>
    <span class="dbox blue">🗄️ Upsert index<span class="sub">idempotent</span></span>
  </div>
  <div class="dcap">Extract → parse → chunk → embed → upsert. Runs offline on a schedule or event, feeding the online retriever.</div>
</div>

1. **Extract.** Pull from the source — files from object storage, rows from a DB, records from an API. Track *what changed* since last run so you don't reprocess everything.
2. **Parse / clean.** Turn raw formats into clean text: PDF→text, OCR for scans, strip boilerplate, HTML→markdown. Garbage in here = garbage retrieval forever.
3. **Chunk + attach metadata.** Split into retrieval-sized pieces and tag each with source, page, date, section — so you can filter, cite, and expire stale chunks.
4. **Embed.** Run each chunk through the embedding model (batch them for throughput/cost).
5. **Upsert to the index.** Write to the vector DB **idempotently** — keyed by a stable doc/chunk ID so re-running updates in place instead of creating duplicates. Delete chunks for docs that were removed at source.

Two properties make a pipeline production-grade:

- **Freshness — the update strategy.** *Batch* (rebuild nightly) is simplest but data is up to a day stale. *Incremental* (process only changed docs) is cheaper and fresher. *Event-driven* (a doc update triggers immediate re-embed) is freshest, for when minutes matter. Pick based on the freshness requirement you got in [clarification](clarify-requirements.md).
- **Correctness — idempotency + monitoring.** Re-running must be safe (idempotent upserts, dead-letter queue for failed docs, retries). Monitor row counts, embedding failures, and freshness lag, because a silently broken pipeline degrades answers with no error visible on the online side.

## Worked example: keeping a policy index fresh

HR-policy RAG: 8,000 docs, policies change weekly, occasional urgent mid-week updates.

- **Baseline:** nightly *incremental* run — diff the source, reprocess only the ~20 changed docs (extract → parse → chunk with `doc_id` + `version` metadata → embed → upsert by `chunk_id`). Cheap, keeps data ≤ 1 day stale.
- **Urgent updates:** an *event-driven* hook — when a policy is edited in the CMS, fire a job that re-embeds just that doc within minutes. Best of both: cheap steady-state, fast when it matters.
- **Correctness:** upsert by `chunk_id` so re-running never duplicates; delete chunks whose `doc_id` no longer exists at source; alert if the nightly run processes 0 docs (a sign the source connection broke).

The metadata (`doc_id`, `version`, `date`) does double duty: it powers idempotent upserts *and* lets the online side cite the source and filter out expired policies.

## How a company uses this

> **A Dubai government-services portal** ran a citizen-info assistant whose answers slowly drifted wrong over a month — not because of the model, but because the **nightly pipeline had silently failed** after a source-schema change, so the index froze while the real content kept updating. No online error fired; retrieval just returned increasingly stale chunks. The fix was pure pipeline hygiene: a **freshness-lag metric** (alert if newest indexed doc is > 48h old), **idempotent, keyed upserts** so recovery re-runs cleanly, a **dead-letter queue** for docs that fail parsing, and a move to **incremental + event-driven** so urgent regulatory changes propagated in minutes, not a day. At their scale (tens of thousands of docs, updated continuously) the pipeline *was* the reliability story — the online path had been fine all along. This is why interviewers probe it.

## Common mistakes
- **Only designing the online path.** Forgetting how the index is built and refreshed leaves half the system undesigned — and it's the half that rots silently.
- **Non-idempotent writes.** Re-running the pipeline creates duplicate chunks that pollute retrieval. Always upsert by a stable ID.
- **No freshness monitoring.** A dead pipeline shows *no* online error while answers quietly go stale. Alert on freshness lag and processed-count.
- **One-size update strategy.** Nightly batch is fine for slow data and terrible for minute-fresh data. Match the strategy (batch / incremental / event-driven) to the requirement.

## Interview tip
Bring it up unprompted: *"Alongside the online path I'd design the ingestion pipeline separately — extract, parse, chunk with metadata, embed, upsert idempotently by chunk ID. For freshness I'd go incremental nightly plus an event-driven hook for urgent updates, and I'd monitor freshness lag because a silently dead pipeline degrades answers with no visible error."* Volunteering the offline pipeline — and calling out idempotency and freshness monitoring — signals you know an AI system is two subsystems, not one. It ties directly to the [doc-processing pipeline](design-a-doc-processing-pipeline-at-scale.md) example and the [failure modes](failure-mode-analysis.md) a stale index creates.
