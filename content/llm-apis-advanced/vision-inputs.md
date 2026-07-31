# Vision inputs

**What it is:** Sending **images** to a multimodal model alongside your text, so it can *see* — read a document photo, describe a scene, extract a table from a screenshot, or answer questions about a chart.

## Why it matters for an AI Engineer

A huge amount of real business data isn't clean text — it's scanned invoices, ID cards, damage photos, screenshots, receipts, whiteboard pictures, and PDFs full of tables. Vision-capable models let you skip the old, brittle OCR-plus-rules pipeline and just *ask the model what's in the image*. For an AI Engineer this unlocks document-understanding, visual QA, and multimodal RAG. In Dubai specifically — where documents mix Arabic and English and arrive as phone photos — a model that reads images directly is enormously practical. Interviewers increasingly expect you to know that "multimodal" isn't a special product; it's just another content block in the same [messages array](/working-with-llm-apis/messages-roles).

## The mechanism — how it works

An image is just another **content part** inside a user message. Instead of `content` being a string, it becomes a *list* of parts — some `text`, some `image`. You supply the image two ways:

- **URL** — a link the provider fetches.
- **Base64 data URL** — you read the file, base64-encode it, and inline it (needed for private/local images).

Under the hood the model **tokenizes the image into visual tokens** — a tiled grid whose count depends on resolution. This matters for cost: a high-res image can cost as much as *hundreds to a couple thousand* input tokens (see [Usage & token counting](/working-with-llm-apis/usage-token-counting)). Most APIs let you pick a **detail level** (`low` = cheap, fixed small token cost; `high` = more tiles, better for fine text). You can send **multiple images** in one message (e.g. front and back of an ID).

What it's great at: reading text in images (OCR-like), describing scenes, extracting structured data from documents, reasoning about charts. What it's weak at: precise pixel coordinates, tiny dense text at low detail, and counting many small objects.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🖼️ invoice.jpg</span>
    <span class="dbox gray">💬 "extract total + date"</span>
    <span class="darr">→</span>
    <span class="dbox purple">🧠 vision model<span class="sub">image → visual tokens</span></span>
    <span class="darr">→</span>
    <span class="dbox green">✅ {"total": 4200, "date": "2026-03-01"}</span>
  </div>
  <div class="dcap">Image + text go in the same message; the model reads the image and returns structured data.</div>
</div>

## Concrete example

```python
import base64
from openai import OpenAI
client = OpenAI()

with open("invoice.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

resp = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Extract the total amount and invoice date as JSON."},
            {"type": "image_url",
             "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"}},
        ],
    }],
)
print(resp.choices[0].message.content)   # {"total_aed": 4200, "date": "2026-03-01"}
```

Anthropic uses the same idea with an `image` content block carrying `source: {type: "base64", media_type, data}`.

## How a company uses this

A Dubai logistics company processes thousands of **proof-of-delivery photos** and handwritten delivery notes daily. **Production reality:** they send each photo with a prompt asking for `{recipient_name, timestamp, signature_present}` as structured output, replacing a fragile OCR + template pipeline that failed on rotated or low-light phone photos. Costs are controlled by using `detail: "low"` for simple presence checks and `high` only when reading handwritten text. They pre-resize images to ~1024px on the long edge before sending — larger images cost more visual tokens with no accuracy gain — and combine vision with [JSON mode](/working-with-llm-apis/json-mode) so results drop straight into their database.

## Common mistakes

- **Sending needlessly huge images** — resize first; oversized images just burn visual tokens.
- **Using `detail: low` for fine text** — it downsamples and misses small print; use `high` for documents.
- **Forgetting images count as (often expensive) input tokens** — budget for them.
- **Expecting pixel-perfect localization** — models are unreliable at exact bounding boxes.
- **Not pairing vision with structured output**, then scraping the description with regex — ask for JSON directly.

## Interview tip
Say: *"Vision is just another content part in the user message — text plus an image block, sent as a URL or inline base64. The model tokenizes the image into visual tokens, so cost scales with resolution and I control it with the detail level and by pre-resizing. I pair it with structured outputs so document data lands as clean JSON. It's great at reading and describing images but unreliable at exact coordinates."* That covers cost, mechanism, and limits in one breath.
