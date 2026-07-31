# Files API

**What it is:** An endpoint to **upload a file once, get back an ID, and then reference it by that ID** in later requests — instead of inlining the file's bytes into every call.

## Why it matters for an AI Engineer

Some things don't belong inline. A [Batch](batch-api.md) job's JSONL, a large PDF you'll ask several questions about, a fine-tuning dataset, or an image reused across requests — re-sending the raw bytes every time is slow, wasteful, and sometimes over the request size limit. The Files API is the plumbing that makes batch jobs, document workflows, and fine-tuning possible. It's not glamorous, but every serious pipeline touches it, and interviewers like to see that you know files are *uploaded and referenced*, not pasted, for these workflows.

## The mechanism — how it works

The lifecycle is simple:

1. **Upload** the file with a **`purpose`** — a required tag telling the provider what it's for (`batch`, `fine-tune`, `assistants`/`user_data`, `vision`, etc.). The purpose determines what validation runs and where the file can be used.
2. **Get a file ID** back (like `file-abc123`).
3. **Reference the ID** in other API calls — as a batch's `input_file_id`, a fine-tuning `training_file`, or an attachment in a message.
4. **Retrieve, list, or delete** files, and **download** output files (batch results, etc.) by ID.

Files are stored on the provider's side, subject to size limits and retention policies. You manage them like any resource: create, list, get, delete. Providers differ in details — OpenAI has a general `files` endpoint with purposes; Anthropic has a Files API for reusing documents/images across requests — but the pattern (upload → ID → reference) is the same.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">📄 report.pdf</span>
    <span class="darr">→<span class="lbl">upload (purpose)</span></span>
    <span class="dbox blue">🗄️ file-abc123<span class="sub">stored, gets an ID</span></span>
    <span class="darr">→<span class="lbl">reference by ID</span></span>
    <span class="dbox purple">🧠 use in batch / chat / fine-tune</span>
  </div>
  <div class="dcap">Upload once, reference many times by ID — no re-sending bytes per request.</div>
</div>

## Concrete example

```python
from openai import OpenAI
client = OpenAI()

# Upload a batch input file and use its ID (ties into the Batch API)
f = client.files.create(file=open("batch.jsonl", "rb"), purpose="batch")
print(f.id)                      # file-abc123

job = client.batches.create(
    input_file_id=f.id,          # reference by ID, not by re-uploading bytes
    endpoint="/v1/chat/completions",
    completion_window="24h",
)

# Housekeeping
for meta in client.files.list().data[:3]:
    print(meta.id, meta.purpose, meta.bytes)
# When done, clean up:
client.files.delete(f.id)
```

For fine-tuning you'd upload with `purpose="fine-tune"`; for a document you'll query repeatedly, upload once and attach its ID to each message instead of inlining the PDF every time.

## How a company uses this

A Dubai consultancy builds a tool where analysts upload a **long due-diligence PDF once** and then ask dozens of questions about it over a session. **Production reality:** inlining a 200-page PDF's text into every one of 30 questions would re-send tens of thousands of tokens per question — huge cost and latency. Instead they upload the document via the Files API once, reference its ID per question, and combine that with [prompt caching](prompt-caching.md) so the document is read cheaply on repeat calls. For their nightly analytics they also upload [Batch](batch-api.md) JSONL files this way and delete them after downloading results, keeping storage tidy and within retention limits.

## Common mistakes

- **Wrong `purpose`** — a file uploaded for `fine-tune` won't work in a `batch` job; the purpose gates usage.
- **Re-uploading the same file repeatedly** instead of reusing its ID — defeats the point.
- **Never deleting** — files accumulate and can hit account storage limits; clean up after use.
- **Assuming files live forever** — retention policies can expire them; don't treat the Files API as permanent storage.
- **Confusing it with an embeddings/vector store** — Files API just stores raw files; it doesn't make them searchable.

## Interview tip
Say: *"The Files API is upload-once-reference-by-ID. It's required plumbing for Batch input/output files and fine-tuning datasets, and it lets me reuse a large document across many requests instead of re-inlining its bytes. Each upload carries a purpose that gates where it can be used, and I delete files after use to stay under storage and retention limits."* Knowing purpose-gating and cleanup shows you've actually used it, not just read about it.
