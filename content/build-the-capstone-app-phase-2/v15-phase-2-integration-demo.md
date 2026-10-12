# v15 · Phase 2 Integration & Demo

**What you'll build:** one coherent release that connects the Phase 2 capabilities, proves their failure behavior, and presents the system as a portfolio case study rather than seven disconnected experiments.

## Why this version

Features working alone do not guarantee a working product. Tool calls may bypass your retry policy; a voice transcript may not reach ticket search; fallback mode may accidentally retain write access. Integration is where those seams fail. The final version makes the entire customer journey observable, tested, and explainable.

## The end-to-end story

Use one repeatable scenario. A signed-in customer reports that order `DXB-1042` arrived damaged, attaches a photo, and sends a voice explanation. HelpDesk transcribes the audio and analyzes the image concurrently, checks the order through the authorized tool, finds similar solved tickets, and drafts a structured ticket. The UI shows sources and processing states instead of hiding the work.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">customer evidence</span><span class="darr">→</span><span class="dbox purple">multimodal analysis</span><span class="darr">→</span><span class="dbox orange">authorized tools</span><span class="darr">→</span><span class="dbox blue">similar cases</span><span class="darr">→</span><span class="dbox green">reviewed ticket</span>
  </div>
  <div class="dcap">The demo follows one user outcome through every layer; architecture exists to support the journey.</div>
</div>

## Integration contract

Give the workflow a stable `trace_id`. Every log and metric includes that ID, the feature name, model, prompt version, latency, token counts, cache use, and outcome—but never raw private evidence. Persist a workflow record with explicit states such as `received`, `analyzing`, `awaiting_review`, `submitted`, and `failed`.

```python
class TicketWorkflow(BaseModel):
    trace_id: UUID
    status: Literal[
        "received", "analyzing", "awaiting_review", "submitted", "failed"
    ]
    order_result: OrderResult | None = None
    evidence: list[EvidenceResult] = []
    similar_ticket_ids: list[int] = []
    draft: TicketDraft | None = None
    warnings: list[str] = []
```

Do not hide partial failure. If transcription fails but image analysis succeeds, preserve the image result, display the warning, and let the customer type the missing description. Only submit after the user reviews the structured draft. Use an idempotency key so double-clicking Submit cannot create two tickets.

## Verification

Build automated tests at three levels. Unit tests cover argument validation, retry classification, vector-result filtering, and provider routing. Integration tests use fake provider responses and a test database to verify the workflow. One browser test performs the complete upload-to-ticket journey.

Then run failure drills: return `429` twice before success; time out image analysis; corrupt a batch row; make Redis unavailable; open the primary-provider circuit; attempt cross-user order access; and double-submit a ticket. Capture the expected UI behavior for each. Add a small load test and record p50/p95 latency, error rate, and cost per completed ticket.

## Portfolio presentation

Your README should lead with the customer problem and a 60–90 second demo GIF. Include an architecture diagram, feature table, local setup, environment-variable names without values, security decisions, evaluation results, failure-handling table, cost/latency measurements, and the version progression from v1 to v15. Link to the deployed UI and a sanitized observability screenshot.

## How a company uses this

A team would release this behind a feature flag, start with internal agents, then expose it to a small percentage of customers. Product metrics include completion rate, time to ticket, agent correction rate, deflection rate, and customer satisfaction. Engineering metrics include p95 latency, provider failure rate, fallback activation, tool denials, and cost per resolved contact. Roll back if customer or safety metrics worsen.

## Common mistakes

- Creating a feature montage instead of one believable customer flow.
- Logging raw uploads, transcripts, or tool payloads.
- Testing only successful provider responses.
- Letting fallback mode execute state-changing tools.
- Publishing screenshots without reproducible metrics or setup instructions.

## Interview tip

Tell the story as decisions and evidence: why each feature exists, its trust boundary, its principal failure mode, and the metric proving it works. Invite the interviewer to inspect the version tags.

## Practice — assignments

1. Complete the photo-and-voice damaged-order flow in a browser.
2. Propagate one trace ID through every service boundary.
3. Automate the critical unit, integration, and browser tests.
4. Run every listed failure drill and record the result.
5. Measure latency, error rate, and cost for 100 test workflows.
6. Produce the demo GIF and architecture diagram.
7. Tag `v15`, deploy it behind a feature flag, and rehearse a five-minute project walkthrough.
