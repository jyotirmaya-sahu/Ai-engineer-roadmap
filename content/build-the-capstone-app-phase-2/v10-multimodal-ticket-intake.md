# v10 · Multimodal Ticket Intake

**What you'll build:** a customer can attach a product photo, a PDF receipt, or a voice note. HelpDesk extracts useful evidence, shows progress, and attaches the result to a structured support ticket.

## Why this version

Support problems are often easier to show than describe. A cracked screen needs a photo; a warranty claim needs a receipt; a customer on the move may send audio. Multimodal input reduces friction, but it also introduces large files, unsupported formats, slow processing, privacy risk, and new failure states. This version teaches the whole intake boundary rather than only the happy API call.

## The mechanism

The browser uploads a file to your backend with `multipart/form-data`. Your server checks size, MIME type, and file signature before storing it in private object storage. It then chooses a processor: vision for images, text extraction for PDFs, or transcription for audio. The normalized evidence becomes plain text plus a private file reference that the ticket can use.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">photo · PDF · voice</span><span class="darr">→</span><span class="dbox orange">validate + private storage</span><span class="darr">→</span><span class="dbox purple">vision · parser · transcription</span><span class="darr">→</span><span class="dbox blue">normalized evidence</span><span class="darr">→</span><span class="dbox green">ticket draft</span>
  </div>
  <div class="dcap">Every modality crosses the same validation boundary and leaves as a common evidence shape.</div>
</div>

## Concrete implementation

```python
from fastapi import UploadFile, HTTPException

MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "application/pdf", "audio/webm"}

async def accept_evidence(ticket_id: UUID, file: UploadFile,
                          tenant: TenantContext, db):
    await require_owned_ticket(ticket_id, tenant, db)
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Unsupported evidence type")
    uploaded = await stream_to_quarantine(
        file, byte_limit=MAX_BYTES,
        object_prefix=f"{tenant.organization_id}/{ticket_id}/",
    )
    verify_signature_and_complexity(uploaded)
    await malware_scan(uploaded)
    async with db.transaction():
        evidence = await insert_evidence(db, tenant, ticket_id, uploaded)
        workflow = await enqueue_unique_job(
            db, tenant, kind="process_evidence", evidence_id=evidence.id
        )
    return JSONResponse(status_code=202, content={
        "evidence_id": str(evidence.id), "workflow_id": str(workflow.id)
    })
```

The reverse proxy rejects oversized bodies before FastAPI. Streaming counts bytes and hashes content without buffering the whole file. Complexity checks cap PDF pages, image pixels, audio duration, archive depth, and decompressed size; risky parsers run sandboxed. Objects use random tenant-scoped keys, private encryption, short-lived authorized preview URLs, and deletion cascades. The worker—not the HTTP request—claims the durable v8.1 job, moves clean content out of quarantine, processes it, and writes reconnectable SSE events. Reconciliation deletes aborted or orphaned uploads.

For an image, send a short task-specific instruction: identify visible damage, packaging condition, and readable labels; do not guess hidden causes. For audio, transcribe first and show the transcript so the user can correct names or order numbers. For PDFs, extract text locally when possible and use the Files API only when the provider must access the original layout.

Expose processing updates over the SSE pattern learned earlier: `uploaded`, `validating`, `analyzing`, and `ready`. Do not stream private extracted text into application logs. Store provider file IDs with an expiry policy and delete them when the ticket retention period ends.

## How a company uses this

A Dubai retailer may receive thousands of return requests during a sale. Automated intake can pre-fill the damage category and receipt fields, cutting handle time, while a human still approves refunds. Track processing success by MIME type, p95 analysis latency, correction rate, and cost per attachment. Route low-confidence or contradictory evidence to manual review rather than pretending certainty.

## Common mistakes

- Trusting the filename or browser-supplied MIME type without checking file bytes.
- Making uploaded evidence publicly readable.
- Sending a whole long video when sampled frames would be safer and cheaper.
- Treating visual interpretation as proof of fraud or fault.
- Hiding the transcript so users cannot correct transcription errors.

## Interview tip

Describe the normalization layer: every input becomes `{kind, storage_key, extracted_text, confidence, warnings}`. The ticket workflow consumes that stable contract instead of knowing every provider-specific format.

## Practice — assignments

1. Accept a JPEG and show a damage summary beside its preview.
2. Reject an oversized or falsely labelled upload.
3. Transcribe a voice note and let the customer edit the transcript.
4. Extract receipt fields from a PDF into the ticket draft.
5. Stream processing states to the browser with SSE.
6. Delete stored evidence when its ticket is deleted.
7. Route low-confidence extraction to manual review.
