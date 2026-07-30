# Sync vs streaming vs async vs batch

**What it is:** the decision of *how the caller waits for the answer* — block until it's done, stream it token-by-token, fire-and-poll later, or process a whole pile of jobs offline overnight.

## Why it matters for an AI Engineer

LLM calls are *slow* — a long generation can take many seconds. How you deliver that latency to the user (or the next system) decides whether your app feels instant or broken, whether it stays up under load, and how much you pay. Pick "synchronous" for a 30-second report generation and the user stares at a frozen spinner (or the request times out). Pick "batch" for a live chat and there is no product. This is a UX-and-reliability decision as much as a technical one, and it comes up whenever an interviewer asks "how would you serve this?"

## The mechanism: four request shapes

The right shape depends on **how long the work takes** and **whether a human is waiting**:

<div class="diagram">
  <div class="flow v">
    <span class="dbox blue">⏳ Sync<span class="sub">wait, get full answer</span></span>
    <span class="dbox green">🌊 Streaming<span class="sub">tokens arrive as generated</span></span>
    <span class="dbox orange">📮 Async<span class="sub">submit → poll / webhook later</span></span>
    <span class="dbox purple">📦 Batch<span class="sub">thousands of jobs, offline</span></span>
  </div>
  <div class="dcap">From "wait for the whole thing" to "come back tomorrow" — pick by wait-time and who's waiting.</div>
</div>

- **Synchronous** — request goes out, connection blocks, full response comes back. Simplest to build. Fine when the response is *fast* (< ~2–3s): classification, short extraction, quick RAG answers. Breaks down for long generations — the user sees a frozen UI and you risk gateway timeouts.
- **Streaming** — the model sends tokens as it generates them (server-sent events / a stream). The user reads the answer *as it appears*, so **time-to-first-token** (~hundreds of ms) matters more than total time. This is why ChatGPT feels fast despite taking seconds. The default for any **user-facing chat or long text**. Slightly more client work (handle a stream), but transforms perceived latency.
- **Asynchronous** — for work too long to hold a connection (a 30s multi-step agent, a big report): submit the job, get a job ID, and either **poll** for status or receive a **webhook** when done. The user isn't frozen; they get notified. Essential for long-running agents and pipelines.
- **Batch** — you have thousands/millions of *non-urgent* items (embed a whole corpus, classify last month's tickets, generate product descriptions). Submit them as a batch job that runs offline. Providers offer **batch APIs at ~50% discount** because they run it in spare capacity, with turnaround measured in hours. Cheapest per token; useless for anything real-time.

| Shape | Waits how | Reach for it when | Cost note |
|---|---|---|---|
| **Sync** | blocks for full answer | fast responses (<~3s), simple | standard |
| **Streaming** | reads as generated | user-facing chat / long text | standard, best *perceived* speed |
| **Async** | submit → poll/webhook | long jobs (agents, reports) | standard |
| **Batch** | hours, offline | bulk non-urgent work | **~50% cheaper** |

**The two questions that decide it:** *Is a human waiting?* (yes → sync/streaming; no → async/batch) and *How long does it take?* (short → sync; long but interactive → streaming; long and non-interactive → async; huge and non-urgent → batch).

## Worked example: same feature, right shape each

A "generate a market report" feature.

- Naive **sync**: user clicks, browser hangs 40s, request times out at the load balancer's 30s limit → broken.
- Better **async**: click → return a job ID instantly → agent runs in the background → webhook/poll notifies "report ready." UI stays responsive.
- The *chat* part of the same app (asking follow-up questions) uses **streaming** so answers feel instant.
- The nightly job that pre-embeds 500k new documents uses **batch** at half price — nobody's waiting on it.

One app, all four shapes, each matched to its wait profile.

## How a company uses this

> **A Dubai media company's content platform.** Their editor-facing **chat** assistant *streams* — first token in ~400ms, so writers see text flowing immediately even on long drafts (perceived latency is what retention depends on). "Generate a full SEO article" is *async* — it's a multi-step agent taking ~45s, so it returns a job ID and pushes a notification when done, keeping the UI unblocked and dodging gateway timeouts. And every night they re-embed the day's new articles and re-tag the archive via the **batch API at ~50% off** — no human waits, so they trade hours of turnaround for half the cost. Choosing per-feature (not one blanket shape) is the senior decision; forcing the report through sync was the exact bug that took the first version down under load.

## Common mistakes
- **Sync for long generations.** The classic outage: a slow call holds a connection past the gateway timeout and the request dies. Long work → async.
- **Not streaming user-facing chat.** A correct answer that appears all-at-once after 6 seconds *feels* broken; the same answer streamed feels instant. Streaming is near-free UX.
- **Real-time API for bulk work.** Embedding a whole corpus through the standard endpoint when the batch API would do it at half price — pure wasted money.
- **Polling too aggressively.** For async, hammering a status endpoint every 100ms wastes resources; use webhooks or sensible back-off.
- **Confusing async with streaming.** Streaming = one response delivered progressively while you wait. Async = you *stop* waiting and get told later. Different problems.

## Interview tip
Say: *"I pick by two questions: is a human waiting, and how long does it take. Fast and interactive → sync. Long but interactive, like chat → streaming, because time-to-first-token is what makes it feel instant. Long and non-interactive, like a report or a multi-step agent → async with a job ID and webhook, so nothing times out. Bulk and non-urgent → the batch API for ~50% off. A single app usually mixes all four."* This shows you treat latency as a product and reliability decision, not just a number. Latency budgets get deeper in [Latency & Reliability Engineering](../latency-reliability-engineering.md).
