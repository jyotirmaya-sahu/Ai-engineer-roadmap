# Vision LLMs / VLMs

**What it is:** a single language model that also *sees* — you send it an image plus a text prompt and it reasons over both to answer in words.

## Why it matters for an AI Engineer

A plain [image classifier](./image-understanding.md) answers a fixed question ("is this a cat?"). A **Vision LLM (VLM)** answers *any* question about the image, in natural language, with reasoning: "Which item in this fridge photo expires soonest?", "Is this receipt total correct given the line items?", "Debug this error screenshot." That flexibility is why VLMs are the backbone of modern multimodal apps — screenshot understanding, visual Q&A, UI automation, document reasoning. As an AI Engineer, a VLM is your Swiss-army knife: when you don't want to train a specialist, you send the picture to a VLM and ask. The cost is real (per-image and per-token), so knowing *how* it works lets you control the bill.

## The mechanism / how it works

A VLM stitches a **vision encoder** onto a **language model**:

1. **Image → patches → tokens.** The image is cut into a grid of small patches. A vision encoder (a ViT, often CLIP-style) turns each patch into a vector.
2. **Projection.** A small "connector" network maps those image vectors into the **same space the LLM's text tokens live in** — literally turning the image into a sequence of "visual tokens" the language model can read as if they were words.
3. **Fused reasoning.** The LLM now sees one combined sequence: `[visual tokens][your text prompt]`. It attends across both and generates a text answer. The language model's full reasoning ability is applied to image content.

The crucial cost insight: **images become tokens, and tokens cost money.** A high-resolution image can expand into hundreds or thousands of tokens. Providers tile large images (e.g. 512×512 tiles), and each tile adds tokens. So a "detail: high" image can cost as much as a page of text. Sending images at unnecessary resolution is the #1 way to blow a VLM budget.

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🖼️ Image</span>
    <span class="darr">→<span class="lbl">patches</span></span>
    <span class="dbox orange">🔢 visual tokens</span>
    <span class="dbox gray">💬 text prompt</span>
    <span class="darr">→<span class="lbl">same sequence</span></span>
    <span class="dbox purple">🧠 LLM reasons over both</span>
    <span class="darr">→</span>
    <span class="dbox green">📝 text answer</span>
  </div>
  <div class="dcap">The image is projected into visual tokens and read by the LLM alongside the prompt.</div>
</div>

## Concrete example

Ask a question about an image (OpenAI, 2026 API):

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's the total, and does it match the line items?"},
            {"type": "image_url",
             "image_url": {"url": "https://example.com/receipt.jpg", "detail": "high"}},
        ],
    }],
)
print(resp.choices[0].message.content)
```

You can pass a base64 image instead of a URL, and `detail: "low"` to force a cheap ~85-token single-tile read when you don't need fine print.

## How a company uses this

> A **Dubai retail chain** built a shelf-audit tool. Store staff photograph a shelf; a VLM answers "which products are out of stock, and are any misplaced vs the planogram?" in one call. Scale: ~5,000 shelf photos/day. Each high-detail photo costs ~$0.01–0.02 in tokens, so ~$75–100/day — acceptable because it replaces a manual audit. Their key optimization: **downscale photos to the minimum resolution where text is still legible** before sending. Blindly uploading 12-megapixel phone photos at "high" detail *tripled* the token cost for zero accuracy gain. They also learned VLMs **hallucinate confident wrong counts** on cluttered shelves, so anything driving a reorder decision gets a confidence check and human spot-audit.

## Common mistakes / misconceptions

- **Sending full-resolution phone photos.** Downscale first; match resolution to the smallest legible size. This is the biggest cost lever.
- **Trusting exact counts/coordinates.** VLMs are great at *description*, shaky at precise counting and pixel-accurate localization. Use a detector for that.
- **Forgetting they hallucinate.** A VLM will confidently describe text or objects that aren't there. Validate anything consequential.
- **Using a VLM where a classifier fits.** For a fixed label at massive scale, the cheap specialist wins.

## Interview tip
Say: *"A VLM projects image patches into visual tokens the LLM reads alongside the prompt — so images literally cost tokens, and resolution is my main cost lever. VLMs excel at open-ended visual reasoning but are unreliable at exact counting and localization, where I'd use a dedicated detector, and they hallucinate, so consequential outputs get validated."* The token-cost and hallucination points show you've run one at scale.
